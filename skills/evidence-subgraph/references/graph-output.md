# Graph Output Guide

## Minimum Artifacts

- graph source: `.dot`, Mermaid, or JSON
- rendered graph: PDF/PNG/SVG when requested
- audit table: Markdown or JSON
- raw retrieval/evidence files when available

## Labeling

Use short, readable labels. Two lines are usually enough:

- `关键结论`
- `方法设置`
- `模型假设`
- `实验背景`
- `未展开前提`

The labels should summarize reasoning role, not database IDs.

## Graphviz

Prefer automatic layout:

```bash
sfdp -Tpdf graph.dot -o graph.pdf
sfdp -Tpng graph.dot -o graph.png
```

Avoid manual constraints unless the automatic layout is unreadable.

## Verification

Before finalizing:

- count nodes and edges
- check cycles
- confirm every displayed chain has all premises
- confirm context edges are not described as dependencies
- inspect the rendered graph visually
