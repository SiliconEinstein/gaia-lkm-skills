# Contributor conventions

This file is the contributor contract for `gaia-lkm-skills`. Agent-agnostic — applies to any human or AI contributor working on the skill bodies, references, or orchestrator.

## Where to read first

- **`skills/orchestrator/SKILL.md`** — the single front door. Workflow, turn shapes, audit-trail contract, invariants. Start here on any unfamiliar task.
- **`README.md`** — repo-level orientation (skill catalog, package layout, turn-shape one-liners).
- **`skills/<name>/SKILL.md`** — the contract for each atomic skill. The body is what an agent reads at runtime.
- **`skills/<name>/references/`** — on-demand supporting material (palettes, templates, contracts). Linked from `SKILL.md`; do not inline.

## Collaboration contract

`main` is the single source of truth.

- Each contributor owns a personal branch (e.g. `dev_<name>`). Commit and push freely there.
- PRs go straight to `main`. There are no long-lived integration branches; rebase or merge `main` into your branch as needed.
- Conflict resolution belongs in the PR body, not the merge commit. State which side won, which side lost, and why — so the rationale survives in the PR history.
- Never rewrite `main` history.
- Never `gh pr create` autonomously on personal branches without explicit user authorization to ship.

## Skill authoring discipline

### Frontmatter shape

Every `skills/<name>/SKILL.md` opens with YAML frontmatter:

```yaml
---
name: <skill-name>           # kebab-case, matches directory name
description: <one paragraph> # what this skill does + when to invoke it
---
```

The `description` is what an agent reads to decide whether to invoke the skill. Keep it self-contained and trigger-rich. Mention domain neutrality if applicable.

### Atomicity discipline

Each atomic skill does **one thing** and exposes a clean contract:

- **`$lkm-api`** — HTTP I/O against LKM only. No graph logic, no DSL emission.
- **`$evidence-subgraph`** — graph build / audit / render only. Consumes `$lkm-api` JSON.
- **`$lkm-to-gaia`** — LKM evidence → Gaia DSL only. No HTTP, no rendering.
- **`$gaia-render`** — `<domain>-gaia/` or `plan.gaia.py` → visualization only.
- **`$scholarly-synthesis`** — audited graph → article only.

**No cross-skill orchestration is baked into atomic skills.** If a workflow needs two skills, that workflow lives in `skills/orchestrator/SKILL.md` (or, for narrow paths, in a sub-shape section there). Atomic skills must remain composable — invokable individually without the orchestrator.

### `$<skill>` reference syntax

Cross-skill references in any `SKILL.md` body use `$<skill-name>` (e.g. `$lkm-api`, `$evidence-subgraph`). The orchestrator's catalog uses the same convention. When you add or rename a skill, grep the repo for the old `$<name>` and update.

### What goes in `SKILL.md` vs `references/`

- `SKILL.md` — contract, role, invariants, when-to-invoke, brief workflow. The agent reads it on every invocation.
- `references/<topic>.md` — palettes, templates, full taxonomies, troubleshooting tables. Loaded on demand from `SKILL.md` links.

If a `SKILL.md` is over ~300 lines, push reference material out into `references/`.

## Audit-trail contract

Any skill that writes to `<domain>-gaia/` MUST respect the orchestrator's audit-trail invariants:

- Append, never silently overwrite, in `artifacts/lkm-discovery/`.
- New verdicts go into `merge_audit.md` with `(label_a, label_b, verdict, reason, source-pointers)`.
- Dismissed candidates go into `dismissed/` with the rejection reason.
- Ambiguous cases go into `merge_decisions.todo` with a one-line user question.
- Open obligations live under `.gaia/inquiry/` and are honoured on the next turn.

Prior verdicts are honoured. A pair already merged stays merged; a candidate already dismissed is not re-introduced silently.

## Field-neutrality

Skills must remain reusable across disciplines. Domain knowledge may guide judgment in examples, but the workflow and contracts must not specialize to one field. LKM is a retrieval backend, not a discipline-specific ontology.

## When in doubt

Read `skills/orchestrator/SKILL.md`'s **Invariants** section. It enumerates the load-bearing rules: chain-backed root only, user-selected root only, chain payload as source of truth, audit-trail continuity, single growing package, loose-md flag files only, mandatory user-selection checkpoint, self-checks before declaring a turn complete.
