# Mapping contract — LKM artefact -> Gaia DSL output

Canonical reference for what every LKM artefact in an `evidence-graph-run/2.0` run-folder becomes in the emitted Gaia DSL. Cited by [`SKILL.md`](../SKILL.md). Discrepancies between this document and what [`scripts/dsl_emit.mjs`](../scripts/dsl_emit.mjs) actually emits are bugs in the skill — fix the script (or this doc) so they agree.

## 1. Premises and conclusions (LKM `claim` blocks and `factors[].premises[]`)

Every distinct `gcn_*` id (post-dedup, see [`share-extract-procedure.md`](share-extract-procedure.md)) becomes one `claim(...)` call:

```python
<label> = claim(
    "<premise.content or 'placeholder' if empty>",
    prior=[a, b],                             # Beta, mean = a/(a+b), Cromwell-bounded
    metadata={
        "prior_justification": "<heuristic tag + lkm_score + TODO:review>",
        "provenance": "lkm",
        "lkm_id": "gcn_xxx",                  # original id; multi-id list if merged
        "source_paper": "paper:xxx",          # primary source package
    },
)
```

Rules:

- `<label>` is mint via `dsl_emit.mintLabel(<gcn_id>)` (lowercase, snake_case, sanitised against Python + DSL reserved words).
- `prior` is Beta `[a, b]` per the gaia-discovery `claim()` hard constraint. Auto-seeded by `prior_heuristic.betaForPremise({content, lkmScore, sourcePackage})`. Buckets:
  - `experimental_observation` (keywords: measured, observed, experimental, XRD, ARPES, ...) -> `[18, 2]` (mean 0.90)
  - `computational_result` (keywords: computed, simulated, DFT, first-principles, Eliashberg, ...) -> `[16, 4]` (mean 0.80)
  - `assumed_or_proposed` (keywords: assume, propose, hypothesize, conjecture, ...) -> `[14, 6]` (mean 0.70)
  - default -> `[10, 10]` (mean 0.50, neutral)
  - empty content -> `[1, 1]` (Cromwell-safe; mean 0.50 with very low confidence)
- `data.variables[].score` (when present in match results) nudges by ±1 unit of mass: `score >= 0.85` tightens; `score <= 0.50` loosens.
- `prior_justification` is non-empty and ends with `TODO:review` so `gaia check --hole` makes the reviewer pass through it.
- `metadata.lkm_id` is a string when un-merged; when two premises are merged via the share-extract procedure, becomes `metadata.lkm_ids` (plural) listing all merged ids.

### Empty-content premise

When `premise.content == ""` (the temporary corpus state documented in [`lkm-api/SKILL.md` §Known temporary](../../lkm-api/SKILL.md)):

```python
<label> = claim(
    "(LKM premise gcn_xxx; content unavailable in corpus)",
    prior=[1, 1],
    metadata={
        "prior_justification": "Cromwell-safe default; LKM premise content unavailable (corpus not yet populated); TODO:review",
        "provenance": "lkm",
        "lkm_id": "gcn_xxx",
        "source_paper": "paper:xxx",
        "todo": "revisit when LKM corpus populates this premise",
    },
)
```

Do not invent content; preserve the placeholder so a future skill run can spot the unfilled premise.

## 2. Factors (`gfac_*`)

Every factor in `evidence_chains[].factors[]` becomes one `deduction(...)` call:

```python
deduction(
    premises=[<premise_label_1>, <premise_label_2>, ...],
    conclusion=<conclusion_label>,
)
```

Rules:

