---
name: orchestrator
description: Thin router for project-local LKM/Gaia skills. Use first for LKM-driven or Gaia-graph tasks. Classifies the user request and points the agent to the right atomic skill or SOP. Two main maintained workflows — LKM → Gaia package via $lkm-search and $lkm-explorer (claim-driven, contradiction-driven), and Paper → Gaia package via $formalize (single-paper, 4-phase). Both emit packages conforming to the $gaia-package contract. $lkm-search-internal provides paper full-text access. Evidence-subgraph and scholarly-synthesis are independent optional branches; gaia-cli is the CLI toolchain reference.
---

# Orchestrator

## Role

This is the lightweight front door for project-local LKM/Gaia work. It does not
retrieve evidence, write Gaia DSL, build graphs, or write synthesis prose. It
routes the task and loads the right SOP or atomic skill.

## Atomic Skills

- **`$lkm-search`** — Bohrium LKM public HTTP API: search claims/questions,
  trace reasoning chains, search by reasoning pattern, batch-fetch variable
  details, and retrieve paper knowledge graphs. The primary API skill for all
  external LKM interactions.
- **`$lkm-search-internal`** — Bohrium LKM internal API: fetch paper full-text
  markdown and images (`POST /papers/content/batch`). Requires internal
  whitelist access.
- **`$gaia-package`** — references-only contract atomic for the unified
  `<name>-gaia/` package shape, generic emit-mapping rules, and the
  `graph_growth_log.jsonl` v1 audit schema. Consumed by every Gaia-emitting
  skill; no scripts, no runtime workflow.
- **`$lkm-explorer`** — contract-driven LKM exploration that maps LKM raw
  match/evidence/source payloads into Gaia DSL per `$gaia-package`, via its
  progressive five-step workflow.
- **`$formalize`** — single-paper formalization: reads a paper Markdown,
  performs four analytical phases (extract conclusions / build reasoning chain
  / review weak points / emit), and produces a Gaia knowledge package per
  `$gaia-package`. Phase 1b cross-grounds via `$lkm-search` `/search` reverse
  trace.
- **`$gaia-cli`** — Gaia CLI toolchain reference (`init`, `compile`, `check`,
  `infer`, `render`, `register`, `add`). Pure documentation; consulted by
  callers running quality gates after package emission.
- **`$gaia-review-lite`** — lightweight ("flash") scientific audit prompt
  template for a compiled Gaia package. Claim+contradiction-centric quick
  review producing `docs/scientific_story.md` and
  `docs/open_questions_review.md`. References-only documentation atomic;
  covers ~30-40% of named IR primitive types — see its `## Coverage`
  section. `$gaia-review-deep` (TBD) is the planned full-IR follow-up.
- **`$evidence-subgraph`** — optional graph-only branch for a chain-backed root;
  not an upstream dependency of `$lkm-explorer`.
- **`$scholarly-synthesis`** — optional/future prose branch from an audited
  evidence graph and `data.papers`; not part of the LKM/Paper → Gaia package
  loop.

There is no local render skill. For package visualization, use Gaia CLI or
package-specific render commands after compilation/inference.

## Routing

### LKM -> Gaia Package

Use this for prompts such as "build a Gaia package", "formalize this LKM claim
into Gaia", "extend the package", "clean duplicate claims", or "continue
growing this graph". This is the only maintained LKM-explorer workflow; support
search, contradiction/open-question search, duplicate cleanup, and iterative
root-claim frontier expansion all route through the same SOP.

1. Read `references/lkm-explorer-sop.md`.
2. Read `$lkm-search/SKILL.md` before any API calls.
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
   reverse trace (`$lkm-search` `/search`); Phase 1b is best-effort and skips
   silently when the paper isn't in the LKM corpus.
3. Emit conforms to `$gaia-package`.
4. Run Gaia quality gates (per `$gaia-cli`) after emission: `gaia compile`,
   `gaia check --hole`, `gaia infer`.

### Raw LKM Search Task

Use `$lkm-search` directly when the user only asks to search, inspect, or
compare LKM claims/reasoning and does not ask for Gaia formalization. Use
`$lkm-search-internal` if they additionally need paper full-text markdown.

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
Gaia package, use Gaia CLI render commands directly (see `$gaia-cli` for the
toolchain reference) and preserve the same quality/audit discipline.

### Lite Scientific Review (claim + contradiction-centric)

Use `$gaia-review-lite` when the user asks for a quick / lite / flash
scientific review of a compiled Gaia package and a full IR audit is overkill.
It produces `docs/scientific_story.md` and `docs/open_questions_review.md`,
focused on `claim` knowledge plus `support` / `deduction` / `contradiction`
relations. Hypothesis-only items in `.gaia/inquiry` are out of scope.
Covered surface is ~30-40% of named IR primitive types — confirm the
uncovered list in `$gaia-review-lite`'s `## Coverage` section is acceptable
for the package at hand, otherwise wait for `$gaia-review-deep`.
