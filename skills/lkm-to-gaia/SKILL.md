---
name: lkm-to-gaia
description: Convert LKM evidence-chain payloads directly into a Gaia DSL knowledge package. Two modes — `batch` (emit a fresh standalone `<name>-gaia/` package directory ready for `gaia compile`) and `incremental` (emit a Python source fragment to merge into an existing `plan.gaia.py`). Agent reads raw LKM evidence JSON + the orchestrator's `contradictions.md` flag file, performs semantic analysis (shared-premise dedup, upstream support, contradiction promotion from both discovery flags and upstream search findings), and writes Gaia DSL source directly. No intermediate JSON format. Domain-agnostic.
---

# LKM-to-Gaia

> **Prerequisite — read `$gaia-lang` and `$gaia-cli` first.** This skill assumes
> the language reference (Gaia DSL primitives, signatures, kwargs/positional
> conventions, label grammar, Cromwell bounds, citation rules, `__all__` /
> module organization rules) and the CLI reference (`pyproject.toml` shape,
> `priors.py` shape, `gaia compile` / `gaia check` / `gaia infer` workflow).
> Anything about *what Gaia DSL is* lives there. This skill documents only
> what is unique to it: how an agent reads LKM evidence and writes Gaia DSL.

## Role

This is the fifth peer in the `gaia-lkm-skills` family. Where `$scholarly-synthesis` turns LKM evidence into prose, this skill turns the same input into **executable Gaia DSL** — a knowledge package that compiles via `gaia compile`, propagates beliefs via `gaia infer`, and carries LKM provenance into `**metadata` kwargs of every claim.

```
discovery -> $evidence-subgraph (raw LKM evidence JSON)
                                |
                        +-------+-------+
                        v               v
              $scholarly-synthesis   $lkm-to-gaia   <-- THIS SKILL
                  (prose article)    (Gaia package)
```

Routed via [`$evidence-graph-synthesis`](../evidence-graph-synthesis/SKILL.md) when the user asks for a "Gaia package", "Gaia DSL", "knowledge package", or "formalized into Gaia".

## Input (received from orchestrator)

