# `lkm-to-gaia` skill — design note

Status: design v0 (2026-05-02). This note is the prose record of the decisions that
shape `skills/lkm-to-gaia/`. The canonical machine-checkable contracts live in the
`SKILL.md` and the four reference files under `skills/lkm-to-gaia/references/`.

## Purpose

Convert the artefacts produced by `$evidence-subgraph` (the run-folder per the
[`evidence-graph-run/2.0`](../skills/evidence-subgraph/references/run-folder-output-contract.md)
contract) directly into Gaia DSL — either:

- a fresh, standalone Gaia knowledge package (mode `batch`), or
- a fragment that merges into an existing `plan.gaia.py` (mode `incremental`,
  intended for use from inside a `gaia-discovery` `gd explore` loop).

The skill sits in the same repo as the existing four LKM skills and is routed
via the orchestrator (`$evidence-graph-synthesis`) — it is the fifth peer of
`$lkm-api`, `$evidence-subgraph`, `$scholarly-synthesis`,
`$evidence-graph-synthesis`. From the orchestrator's standpoint it is parallel
to `$scholarly-synthesis`: same input contract (a run-folder), different output
register (Gaia DSL Python instead of Markdown / LaTeX prose).

## Design decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Strategy default for every `gfac_*` factor | `deduction(premises=[...], conclusion=...)` with no warrant prior | User pick; consistent with `gaia-discovery` v0.x default of "都不给 reason / prior" on strategies, pushes uncertainty to leaf priors |
| 2 | Scope per invocation | multi-root single package | Lets cross-root `equivalence` / `contradiction` / `induction` operators live inside one factor graph |
| 3 | First deliverable | SKILL.md + 3 small primitive scripts (option C) | Mapping rules stay in markdown; mechanical correctness (DSL syntax, Beta priors, label uniqueness, `_validate_reason_prior` pairing) lives in tested primitives |
| 4 | Output of `batch` mode | a `<name>-gaia/` directory ready for `gaia compile` | Mirrors `gaia init` output |
| 5 | Output of `incremental` mode | a Python source fragment (not a diff) the agent appends after `find_anchors_for`-driven dedup | Keeps the wrapper that lives in `gaia-discovery` simple |
| 6 | Shared-premise extraction | hybrid: auto-merge exact text + lineage `same paper, different version`; surface ambiguous semantic-equivalents as `merge_decisions.todo`; keep independent confirmations distinct + linked via `equivalence(...)` | Avoids double-counting (user's stated concern) without erasing independent-confirmation information |
| 7 | Cross-validation `confirm` polarity | narrow exception to "always deduction" → `support` + `support` + `induction(support_1=, support_2=, law=)` | gaia's `induction` is the canonical idiom for "multiple independent observations confirm one law" and is structurally built on `support`, not `deduction` |
| 8 | Cross-validation `partial_disconfirm` polarity | `contradiction(a, b, ...)` + `# TODO:HUMAN-REVIEW` comment + emit a `SyntheticObligation` placeholder in incremental mode | Genuinely ambiguous; surface for judgement |
| 9 | Priors | Beta `[a, b]` per gaia-discovery `claim()` hard constraint; auto-seeded from premise-content keywords + `data.variables[].score` | Required form; heuristic seeds are TODO-marked for reviewer refinement |
| 10 | References | auto-built CSL-JSON from `data.papers`, key `<firstAuthor><year>` deduped by suffix letters | Single source of truth (LKM's `data.papers` block); avoids reaching for external bibliographic services |

## Two-mode contract (one-line summary)

- `batch`: read run-folders → emit a complete `<name>-gaia/` directory.
- `incremental`: read run-folders + an existing `plan.gaia.py` path → emit a
  Python source fragment to append, plus a side-channel `imports.json`
  describing what was added (consumed by `gaia-discovery`'s `/lkm-evidence`
  wrapper if/when that ships).

Both modes share the same primitives in `scripts/`. The mode flag changes only
the sink; everything upstream (load, dedup, emit) is identical.

## Out of scope (this delivery)

- The `gaia-discovery` `/lkm-evidence` slash-skill wrapper. Deferred —
  `incremental` mode is built so the wrapper can be a thin shell-out, but the
  wrapper itself ships in a separate repo.
- A `--auto-dispatch` / `--no-dispatch` flag for marking imported deductions
  with `metadata.action`. That decision is wrapper-level and only matters
  inside `gd explore`; the skill itself emits no `metadata.action` unless the
  caller explicitly asks for it.
- Re-running `gaia infer` or interpreting BP results. The skill's job ends
  when the package is on disk and `gaia compile .` succeeds; belief / weakness
  / publish-blocker analysis is the user's next step (or the wrapper's).

## Why these decisions are not encoded as code in this delivery

The mapping rules (decisions 1–2, 6–8) are policy that we expect to refine as
real packages emerge. They live in markdown — `SKILL.md` and
`references/mapping-contract.md` — exactly where the existing four skills put
their policy. The primitives encode only the mechanics that are easy to get
subtly wrong by hand:

- DSL syntax (kwargs vs positional split, `_validate_reason_prior` pairing)
- Beta-prior shape (Cromwell-bounded, integer-friendly)
- Label uniqueness (the QID grammar `[a-z_][a-z0-9_]*`)
- Schema validation against `evidence-graph-run/2.0`
- RFC 6901 pointer resolution

This split keeps the cost of changing policy low (edit markdown, no test churn)
while keeping the cost of mechanical bugs near zero (typed primitives, fixture
tests).