- **Always `deduction`**, regardless of LKM `subtype` (`noisy_and`, `noisy_or`, etc.). Per `gaia-discovery v0.x` deprecation note: `noisy_and` is deprecated in the gaia DSL; the canonical strict-implication strategy is `deduction`.
- **No `reason` / `prior`** by default. The gaia-discovery `_validate_reason_prior` rule requires both or neither; "都不给" is the recommended default. Uncertainty lives at leaf premises, not at the warrant.
- **kwargs style** (`premises=[...], conclusion=...`). Strategies are kwargs-only; do not write `deduction(p1, p2, t)` — the IR rejects positional args on strategies.
- A factor that points to a conclusion you already wrote in another `deduction(...)` is fine — Gaia's BP combines multiple strategies on the same conclusion correctly. Do not collapse them into one.

The single exception to "always `deduction`" is `cross_validation.json` polarity `confirm` — see §5.

## 3. `equivalences.json` pairs

Every pair gets a lineage classification (via `lkm_io.classifyEquivalenceLineage`) that determines how it lands:

| lineage tag | DSL output |
|---|---|
| `same_paper_different_version` | merged: one `claim(...)` with both `lkm_id`s in metadata; **no `equivalence(...)` operator emitted** |
| `independent_experimental` | `equivalence(<a>, <b>, reason="<rationale> (lineage=independent_experimental)", prior=[19, 1])` |
| `independent_theoretical` | `equivalence(<a>, <b>, reason="<rationale> (lineage=independent_theoretical)", prior=[16, 4])` |
| `cross_paradigm` | `equivalence(<a>, <b>, reason="<rationale> (lineage=cross_paradigm)", prior=[19, 1])` |
| `unclassified` | `equivalence(<a>, <b>, reason="<rationale> (lineage=unclassified)", prior=[10, 10])` plus a `# TODO:CLASSIFY lineage` comment on the line above |

Rules:

- Operators are **positional**: `equivalence(a, b)`, never `equivalence(claim_a=a, claim_b=b)`. The IR rejects kwargs on operators.
- The `reason` always includes the lineage tag in parentheses so the reviewer can spot the policy decision without reopening the JSON.
- The `prior` is the warrant prior on the `equivalence` gate — `gaia.bp` interprets it as "how strongly does this equivalence couple A and B's beliefs". Higher means tighter coupling.

## 4. `contradictions.json` pairs (promoted only)

Every promoted contradiction (`verdict == "promoted"`) becomes:

```python
contradiction(
    <a>, <b>,
    reason="<rationale> | new_question: <new_question>",
    prior=[a, b],
)
```

Rules:

- Positional args, paired `reason` + `prior`.
- `prior` is derived from the `hypothesized_cause` array via `prior_heuristic.betaForContradiction`:
  - `evidence_reliability` -> 0.95
  - `measurement_protocol` -> 0.92
  - `hidden_variable` -> 0.88
  - `model_assumption` -> 0.85
  - `boundary_condition` -> 0.80
  - average across the array -> mean of Beta over total mass 20.
- The `new_question` from the pair record is appended to the `reason` so it survives in the source. The reason is the only place where `new_question` lives in the DSL — review tools that surface "open questions" should grep for `new_question:` in strategy reasons.
- An empty `hypothesized_cause` array is impossible per the run-folder contract §6.1 (`hypothesized_cause` is non-empty); this skill rejects loudly if it sees one.

## 5. `cross_validation.json` pairs (promoted only) — the `induction` exception

For `polarity: confirm`, emit two `support` strategies and one `induction`:

```python
s_<lawId>_a = support(
    premises=[<lawLabel>],
    conclusion=<obsALabel>,
)
s_<lawId>_b = support(
    premises=[<lawLabel>],
    conclusion=<obsBLabel>,
)
induction(
    support_1=s_<lawId>_a,
    support_2=s_<lawId>_b,
    law=<lawLabel>,
    reason="cross-validation: <independence_basis> | weight: <scientific_weight>",
    prior=[19, 1],
)
```

Rules:

