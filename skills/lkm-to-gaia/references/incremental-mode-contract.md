# Incremental-mode contract

What `lkm-to-gaia --mode incremental` does and does not do, and the side-channel `imports.json` schema. Cited by [`SKILL.md`](../SKILL.md) §"Mode `incremental`".

## When to use this mode

You are inside an iterative `plan.gaia.py` editing loop (the canonical case is the `gaia-discovery` `gd explore` 8-step loop, where the main agent is in Step 2 "THINK" and decides "I want to import LKM evidence for claim X"). Batch mode would clobber the existing `plan.gaia.py`; incremental mode produces a Python source fragment to **append**.

## Inputs

- One or more run-folders, same as batch mode.
- A path to the existing `plan.gaia.py` (or its enclosing directory).
- An `existingAnchors` map: `label -> SourceAnchor` from `gaia.inquiry.anchor.find_anchors(<plan_dir>)`. The host runtime obtains this via the `inquiry_bridge` (or equivalent) and passes it in. The skill itself does NOT call `gaia.inquiry` — that's the host's job.

## Outputs

1. **A Python source fragment** (string or stdout). The fragment is well-formed Python that the host appends verbatim to `plan.gaia.py`. The fragment has no top-level `from gaia.lang import ...` line — it assumes the existing file already has the canonical import block.
2. **An `imports.json` sidecar** with the schema below. Written to a path the host specifies (default: alongside `plan.gaia.py` as `lkm_imports_<iso8601>.json`).

## Invariants

- **Append-only.** Existing claim definitions in `plan.gaia.py` are never rewritten. Existing `metadata.action` flags, `metadata.action_status`, and reviewer-set priors are left untouched.
- **Dedup against `existingAnchors` first.** Before emitting any `claim(...)`, the skill checks whether a label with text-equal content already exists. If yes, reuse the label (do not emit a new `claim`); the host can then write `deduction(premises=[<existing_label>, ...], ...)` referencing it.
- **Operator linkage rule for soft dedup.** When two LKM premises look semantically equivalent (cosine threshold or `equivalences.json` non-merge lineage) and one of them already exists in `plan.gaia.py`, the skill emits an `equivalence(<existing>, <new>, ...)` operator instead of merging. The host's reviewer / next iteration can promote the merge if appropriate.
- **No `metadata.action` emission unless explicitly requested.** Imported `deduction(...)` strategies do not carry `metadata.action` by default. The host (e.g. the `gaia-discovery` `/lkm-evidence` wrapper) decides whether to mark them for sub-agent re-verification by editing the emitted text post-hoc, or by passing a flag through to the skill (TODO: not yet wired in this delivery).
- **Cross-paper operators land where the host says.** Incremental mode does NOT write a `cross_paper.py` module. All operators are appended to the same fragment as the claims; the host can libcst-relocate them to a separate module if desired.

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
      "prior": [16, 4],
      "prior_tag": "computational_result",
      "anchor_decision": "new",
      "anchor_existing_label": null
    },
    {
      "label": "gcn_some_existing",
      "lkm_id": "gcn_some_new_id",
      "lkm_ids_merged": [],
      "source_paper": "paper:p_xxx",
      "content_excerpt": "Same content as an existing claim",
      "prior": null,
      "prior_tag": null,
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
      "metadata_action": null
    }
  ],
  "added_operators": [
    {
      "kind": "equivalence",
      "pair_id": "eq_root_ab",
      "lineage": "independent_experimental",
      "labels": ["gcn_root_a", "gcn_root_b"],
      "warrant_prior": [19, 1]
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
    "fill in merge_decisions.todo (1 pair surfaced)",
    "consider explicit metadata.action on partial_disconfirm contradiction (0 in this run)"
  ]
}
```

## Anchor-resolution algorithm (the dedup gate)

For each premise in the run-folder(s):

1. Compute `normalized_content = normalize(premise.content)`.
2. Look up by `existingAnchors[label].content_normalized` for any matching label. Note: `existingAnchors` does not in fact carry content text; the host runtime is expected to provide it via a pre-pass over `plan.gaia.py` (or pass a richer `existingAnchors` map). The skill treats the map as authoritative — if a key is missing, the premise is treated as new.
3. If a matching label exists:
   - `anchor_decision: "reused_existing"`, `anchor_existing_label: <label>`. No `claim(...)` emitted.
4. Else:
   - Mint a new label via `dsl_emit.mintLabel(<gcn_id>)`. Check uniqueness against `existingAnchors`; on collision, suffix `_2`, `_3`, ...
   - `anchor_decision: "new"`. Emit `claim(...)`.

## Re-runnability

Running incremental mode twice on the same run-folder + plan should produce **the same `imports.json`** (modulo timestamp), and the second run should add nothing — every claim is now reused, every operator is now a known reference. The host can use this as a sanity check.

## What incremental mode does NOT do

- It does not edit `plan.gaia.py` itself; it only emits the fragment.
- It does not call `gaia.inquiry`, `gaia.bp`, or any gaia-discovery-specific module. The integration with `gd explore` is the host's job (the `/lkm-evidence` wrapper, when shipped).
- It does not write a `priors.py`, a `cross_paper.py`, or a `pyproject.toml`. The plan directory already has these (or doesn't need them).
- It does not write artefacts to `artifacts/lkm-discovery/` of the plan directory. The host can choose to copy the source run-folders into the plan project if it wants reproducibility; the skill itself does not.
