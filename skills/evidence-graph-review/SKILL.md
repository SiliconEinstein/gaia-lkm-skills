---
name: evidence-graph-review
description: Orchestrate conclusion-rooted mapping: chain-backed LKM root; per-premise upstream search (incl. empty premises via step anchors); optional multi-tier unpack; audited graphs with locale-aware human labels; scholarly review.
---

# Evidence Graph Review

## Role

Thin orchestration. Delegate to:

- **`$lkm-api`** — **discover or verify chain-backed root**; root `evidence` JSON; **per-premise** search bundles; near-miss archive.
- **`$evidence-subgraph`** — premise worklist from **LKM chains**, **`upstream_conclusion_support`** classification, graph + audit table + cycle check.
- **`$scholarly-review`** — standalone prose from audited reasoning (minimal system jargon).

## Primary user intent (default)

**Start from one target conclusion that LKM can unpack into evidence chains** (`total_chains > 0`). Build its **dependency subgraph** backward: native premises first, then—for **each premise**—heavy retrieval for **earlier papers’ conclusion-type claims** whose **content** supports that premise. **Verbatim match is not expected**; document the inferential bridge in the audit.

If the user’s first claim ID is **chain-less**, the pipeline **pauses for root discovery** (search + probe) or an **explicit waiver**—it does **not** silently invent premises.

## End-to-End Workflow

1. **`$lkm-api` — chain-backed root discovery**
   - `evidence` on user ID; if `total_chains == 0`, **search + probe** other candidates until a satisfactory root with **`total_chains > 0`** is found (or user waives).
   - Save root `evidence` JSON; enumerate **native premises** from chains (including empty slots).

2. **`$lkm-api` — per-premise upstream retrieval**
   - For **each premise**, run a **query bundle**; fetch `evidence` on distinct upstream candidates; archive rejected near-misses.
   - If premise `content` is **empty** or standalone `evidence` on the premise id **fails**, anchor queries on the **parent factor `steps`** and document `anchor_step_ids` in the audit.

3. **`$lkm-api` — optional deeper tiers**
   - For each high-value **`upstream_conclusion_support`** node, if `evidence` shows **`total_chains > 0`**, repeat step 2 for **its** premises (tier-2+ subgraph). Stop when further chains are empty or the user caps depth.

4. **`$evidence-subgraph` — audit and graph**
   - Read `references/premise-upstream-support.md` and `references/audit-rubric.md`.
   - Classify edges; use **`upstream_conclusion_support`** only when the prior-conclusion content test passes.
   - Render Graphviz (or Mermaid) with **`references/graph-output.md`** rules: **user-language node labels**, **root node name = real claim id**, **CJK-safe fonts** when needed, localized edge legends, and the **premium color system** (muted panels + dark root + tier accents); run `scripts/check_dot_cycles.mjs` on DOT.

5. **`$scholarly-review`**
   - Reconstruct **prior conclusions → premises → root** for a reader outside the system.

6. **Finalize**
   - Report root `total_chains`, premise counts, upstream hit rates, unresolved premises, waiver status (if any), **empty-premise anchor summary**, and **figure label language** used.

## Default Output Set

- root `evidence` JSON + per-premise search JSON (organized by premise ID or folder)
- near-miss / rejection log
- audited relation Markdown (or JSON)
- graph `.dot` / rendered PNG or SVG + cycle-check output
- review Markdown (and PDF only if the user requests compilation)

Do not let LKM-specific terms dominate the review. They belong in audit artifacts, not in the main academic narrative.
