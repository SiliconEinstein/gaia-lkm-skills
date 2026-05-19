# gaia-lkm-skills

LKM-side agent skills for building Gaia knowledge packages from LKM evidence chains.

The repo ships a family of atomic skills plus a thin orchestrator that classifies an incoming prompt and routes it to the right SOP or atomic skill. Two primary flows are maintained: **LKM -> Gaia package** via `$lkm-search` and `$lkm-explorer`, and **Paper -> Gaia package** via `$formalize` -- both emit Gaia knowledge packages per the upstream Gaia spec (see upstream `SiliconEinstein/Gaia` docs `docs/for-users/quick-start.md` and `docs/for-users/language-reference.md`). `$lkm-search-internal` provides paper full-text markdown access for whitelisted users. `$evidence-subgraph` and `$scholarly-synthesis` are independent optional branches.

## Documentation

- **[User Guide](docs/user-guide.md)** -- LKM-side companion guide (installation, authentication, LKM workflows). Assumes the reader already knows Gaia from upstream `SiliconEinstein/Gaia` docs `docs/for-users/`.
- **[Environment Setup](docs/user-guide.md#0-环境准备)** -- install Gaia, install gaia-lkm-skills, configure LKM accessKey
- **[Agent Usage](docs/user-guide.md#1-agent-使用指南)** -- how AI agents should use this repo

## Entry point

`skills/orchestrator/SKILL.md` is the single front door. Any agent handling an LKM-related prompt routes through it first. The orchestrator does not retrieve evidence, write Gaia DSL, build graphs, or write synthesis prose -- it picks the right SOP / atomic skill and hands off.

## Skill family

Atomic skills + one thin orchestrator. Full contracts live in each skill's `SKILL.md`; one-line purpose each:

- **`skills/orchestrator/`** — thin router. Classifies the user request and points to the right atomic skill or SOP. Routing paths: LKM → Gaia package, Paper → Gaia package, raw LKM search task, evidence graph only, scholarly synthesis, visualization (no local skill — use upstream `gaia run render` per `docs/for-users/cli-commands.md`).
- **`skills/lkm-search/`** — Bohrium LKM public HTTP API: search claims/questions, trace reasoning chains, search by reasoning pattern, batch-fetch variable details with v2 metadata, and retrieve paper knowledge graphs. Workflow-driven skill covering the full external surface (search → reasoning → variables → papers/graph → reasoning/search).
- **`skills/lkm-search-internal/`** — Bohrium LKM internal API: fetch paper full-text markdown and embedded images (`POST /papers/content/batch`). Requires internal whitelist access.
- **`skills/lkm-explorer/`** — contract-driven LKM exploration → Gaia knowledge package per the upstream Gaia spec. Maps raw LKM search/reasoning/source payloads into Gaia DSL via a five-step contradiction-driven workflow. Two modes: `batch` (fresh package) and `refresh` (extend or repair an existing package in place).
- **`skills/formalize/`** — paper-driven sibling to `$lkm-explorer`. Reads a single physics paper Markdown and emits a Gaia knowledge package per the upstream Gaia spec via a four-phase analytical workflow (extract conclusions → reconstruct reasoning chain → audit weak points → emit DSL). Phase 1b cross-grounds the paper against LKM's existing graph via `$lkm-search`'s `/search` reverse trace (best-effort; skips silently when the paper isn't in the corpus).
- **`skills/evidence-subgraph/`** — build / audit / render an evidence graph from LKM chain payloads (factor diamonds, three-class edge taxonomy, chain-bounded discipline). Optional graph-only branch; not an upstream dependency of `$lkm-explorer`.
- **`skills/scholarly-synthesis/`** — *optional / future-work*: write a domain-vocabulary scholarly synthesis from an audited evidence graph + bibliographic metadata. Not part of the LKM/Paper → Gaia package loop.

For Gaia DSL primitives (`claim` / `derive` / `contradict` / `equal` body discipline, metadata kwargs, package layout) and the Gaia CLI (`build init`, `build compile`, `build check`, `run infer`, `run render`, `pkg register`, `pkg add`, `pkg scaffold`, `author`, `bayes`), see the upstream `SiliconEinstein/Gaia` docs:

- `docs/for-users/quick-start.md` -- end-to-end workflow.
- `docs/for-users/language-reference.md` -- DSL primitives + package structure.
- `docs/for-users/cli-commands.md` -- full CLI reference.
- `docs/for-users/hole-bridge-tutorial.md` -- prior calibration tutorial.

For runtime help, prefer `gaia <group> <cmd> --help`; the upstream CLI is self-documenting.

## Routing paths (full recipes in `skills/orchestrator/SKILL.md`)

1. **LKM → Gaia Package** — the maintained LKM-driven flow. Read `references/lkm-explorer-sop.md`, then `$lkm-search/SKILL.md` before any API calls, then `$lkm-explorer/SKILL.md` once selected payloads are ready. `$lkm-explorer` runs its own progressive five-step workflow and creates its session todo. Support search, contradiction / open-question search, duplicate cleanup, and iterative root-claim frontier expansion are all channels inside this SOP — there is no separate expansion SOP. Upstream `gaia` CLI quality gates (see upstream `SiliconEinstein/Gaia` docs `docs/for-users/cli-commands.md`) close the turn.
2. **Paper → Gaia Package** — the maintained paper-driven flow. Read `$formalize/SKILL.md`, then run its four-phase workflow: extract conclusions → reconstruct reasoning chain → audit weak points → emit package. Phase 1b cross-grounds the paper against LKM's existing graph via `$lkm-search`'s `/search` reverse trace (best-effort; skips when the paper isn't in the corpus). Emit conforms to the upstream Gaia knowledge-package spec. Run Gaia quality gates (`gaia build compile`, `gaia build check --hole`, `gaia run infer` — see upstream `docs/for-users/cli-commands.md`) after emission.
3. **Raw LKM Search Task** — `$lkm-search` directly when the user only wants to search, inspect, or compare LKM claims/reasoning without Gaia formalization. Use `$lkm-search-internal` if additionally needing paper full-text markdown.
4. **Evidence Graph Only** — `$evidence-subgraph` only when the user explicitly asks for a closure-chain or evidence graph without Gaia formalization. Root must be chain-backed (`total_chains > 0`).
5. **Scholarly Synthesis** — `$scholarly-synthesis` only on explicit request. Requires audited evidence graph + audit table + `data.papers`. Kept separate from package construction.
6. **Visualization** — no project-local render skill. Use the upstream `gaia run render` command after `gaia build compile` / `gaia run infer` (see upstream `SiliconEinstein/Gaia` docs `docs/for-users/cli-commands.md`).

## How an agent uses this repo

1. Clone the repo.
2. Read `skills/orchestrator/SKILL.md` first; follow its `$lkm-search`, `$lkm-search-internal`, `$lkm-explorer`, `$formalize`, `$evidence-subgraph`, `$scholarly-synthesis` references on demand. For Gaia DSL syntax, CLI command reference, and package layout, follow upstream `SiliconEinstein/Gaia` docs `docs/for-users/`.
3. Each `skills/<name>/SKILL.md` is the contract for that skill. Per-skill `references/` directories carry on-demand supporting material (SOPs, palettes, templates).
4. Skills are plain Markdown directories -- runtime-agnostic. Any host that supports a "skill" or "rule" surface can register them by pointing at `skills/`.

## Design boundary

The skills are intentionally field-neutral. LKM is a retrieval / evidence-chain backend, not a discipline-specific ontology. The graph, formalization, and synthesis skills work for physics, chemistry, materials, biology, ML, climate, astrophysics, etc. -- any domain where propositions, premises, contexts, and source evidence must be audited.

## Contributing

See `AGENTS.md` for the collaboration contract and skill authoring conventions.
