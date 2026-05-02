# Gaia LKM Skills

Agent skills for working with Gaia/LKM-style claim graphs, evidence chains, dependency subgraphs, and scholarly syntheses.

The repository is organized so the same skill bodies can be used by Codex, Claude-style plugin loaders, and Cursor-style rule/plugin workflows. The canonical skills live in `skills/`.

## Skills

- `lkm-api`: query LKM search/evidence APIs, preserve raw retrieval artifacts, and run **premise-driven search bundles** to find **prior papers’ conclusion-type claims** that may support each premise **on content** (not verbatim).
- `evidence-subgraph`: build graphs **rooted on a chain-backed user conclusion** (`evidence` → `total_chains>0`); treat **native** premises as a **worklist item** (including **empty-text** premises anchored on **`steps`**); classify every edge into exactly **three semantic classes** — *chain support*, *background*, *verification support* (locale-rendered); render Graphviz/Mermaid with **locale-aware human labels**, **publication-style (premium) colors**, and chain-payload-anchored audit tables (see `references/source-ground-truth.md`, `references/graph-output.md`).
- `scholarly-synthesis`: write standalone academic syntheses from audited evidence structures, including **prior-result → premise → conclusion** narration when applicable.
- `lkm-to-gaia`: convert LKM evidence-chain payloads directly into a Gaia DSL knowledge package. Agent reads raw LKM evidence JSON + discovery flag files, performs semantic analysis (shared-premise dedup, equivalence vs merge decisions, contradiction promotion, warrant-prior assignment), and writes Gaia DSL source. No intermediate JSON format. Two modes: `batch` (fresh `<name>-gaia/` package) and `incremental` (Python source fragment to merge into an existing `plan.gaia.py`).
- `evidence-graph-synthesis`: orchestrator for the default pipeline: **chain-backed conclusion (`total_chains>0`) → native premises → per-premise upstream retrieval → audited graph → {synthesis | Gaia knowledge package}** (chain-less synthetic mode only with explicit waiver).

## Plugin Manifests

The repo includes lightweight manifests for different agent runtimes:

- `.claude-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `.cursor-plugin/plugin.json`

They all point to the shared `skills/` directory. Cursor users can also use `.cursor/rules/gaia-lkm-skills.mdc`.

## Installation (agent-agnostic)

These skills are plain directories of Markdown — they are not tied to any single runtime. Any agent that supports a "skill" or "rule" concept can register them. Hand the steps below to your agent verbatim and it will install the skills into whatever location its host runtime uses.

**Step 1 — clone the repo.**

```bash
git clone https://github.com/SiliconEinstein/gaia-lkm-skills.git
```

**Step 2 — locate the skills.** Every skill lives under `skills/<skill-name>/` and contains:

- `SKILL.md` — frontmatter (`name`, `description`) plus the body the agent reads to learn the skill's role and workflow.
- `references/` (optional) — supporting reference files the SKILL.md links to; load them on demand.
- `agents/` (optional) — runtime-specific manifests (e.g. `openai.yaml`); read only if your runtime consumes them.

The five skills are: `lkm-api`, `evidence-subgraph`, `scholarly-synthesis`, `lkm-to-gaia`, `evidence-graph-synthesis`. Note: `lkm-to-gaia` has no scripts or `agents/` directory — the agent writes Gaia DSL directly.

**Step 3 — read each `SKILL.md`** so the agent understands the skill's purpose, its inputs, and how it hands off to the others. Start with `evidence-graph-synthesis` (the orchestrator entry point) and follow its `$lkm-api`, `$evidence-subgraph`, `$scholarly-synthesis`, `$lkm-to-gaia` references.

**Step 4 — register the skill directories verbatim into the host runtime's skill location.** Do not modify the skill contents. The registration mechanism is runtime-specific:

- **Claude Code** — copy or symlink each skill directory into `~/.claude/skills/` (user scope) or `.claude/skills/` (project scope), or install the whole repo as a plugin via the `.claude-plugin/plugin.json` manifest already in this repo.
- **Codex** — copy or symlink each skill directory into `~/.codex/skills/`. The `.codex-plugin/plugin.json` manifest in this repo can also be used by plugin-capable Codex builds.
- **Cursor** — point Cursor at this repo as a plugin via `.cursor-plugin/plugin.json`, or load the rule file `.cursor/rules/gaia-lkm-skills.mdc` directly into your project's `.cursor/rules/` directory.
- **OpenClaw** — copy or symlink each skill directory into OpenClaw's configured skill root (consult your OpenClaw docs for the exact path). The plain SKILL.md format is consumed without modification.

For any other runtime, follow the same pattern: clone the repo, point the runtime at `skills/` (or symlink each subdirectory into the runtime's skill location), and let the agent read the SKILL.md files from there.

## Design Boundary

The skills are intentionally field-neutral. LKM is treated as a retrieval/evidence-chain backend, not as a discipline-specific ontology. The graph and synthesis skills can be used with any domain where propositions, premises, contexts, and source evidence must be audited.
