---
name: lkm-to-gaia
description: Convert one or more `$evidence-subgraph` run-folders directly into a Gaia DSL knowledge package. Two modes - `batch` (emit a fresh standalone `<name>-gaia/` package directory ready for `gaia compile`) and `incremental` (emit a Python source fragment to merge into an existing `plan.gaia.py`). Maps every LKM `gfac_*` factor to `deduction([premises], conclusion)` (the chain-backbone default, overriding `$gaia-lang`'s noisy_and→support deprecation), every `equivalences.json` pair (other than `same paper, different version`) to `equivalence(a, b, ...)`, every promoted `contradictions.json` pair to `contradiction(a, b, ...)`, and every promoted `cross_validation.json` pair with `polarity: confirm` to `support` + `support` + `induction(support_1, support_2, law)` (the one narrow exception to "always deduction"). Emitted source is `$gaia-lang`-clean: `claim(content, **metadata)` with no inline `prior` kwarg, leaf priors land in `priors.py` per `$gaia-cli` §6 as floats, strategy / operator warrant priors are floats Cromwell-bounded `[1e-3, 0.999]`, strategies are positional-first. Hand-off contract is the structured run-folder produced by `$evidence-subgraph` (`evidence-graph-run/2.0`); `data.papers` is the citation source. Domain-agnostic.
---

# LKM-to-Gaia

> **Prerequisite — read `$gaia-lang` and `$gaia-cli` first.** This skill assumes
> the language reference (Gaia DSL primitives, signatures, kwargs/positional
> conventions, label grammar, Cromwell bounds, citation rules, `__all__` /
> module organization rules) and the CLI reference (`pyproject.toml` shape,
> `priors.py` shape, `gaia compile` / `gaia check` / `gaia infer` workflow).
> Anything about *what Gaia DSL is* lives there. This skill documents only
> what is unique to it: the LKM-artefact-to-DSL **mapping** and the
> shared-premise extraction algorithm.

## Role

This is the fifth peer in the `gaia-lkm-skills` family. Where `$scholarly-synthesis` turns the audited evidence structure into prose, this skill turns the same input into **executable Gaia DSL** — a knowledge package that compiles via `gaia compile`, propagates beliefs via `gaia infer`, and carries the LKM provenance into `**metadata` kwargs of every claim and into the `priors.py` justifications.

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

**Output:** a fresh standalone `<name>-gaia/` directory whose layout matches the gaia-cli skill's expectations and whose internals are pure `$gaia-lang`. See [`references/package-skeleton.md`](references/package-skeleton.md) for the layout, templates, and naming conventions.

After emit, the agent (or user) runs the standard gaia-cli loop:

```bash
cd <name>-gaia/
gaia compile .          # produce .gaia/ir.json
gaia check --brief .    # verify structure
gaia check --hole .     # confirm every leaf has a prior in priors.py
gaia infer .            # run BP
```

The skill does NOT run `gaia infer`; that is a follow-up step the caller decides.

### Mode `incremental`

**Input:** one or more run-folders + a path to an existing `plan.gaia.py` (or a directory with one) + an `existingAnchors` map from the host runtime (typically obtained via `gaia.inquiry.anchor.find_anchors`).

**Output:** a Python source fragment string + a side-channel `imports.json` describing what was added. The fragment is `$gaia-lang`-clean: it appends to `plan.gaia.py` without re-declaring imports and without breaking existing claim definitions.

This mode is built so a thin host wrapper (e.g. the future `gaia-discovery /lkm-evidence` slash skill) can post-process the imported claims to add a different convention if its own framework requires one — see [`references/incremental-mode-contract.md`](references/incremental-mode-contract.md).

## Mapping rules

The canonical mapping table lives in [`references/mapping-contract.md`](references/mapping-contract.md). One-paragraph summary:

- Every `gfac_*` factor → `deduction([premises], conclusion)` (positional-first per `$gaia-lang` §4). No warrant `reason` / `prior`. **This overrides `$gaia-lang`'s `noisy_and → support` deprecation guidance**: we treat the LKM-corpus vetting as a strict-correctness stamp and let the reviewer pass + `gaia infer` results catch any cases where this overstates certainty.
- Every `equivalences.json` pair (other than lineage `same paper, different version`, which is auto-merged) → `equivalence(a, b, reason=..., prior=<float>)` with the warrant prior derived from lineage.
- Every promoted `contradictions.json` pair → `contradiction(a, b, reason=..., prior=<float>)` with the warrant prior derived from `hypothesized_cause`.
- Every promoted `cross_validation.json` pair with `polarity: confirm` → `support` + `support` + `induction(support_1, support_2, law, ...)` — the **one** narrow exception to "always deduction" (gaia-lang's canonical "two independent observations confirm one law" idiom is built on `support`, not `deduction`).
- Every distinct `gcn_*` claim (post shared-premise extraction) → one `claim(content, **metadata)` call. **No inline `prior` kwarg** — leaf priors land in `priors.py` as floats (`PRIORS = {leaf_claim: (float, "justification.")}`) per `$gaia-cli` §6.
- `data.papers` → CSL-JSON entries in `references.json`, key `<firstAuthor><year>` deduped by suffix letters.

## Shared-premise extraction (avoiding double counting)

Spelled out in [`references/share-extract-procedure.md`](references/share-extract-procedure.md). Hybrid policy:

1. **Auto-merge** premises with **identical content text** (normalized: trimmed, whitespace-collapsed). One Python variable, both `lkm_id`s in `**metadata` as a `lkm_ids` list.
2. **Auto-merge** equivalence pairs whose lineage classifies as `same paper, different version`. No `equivalence(...)` operator emitted; treated as one claim.
3. **Surface** ambiguous semantic-equivalent pairs into `merge_decisions.todo` for the user to resolve. Default until filled in: `KEEP` (safe).
4. **Keep distinct + link via `equivalence(...)`** for `independent_experimental`, `independent_theoretical`, or `cross_paradigm` lineages. The operator's warrant prior gates how much BP combines them, so independent confirmations boost the underlying proposition correctly without over-counting.

## Workflow (batch mode)

1. **Discovery gate.** If invoked with `--query` (no run-folders), bounce to `$evidence-graph-synthesis`. This skill does not perform LKM discovery; it consumes the audited run-folder.
2. **Validate input.** Load every run-folder via [`scripts/lkm_io.mjs`](scripts/lkm_io.mjs) `loadRunFolder`. Every run-folder must satisfy the `evidence-graph-run/2.0` self-check; reject with a clear error otherwise.
3. **Plan package shape.** Pick a package name (kebab-case `<topic>-gaia`); pick the import name (snake_case). Inventory all paper ids → module list (`paper_<key>.py` per paper). Inventory cross-paper relations (the four pair JSON files unioned across run-folders) → all land in `cross_paper.py`. See [`references/package-skeleton.md`](references/package-skeleton.md).
4. **Shared-premise extraction.** Run the procedure in [`references/share-extract-procedure.md`](references/share-extract-procedure.md). Resolve every premise to a canonical label; emit `merge_audit.md`.
5. **Emit DSL** using the primitives in [`scripts/`](scripts/):
   - For each canonical claim: `dsl_emit.emitClaim({label, content, metadata})`. No prior on the claim call. Place in the module of the **first paper** it appears in.
   - For each `gfac_*` factor: `dsl_emit.emitDeduction({premiseLabels, conclusionLabel})` — positional-first, no warrant. Place in the module of `factor.source_package`.
   - For each cross-paper operator: place in `cross_paper.py`. Operator priors are **float**, derived from the Beta heuristic via `prior_heuristic.betaMean(...)`.
   - For each cross-validation `confirm` pair: emit two `support`s + one `induction`. Also in `cross_paper.py`.
6. **Build `priors.py`** via `dsl_emit.emitPriorsPyFile({importsByModule, entries})`. Entries are floats per `$gaia-cli` §6, one per **leaf** claim (any claim that is not the conclusion of a strategy in this package). The justification text carries the heuristic tag, the LKM context, and a `TODO:review` marker so `gaia check --hole` makes the reviewer pass through it.
7. **Build `references.json`** from `lkm_io.collectPapers(...)`. Key format: `<firstAuthorSurname><year>` (Pascal-cased), deduped by suffix letters.
8. **Write `pyproject.toml`** per the gaia-cli skill's pyproject contract (with a fresh UUID).
9. **Copy run-folders verbatim** into `artifacts/lkm-discovery/<run-folder-name>/` so the LKM provenance stays reproducible.
10. **Self-check.** Lexical sanity (balanced parens / brackets / braces; `from gaia.lang import` block present; every `claim(` has matching close; every `prior=` is a float between 0 and 1). If a Python interpreter is available, additionally `python3 -c "import ast; ast.parse(open('<file>').read())"` on each emitted module. Fail loudly if any check fails.

## Workflow (incremental mode)

Same as batch, except:

- **Step 3 is the host's job**, not this skill's.
- **Step 4** consults `existingAnchors` (passed in by the host) and treats every existing label as if it were already in the canonical-claim table. New premises whose content matches an existing label reuse the label.
- **Steps 6, 7, 8, 9** are skipped (the host's plan directory already has them).
- The skill emits a single Python source fragment to stdout (or a return value); the host appends it to `plan.gaia.py` so existing claim definitions are not perturbed.
- The skill also emits an `imports.json` sidecar — see [`references/incremental-mode-contract.md`](references/incremental-mode-contract.md) — listing every label, its source LKM id, the float prior emitted, and the original Beta `[a, b]` from the heuristic so the host wrapper can re-inflate to its own convention if it needs to.

## Authentication

This skill makes **no network calls**. All retrieval was already done by `$lkm-api` upstream and is preserved in the run-folder's `raw/` directory. No `LKM_ACCESS_KEY` is needed.

## Hand-off

Batch mode hands the package directory back to the user, who runs `gaia compile .` and follows the standard gaia-cli workflow. The first thing the user should do after `gaia compile` succeeds: `gaia check --hole .` to surface the TODO-marked priors in `priors.py` for refinement.

Incremental mode hands the source fragment back to the host runtime, which appends to `plan.gaia.py`. The orchestrator's BP + `gaia.inquiry.run_review` loop picks up the new claims on the next iteration.

## What this skill is NOT

- **Not a discovery skill.** Discovery is `$evidence-graph-synthesis` + `$lkm-api`. This skill consumes the audited output.
- **Not a renderer.** GitHub presentation, README, mermaid graphs are `gaia render` + the publish skill. This skill stops at `gaia compile`-ready source.
- **Not a reviewer.** Setting reviewed priors, interpreting BP, identifying weak points are the review skill and `gaia.inquiry.run_review`. This skill emits TODO-marked auto-seeded floats in `priors.py` and stops there.
- **Not a Gaia DSL teacher.** For *what* `claim` / `deduction` / `support` / `equivalence` mean and how to write them, read `$gaia-lang` directly. This skill only documents the LKM-artefact-to-DSL **mapping**.
- **Not a wrapper for the gaia-discovery loop.** The `/lkm-evidence` slash skill that lives inside `gaia-discovery` is a separate, optional, downstream consumer of this skill's incremental mode.

## Reference files

- [`references/mapping-contract.md`](references/mapping-contract.md) — canonical LKM artefact → DSL output table (mapping policy only; defers to `$gaia-lang` for grammar)
- [`references/share-extract-procedure.md`](references/share-extract-procedure.md) — shared-premise extraction algorithm + `merge_decisions.todo` schema
- [`references/package-skeleton.md`](references/package-skeleton.md) — batch-mode output layout + templates (defers to `$gaia-cli` for `pyproject.toml` and `priors.py` shape)
- [`references/incremental-mode-contract.md`](references/incremental-mode-contract.md) — incremental-mode invariants + `imports.json` schema

## Helpers

- [`scripts/lkm_io.mjs`](scripts/lkm_io.mjs) — load + validate + iterate run-folder
- [`scripts/dsl_emit.mjs`](scripts/dsl_emit.mjs) — emit `$gaia-lang`-conformant Python source (no Beta in any emitted Python; floats only)
- [`scripts/prior_heuristic.mjs`](scripts/prior_heuristic.mjs) — content + score → Beta `[a, b]` internally + `betaMean()` collapse to float for emission
- [`scripts/test_lkm_to_gaia.mjs`](scripts/test_lkm_to_gaia.mjs) — `node --test` suite (no deps)
- [`scripts/_smoke_emit.mjs`](scripts/_smoke_emit.mjs) — dev script that builds a Python source from the fixture run-folder; useful as a worked example
