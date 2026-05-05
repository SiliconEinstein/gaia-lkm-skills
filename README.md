# gaia-lkm-skills

LKM-side agent skills for building Gaia knowledge packages from LKM evidence chains.

The repo ships a family of atomic skills plus a thin orchestrator that classifies an incoming prompt and routes it to the right SOP or atomic skill. The maintained primary flow is **LKM → Gaia package** via `$lkm-api` and `$lkm-to-gaia`; `$evidence-subgraph` and `$scholarly-synthesis` are independent optional branches.

## Entry point

`skills/orchestrator/SKILL.md` is the single front door. Any agent handling an LKM-related prompt routes through it first. The orchestrator does not retrieve evidence, write Gaia DSL, build graphs, or write synthesis prose — it picks the right SOP / atomic skill and hands off.

## Skill family

Four atomic skills + one thin orchestrator. Full contracts live in each skill's `SKILL.md`; one-line purpose each:

- **`skills/orchestrator/`** — thin router. Classifies the user request and points to the right atomic skill or SOP. Routing paths: LKM → Gaia package (the single maintained workflow — covers builds, extensions, contradiction/open-question search, duplicate cleanup, frontier expansion), raw LKM API task, evidence graph only, scholarly synthesis, visualization (no local skill — use Gaia CLI).
- **`skills/lkm-api/`** — Bohrium LKM HTTP client (match / evidence / variables verbs; `accessKey` auth; raw JSON pass-through).
- **`skills/lkm-to-gaia/`** — convert LKM raw match/evidence/source payloads directly into Gaia DSL source for a standalone `<name>-gaia/` package. Two modes: `batch` (fresh package) and `refresh` (extend or repair an existing package in place). Progressive five-step workflow.
- **`skills/evidence-subgraph/`** — build / audit / render an evidence graph from LKM chain payloads (factor diamonds, three-class edge taxonomy, chain-bounded discipline). Optional graph-only branch; not an upstream dependency of `$lkm-to-gaia`.
- **`skills/scholarly-synthesis/`** — *optional / future-work*: write a domain-vocabulary scholarly synthesis from an audited evidence graph + bibliographic metadata. Not part of the LKM → Gaia package loop.

## Routing paths (full recipes in `skills/orchestrator/SKILL.md`)

1. **LKM → Gaia Package** — the single maintained flow. Read `references/lkm-to-gaia-sop.md`, then `$lkm-api/SKILL.md` before any API calls, then `$lkm-to-gaia/SKILL.md` once selected payloads are ready. `$lkm-to-gaia` runs its own progressive five-step workflow and creates its session todo. Support search, contradiction / open-question search, duplicate cleanup, and iterative root-claim frontier expansion are all channels inside this SOP — there is no separate expansion SOP. SOP-defined Gaia quality gates close the turn.
2. **Raw LKM API Task** — `$lkm-api` directly when the user only wants raw API output, no Gaia formalization.
3. **Evidence Graph Only** — `$evidence-subgraph` only when the user explicitly asks for a closure-chain or evidence graph without Gaia formalization. Root must be chain-backed (`total_chains > 0`).
4. **Scholarly Synthesis** — `$scholarly-synthesis` only on explicit request. Requires audited evidence graph + audit table + `data.papers`. Kept separate from package construction.
5. **Visualization** — no project-local render skill. Use the package's own Gaia CLI render commands after `gaia compile` / `gaia infer`.

## How an agent uses this repo

1. Clone the repo.
2. Read `skills/orchestrator/SKILL.md` first; follow its `$lkm-api`, `$lkm-to-gaia`, `$evidence-subgraph`, `$scholarly-synthesis` references on demand.
3. Each `skills/<name>/SKILL.md` is the contract for that skill. Per-skill `references/` directories carry on-demand supporting material (SOPs, palettes, templates).
4. Skills are plain Markdown directories — runtime-agnostic. Any host that supports a "skill" or "rule" surface can register them by pointing at `skills/`.

## Design boundary

The skills are intentionally field-neutral. LKM is a retrieval / evidence-chain backend, not a discipline-specific ontology. The graph, formalization, and synthesis skills work for physics, chemistry, materials, biology, ML, climate, astrophysics, etc. — any domain where propositions, premises, contexts, and source evidence must be audited.

## Contributing

See `AGENTS.md` for the collaboration contract and skill authoring conventions.
