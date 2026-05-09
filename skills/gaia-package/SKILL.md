---
name: gaia-package
description: References-only atomic defining the unified Gaia knowledge package contract — package layout and file templates, emit mapping rules for claim/deduction/support/contradiction/equivalence/question primitives plus provenance metadata (provenance_source enum, claim_kind, weak_types, p1/p2/review_prior, refs whitelist), and the graph_growth_log.jsonl v1 audit schema. Referenced by `$lkm-to-gaia` (LKM-driven exploration → Gaia DSL; pending rename to `$lkm-explorer`) and the upcoming `$formalize` skill. No scripts; pure contract.
---

# Gaia-Package

## Role

`$gaia-package` is a **contract atomic**. It defines the shared shape of any
`<name>-gaia/` knowledge package emitted by upstream skills, plus the audit log
that makes those packages replayable. It is references-only: no scripts, no
runtime workflow, no execution. Skills that *produce* Gaia packages (currently
`$lkm-to-gaia`; pending `$formalize`) consume this contract and add their own
upstream-specific rules on top.

The split exists so that the package-emission contract is authored once and
shared, rather than duplicated and drifted across every Gaia-emitting skill.

## What this skill defines

- The on-disk layout of a `<name>-gaia/` package (directory shape, naming
  conventions, source-file templates).
- The mapping rules from analytical objects (claims, deductions, supports,
  contradictions, equivalences, motivations) to Gaia DSL primitives, including
  the metadata kwargs that travel with each call (`source_paper`,
  `provenance_source`, `claim_kind`, `weak_types`, `p1`, `p2`, `review_prior`,
  `refs`, `lkm_id`, `lkm_original`).
- The `graph_growth_log.jsonl` v1 audit schema — event identity, decision
  vocabulary, `graph_delta` block, append-only / `supersedes_event_id`
  semantics, and the markdown audit-table conventions that pair with it.

## What this skill does NOT define

- **Upstream-specific workflow.** How an LKM round retrieves chains, how a
  paper is decomposed into conclusions and weak points, how a frontier expands,
  how cold start picks roots — none of that lives here. Each consumer skill
  owns its own workflow contract.
- **LKM-only audit shapes.** `retrieval_log.jsonl`, `merge_audit.md`,
  `merge_decisions.todo`, the `dismissed/` folder, and the `lkm-discovery/`
  audit-dir name are LKM-workflow-specific and remain in `$lkm-to-gaia`.
- **Audit-dir naming.** This skill specifies the layout *under* the audit
  directory (`graph_growth_log.jsonl`, `mapping_audit.md`, `input/`); the
  caller chooses the directory name (`lkm-discovery/` for `$lkm-to-gaia`,
  `paper-extract/` for the upcoming `$formalize`).
- **Gaia DSL grammar.** The Gaia library/CLI is the source of truth for what
  compiles. Verify with `gaia compile` and `gaia check --hole`.
- **Quality gates and review.** Running `gaia compile`, `gaia infer`,
  `gaia check --hole`, and any reviewer pass belongs to the caller.
- **Cross-skill orchestration.** Routing between skills lives in
  `$orchestrator`.

## Reference files

- [`references/package-shape.md`](references/package-shape.md) — directory
  layout, naming conventions, file templates (`pyproject.toml`, `__init__.py`,
  `paper_<key>.py`, `cross_paper.py`, `priors.py`, `references.json`),
  multi-paper vs single-paper layout, Python LaTeX raw-string convention,
  audit-dir layout (caller-named).
- [`references/emit-mapping.md`](references/emit-mapping.md) — claim /
  deduction / support / contradiction / equivalence / question emission rules,
  the `provenance_source` / `claim_kind` / `weak_types` enums, `p1`/`p2`/
  `review_prior` semantics, `refs` whitelist (`figure` / `equation` /
  `citation` only), deduction warrant calibration, label rules, module
  placement, `references.json` (CSL-JSON) conventions, `__all__` rules.
- [`references/audit-log.md`](references/audit-log.md) — `graph_growth_log.jsonl`
  v1 schema (event-identity fields, decision vocabulary, `graph_delta`
  requirement, append-only / `supersedes_event_id`, single-event-per-deduction
  with multi-edge expansion, logical-vs-wall-clock ordering), `mapping_audit.md`
  table conventions, paper-extract subset semantics.

## Cross-refs

This contract is consumed by:

- **`$lkm-to-gaia`** (current name; pending rename to **`$lkm-explorer`** in a
  follow-up commit) — LKM evidence + audit flags → Gaia DSL. Adds frontier
  expansion, cold-start root selection, support-channel and
  open-question/conflict channel handling, retrieval logging, and the
  `lkm-discovery/` audit-dir on top of this contract.
- **`$formalize`** (planned; not yet created) — single-paper Markdown →
  Gaia DSL. Adds Phase 1–4 paper-decomposition workflow, conclusion / weak-point
  / highlight extraction, and the `paper-extract/` audit-dir on top of this
  contract.

Follow-up commits will (1) rename `$lkm-to-gaia` to `$lkm-explorer` and prune
the now-shared content from its references, (2) create `$formalize`, and
(3) update `$orchestrator`'s atomic-list and the AGENTS.md atomicity section.
None of those changes are part of this commit.

For frontmatter shape, atomicity discipline, and `$<skill>` cross-ref
convention, see [`AGENTS.md`](../../AGENTS.md). For the routing front door, see
[`$orchestrator`](../orchestrator/SKILL.md).
