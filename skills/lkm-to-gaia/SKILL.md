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

Every distinct `gcn_*` claim (post shared-premise extraction) → one `claim(...)` per `$gaia-lang` §2:

```python
<label> = claim("<content>", lkm_id="gcn_xxx", source_paper="paper:xxx", provenance_source="lkm")
```

- **No `prior` kwarg on claims.** After `gaia compile`, run `gaia check --hole` to surface which leaf claims need priors, then assign them in `priors.py`. LKM's `score` field is match relevance, not a prior — do not use it as one.
- When two claims are merged into one: `lkm_ids=["gcn_a", "gcn_b"]`.
- Empty content → placeholder string + `todo="revisit when LKM populates this premise"` in metadata.

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

### 4. Contradiction — prioritize open problems

**Finding contradictions is more important than finding supports.** An unresolved contradiction is a potential open problem — the most valuable output of exploration. The agent must actively search for conflicting claims, especially across different paradigms.

**Highest priority: experiment vs theory conflict.** When one claim comes from an experimental measurement and the other from a theoretical prediction, a contradiction between them signals either new physics or a flaw in the theory — either way, it's a first-class open problem.

**Avoid echo chambers.** When BP resolves a contradiction strongly in one direction (one side belief > 0.95, other < 0.1), the graph may be overconfident. The agent MUST then search for evidence supporting the **weak side** of the contradiction — not just reinforce the strong side. A belief of 0.011 on a contradicted experimental claim means the graph thinks the experiment is wrong; that demands aggressive search for additional experimental evidence before accepting the resolution.

Contradictions come from **two sources**:

**Source A — Orchestrator flag files** (`contradictions.md` from discovery Step 2b). The agent reads each flagged pair and decides:

| Situation | Action |
|---|---|
| Real tension (can't both be true; may be an open problem) | `contradiction(a, b, reason="... \| new_question: ...", prior=<float>)` |
| False alarm (boundary conditions differ, etc.) | Dismiss; no DSL emitted |

**Source B — Upstream search.** While searching upstream for a premise P, the agent must also look for claims that **contradict** P. Pay special attention to claims from different paradigms (experiment vs theory, different materials, different methods):

```python
contradiction(P, <conflicting_claim>, reason="found during upstream search for P: <why they can't both be true>", prior=<float>)
```

Every contradiction should also be marked as an obligation:
```bash
gaia inquiry obligation add <qid> -c "resolve contradiction: <new_question>"
```

Prior reflects the strength of the contradiction:
- Experiment vs theory on the same quantity → 0.90–0.95 (highest priority)
- Direct conflict on the same quantity (same paradigm) → 0.85–0.90
- Different boundary conditions may explain it → 0.50–0.60
- Unclear → 0.50

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

The exploration is **review-driven**: each iteration compiles, infers, and uses `gaia inquiry review` to decide which premise to expand next. The agent searches LKM with that premise, adds new claims and edges, then re-evaluates.

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
 │  4. gaia inquiry review .                                   │
 │     └─ **Lowest belief = highest priority.**                 │
 │        Sort by belief ascending. The weakest claim —        │
 │        whether a premise, an upstream, or the weak side      │
 │        of a contradiction — is always the next target.       │
 │                                                             │
 │  5. Search LKM with that premise → top-10 results           │
 │     ├─ found upstream evidence / equivalent conclusions     │
 │     │   → claim(U) + support([U], P, prior=...)            │
 │     └─ found contradictions with P or its peers             │
 │         → contradiction(P, X, prior=...)                    │
 │         → gaia inquiry obligation add <qid> -c "..."        │
 │                                                             │
 │  6. Back to step 2 — repeat until:                          │
 │     • User-specified goal met (e.g. ≥ N nodes,              │
 │       belief ≥ threshold, depth ≥ K layers),                │
 │       OR review shows no clear next target                  │
 │     • AND 0 holes, 0 unreviewed warrants, 0 open obligations│
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

**4. Review.** `gaia inquiry review .` Sort beliefs ascending. **The claim with the lowest belief is always the next target** — whether it's a premise lacking upstream support, or the weak side of a contradiction that needs balancing.

**5. Search & expand.** Search LKM with the chosen premise's content (`POST /claims/match`, top-10). In the results:
- **Upstream support**: conclusions from other reasoning chains that corroborate this premise → `claim(U)` + `support([U], P, prior=...)`. Multiple supports allowed.
- **Contradiction**: claims that can't both be true with this premise or its peers → `contradiction(P, X, prior=...)` + `gaia inquiry obligation add <qid> -c "resolve this contradiction"`.

**6. Repeat.** Back to step 2. Exit when `gaia inquiry review` shows no clear next target, all holes filled, all warrants reviewed, and all obligations resolved.

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
