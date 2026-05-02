# Mapping contract — LKM evidence → Gaia DSL output

> **Prerequisite — read `$gaia-lang` and `$gaia-cli` first.**
> This document covers the *mapping policy* — what each piece of LKM evidence
> becomes in the emitted DSL. The *grammar* is governed by `$gaia-lang`.

## 1. Claims (`gcn_*`)

Every distinct `gcn_*` id (post shared-premise extraction) becomes one `claim(...)` call per `$gaia-lang` §2:

```python
<label> = claim(
    "<content>",                         # or placeholder if empty
    lkm_id="gcn_xxx",                    # **metadata
    source_paper="paper:xxx",
    provenance_source="lkm",
)
```

Rules:
- `<label>` is mint from the `gcn_*` id and the claim's semantic content.
- **No `prior` kwarg on claims.** LKM's `score` is match relevance, not a Bayesian prior. After `gaia compile`, run `gaia check --hole` to surface leaf claims that need priors, then fill them in `priors.py`.
- When premises are merged, the kwarg becomes `lkm_ids=["gcn_a", "gcn_b"]` (plural).
- Empty-content premises get a placeholder string + `todo="revisit when LKM corpus populates this premise"` in metadata. Do not invent content.

### 1a. Leaf priors → `priors.py`

Claims that are **leaves** (not the conclusion of any strategy) and were surfaced by `gaia check --hole` get entries in `priors.py` per `$gaia-cli` §6:

```python
PRIORS = {
    <label>: (<float>, "<heuristic tag + lkm context + TODO:review>"),
    ...
}
```

The float is the agent's direct judgment: **what is the probability this claim is correct?** Capped at 0.9 — no claim is absolutely certain, no matter how well-established. Lower bound: 0.001 (Cromwell). No heuristic buckets — just read the claim and estimate how likely it is to be true. Every justification text ends with `TODO:review`.

## 2. Upstream support for premises

The agent searches LKM for upstream conclusions relevant to each premise (not from the same chain). A single premise may have **multiple** upstream conclusions — each gets its own `support(...)`:

```python
support([U_1], P, reason="<what U_1 says and why it supports P>", prior=<float>)
support([U_2], P, reason="<what U_2 says and why it supports P>", prior=<float>)
```

`support([a], b, prior=p)` is directional: a 充分支撑 b。p close to 1 → a 几乎充分决定 b。

Multiple upstream supports converging on the same premise naturally reinforce each other under BP. **No `equivalence()` operator is needed** — the shared conclusion node is the convergence point.

Warrant prior for each support:
- Strong (same topic, directly implies) → 0.85–0.95
- Moderate (related, partially overlaps) → 0.70–0.85
- Weak/lateral → 0.50–0.65

If no relevant upstream conclusions are found, skip. Do not invent.

## 2b. Factors (`gfac_*`)

Every factor in `evidence_chains[].factors[]` → `deduction(...)` (positional-first per `$gaia-lang` §4):

```python
deduction(
    [<premise_label_1>, <premise_label_2>, ...],
    <conclusion_label>,
    reason="<concatenated steps[].reasoning from the factor>",
)
```

- `reason` is the LKM evidence formatted as numbered markdown: one numbered item per `steps[].reasoning`, preserving the step order from the LKM factor. Each step preserves figure/table references from the original.
- `prior=0.95` — for backward compatibility (Gaia #494 makes deduction rigid with default 0.999; remove once widely adopted).
- **Always `deduction`**, regardless of LKM `subtype`.
- Multiple `deduction(...)` calls may share the same conclusion label.

## 3. Contradiction

Contradictions come from **two sources**:

**Source A — Orchestrator discovery flags** (`contradictions.md` from Step 2b). For each flagged pair:

| Situation | DSL output |
|---|---|
| **Promoted** (real tension, possible open problem) | `contradiction(a, b, reason="... \| new_question: <...>", prior=<float>)` |
| **Dismissed** (false alarm: boundary conditions differ, etc.) | Not emitted. Copied to `artifacts/lkm-discovery/dismissed/`. |

**Source B — Upstream search.** While searching upstream for a premise P, the agent may find claims that **can't both be true** with P:

```python
contradiction(P, <conflicting_claim>, reason="found during upstream search for P: <why>", prior=<float>)
```

Warrant prior:
- Direct conflict on the same quantity → 0.90
- Different boundary conditions may explain it → 0.50–0.60
- Unclear → 0.50

## 4. `data.papers` → `references.json`

Every paper in the union of `data.papers` across all evidence + match files → CSL-JSON record.

Key: `<firstAuthorSurname><year>`, deduped by suffix letters (`An2001`, `An2001a`, …). Authors field is pipe-separated (`Surname Given | ...`); best-effort parse. Cite via `[@<key>]`.

## 5. `__all__` and exported labels

Per `$gaia-lang` §5 — do NOT define `__all__` in submodules. Single `__all__` in `__init__.py`. Export the set of **selected root claims**, deduped.

## 6. Module placement

- Each canonical claim → module of the **first paper** it appears in (paper id alphabetical tie-break).
- Each `gfac_*` factor → module of `factor.source_package`.
- Cross-paper operators → `cross_paper.py`.
- `__init__.py` re-exports via `from .paper_<key> import *` and `from .cross_paper import *`.

## 7. What this contract does NOT cover

- The full `priors.py` shape — see `$gaia-cli` §6.
- The shape of `pyproject.toml` — see `$gaia-cli` §1.
- BP interpretation, weakness analysis — see the review skill.
- Render-time choices — see `gaia render` and the publish skill.
- The Gaia DSL grammar — see `$gaia-lang`.