- This is the **only** place the skill emits `support` or `induction`. Everything else in the chain backbone is `deduction`. The exception exists because gaia's `induction(support_1, support_2, law)` is the canonical "multiple independent observations confirm one law" idiom and is structurally built on `support`.
- The two confirmed-observation labels become the conclusions of the support strategies; the law label is what the induction is for. Direction matters: `support([law], obs)` is correct (law predicts obs); the reverse is rejected by the gaia compiler.
- `prior` `[19, 1]` is fixed for `confirm` polarity; `partial_confirm` and `partial_disconfirm` are handled differently below.
- Result-label naming: `s_<lawId>_a` / `s_<lawId>_b` keeps the support strategies addressable by `priors.py` for reviewer overrides if needed.

For `polarity: partial_disconfirm`:

```python
# TODO:HUMAN-REVIEW partial_disconfirm cross_validation pair
contradiction(
    <a>, <b>,
    reason="<rationale> (cross-validation polarity=partial_disconfirm)",
    prior=[10, 10],
)
```

For `polarity: partial_confirm`: same as `confirm` but `prior=[16, 4]` instead of `[19, 1]`.

## 6. `dismissed_pairs.json`

**Not emitted as DSL.** The pairs are dropped into `artifacts/lkm-discovery/<run-folder-name>/dismissed/` as a verbatim copy of the JSON file plus a one-line audit entry in `mapping_audit.md`. The `verdict` (one of `confirmed_equivalence`, `resolved_moderator`, `trivially_dependent`, `non_generative`) tells the reviewer why each was dismissed.

## 7. `data.papers` -> `references.json`

Every entry in the union of `data.papers` across all loaded evidence + match files becomes one CSL-JSON record:

```json
{
  "<key>": {
    "type": "article-journal",
    "title": "<en_title>",
    "DOI": "<doi>",
    "container-title": "<publication_name>",
    "issued": {"date-parts": [[<year>]]},
    "author": [{"family": "<surname>", "given": "<given>"}, ...]
  }
}
```

Rules:

- `<key>` is `<firstAuthorSurnamePascalCase><year>`, e.g. `An2001`. On collision, suffix letters: `An2001`, `An2001a`, `An2001b`.
- `authors` field in LKM is pipe-separated `Surname Given | Surname Given | ...`. Parser is best-effort; if a name doesn't split cleanly, fall back to `{"literal": "<as-is>"}`.
- `issued` parses `publication_date` `YYYY-M-D` -> `[[YYYY]]`. If only year is recoverable, omit month/day.
- Cite via `[@<key>]` in claim content or strategy reasons; gaia compile validates these strictly per the gaia-lang `[@key]` rule.

## 8. `__all__` and exported labels

The exported public API of the package is the set of **selected root claims** across all loaded run-folders, deduped:

```python
__all__ = [
    "<root_label_1>",
    "<root_label_2>",
    ...
]
```

Roots are determined by `evidence_graph.json.selected_root_id` per run-folder. Premises and intermediate conclusions are NOT exported (they remain package-public but not in `__all__` per the gaia-lang export rule).

## 9. Module placement

- Each canonical claim goes in the module of the **first paper** it appears in (deterministic ordering: paper id alphabetical for tie-breaking). Other modules import by label via `from .paper_<key> import <label>`.
- Each `gfac_*` factor goes in the module of `factor.source_package`.
- Cross-paper operators (`equivalence`, `contradiction`, `induction`) all go in `cross_paper.py`.
- `__init__.py` re-exports everything via `from .paper_<key> import *` and `from .cross_paper import *`, then declares `__all__`.

## 10. What this contract does NOT cover

- The shape of `priors.py` — see [`gaia-cli` skill §6](../../../README.md) and the `review` skill. For LKM-imported leaves, this skill writes the prior inline on the `claim(...)` call, so `priors.py` stays empty (or carries reviewer-added overrides).
- BP interpretation, weakness analysis, publish-blocker resolution — see the `review` skill and `gaia.inquiry.run_review`.
- Render-time choices (mermaid layout, README sections) — see `gaia render` and the `publish` skill.
