# Agent Instructions

Use the skill files in `skills/` as the source of truth.

When a task involves LKM API calls, evidence-chain retrieval, claim dependency graphs, Graphviz evidence diagrams, or academic reviews based on claim graphs:

1. Read the relevant `skills/<name>/SKILL.md`.
2. Load referenced files under that skill's `references/` directory only when needed.
3. Use scripts under `scripts/` rather than rewriting fragile API or graph-checking utilities.
4. Keep evidence dependencies separate from context/background.
5. Preserve raw retrieval artifacts and audit decisions whenever possible.
6. When the user gives a **target conclusion**, **first** ensure the LKM root has **`total_chains > 0`** (search + `evidence` probe on candidates if the first ID is empty). Only then enumerate **native premises** from those chains and, for **each premise**, invest deliberate retrieval effort to find **prior papers’ conclusion-type claims** whose **propositional content** supports that premise (wording will not match exactly). Classify those edges as `upstream_conclusion_support` when appropriate. **Do not** default to inventing synthetic premises when chains are missing unless the user **explicitly waives** chain-backed mode in writing.
7. **Empty premise text / `claim not found` on premise ids:** anchor retrieval on the **parent chain’s `steps`**, document `anchor_step_ids` in the audit, and still draw the premise node with a **human-readable** label (e.g. 中文「无字前提，锚定步骤 …」)—see `skills/evidence-subgraph/references/premise-upstream-support.md`.
8. **Figures:** every graph node needs a **short natural-language label** in the user’s locale; use the **real `gcn_*` id as the Graphviz node name** for the root, not opaque names like `ROOT`; set **CJK-capable fonts** for Chinese labels—see `skills/evidence-subgraph/references/graph-output.md`.
9. **Figure aesthetics:** use the **premium Graphviz palette** (light canvas, white cluster panels, **dark slate root**, sky premises, indigo upstreams, emerald second tier, slate-mist context, ink/indigo/slate edges)—do not ship default rainbow fills unless the user opts out.
10. **Depth:** when an upstream node has **`total_chains > 0`**, optionally **unpack another tier** (same per-premise discipline) until chains dry up or the user stops scope creep.

Do not specialize these skills to one scientific field. Domain knowledge may guide judgment, but the workflow must remain reusable across disciplines.
