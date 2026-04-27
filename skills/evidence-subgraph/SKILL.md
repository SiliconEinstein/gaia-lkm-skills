---
name: evidence-subgraph
description: Build, audit, and render evidence-dependence subgraphs rooted on a chain-backed user conclusion (LKM total_chains>0); expand native premises from evidence chains (including empty-text premises anchored on factor steps); optional multi-tier unpack when upstream claims also have chains; locale-aware Graphviz labels (e.g. 中文短句, CJK fonts). Chain-less synthetic mode only with explicit waiver. Cycle checks and audit tables.
---

# Evidence Subgraph

## Principle

Retrieval proposes edges; reasoning validates them. **Proof dependencies** (what the root conclusion actually needs) must stay separate from **background context**. When premises re-use **prior literature’s conclusions**, finding those upstream nodes is a **deliberate per-premise retrieval task**: wording will not align; **content and inferential direction** decide support.

## Default root

Unless the user explicitly asks for a theme map or literature survey, assume the graph is **rooted on one target conclusion** (their claim of interest). Record root ID, source package, full conclusion text, and max depth. **Do not change the root** to a more convenient hit **except** when replacing a **chain-less** candidate with a **chain-backed** root per `$lkm-api` Step 0 (that replacement is required, not caprice).

## Workflow

### 0. Require a chain-backed root (with `$lkm-api`)

Before drawing structure: the root’s LKM `evidence` payload must have **`total_chains > 0`** so premises come from the system, not from analyst invention. If the user’s first ID is chain-less, **stop** and return to **`$lkm-api`** to **discover** an appropriate root or obtain an **explicit written waiver** for chain-less mode.

### 1. Establish root (conclusion)

Fix the **root conclusion** node: ID, package, text, `total_chains`, and why it matters. Resolve text → ID via search only when the resolved hit remains **chain-backed** or the user waives.

### 2. Load local evidence structure

Pull **all** evidence chains for the root (`total_chains`, factors, premises). **Preserve empty or unreadable premises** as explicit nodes—do not omit them from the worklist or graph.

### 3. Premise worklist (core effort)

For **each** premise instance (ordered, deduplicated by ID where applicable):

1. **Restate** the premise in one neutral sentence (what must hold for the root argument at this step). If LKM gives **`content: ""`**, derive the restatement and search queries from the **parent factor’s `steps`** (document `anchor_step_ids` in the audit—see `references/premise-upstream-support.md`). If `GET /claims/{premise_id}/evidence` returns **claim not found**, treat as **normal** for chain-internal ids and **do not** drop the premise.
2. **Upstream search pass** — this is where agents should spend most effort. Follow `references/premise-upstream-support.md`:
   - multiple **paraphrases and angles** (formalism, mechanism, key quantity, boundary condition, named effect, contrapositive);
   - retrieve **candidate conclusion-type claims** from other papers/packages;
   - fetch **evidence** for promising candidates when using LKM.
3. For each candidate, apply **`references/audit-rubric.md`** including **`upstream_conclusion_support`** vs `context` vs `noise`.
4. Log **rejected** high-scoring candidates with one-line reasons (lexical only, wrong population, wrong regime, reversed direction, duplicate of root package, etc.).
5. If nothing passes after disciplined search, mark **`unresolved`** and state what evidence would decide.

6. **Optional deeper tiers:** for any retained upstream with **`total_chains > 0`**, repeat steps 2–5 for that claim’s premises (same audit discipline). Stop per `references/premise-upstream-support.md`.

Coordinate retrieval tactics with **`$lkm-api`** (per-premise query bundles are expected there).

### 4. Context and non-support edges

Attach **context** (definitions, methods, instrument limits) only when it aids reading; never promote to `upstream_conclusion_support` without passing the content test.

### 5. Classify and render graph

- Layout: prefer Graphviz `dot`, `fdp`, or `sfdp`.
- **Labels (mandatory):** follow `references/graph-output.md` — **user-language short sentences** on every node; **real claim id as node name** for the root; **no** meaningless singletons like `ROOT` / `prem` as the only text; set **CJK-safe fonts** when labels are Chinese.
- **Visual roles:** distinguish **root conclusion**, **premises**, and **upstream paper conclusions** (shape or color—see `references/graph-output.md`).
- **Color:** apply the **premium palette** in `references/graph-output.md` (muted panels, dark root anchor, tier-2 accent) unless the user supplies a house style.

### 6. Validate

Run `scripts/check_dot_cycles.mjs` on DOT output. Inspect for accidental **semantic-retrieval cycles**. Ensure every premise from the package appears unless explicitly merged with justification in the audit.

### 7. Output audit

Produce a table (Markdown or JSON) with columns at minimum:

| downstream (premise or root) | upstream | relation class | one-sentence support bridge | queries tried (count) | rejected top candidates |

Separate section listing **unresolved** premises and **empty** premises.

## Edge styling (suggested)

- **solid dark:** `direct_support` (native evidence-chain edge)
- **dashed green:** `verified_support` (manual, same package or cross-source, not specifically “prior conclusion”)
- **dashed blue:** `upstream_conclusion_support` (prior paper conclusion → premise/root)
- **dotted purple:** `context`
- **dotted gray:** `weak_context`
- **gray dashed node border:** empty / unexpanded premise

## Handoff

After the subgraph is audited and rendered, use **`$scholarly-review`**. The review should reconstruct reasoning using the **premise ← upstream conclusion** structure where those edges exist.
