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

### 1a. Refine + decompose root claims

For each root claim from LKM, apply two transformations before writing DSL:

**(1) Refinement — make self-contained.** Ensure the claim can be judged true/false independently. If the LKM text omits system, method, quantity, or conditions, add them from the evidence chain. Save the original LKM text in `lkm_original` metadata.

**(2) Decomposition — break compound claims into atomic propositions.** If the claim is a logical compound of simpler assertions (e.g., "method A predicts X, method B measures Y, they disagree"), decompose it into atomic claims + Gaia operators:

- **If the compound says "M₁ and M₂ conflict":**
  ```python
  A = claim("<M₁'s atomic assertion>", ...)
  B = claim("<M₂'s atomic assertion>", ...)
  D = contradiction(A, B, reason="...", prior=...)
  ```

- **If the compound says "M₁ and M₂ agree":**
  ```python
  A = claim("<M₁'s atomic assertion>", ...)
  B = claim("<M₂'s atomic assertion>", ...)
  D = equivalence(A, B, reason="...", prior=...)
  ```

The original LKM claim C is preserved as a `claim(C, lkm_original=...)`. Link it to the decomposition:
```python
equivalence(C, D, reason="C is the meta-claim that names the contradiction between A and B")
```

**Why decompose:** contradiction hunting (step 5b) needs atomic claims with specific systems, methods, and values. Searching with a compound claim like "theory vs experiment disagreement of ~40%" returns other compound claims, not atomic counter-evidence. Searching with "ScN G₀W₀ gap = X eV" finds claims asserting different values for the same quantity.

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
 │     Load evidence, write claim() + deduction(reason=...)    │
 │                                                             │
 │  2. Refine — make every new claim self-contained             │
 │     Add system, method, values from evidence chain           │
 │                                                             │
 │  3. Decompose — break compound claims into atomic propositions│
 │     claim(A) + claim(B) + contradiction(A,B) or equivalence │
 │                                                             │
 │  4. Hunt contradictions for each new atomic claim            │
 │     → contradiction(P, X, prior=...)                        │
 │     → gaia inquiry obligation add <qid> -c "..."            │
 │                                                             │
 │  5. Mark suspicions on reasoning chains or weak premises     │
 │     → gaia inquiry obligation add <qid> -c "..."            │
 │                                                             │
 │  6. gaia compile . && gaia infer .                          │
 │                                                             │
 │  7. gaia check --hole . → which claims need priors?         │
 │     gaia inquiry review . → belief context                  │
 │     └─ Pick the most interesting obligation as next target   │
 │                                                             │
 │  8. Search: find upstream conclusions for the target claim   │
 │      → claim(U) + support([U], P, prior=...)               │
 │                                                             │
 │  9. Back to step 1 — bootstrap new claims (deduction if      │
 │     evidence chain available), refine, decompose, continue.    │
 │     Repeat until: obligation list empty, 0 holes,             │
 │     0 unreviewed warrants (or user-specified goal met).       │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
```

### Step details

**1. Bootstrap.** For each root claim, load `GET /claims/{id}/evidence`. Write `claim()` for the root and each premise, plus `deduction([premises], conclusion, prior=0.95, reason="<numbered LKM steps>")` for evidence chains.

**2. Refine.** Make every new claim self-contained: add system, method, numerical values, and conditions from the evidence chain. Save the original LKM text in `lkm_original` metadata.

**3. Decompose.** Compound claims that compare two or more sources must be broken into atomic propositions. This is the most complex step — it requires domain judgment.

**Detect.** A claim needs decomposition if it explicitly compares two or more named sources: "method A predicts X, method B measures Y, they disagree". If the comparison is implicit, or the individual assertions can't be cleanly separated, keep the claim as-is.

**Gate: can both sides be made self-contained?** If the evidence chain doesn't provide enough information to write two self-contained atomic claims (explicit system, method, values for both sides), do NOT decompose. A partial decomposition is worse than the original compound claim. Pass through to the next step.

**Extract.** For each side, write an atomic claim with explicit system, method, and value. Every detail in an atomic claim — system, method, numerical value, condition — must be traceable to an authoritative source: the original LKM claim text, the evidence chain (steps/premises), or the cited paper's metadata (data.papers). Do not invent or infer details that cannot be anchored to one of these sources.

**Connect.** Write the Gaia operator linking the atomic claims:
- Conflict → `contradiction(A, B, reason="...", prior=...)`
- Agreement → `equivalence(A, B, reason="...", prior=...)`

**Preserve.** The original LKM claim C is kept as `claim(C, lkm_original="...")`. Link it:
```python
equivalence(C, D, reason="the meta-claim C names the relationship expressed by D")
```
where D is `contradiction(A, B)` or `equivalence(A, B)`.

**4. Hunt contradictions (MANDATORY).** For each new atomic claim, use **scientific falsification** to design a search that would surface counter-evidence.

**Principle: retain the subject, challenge the assertion.** Keep what the claim is *about* (the specific entity, system, or phenomenon). Add terms that would appear in a source that reached a *different* conclusion about the same subject.

- Claim: "PBE BeSe gap = 2.51 eV" → search: "BeSe band gap measured optical absorption different value"
- Claim: "HSE06 ZnO within 10% of experiment" → search: "HSE06 ZnO underestimates gap by more than 0.5 eV"
- Claim: "GW within 0.1-0.2 eV of experiment" → search: "GW quasiparticle gap deviates from experiment dependence starting point"

**Do NOT:** drop the specific system (loses relevance), mechanically invert the text (API may timeout), or search for "limitations" (returns consensus).

For each contradiction candidate found: `contradiction(P, X, prior=...)` + `gaia inquiry obligation add <qid> -c "resolve: ..."`.

**5. Mark suspicions.** Flag unreliable reasoning chains or premises:
```bash
gaia inquiry obligation add <claim_or_strategy_qid> -c "<concern>"
```

**6. Compile & infer.** `gaia compile . && gaia infer .`

**7. Review.** Run `gaia check --hole .` and `gaia inquiry review .`. Use domain judgment to identify gaps and mark obligations. Run `gaia inquiry obligation list` and pick the most interesting obligation.

**8. Search supports.** Search LKM with the target claim (`POST /claims/match`, top-10). Pick conclusion-type claims → `claim(U)` + `support([U], P, prior=...)`.

**9. Repeat.** Back to step 1 — bootstrap any new claims that have evidence chains (write deduction), then refine, decompose, and continue. Exit when obligation list empty, 0 holes, 0 unreviewed warrants.

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
