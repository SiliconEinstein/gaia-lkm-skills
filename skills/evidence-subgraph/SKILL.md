---
name: evidence-subgraph
description: Build, audit, and render evidence-dependence subgraphs from claim/premise/context data produced by LKM, Gaia, paper extraction, knowledge graphs, or manually supplied propositions. Use when Codex needs to trace premises and contexts, decide whether retrieved relations are true dependencies or background, remove semantic-search loops, create Graphviz/Mermaid graphs, or produce relation audit tables.
---

# Evidence Subgraph

## Principle

Retrieval proposes edges; reasoning validates them. Keep proof dependencies separate from context.

## Workflow

1. Establish root.
   Record root ID, source package, claim text, and traversal depth. If the user gave a root, do not silently switch roots.

2. Load evidence chains.
   Include all premises from every displayed chain. Preserve empty or unreadable premises as explicit nodes.

3. Trace readable premises and contexts.
   For each readable item, search or inspect nearby propositions. Fetch evidence for candidate support nodes when available.

4. Classify relations.
   Use `references/audit-rubric.md`. Do not draw semantic-similarity edges as dependencies without checking direction and support.

5. Render graph.
   Prefer Graphviz `dot`, `fdp`, or `sfdp` automatic layout with minimal constraints. Use short labels. Keep layout decisions separate from reasoning decisions.

6. Validate.
   Check for unintended cycles, missing premises, unclassified edge types, and unlabelled empty nodes. Use `scripts/check_dot_cycles.mjs` for DOT files.

7. Output audit.
   Write a compact table listing retained dependencies, retained context, rejected candidates, and unresolved items.

## Edge Styling

- solid dark: direct evidence-chain support
- dashed green: manually verified cross-source support
- dotted purple: context/background
- dotted gray: weak/generic background
- gray dashed node: empty/unexpanded premise

## Handoff

Use `$scholarly-review` after the subgraph is audited and rendered.
