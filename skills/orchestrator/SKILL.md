---
name: orchestrator
description: Thin router for project-local LKM/Gaia skills. Use first for LKM-driven or Gaia-graph tasks. Classifies the user request and points the agent to the right atomic skill or SOP. Two main maintained workflows — LKM → Gaia package via $lkm-api and $lkm-explorer (claim-driven, contradiction-driven), and Paper → Gaia package via $formalize (single-paper, 4-phase). Both emit Gaia knowledge packages per the upstream Gaia spec. Evidence-subgraph and scholarly-synthesis are independent optional branches.
---

# Orchestrator

## Role

This is the lightweight front door for project-local LKM/Gaia work. It does not
retrieve evidence, write Gaia DSL, build graphs, or write synthesis prose. It
routes the task and loads the right SOP or atomic skill.

Gaia DSL primitives, package layout, and CLI command reference are owned by
upstream `SiliconEinstein/Gaia` — see `docs/for-users/language-reference.md`,
`docs/for-users/quick-start.md`, and `docs/for-users/cli-commands.md`. This
orchestrator is LKM-side only and points at upstream for any
DSL/CLI/package-layout teaching.

## Atomic Skills

- **`$lkm-api`** — Bohrium LKM HTTP API surface: match, evidence, variables,
  auth, raw JSON preservation, and API quirks.
- **`$lkm-explorer`** — contract-driven LKM exploration that maps LKM raw
  match/evidence/source payloads into Gaia DSL per the upstream Gaia
  knowledge-package spec, via its progressive five-step workflow.
- **`$formalize`** — single-paper formalization: reads a paper Markdown,
  performs four analytical phases (extract conclusions / build reasoning chain
  / review weak points / emit), and produces a Gaia knowledge package per
  the upstream Gaia spec. Phase 1b cross-grounds via `$lkm-api` `/search`
  reverse trace.
- **`$evidence-subgraph`** — optional graph-only branch for a chain-backed root;
  not an upstream dependency of `$lkm-explorer`.
- **`$scholarly-synthesis`** — optional/future prose branch from an audited
  evidence graph and `data.papers`; not part of the LKM/Paper → Gaia package
  loop.

There is no local render skill. For package visualization, use upstream
`gaia run render` (see upstream `docs/for-users/cli-commands.md`) after
compilation/inference.

## Routing

### LKM -> Gaia Package

Use this for prompts such as "build a Gaia package", "formalize this LKM claim
into Gaia", "extend the package", "clean duplicate claims", or "continue
growing this graph". This is the only maintained LKM-explorer workflow; support
search, contradiction/open-question search, duplicate cleanup, and iterative
root-claim frontier expansion all route through the same SOP.

1. Read `references/lkm-explorer-sop.md`.
2. Read `$lkm-api/SKILL.md` before any API calls.
3. Maintain the LKM-explorer timeline logs required by the SOP for every
   package retrieval and graph-growth decision.
4. Read `$lkm-explorer/SKILL.md` when selected LKM payloads are ready to map.
5. Let `$lkm-explorer` create and advance its own progressive todo/checklist.
6. Run Gaia quality gates from the SOP before declaring the turn complete.

### Paper -> Gaia Package

Use this for prompts such as "review 一下这文章", "帮我看看这文章结构",
"把这论文 formalize 成 gaia 包", "paper.md → gaia", "produce a Gaia package
from this paper", or any variant where the upstream is a single paper Markdown
and the requested output is Gaia DSL or a Gaia knowledge package.

1. Read `$formalize/SKILL.md`.
2. Run the 4-phase workflow: extract conclusions → build reasoning chain →
   review weak points → emit package. Phase-3 cross-grounds via Phase 1b LKM
   reverse trace (`$lkm-api` `/search`); Phase 1b is best-effort and skips
   silently when the paper isn't in the LKM corpus.
3. Emit conforms to the upstream Gaia knowledge-package spec (see upstream
   `SiliconEinstein/Gaia` docs `docs/for-users/quick-start.md` and
   `docs/for-users/language-reference.md`).
4. Run upstream Gaia quality gates after emission: `gaia compile`,
   `gaia check --hole`, `gaia infer` (see upstream
   `docs/for-users/cli-commands.md`).

### Raw LKM API Task

Use `$lkm-api` directly when the user only asks to fetch, inspect, or compare
raw LKM API output and does not ask for Gaia formalization.

### Evidence Graph Only

Use `$evidence-subgraph` only when the user explicitly asks for a closure-chain
or evidence graph without Gaia formalization. The root must be chain-backed
(`total_chains > 0`). Stop after returning graph artifacts and audit table.

### Scholarly Synthesis

Use `$scholarly-synthesis` only when the user explicitly asks for prose/literary
synthesis. It requires an audited evidence graph, audit table, and `data.papers`
metadata. Keep this path separate from LKM->Gaia package construction.

### Visualization

No project-local render skill exists. If the user asks to visualize a compiled
Gaia package, use upstream `gaia run render` (see upstream
`SiliconEinstein/Gaia` docs `docs/for-users/cli-commands.md`) and preserve the
same quality/audit discipline.
