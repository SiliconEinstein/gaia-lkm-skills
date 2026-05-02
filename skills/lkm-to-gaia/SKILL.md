---
name: lkm-to-gaia
description: Convert one or more `$evidence-subgraph` run-folders directly into a Gaia DSL knowledge package. Two modes - `batch` (emit a fresh standalone `<name>-gaia/` package directory ready for `gaia compile`) and `incremental` (emit a Python source fragment to merge into an existing `plan.gaia.py`, the format used by the `gaia-discovery` orchestration loop). Maps every LKM `gfac_*` factor to `deduction(premises=[...], conclusion=...)` (kwargs, no warrant prior - "always deduction" default), every `equivalences.json` pair (other than `same paper, different version`) to `equivalence(a, b)`, every promoted `contradictions.json` pair to `contradiction(a, b)`, and every promoted `cross_validation.json` pair with `polarity: confirm` to `support` + `support` + `induction(support_1, support_2, law)` (the one narrow exception to "always deduction"). Premise priors are Beta `[a, b]` per the gaia-discovery `claim()` hard constraint, auto-seeded from premise-content keywords + `data.variables[].score` and TODO-marked. Hand-off contract is the structured run-folder produced by `$evidence-subgraph` (`evidence-graph-run/2.0`); `data.papers` is the citation source. Domain-agnostic.
---

# LKM-to-Gaia

## Role

This is the fifth peer in the `gaia-lkm-skills` family. Where `$scholarly-synthesis` turns the audited evidence structure into prose, this skill turns the same input into **executable Gaia DSL** — a knowledge package that compiles via `gaia compile`, propagates beliefs via `gaia infer`, and carries the LKM provenance into the `metadata` of every claim.

```
discovery -> $evidence-subgraph (run-folder per evidence-graph-run/2.0)
                                |
                        +-------+-------+
                        v               v
              $scholarly-synthesis   $lkm-to-gaia   <-- THIS SKILL
                  (prose article)    (Gaia package)
```

Routed via [`$evidence-graph-synthesis`](../evidence-graph-synthesis/SKILL.md) when the user asks for a "Gaia package", "Gaia DSL", "knowledge package", or "formalized into Gaia". Invokable standalone when the user already has a run-folder and just wants the package.

## Two-mode contract

### Mode `batch`

**Input:** one or more run-folders that satisfy the [run-folder output contract](../evidence-subgraph/references/run-folder-output-contract.md).

**Output:** a fresh standalone `<name>-gaia/` directory:

```
<name>-gaia/
  pyproject.toml             # [tool.gaia] type=knowledge-package + uuid (mints if absent)
  references.json            # CSL-JSON, built from the union of `data.papers`
  src/<import_name>/
    __init__.py              # imports + __all__ (exported root conclusions)
    paper_<key>.py           # one module per source paper (claims + deductions for chains in that paper)
    cross_paper.py           # cross-paper equivalence / contradiction / induction operators
    priors.py                # auto-seeded Beta priors with TODO:review markers
  artifacts/
    lkm-discovery/
      <run-folder-name>/...  # full copy of every input run-folder (raw/ + JSON contract files)
      merge_audit.md         # which premises were merged, with provenance
      mapping_audit.md       # gfac_* -> deduction, pair-files -> operators, decision log
```

After emit, the agent (or user) runs:

```bash
cd <name>-gaia/
gaia compile .          # produce .gaia/ir.json
gaia check .            # sanity-check structure
gaia check --hole .     # confirm every leaf has a prior
gaia infer .            # run BP
```

The skill does NOT run `gaia infer`; that is a follow-up step the caller decides.

### Mode `incremental`

**Input:** one or more run-folders + a path to an existing `plan.gaia.py` (or a directory with one).

**Output:** a Python source fragment string + a side-channel `imports.json` describing what was added. The fragment is designed to be **appended** to `plan.gaia.py`; existing claims/strategies are not rewritten. Before emitting, the skill is expected to run `gaia.inquiry.find_anchors_for(<plan_dir>)` (via the host runtime) and dedup any premise whose content matches an existing label.

This mode is built so the `gaia-discovery` `/lkm-evidence` slash-skill wrapper can be a thin shell-out (~30 lines). The wrapper itself ships in a separate repo; this skill provides the substantive conversion.

## Mapping rules

The canonical mapping table lives in [`references/mapping-contract.md`](references/mapping-contract.md). Summary (per the design choices in [`docs/lkm-to-gaia-design.md`](../../docs/lkm-to-gaia-design.md)):