- **Raw LKM evidence JSON** (from `$lkm-api`) for each selected root claim — the `GET /claims/{id}/evidence` response, containing `data.claim`, `data.evidence_chains[].factors[]`, and `data.papers`.
- **Raw LKM match JSON** (from `$lkm-api`) — the `POST /claims/match` response, providing the full candidate set (`data.variables`) and `data.papers` for all candidates.
- **`contradictions.md`** (from the orchestrator's Step 2b) — flag list of contradiction candidates.
- **`candidates.md`** (from the orchestrator's Step 3) — the user's root selection.

These are loose files — **no formal schema, no run-folder contract, no `evidence-graph-run/2.0`**. The agent reads them directly.

## Two-mode contract

### Mode `batch`

**Input:** the files listed above, for one or more selected roots.

**Output:** a fresh standalone `<name>-gaia/` directory ready for `gaia compile`. The agent creates:
- `__init__.py` — re-exports all modules, declares `__all__`
- `paper_<key>.py` — one module per paper, containing its claims + deductions
- `cross_paper.py` — cross-paper operators (equivalence, contradiction, induction)
- `priors.py` — `PRIORS = {leaf_claim: (float, "justification.")}` per `$gaia-cli` §6
- `references.json` — CSL-JSON bibliography built from `data.papers`
- `pyproject.toml` — per `$gaia-cli` §1
- `artifacts/lkm-discovery/` — verbatim copy of input files (raw JSON + `.md` flag files) for provenance

After emit, the agent (or user) runs:

```bash
cd <name>-gaia/
gaia compile .          # produce .gaia/ir.json
gaia check --brief .    # verify structure
gaia check --hole .     # confirm every leaf has a prior in priors.py
gaia infer .            # run BP
```

The skill does NOT run `gaia infer`; that is a follow-up step the caller decides.

### Mode `incremental`

**Input:** same as batch + a path to an existing `plan.gaia.py` + an `existingAnchors` map from the host runtime (typically obtained via `gaia.inquiry.anchor.find_anchors`).

**Output:** a Python source fragment. The agent appends it to `plan.gaia.py` without re-declaring imports and without breaking existing claim definitions. Labels that match `existingAnchors` are reused. `priors.py` and `references.json` are updated by the host, not by this skill.

## Core mapping rules

The agent reads the LKM evidence JSON and writes Gaia DSL, applying these rules:

### 1. Claims

Every distinct `gcn_*` claim (post shared-premise extraction) → one `claim(...)` per `$gaia-lang` §2.

**Self-contained check (MANDATORY).** Before writing a claim, verify it can be judged true or false **without referring back to the evidence chain**. LKM claims often omit critical context — the reader cannot tell what system, method, quantity, or conditions the claim is about. If the claim is not self-contained, **rewrite it** to include the missing information extracted from the evidence chain (steps, premises, paper metadata). Save the original LKM text in metadata:

```python
<label> = claim(
    "<self-contained content with explicit system, method, values>",
    lkm_id="gcn_xxx",
    source_paper="paper:xxx",
    provenance_source="lkm",
    lkm_original="<verbatim LKM claim text>",   # for traceability
)
```

- **No `prior` kwarg on claims.** After `gaia compile`, run `gaia check --hole` to surface which leaf claims need priors, then assign them in `priors.py`. LKM's `score` field is match relevance, not a prior — do not use it as one.
- When two claims are merged into one: `lkm_ids=["gcn_a", "gcn_b"]`.
- Empty content → placeholder string + `todo="revisit when LKM populates this premise"` in metadata.

### 1a. Decompose compound claims

When an LKM claim C has the form **"method/source M₁ says X; method/source M₂ says Y; they agree/conflict"** — whether M₁ and M₂ are two theories, theory vs experiment, or two experiments — do NOT emit a single `claim(C)`. Decompose:

**If M₁ and M₂ conflict:**
```python
A = claim("<M₁'s prediction/observation>", ...)
B = claim("<M₂'s prediction/observation>", ...)
D = contradiction(A, B, reason="...", prior=...)   # the conflict
```

**If M₁ and M₂ agree:**
```python
A = claim("<M₁'s prediction/observation>", ...)
B = claim("<M₂'s prediction/observation>", ...)
D = equivalence(A, B, reason="...", prior=...)
```

Examples:
- GGA band gap vs experimental band gap (theory vs experiment)
- HSE06 band gap vs GW band gap (theory vs theory)
- ARPES gap vs transport gap (experiment vs experiment)

This turns one opaque meta-claim into two testable atomic claims + one explicit relation. BP independently weighs evidence for A and B, and for the relation between them.

### 2. Factors → Deduction

Every `gfac_*` factor → `deduction([premises], conclusion, reason="<markdown>", prior=0.95)` (positional-first). The `reason` is the full LKM evidence, formatted as a **numbered markdown list** — one numbered item per `factors[].steps[]` entry from the LKM JSON, preserving the step order:

```
1. State the realistic Hamiltonian considered for experimental relevance:
   H = H_coulomb^intra + H_coulomb^inter + U_0^inter V_0^inter + U_1^inter V_1^inter,
   with U_0^inter=-0.4, U_1^inter=0.6 (Fig. 2).
2. Report the numerical stabilizability: ED of this Hamiltonian produces a robust
   6-fold GSD phase with a sizable many-body gap (Fig. 2(a)-(b)).
3. Define the dimensionless ratios: g_1 ≡ V_1^inter/V_1^intra,
   g_2 ≡ V_1^inter/V_0^inter.
...
```

`prior=0.95` is included for backward compatibility with Gaia versions that still enforce reason↔prior pairing; once Gaia #494 lands the default is 0.999.

### 3. Upstream support for premises

During formalization, the agent searches LKM for upstream conclusions relevant to each premise. A single premise may have **multiple** upstream conclusions — each gets its own `support(...)` call:

```python
support([U_1], P, reason="...", prior=<float>)
support([U_2], P, reason="...", prior=<float>)
# ... 等
```

`support([a], b, prior=p)` is directional: a 充分支撑 b。p close to 1 → a 几乎充分决定 b。

Warrant prior reflects how strongly the upstream corroborates the premise:
- Strong (same topic, directly implies) → 0.85–0.95
- Moderate (related, partially overlaps) → 0.70–0.85
- Weak/lateral → 0.50–0.65

**No equivalence needed here.** Two upstream claims that both strongly support the same premise naturally converge in BP through their shared conclusion. The agent just writes separate `support()` edges.

### 4. Contradiction

**Definition:** Two claims A and B form a contradiction when they **logically cannot both be true** — accepting A forces rejection of B, and vice versa. This is not about different boundary conditions, sample quality, or measurement protocols. It is a logical incompatibility: the truth of A excludes the truth of B. Every such contradiction hints at an **open problem** in the knowledge system — either one claim is wrong, or the framework that makes them appear incompatible is incomplete.

**Finding contradictions is more important than finding supports.** A resolved support makes the graph slightly more confident. A discovered contradiction reveals where knowledge is broken.

**Signal:** the agent MUST flag a contradiction when:
- Two claims assert mutually exclusive values for the same quantity (e.g. "gap = 2.5 eV" vs "gap = 4.0 eV" for the same material under the same conditions)
- Two claims assert opposite signs or directions for the same effect
- A theoretical prediction and an experimental observation for the same system disagree beyond experimental error bars
- Two theoretical methods (e.g. PBE vs GW) predict qualitatively different outcomes for the same system

**Not a contradiction:**
- Different results explained by different boundary conditions (temperature, pressure, doping, sample quality) — these can both be true under their respective conditions
- Different measurement techniques giving slightly different values within error bars

**Two sources:**

**Source A — Orchestrator flag files** (`contradictions.md` from discovery Step 2b).

**Source B — Upstream search (step 5b).** Check each pair of claims in `new_conclusions` against each other and against existing claims in the graph.

For each contradiction:
```python
contradiction(A, B, prior=<float>,
    reason="<why A and B cannot both be true> | new_question: <what open problem does this reveal?>")
```
Plus:
```bash
gaia inquiry obligation add <qid> -c "resolve contradiction: <new_question>"
```

Prior:
- Experiment vs theory on the same quantity → 0.90–0.95
- Direct conflict on the same quantity (same paradigm) → 0.85–0.90
- Different boundary conditions may explain it → 0.50–0.60 (likely false alarm)
- Unclear → 0.50

**Avoid echo chambers.** When BP resolves a contradiction strongly in one direction (one side belief > 0.95, other < 0.1), the graph may be overconfident. Search for evidence supporting the **weak side** before accepting the resolution.

### 5. `data.papers` → `references.json`

Every paper in the union of `data.papers` across all evidence + match files → one CSL-JSON record. Key: `<firstAuthorSurname><year>`, deduped by suffix letters (`An2001`, `An2001a`, …). Cite via `[@<key>]` in claim content or strategy reasons.

### 7. Module placement

- Claims go in the module of the **first paper** they appear in (paper id alphabetical tie-break).
- `gfac_*` deductions go in the module of `factor.source_package`.
- Cross-paper operators (`support`, `contradiction`, `induction`) go in `cross_paper.py`.
- `__init__.py` re-exports via `from .paper_<key> import *` and `from .cross_paper import *`, then declares `__all__` (selected root claims only).

## Shared-premise extraction (avoiding double counting)

Runs before any operator emission, and **again whenever ≥2 supports converge on the same premise**. The agent reads claim contents and checks whether the supporting upstream claims share a common factor or assumption.

1. **Auto-merge** premises with **identical content text** (normalized: trimmed, whitespace-collapsed) → one claim, `lkm_ids=[...]` in `**metadata`.
2. **Auto-merge** same paper, different version (arXiv ↔ published, detected by matching DOI/author/title) → one claim.
3. **Extract shared factor.** When ≥2 upstream supports converge on the same premise P, check whether those upstream claims share a common factor (same method, same model assumption, same dataset, same physical approximation). If so, extract it as a new `claim(shared_factor, prior=...)` and route the supports through it:

   ```
   Before:  U1 ──support──→ P
            U2 ──support──→ P     ← BP treats as independent → double counting

   After:   U1 ──support──→ shared_factor ←──support── U2
                                    │
                                 support
                                    │
                                    ▼
                                    P
   ```

4. **Keep distinct** when supports are genuinely independent (different methods, different labs, different paradigms).
5. **Surface** to `merge_decisions.todo` when the agent can't decide — default: KEEP (safe).

Output: `merge_audit.md` logs every decision for reproducibility.

## Workflow (batch mode)

The exploration is **obligation-driven**: each iteration identifies gaps via `gaia check --hole` and `gaia inquiry review`, marks them as obligations, then picks the most interesting obligation to resolve by searching LKM. Obligations persist across iterations — `gaia inquiry obligation list` is the exploration's TODO list.

```
 ┌─────────────────────────────────────────────────────────────┐
 │                                                             │
 │  1. Bootstrap from root                                     │
 │     claim(root) + claim(premises) + deduction(reason=...)   │
 │     └─ estimate a prior on each premise claim directly      │
 │                                                             │
 │  2. Mark suspicions                                         │
 │     └─ suspicious reasoning chain or premise →              │
 │        gaia inquiry obligation add <qid> -c "..."           │
 │                                                             │
 │  3. gaia compile . && gaia infer .                          │
 │                                                             │
 │  4. gaia check --hole . → which claims need priors?         │
 │     gaia inquiry review . → belief context                  │
 │     └─ Pick the most interesting hole or weakest claim       │
 │        using domain judgment, not mechanical sorting.        │
 │                                                             │
 │  5a. Search: find upstream conclusions → new_conclusions    │
 │      → claim(U) + support([U], P, prior=...)               │
 │                                                             │
 │  5b. Search: contradictions among new_conclusions           │
 │      → contradiction(P, X, prior=...)                       │
 │      → gaia inquiry obligation add <qid> -c "..."           │
 │                                                             │
 │  6. Back to step 2 — inspect new claims, mark suspicions,    │
 │     then compile, review, search. Repeat until:              │
 │     • obligation list is empty                               │
 │     • 0 holes, 0 unreviewed warrants                         │
 │     • (or user-specified goal met)                           │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
```

### Step details

**1. Bootstrap.** For each root claim, load `GET /claims/{id}/evidence`. Write:
- `claim()` for the root and each premise — give each premise a direct prior estimate
- `deduction([premises], root, prior=0.95, reason="<numbered LKM steps>")`

**2. Mark suspicions.** If any reasoning chain or premise looks unreliable, flag it:
```bash
gaia inquiry obligation add <claim_or_strategy_qid> -c "<concern>"
```

**3. Compile & infer.** `gaia compile . && gaia infer .`

**4. Review.** Run `gaia check --hole .` and `gaia inquiry review .`. Use domain judgment to identify:
- Claims that need upstream support but have none → mark as obligation
- Interesting weak points that deserve further exploration → mark as obligation
- Gaps in the graph (e.g. missing method comparisons, missing material classes) → mark as obligation

```bash
gaia inquiry obligation add <qid> -c "<what needs to be found or verified>"
```

Then run `gaia inquiry obligation list` to see all unresolved obligations. **Pick the most interesting one as the next target.** The obligation list is the exploration's TODO — obligations persist across iterations and guide what to explore next.

**5a. Find upstream conclusions.** Search LKM with the chosen claim's content (`POST /claims/match`, top-10). Pick the **conclusion-type claims** that provide independent strong support → `claim(U)` + `support([U], P, prior=...)`. Record them in a list `new_conclusions`.

**5b. Hunt contradictions (MANDATORY).** For each claim in `new_conclusions`, the agent uses **scientific reasoning** to design a search that would surface counter-evidence. This is NOT mechanical text inversion ("PBE underestimates" → "PBE is accurate"). Instead, think:

- *What physical scenario would falsify or challenge this claim?*
- *Under what conditions would the opposite be true?*
- *What alternative mechanism could explain the same observation?*

For example:
- Claim: "PBE underestimates gaps by ~40%" → search for *error cancellation between DFT gap error and exciton binding energy* (the scientific scenario where PBE appears accurate)
- Claim: "GW is the gold standard" → search for *vertex corrections beyond GW, or systematic GW errors for specific material classes*
- Claim: "HSE fixes the gap problem" → search for *materials where HSE fails, or where the optimal mixing fraction deviates far from 25%*

The agent uses the LKM search engine to find content related to these scientifically meaningful falsification scenarios. For each contradiction candidate found: `contradiction(P, X, prior=...)` + `gaia inquiry obligation add <qid> -c "resolve: ..."`.

**6. Repeat.** Back to step 2 — inspect the newly added claims for suspicious reasoning, then compile, review, and continue. Exit when all holes filled, all warrants reviewed, and `gaia inquiry obligation list` is empty.

## Workflow (incremental mode)

Same as batch, except:

- **Steps 4, 7** (package skeleton, `pyproject.toml`, `priors.py`, `references.json`) are the host's job.
- Agent consults `existingAnchors` and reuses labels that match existing claims.
- Agent emits a single Python source fragment + a side-channel `imports.json` listing every new label with its LKM id and prior. The host appends the fragment to `plan.gaia.py`.

## Authentication

This skill makes **no network calls**. All retrieval was already done by `$lkm-api` upstream. No `LKM_ACCESS_KEY` is needed.

## Hand-off

Batch mode hands the `<name>-gaia/` directory back to the user with:
- Compiled IR, inferred beliefs, inquiry review results
- `gaia inquiry obligation list` showing the refinement checklist
- Next step: resolve obligations → update DSL/priors → `gaia compile && gaia infer && gaia inquiry review` (repeat)

Incremental mode hands the source fragment back to the host, which appends to `plan.gaia.py`.

## What this skill is NOT

- **Not a discovery skill.** Discovery is `$evidence-graph-synthesis` + `$lkm-api`. This skill consumes raw evidence JSON + flag files.
- **Not a renderer.** `gaia render` + the publish skill handle presentation. This skill stops at `gaia compile`-ready source.
- **Not a reviewer.** Setting reviewed priors, interpreting BP, identifying weak points are the review skill and `gaia.inquiry.run_review`. This skill emits `TODO:review` markers and stops there.
- **Not a Gaia DSL teacher.** For *what* `claim` / `deduction` / `support` / `equivalence` mean and how to write them, read `$gaia-lang` directly.
- **Not a wrapper for the gaia-discovery loop.** The `/lkm-evidence` slash skill is a separate downstream consumer.

## Reference files

- [`references/mapping-contract.md`](references/mapping-contract.md) — detailed mapping rules and module placement conventions
- [`references/package-skeleton.md`](references/package-skeleton.md) — batch-mode output layout + templates (defers to `$gaia-cli` for `pyproject.toml` and `priors.py` shape)
- [`references/incremental-mode-contract.md`](references/incremental-mode-contract.md) — incremental-mode invariants + `imports.json` schema
