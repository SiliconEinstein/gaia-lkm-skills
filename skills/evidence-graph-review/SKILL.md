---
name: evidence-graph-review
description: Orchestrate the full workflow from LKM or other claim/evidence retrieval to an audited evidence graph and standalone scholarly review. Use when the user asks for an end-to-end task such as query LKM, trace every readable premise/context, build a dependency graph, render Graphviz/PDF outputs, and write a review or LaTeX paper.
---

# Evidence Graph Review

## Role

This is a thin orchestration skill. Delegate details to:

- `$lkm-api` for retrieval and evidence-chain JSON
- `$evidence-subgraph` for dependency auditing and graph rendering
- `$scholarly-review` for academic prose and PDF article outputs

## End-to-End Workflow

1. Use `$lkm-api`.
   Search, fetch evidence for the root claim, and save raw responses.

2. Use `$evidence-subgraph`.
   Trace every readable premise and context, classify candidate edges, preserve empty premises, render the graph, and write the audit table.

3. Use `$scholarly-review`.
   Write a standalone review or paper from the audited reasoning, include the graph, and compile requested PDFs.

4. Finalize.
   Report artifact paths, audit counts, graph relation semantics, and any limitations such as empty premises, unresolved candidates, API errors, or compilation warnings.

## Default Output Set

- raw search/evidence JSON
- audited relation Markdown/JSON
- graph source and rendered PDF/PNG/SVG
- review source and rendered PDF when requested

Do not let LKM-specific terms dominate the review. They belong in audit artifacts, not in the main academic narrative.