| LKM artefact | Gaia DSL output |
|---|---|
| LKM premise / conclusion content | `label = claim(content, prior=[a,b], metadata={prior_justification, provenance="lkm", lkm_id, source_paper})` |
| `gfac_*` factor (any subtype: `noisy_and`, `noisy_or`) | `deduction(premises=[...], conclusion=...)` — no `reason`/`prior` (default per gaia-discovery v0.x `_validate_reason_prior`); LKM corpus is treated as already-verified for the chain backbone |
| Empty-content premise (temporary corpus state) | `claim("(LKM premise gcn_..., content unavailable)", prior=[1,1], metadata={..., todo: revisit})` |
| `equivalences.json` lineage `same paper, different version` | merge into one `claim` (single label, both `lkm_id`s in metadata) |
| `equivalences.json` other lineages | `equivalence(a, b, reason=..., prior=[a,b])` — keep distinct, gate the boost via the warrant prior |
| `equivalences.json` lineage `unclassified` | emit + `# TODO:CHECK lineage` comment |
| `contradictions.json` (promoted) | `contradiction(a, b, reason=..., prior=[a,b])` — prior derived from `hypothesized_cause` weights |
| `cross_validation.json` polarity `confirm` (the only exception to "always deduction") | `s_a = support([law], obs_a)` + `s_b = support([law], obs_b)` + `induction(support_1=s_a, support_2=s_b, law=law)` |
| `cross_validation.json` polarity `partial_disconfirm` | `contradiction(a, b, reason=...)` + `# TODO:HUMAN-REVIEW` comment |
| `dismissed_pairs.json` | not emitted as DSL; dropped into `artifacts/lkm-discovery/<run>/dismissed/` for audit |
| `data.papers[paper:<id>]` | one CSL-JSON entry in `references.json` (key = `<firstAuthor><year>` deduped by suffix letters) |

The "always `deduction()`" rule is deliberate: the gaia-discovery default is "都不给 reason/prior" on strategies, pushing all uncertainty to leaf priors. The narrow `induction` exception for cross-validation `confirm` exists because gaia's `induction(support_1, support_2, law)` is the canonical idiom for "multiple independent observations confirm one law" and is structurally built on `support`, not `deduction`.

## Shared-premise extraction (avoiding double counting)

Spelled out in [`references/share-extract-procedure.md`](references/share-extract-procedure.md). Hybrid policy:

1. **Auto-merge** premises with **identical content text** (normalized: trimmed, whitespace-collapsed). One Python variable, both `lkm_id`s in the metadata `lkm_ids` list.
2. **Auto-merge** equivalence pairs whose `rationale` classifies the lineage as `same paper, different version` (e.g. arXiv preprint + journal version). No `equivalence(...)` operator emitted; treated as one claim.
3. **Surface** ambiguous semantic-equivalent pairs (high-similarity content but no clear lineage) into `merge_decisions.todo` under the package's `artifacts/lkm-discovery/`. The user fills in `MERGE` or `KEEP` per pair before re-running. Default until filled in: `KEEP` (safe).
4. **Keep distinct + link via `equivalence(...)`** for pairs classified as `independent_experimental`, `independent_theoretical`, or `cross_paradigm`. The `equivalence` operator's warrant prior (per [`prior_heuristic.mjs`](scripts/prior_heuristic.mjs) `betaForEquivalence`) gates how much BP combines them, so independent confirmations boost the underlying proposition correctly without over-counting.

## Workflow (batch mode)

1. **Discovery gate.** If invoked with `--query` (no run-folders), bounce to `$evidence-graph-synthesis`. This skill does not perform LKM discovery; it consumes the audited run-folder.
2. **Validate input.** Load every run-folder via [`scripts/lkm_io.mjs`](scripts/lkm_io.mjs) `loadRunFolder`. Every run-folder must satisfy the `evidence-graph-run/2.0` self-check (§8 of the run-folder contract); reject with a clear error otherwise.
3. **Plan package shape.**
   - Pick a package name (kebab-case `<topic>-gaia`); pick the import name (snake_case).
   - Inventory all paper ids across all run-folders -> module list (`paper_<key>.py` per paper).
   - Inventory cross-paper relations (the four pair JSON files unioned across run-folders) -> they all land in `cross_paper.py`.
