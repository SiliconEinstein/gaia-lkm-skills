---
name: orchestrator
description: Thin router for project-local LKM/Gaia skills. Use first for LKM-driven or Gaia-graph tasks. Classifies the user request and points the agent to the right atomic skill or SOP. The main maintained workflow is LKM -> Gaia package via $lkm-api and $lkm-to-gaia; evidence-subgraph and scholarly-synthesis are independent optional branches.
---

# Orchestrator

## Role

This is the lightweight front door for project-local LKM/Gaia work. It does not
retrieve evidence, write Gaia DSL, build graphs, or write synthesis prose. It
routes the task and loads the right SOP or atomic skill.

## Atomic Skills

- **`$lkm-api`** — Bohrium LKM HTTP API surface: match, evidence, variables,
  auth, raw JSON preservation, and API quirks.
- **`$lkm-to-gaia`** — maps LKM raw match/evidence/source payloads directly to
  Gaia DSL via its progressive five-step workflow.
- **`$evidence-subgraph`** — optional graph-only branch for a chain-backed root;
  not an upstream dependency of `$lkm-to-gaia`.
- **`$scholarly-synthesis`** — optional/future prose branch from an audited
  evidence graph and `data.papers`; not part of the LKM->Gaia package loop.

There is no local render skill. For package visualization, use Gaia CLI or
package-specific render commands after compilation/inference.

## Routing

### LKM -> Gaia Package

Use this for prompts such as "build a Gaia package", "formalize this LKM claim
into Gaia", "extend the package", "clean duplicate claims", or "continue
growing this graph".

1. Read `references/lkm-to-gaia-sop.md`.
2. Read `$lkm-api/SKILL.md` before any API calls.
3. Read `$lkm-to-gaia/SKILL.md` when selected LKM payloads are ready to map.
4. Let `$lkm-to-gaia` create and advance its own progressive todo/checklist.
5. Run Gaia quality gates from the SOP before declaring the turn complete.

### Contradiction-Driven Expansion

Use this when the user explicitly asks to "find contradictions", "explore
contradictions", or grow an existing Gaia package through contradictions.

1. Read `references/contradiction-driven-expansion-sop.md`.
2. Read `$lkm-api/SKILL.md` before any API calls.
3. Use `$lkm-to-gaia` refresh mode only after candidates are classified and
   selected for package changes.
4. Run the SOP quality gates before declaring the turn complete.

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
Gaia package, use repo/package Gaia CLI render commands directly and preserve
the same quality/audit discipline.
