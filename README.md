# Gaia LKM Skills

Agent skills for working with Gaia/LKM-style claim graphs, evidence chains, dependency subgraphs, and scholarly reviews.

The repository is organized so the same skill bodies can be used by Codex, Claude-style plugin loaders, and Cursor-style rule/plugin workflows. The canonical skills live in `skills/`.

## Skills

- `lkm-api`: query LKM search/evidence APIs, preserve raw retrieval artifacts, and run **premise-driven search bundles** to find **prior papers’ conclusion-type claims** that may support each premise **on content** (not verbatim).
- `evidence-subgraph`: build graphs **rooted on a chain-backed user conclusion** (`evidence` → `total_chains>0`); treat **native** premises as a **worklist item** (including **empty-text** premises anchored on **`steps`**); classify edges including **`upstream_conclusion_support`**; render Graphviz/Mermaid with **locale-aware human labels**, **publication-style (premium) colors**, and audit tables (see `references/premise-upstream-support.md`, `references/graph-output.md`).
- `scholarly-review`: write standalone academic reviews from audited evidence structures, including **prior-result → premise → conclusion** narration when applicable.
- `evidence-graph-review`: orchestrator for the default pipeline: **chain-backed conclusion (`total_chains>0`) → native premises → per-premise upstream retrieval → audited graph → review** (chain-less synthetic mode only with explicit waiver).

## Plugin Manifests

The repo includes lightweight manifests for different agent runtimes:

- `.claude-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `.cursor-plugin/plugin.json`

They all point to the shared `skills/` directory. Cursor users can also use `.cursor/rules/gaia-lkm-skills.mdc`.

## Installation

For Codex-style local skills, copy or symlink the skill folders:

```bash
mkdir -p ~/.codex/skills
ln -s "$PWD/skills/lkm-api" ~/.codex/skills/lkm-api
ln -s "$PWD/skills/evidence-subgraph" ~/.codex/skills/evidence-subgraph
ln -s "$PWD/skills/scholarly-review" ~/.codex/skills/scholarly-review
ln -s "$PWD/skills/evidence-graph-review" ~/.codex/skills/evidence-graph-review
```

For plugin-capable runtimes, install this repository as a local plugin or point the runtime at the repository root.

## Design Boundary

The skills are intentionally field-neutral. LKM is treated as a retrieval/evidence-chain backend, not as a discipline-specific ontology. The graph and review skills can be used with any domain where propositions, premises, contexts, and source evidence must be audited.