4. **Shared-premise extraction.** Run the procedure in [`references/share-extract-procedure.md`](references/share-extract-procedure.md). Resolve every premise to a canonical label; emit `merge_audit.md`.
5. **Emit DSL** using the primitives in [`scripts/`](scripts/):
   - For each canonical claim: `dsl_emit.emitClaim(...)` with a Beta prior from `prior_heuristic.betaForPremise(...)`. Place in the module of the **first** paper it appears in (other papers' modules import it by label).
   - For each `gfac_*` factor: `dsl_emit.emitDeduction(...)`. Place in the module of `factor.source_package`.
   - For each cross-paper operator: place in `cross_paper.py`.
   - For each cross-validation `confirm` pair: emit two `support`s + one `induction`. Also in `cross_paper.py`.
6. **Build `references.json`** from `lkm_io.collectPapers(...)`. Key format: `<firstAuthorSurname><year>` (Pascal-cased), deduped by suffix letters.
7. **Build `priors.py`.** It only contains overrides for derived claims that should NOT be set in `__init__.py` (per gaia rules, derived claims should not carry a prior). For LKM-imported leaves, the prior is set inline on the `claim(...)` call and `priors.py` stays empty (or carries reviewer overrides).
8. **Write `pyproject.toml`** with `[tool.gaia] type = "knowledge-package"` and a fresh UUID. Include `[build-system] requires = ["hatchling"]` per the gaia-cli skill's pyproject contract.
9. **Copy run-folders verbatim** into `artifacts/lkm-discovery/<run-folder-name>/` so the LKM provenance stays reproducible.
10. **Self-check.** Run the [`scripts/test_lkm_to_gaia.mjs`](scripts/test_lkm_to_gaia.mjs)-style lexical sanity check (balanced parens / brackets / braces; `from gaia.lang import` present; every `claim(` has a matching `prior=[`). If a Python interpreter is available, additionally `python3 -c "import ast; ast.parse(open('<file>').read())"` on each emitted module. Fail loudly if any check fails.

## Workflow (incremental mode)

Same as batch, except:

- **Step 3 is the host's job**, not this skill's. The agent (or wrapper in `gaia-discovery`) decides which subset of the run-folder content to import in this iteration.
- **Step 4** consults `gaia.inquiry.anchor.find_anchors(<plan_dir>)` (passed in via the host runtime as `existingAnchors`) and treats every existing label as if it were already in the canonical-claim table. New premises whose content text matches an existing label reuse the label.
- **Steps 6, 7, 8, 9** are skipped (the host's `plan.gaia.py` already has them).
- The skill emits a single Python source fragment to stdout (or a return value); the host appends it to `plan.gaia.py` via libcst (or whatever AST tool the host uses) so existing claim definitions are not perturbed.
- The skill also emits an `imports.json` sidecar listing every label, its source LKM id, and its merge decision.

## Authentication

This skill makes **no network calls**. All retrieval was already done by `$lkm-api` upstream and is preserved in the run-folder's `raw/` directory. No `LKM_ACCESS_KEY` is needed.

## Hand-off

Batch mode hands the package directory back to the user, who runs `gaia compile .` and follows the standard gaia-cli workflow (`gaia check`, `gaia infer`, `gaia render . --target github`, `/gaia:publish`).

Incremental mode hands the source fragment back to the host runtime (the `gaia-discovery` `/lkm-evidence` wrapper, when shipped) which appends to `plan.gaia.py`. The orchestrator's BP + `gaia.inquiry.run_review` loop picks up the new claims on the next iteration.

## What this skill is NOT

- **Not a discovery skill.** Discovery (calling `/claims/match`, picking chain-backed candidates) is `$evidence-graph-synthesis` + `$lkm-api`. This skill consumes the audited output.
- **Not a renderer.** GitHub presentation, README, mermaid graphs are `gaia render` + `/gaia:publish`. This skill stops at `gaia compile`-ready source.
- **Not a reviewer.** Setting reviewed priors, interpreting BP, identifying weak points are `gaia.inquiry.run_review` + the `review` skill. This skill emits TODO-marked auto-seeded priors and stops there.
- **Not a wrapper for the gaia-discovery loop.** The `/lkm-evidence` slash skill that lives inside `gaia-discovery` is a separate, optional, downstream consumer of this skill's incremental mode.

## Reference files

- [`references/mapping-contract.md`](references/mapping-contract.md) — canonical LKM artefact -> DSL output table
- [`references/share-extract-procedure.md`](references/share-extract-procedure.md) — shared-premise extraction algorithm + `merge_decisions.todo` schema
- [`references/package-skeleton.md`](references/package-skeleton.md) — batch-mode output layout + `pyproject.toml` template
- [`references/incremental-mode-contract.md`](references/incremental-mode-contract.md) — incremental-mode invariants + `imports.json` schema

## Helpers

- [`scripts/lkm_io.mjs`](scripts/lkm_io.mjs) — load + validate + iterate run-folder
- [`scripts/dsl_emit.mjs`](scripts/dsl_emit.mjs) — emit Python source for v0.x-conformant Gaia DSL
- [`scripts/prior_heuristic.mjs`](scripts/prior_heuristic.mjs) — content + score -> Beta(a, b) + justification
- [`scripts/test_lkm_to_gaia.mjs`](scripts/test_lkm_to_gaia.mjs) — `node --test` suite (47 tests, no deps)
- [`scripts/_smoke_emit.mjs`](scripts/_smoke_emit.mjs) — dev script that builds a Python source from the fixture run-folder; useful as a worked example
