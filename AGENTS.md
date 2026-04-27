# Agent Instructions

Use the skill files in `skills/` as the source of truth.

When a task involves LKM API calls, evidence-chain retrieval, claim dependency graphs, Graphviz evidence diagrams, or academic reviews based on claim graphs:

1. Read the relevant `skills/<name>/SKILL.md`.
2. Load referenced files under that skill's `references/` directory only when needed.
3. Use scripts under `scripts/` rather than rewriting fragile API or graph-checking utilities.
4. Keep evidence dependencies separate from context/background.
5. Preserve raw retrieval artifacts and audit decisions whenever possible.

Do not specialize these skills to one scientific field. Domain knowledge may guide judgment, but the workflow must remain reusable across disciplines.
