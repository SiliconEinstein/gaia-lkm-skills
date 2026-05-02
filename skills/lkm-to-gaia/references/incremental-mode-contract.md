# Incremental-mode contract

> **Prerequisite — read [`$gaia-lang`](../../../README.md) and the
> [`$gaia-discovery`](https://github.com/SiliconEinstein/gaia-discovery) `gd
> explore` loop docs.** This document covers only what `lkm-to-gaia --mode
> incremental` produces; the host runtime (e.g. a future `gaia-discovery
> /lkm-evidence` slash skill) is responsible for reading the output and
> editing `plan.gaia.py`.

## When to use this mode

You are inside an iterative `plan.gaia.py` editing loop. Batch mode would
clobber the existing `plan.gaia.py`; incremental mode produces a Python source
fragment to **append** plus an `imports.json` sidecar describing what was added.

## Inputs

- One or more run-folders, same as batch mode.
- A path to the existing `plan.gaia.py` (or its enclosing directory).
- An `existingAnchors` map: `label -> {content_normalized}`. The host runtime
  obtains this via `gaia.inquiry.anchor.find_anchors(<plan_dir>)` (or
  equivalent) and passes it in. The skill itself does NOT call `gaia.inquiry`.

## Outputs

1. **A Python source fragment** (string or stdout) that is `$gaia-lang`-clean.
   The fragment is well-formed Python that the host appends verbatim to
   `plan.gaia.py`. The fragment has no top-level `from gaia.lang import ...`
   line — it assumes the existing file already has the canonical import block.
2. **An `imports.json` sidecar** with the schema below. Written to a path the
   host specifies (default: alongside `plan.gaia.py` as
   `lkm_imports_<iso8601>.json`).

## Invariants

- **Append-only.** Existing claim definitions in `plan.gaia.py` are never
  rewritten.
- **`$gaia-lang`-clean.** The emitted fragment satisfies `$gaia-lang`'s
  signatures and conventions: `claim(content, **metadata)` with no `prior`
  kwarg; strategies positional-first; operator priors are floats Cromwell-
  bounded.
- **Beta priors are NOT inlined on `claim(...)`.** If the host wrapper (e.g.
  the `gaia-discovery` framework) requires `claim(content, prior=[a, b], ...)`
  per its own `claim()` hard constraint, the wrapper post-processes the
  emitted fragment using the `imports.json` sidecar, which carries both the
  Beta `[a, b]` and the float collapse for every leaf claim.
- **Dedup against `existingAnchors` first.** Before emitting any `claim(...)`,
  check whether a label with text-equal content already exists. If yes, reuse
  the label; do not emit a new `claim`. The host's subsequent `deduction(...)`
  references the existing label.
- **Operator linkage rule for soft dedup.** When two LKM premises look
  semantically equivalent but one is already in `plan.gaia.py`, emit an
  `equivalence(<existing>, <new>, ...)` operator instead of merging. The host
  reviewer / next iteration can promote the merge if appropriate.
- **No `metadata.action` emission unless explicitly requested.** Imported
  `deduction(...)` strategies do not carry `metadata.action`. The host (e.g.
  the `gaia-discovery /lkm-evidence` wrapper) decides whether to mark them for
  sub-agent re-verification by editing the emitted text post-hoc, or by
  passing a flag through to the skill (TODO: not yet wired in this delivery).

## `imports.json` schema

```json
{
  "schema_version": "lkm-to-gaia-imports/1.0",
  "generated_at": "<ISO 8601>",
  "source_run_folders": [
    "<run-folder-path-1>",
    "<run-folder-path-2>"
  ],
  "added_claims": [
    {
      "label": "gcn_phonon_pairing",
      "lkm_id": "gcn_phonon_pairing",
      "lkm_ids_merged": [],
      "source_paper": "paper:p_an2001",
      "content_excerpt": "Phonon-mediated pairing dominates in MgB2.",
      "is_leaf": true,
      "prior_float": 0.8,
      "prior_beta": [16, 4],
      "prior_tag": "computational_result",
      "prior_justification": "computational / theoretical result (lkm chain premise); TODO:review",
      "anchor_decision": "new",
      "anchor_existing_label": null
    },
    {
      "label": "gcn_some_existing",
      "lkm_id": "gcn_some_new_id",
      "lkm_ids_merged": [],
      "source_paper": "paper:p_xxx",
      "content_excerpt": "Same content as an existing claim",
      "is_leaf": null,
      "prior_float": null,
      "prior_beta": null,
      "prior_tag": null,
      "prior_justification": null,
      "anchor_decision": "reused_existing",
      "anchor_existing_label": "gcn_some_existing"
    }
  ],
  "added_strategies": [
    {
      "kind": "deduction",
      "factor_id": "gfac_a1",
      "source_package": "paper:p_an2001",
      "premise_labels": ["gcn_phonon_pairing", "gcn_two_band"],
      "conclusion_label": "gcn_root_a",
      "warrant_prior_float": null,
      "warrant_reason": null,
      "metadata_action": null
    }
  ],
  "added_operators": [
    {
      "kind": "equivalence",
      "pair_id": "eq_root_ab",
      "lineage": "independent_experimental",
      "labels": ["gcn_root_a", "gcn_root_b"],
      "warrant_prior_float": 0.95,
      "warrant_prior_beta": [19, 1],
      "warrant_reason": "..."
    }
  ],
  "skipped": [
    {
      "reason": "dismissed_pairs.json",
      "pair_id": "dp_dummy",
      "verdict": "confirmed_equivalence"
    },
    {
      "reason": "merge_decisions_pending",
      "pair_id": "sim_001",
      "details": "cosine=0.91 on normalized content; surfaced to merge_decisions.todo"
    }
  ],
  "todo": [
    "review prior_tag=default claims (3 items)",
    "fill in merge_decisions.todo (1 pair surfaced)"
  ]
}
```

Note that **both** `prior_float` (the value emitted in the source fragment, when
relevant) and `prior_beta` (the original heuristic Beta) are reported. The
host wrapper picks whichever convention it needs.

## Anchor-resolution algorithm (the dedup gate)

For each premise in the run-folder(s):

1. Compute `normalized_content = normalize(premise.content)`.
2. Look up by `existingAnchors[label].content_normalized`. The host runtime is
   responsible for providing this; if a key is missing, the premise is treated
   as new.
3. If a matching label exists:
   - `anchor_decision: "reused_existing"`. No `claim(...)` emitted.
4. Else:
   - Mint a new label via `dsl_emit.mintLabel(<gcn_id>)`. On collision against
     `existingAnchors`, suffix `_2`, `_3`, ...
   - `anchor_decision: "new"`. Emit `claim(content, **metadata)`.

## How the host wrapper bridges to gaia-discovery's `claim()` hard constraint

The skill emits `$gaia-lang`-clean source. If the host (e.g. `gaia-discovery`)
requires its own `claim()` shape (e.g. `prior=[a, b]` inline + a mandatory
`metadata.prior_justification`), the wrapper does this in three steps:

1. Read the source fragment + `imports.json`.
2. For every entry in `added_claims` with `is_leaf == true`, rewrite the
   corresponding `claim(...)` call to add `prior=<prior_beta>` and to put
   `prior_justification=<prior_justification>` into the metadata kwargs.
3. Append the result to `plan.gaia.py` (via libcst or whatever AST tool the
   host uses).

This keeps `lkm-to-gaia` itself ignorant of any one host's claim-shape
extensions — it emits the language spec; downstream tooling adapts.

## Re-runnability

Running incremental mode twice on the same run-folder + plan should produce
**the same `imports.json`** (modulo timestamp), and the second run should add
nothing — every claim is now reused, every operator is now a known reference.
The host can use this as a sanity check.

## What incremental mode does NOT do

- It does not edit `plan.gaia.py` itself; it only emits the fragment.
- It does not call `gaia.inquiry`, `gaia.bp`, or any host-framework module.
- It does not write a `priors.py`, a `cross_paper.py`, or a `pyproject.toml`.
- It does not write artefacts to `artifacts/lkm-discovery/` of the plan
  directory. The host can choose to copy the source run-folders into the plan
  project if it wants reproducibility; the skill itself does not.
