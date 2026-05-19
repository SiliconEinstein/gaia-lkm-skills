# Contributor conventions

This file is the contributor contract for `gaia-lkm-skills`. Agent-agnostic — applies to any human or AI contributor working on the skill bodies, references, or orchestrator.

## Where to read first

- **`skills/orchestrator/SKILL.md`** — the single front door. Thin router: classifies the prompt and points to the right SOP or atomic skill. Start here on any unfamiliar task.
- **`README.md`** — repo-level orientation (skill catalog, routing paths).
- **`skills/<name>/SKILL.md`** — the contract for each atomic skill. The body is what an agent reads at runtime.
- **`skills/<name>/references/`** — on-demand supporting material (SOPs, palettes, templates). Linked from `SKILL.md`; do not inline.

## Collaboration contract

`main` is the single source of truth.

- Each contributor owns a personal branch (e.g. `dev_<name>`). Commit and push freely there.
- PRs go straight to `main`. There are no long-lived integration branches; rebase or merge `main` into your branch as needed.
- Conflict resolution belongs in the PR body, not the merge commit. State which side won, which side lost, and why — so the rationale survives in the PR history.
- Never rewrite `main` history.
- Never `gh pr create` autonomously on personal branches without explicit user authorization to ship.
- Every merge to `main` gets a CalVer tag: `v<YYYY.MM.DD>` (annotated, from the merge commit), suffixed `.1`, `.2`, … for multiple merges the same day (e.g. `v2026.05.08`, `v2026.05.08.1`). Tag message references the PR (`PR #N: <subject>`); push separately with `git push origin <tag>`.

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

- **`$lkm-search`** — HTTP I/O against the LKM public API (search / reasoning / reasoning-search / variables / papers-graph). No graph logic, no DSL emission.
- **`$lkm-search-internal`** — HTTP I/O against the LKM internal API (paper full-text markdown via `POST /papers/content/batch`). Whitelisted users only.
- **`$lkm-explorer`** — contract-driven LKM exploration → Gaia knowledge package per the upstream Gaia spec. LKM evidence → Gaia DSL via a five-step contradiction-driven workflow. No HTTP, no rendering.
- **`$formalize`** — paper-driven sibling to `$lkm-explorer`. Reads a single paper Markdown and emits a Gaia knowledge package per the upstream Gaia spec via a four-phase analytical workflow.
- **`$evidence-subgraph`** — graph build / audit / render only. Consumes `$lkm-search` JSON. Independent optional branch — not an upstream dependency of `$lkm-explorer`.
- **`$scholarly-synthesis`** — audited graph → article only. Independent optional branch.

Gaia DSL primitives (canonical v0.5: `claim` / `derive` / `contradict` / `equal`), package layout, and CLI command reference are owned by upstream `SiliconEinstein/Gaia` — see `docs/for-users/language-reference.md`, `docs/for-users/quick-start.md`, and `docs/for-users/cli-commands.md`. The cli-as-client authoring surface (`gaia author <verb>` + `gaia pkg scaffold`) is the v0.5 agent-first path for editing knowledge packages without writing Python by hand; see `docs/reference/cli/author.md`. This repo is LKM-side only and does not duplicate upstream teaching.

There is no project-local render skill. For visualization of a compiled Gaia package, use the upstream `gaia run render` command (see upstream `docs/for-users/cli-commands.md`).

**No cross-skill orchestration is baked into atomic skills.** If a workflow needs two skills, that workflow lives in `skills/orchestrator/SKILL.md` (or, for narrow paths, in a sub-shape section there). Atomic skills must remain composable — invokable individually without the orchestrator.

### `$<skill>` reference syntax

Cross-skill references in any `SKILL.md` body use `$<skill-name>` (e.g. `$lkm-search`, `$evidence-subgraph`). The orchestrator's catalog uses the same convention. When you add or rename a skill, grep the repo for the old `$<name>` and update.

### What goes in `SKILL.md` vs `references/`

- `SKILL.md` — contract, role, invariants, when-to-invoke, brief workflow. The agent reads it on every invocation.
- `references/<topic>.md` — palettes, templates, full taxonomies, troubleshooting tables. Loaded on demand from `SKILL.md` links.

If a `SKILL.md` is over ~300 lines, push reference material out into `references/`.

## Audit-trail discipline

Any skill that writes to a `<domain>-gaia/` package MUST preserve prior emitted statements (`skills/orchestrator/references/lkm-explorer-sop.md` — the single maintained workflow; support search and contradiction/open-question search are channels inside it):

- Refresh runs are append-only at the DSL boundary. A claim or operator already in the package stays — `gaia author`'s pre-write collision check enforces this at the CLI surface.
- Inquiry state under `.gaia/inquiry/` survives across rounds.

The exact emission and refresh semantics are owned by the active SOP and the `$lkm-explorer` workflow — refer to those documents for ground truth.

## Field-neutrality

Skills must remain reusable across disciplines. Domain knowledge may guide judgment in examples, but the workflow and contracts must not specialize to one field. LKM is a retrieval backend, not a discipline-specific ontology.

## When in doubt

Read `skills/orchestrator/SKILL.md` and the SOP referenced by the routing path you're on. The orchestrator stays thin; the load-bearing rules live in the SOP and in each atomic skill's contract.
