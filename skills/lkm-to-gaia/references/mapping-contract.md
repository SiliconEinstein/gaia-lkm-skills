# Mapping contract — LKM artefact → Gaia DSL output

> **Prerequisite — read [`$gaia-lang`](../../../README.md) and [`$gaia-cli`](../../../README.md) first.**
> This document covers only the *mapping policy* — what each LKM artefact in
> an `evidence-graph-run/2.0` run-folder becomes in the emitted DSL. The
> *grammar* (kwargs vs positional, label rule, Cromwell bounds, citation rule,
> `__all__` placement) is governed by `$gaia-lang`. Discrepancies between this
> document and what [`scripts/dsl_emit.mjs`](../scripts/dsl_emit.mjs) actually
> emits are bugs in the skill — fix the script (or this doc) so they agree.

## 1. Premises and conclusions (LKM `claim` blocks and `factors[].premises[]`)

Every distinct `gcn_*` id (post-dedup, see [`share-extract-procedure.md`](share-extract-procedure.md)) becomes one `claim(...)` call per `$gaia-lang` §2:

```python
<label> = claim(
    "<premise.content or 'placeholder' if empty>",
    lkm_id="gcn_xxx",                 # **metadata; multi-id list as lkm_ids on merge
    source_paper="paper:xxx",         # primary source package
    provenance_source="lkm",
)
```

Rules:

- `<label>` is mint via `dsl_emit.mintLabel(<gcn_id>)` (label grammar per `$gaia-lang` §6).
- **No `prior` kwarg on `claim(...)`** — `$gaia-lang`'s `claim` signature does not accept one. Leaf priors land in `priors.py` (see §1b).
- LKM-specific provenance lives in `**metadata` kwargs (`lkm_id`, `source_paper`, `provenance_source`, etc.). The first-class `provenance` kwarg on `claim` is reserved for cross-Gaia-package attribution; LKM is a corpus, not a Gaia package, so we don't use it here.
- When two premises are merged via shared-premise extraction, the kwarg becomes `lkm_ids=["gcn_a", "gcn_b"]` (plural).

### 1a. Empty-content premise

When `premise.content == ""`:

```python
<label> = claim(
    "(LKM premise gcn_xxx; content unavailable in corpus)",
    lkm_id="gcn_xxx",
    source_paper="paper:xxx",
    provenance_source="lkm",
    todo="revisit when LKM corpus populates this premise",
)
```

The placeholder string is preserved — do not invent content.

### 1b. Leaf priors → `priors.py`

A claim is a **leaf** if it is not the conclusion of any strategy in the package. For each leaf, emit one entry in `priors.py` per `$gaia-cli` §6:

```python
PRIORS = {
    <label>: (<float>, "<heuristic tag + lkm context + TODO:review>"),
    ...
}
```

The float is `prior_heuristic.betaMean(<beta>)` over the heuristic's internal Beta. Buckets (mean shown):

| heuristic bucket | mean | trigger |
|---|---|---|
| `experimental_observation` | 0.90 | content keywords: measured, observed, experimental, XRD, ARPES, four-probe, ... |
| `computational_result` | 0.80 | content keywords: computed, simulated, DFT, first-principles, Eliashberg, ab initio, ... |
| `assumed_or_proposed` | 0.70 | content keywords: assume, propose, hypothesize, conjecture, ... |
| default | 0.50 | nothing else matched |
| empty content | 0.50 | `[1, 1]` Beta — Cromwell-safe; mean 0.50 with very low confidence |

`data.variables[].score` (when present in match results) nudges by ±0.05 unit on the mean: `score >= 0.85` tightens; `score <= 0.50` loosens.

The justification text is non-empty and ends with `TODO:review` so `gaia check --hole` surfaces every leaf for the reviewer.

## 2. Factors (`gfac_*`)

Every factor in `evidence_chains[].factors[]` becomes one `deduction(...)` call per `$gaia-lang` §4 (positional-first):

```python
deduction(
    [<premise_label_1>, <premise_label_2>, ...],
    <conclusion_label>,
)
```

Rules:

- **Always `deduction`**, regardless of LKM `subtype` (`noisy_and`, `noisy_or`, etc.). This is a **deliberate override** of `$gaia-lang`'s `noisy_and → support` deprecation guidance: we treat the LKM-corpus vetting as a strict-correctness stamp. If `gaia infer` later shows that imported chains overstate certainty, the reviewer can flip them to `support` + warrant prior on a case-by-case basis. See `docs/lkm-to-gaia-design.md` decision 1 for the rationale.
- **No warrant `reason` / `prior`** by default. Per `$gaia-lang` §4, both must be paired or both omitted; we omit both.
- Multiple `deduction(...)` calls may share the same conclusion label (e.g. one factor per source paper, all converging on the same root). `gaia compile` combines them correctly under BP.

The single exception to "always `deduction`" is `cross_validation.json` polarity `confirm` — see §5.

## 3. `equivalences.json` pairs

Every pair gets a lineage classification (via `lkm_io.classifyEquivalenceLineage`) that determines how it lands. Operator priors are **floats** per `$gaia-lang` §3.

| lineage tag | DSL output |
|---|---|
| `same_paper_different_version` | merged: one `claim(...)` with both `lkm_id`s in metadata; **no `equivalence(...)` operator emitted** |
| `independent_experimental` | `equivalence(<a>, <b>, reason="<rationale> (lineage=independent_experimental)", prior=0.95)` |
| `independent_theoretical` | `equivalence(<a>, <b>, reason="<rationale> (lineage=independent_theoretical)", prior=0.80)` |
| `cross_paradigm` | `equivalence(<a>, <b>, reason="<rationale> (lineage=cross_paradigm)", prior=0.95)` |
| `unclassified` | `equivalence(<a>, <b>, reason="<rationale> (lineage=unclassified)", prior=0.50)` plus a `# TODO:CLASSIFY lineage` comment on the line above |

