# Incremental-mode contract

> **Prerequisite — read `$gaia-lang` and the `$gaia-discovery` `gd explore` loop
> docs.** This document covers what `lkm-to-gaia --mode incremental` produces;
> the host runtime is responsible for reading the output and editing `plan.gaia.py`.

## When to use this mode

You are inside an iterative `plan.gaia.py` editing loop. Batch mode would clobber
the existing file; incremental mode produces a Python source fragment to **append**
plus an `imports.json` sidecar.

## Inputs

- Raw LKM evidence JSON for one or more roots (same as batch mode).
- `contradictions.md` and `equivalences.md` from the orchestrator.
- A path to the existing `plan.gaia.py` (or its enclosing directory).
- An `existingAnchors` map: `label -> {content_normalized}` from the host runtime.

## Outputs

1. **A Python source fragment** (string) — `$gaia-lang`-clean. No top-level `from gaia.lang import ...` (assumes the existing file has it). The host appends verbatim to `plan.gaia.py`.
2. **An `imports.json` sidecar** — schema below. Describes every new label, prior, and operator.

## Invariants

- **Append-only.** Existing claim definitions are never rewritten.
- **`$gaia-lang`-clean.** `claim(content, **metadata)` with no `prior` kwarg; strategies positional-first; operator priors floats Cromwell-bounded.
- **Dedup against `existingAnchors` first.** Before emitting a new `claim(...)`, check if a label with text-equal content already exists. If yes, reuse the label.
- **Operator linkage for soft dedup.** When a new premise is semantically equivalent to an existing claim, emit `equivalence(<existing>, <new>, ...)` rather than merging.

## `imports.json` schema

```json
{
  "schema_version": "lkm-to-gaia-imports/1.0",
  "generated_at": "<ISO 8601>",
  "source_roots": ["gcn_xxx", "..."],
  "added_claims": [
    {
      "label": "gcn_2386d1b6",
      "lkm_id": "gcn_2386d1b6908c4e6c",
      "lkm_ids_merged": [],
      "source_paper": "paper:814606014073536517",
      "content_excerpt": "Coulomb interactions projected to Landau level expressed in Haldane pseudopotentials.",
      "is_leaf": true,
      "prior_float": 0.80,
      "prior_justification": "computational result (LKM chain premise); TODO:review",
      "anchor_decision": "new",
      "anchor_existing_label": null
    }
  ],
  "added_strategies": [
    {
      "kind": "deduction",
      "factor_id": "gfac_9d88a6f8",
      "source_paper": "paper:814606014073536517",
      "premise_labels": ["gcn_2386d1b6", "gcn_9f7a3e33"],
      "conclusion_label": "gcn_66ac13c8",
      "warrant_prior_float": null,
      "warrant_reason": null
    }
  ],
  "added_operators": [
    {
      "kind": "equivalence",
      "labels": ["gcn_66ac13c8", "gcn_73c88cf"],
      "warrant_prior_float": null,
      "warrant_reason": "same paper, different version (arXiv→PRB); merged, no operator emitted",
      "note": "merged into single claim"
    }
  ],
  "todo": [
    "review prior_tag=default claims",
    "fill in merge_decisions.todo (if any surfaced)"
  ]
}
```

## How the host wrapper bridges to gaia-discovery

The skill emits `$gaia-lang`-clean source. If the host (e.g. `gaia-discovery`) requires
a different `claim()` shape (e.g. `prior=[a, b]` inline), the wrapper post-processes
the fragment using the `imports.json` sidecar.

## Re-runnability

Running incremental mode twice on the same inputs should produce the same
`imports.json` (modulo timestamp). The second run should add nothing — every claim
is now reused.

## What incremental mode does NOT do

- It does not edit `plan.gaia.py` itself; it only emits the fragment.
- It does not call `gaia.inquiry`, `gaia.bp`, or any host-framework module.
- It does not write `priors.py`, `cross_paper.py`, or `pyproject.toml`.
- It does not write to `artifacts/lkm-discovery/`.