The float priors come from `prior_heuristic.betaForEquivalence({lineageTag})` collapsed via `betaMean`.

## 4. `contradictions.json` pairs (promoted only)

Every promoted contradiction (`verdict == "promoted"`) becomes:

```python
contradiction(
    <a>, <b>,
    reason="<rationale> | new_question: <new_question>",
    prior=<float>,
)
```

The float is `prior_heuristic.betaForContradiction({hypothesizedCauses})` collapsed via `betaMean`. Cause weights:

| `hypothesized_cause` value | weight |
|---|---|
| `evidence_reliability` | 0.95 |
| `measurement_protocol` | 0.92 |
| `hidden_variable` | 0.88 |
| `model_assumption` | 0.85 |
| `boundary_condition` | 0.80 |

The mean weight across the array is the emitted `prior` (Cromwell-clipped). The `new_question` is appended to `reason` so it survives in source — review tools that surface "open questions" should grep for `new_question:` in strategy reasons.

## 5. `cross_validation.json` pairs (promoted only) — the `induction` exception

For `polarity: confirm`, emit two `support` strategies and one `induction` per `$gaia-lang` §4:

```python
s_<lawId>_a = support(
    [<lawLabel>],
    <obsALabel>,
    reason="cross-validation observation A | basis: <independence_basis>",
    prior=0.9,
)
s_<lawId>_b = support(
    [<lawLabel>],
    <obsBLabel>,
    reason="cross-validation observation B | weight: <scientific_weight>",
    prior=0.9,
)
induction(
    s_<lawId>_a,
    s_<lawId>_b,
    <lawLabel>,
    reason="cross-validation: <independence_basis> | <scientific_weight>",
    prior=0.95,
)
```

Rules:

- This is the **only** place the skill emits `support` or `induction`. Everything else in the chain backbone is `deduction`. The exception exists because `$gaia-lang` §4's `induction(support_1, support_2, law)` is the canonical idiom for "multiple independent observations confirm one law" and is structurally built on `support`.
- Direction matters: `support([law], obs)` is correct (law predicts obs); the reverse is rejected by the gaia compiler.
- `induction` takes Strategy objects (not claim labels) for `support_1` and `support_2` per `$gaia-lang` §4 — that's why the supports are assigned to result labels (`s_<lawId>_a`).
- Result-label naming: `s_<lawId>_a` / `s_<lawId>_b` keeps the support strategies addressable by name in `gaia check --brief` per `$gaia-lang` §6.

For `polarity: partial_disconfirm`:

```python
# TODO:HUMAN-REVIEW partial_disconfirm cross_validation pair
contradiction(
    <a>, <b>,
    reason="<rationale> (cross-validation polarity=partial_disconfirm)",
    prior=0.50,
)
```

For `polarity: partial_confirm`: same as `confirm` but the `induction` warrant `prior=0.80` instead of `0.95`.

## 6. `dismissed_pairs.json`

**Not emitted as DSL.** The pairs are dropped into `artifacts/lkm-discovery/<run-folder-name>/dismissed/` as a verbatim copy of the JSON file plus a one-line audit entry in `mapping_audit.md`.

## 7. `data.papers` → `references.json`

Every entry in the union of `data.papers` across all loaded evidence + match files becomes one CSL-JSON record per the `$gaia-lang` §7 `[@key]` rule. Format and key construction:

- `<key>` is `<firstAuthorSurnamePascalCase><year>`, e.g. `An2001`. Suffix letters on collision: `An2001`, `An2001a`, `An2001b`.
- `authors` field in LKM is pipe-separated `Surname Given | ...`. Best-effort parse; on parse failure, fall back to `{"literal": "<as-is>"}`.
- `issued`: parse `publication_date` `YYYY-M-D` → `[[YYYY]]`. If only year is recoverable, omit month/day.

Cite via `[@<key>]` in claim content or strategy reasons. `gaia compile` validates citations strictly — see `$gaia-lang` §7 for the homogeneous-group rule and escape syntax.

## 8. `__all__` and exported labels

Per `$gaia-lang` §5 — "Do NOT define `__all__` in submodules." Single `__all__` lives in `__init__.py`. The exported public API is the set of **selected root claims** across all loaded run-folders, deduped:

```python
__all__ = [
    "<root_label_1>",
    "<root_label_2>",
    ...
]
```

Roots are determined by `evidence_graph.json.selected_root_id` per run-folder. Premises and intermediate conclusions remain package-public (no `_` prefix per `$gaia-lang` §6) but are not in `__all__`.

## 9. Module placement

Per `$gaia-lang` §5 module-organization conventions:

- Each canonical claim goes in the module of the **first paper** it appears in (deterministic ordering: paper id alphabetical for tie-breaking). Other modules import by label via `from .paper_<key> import <label>`.
- Each `gfac_*` factor goes in the module of `factor.source_package`.
- Cross-paper operators (`equivalence`, `contradiction`, `induction`) all go in `cross_paper.py`.
- `__init__.py` re-exports everything via `from .paper_<key> import *` and `from .cross_paper import *`, then declares `__all__`.

## 10. What this contract does NOT cover

- The full `priors.py` shape — see `$gaia-cli` §6.
- The shape of `pyproject.toml` — see `$gaia-cli` §1.
- BP interpretation, weakness analysis, publish-blocker resolution — see the review skill and `gaia.inquiry.run_review`.
- Render-time choices — see `gaia render` and the publish skill.
- The Gaia DSL grammar — see `$gaia-lang`.
