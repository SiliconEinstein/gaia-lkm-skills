---
name: evidence-graph-review
description: Universal entry point for any LKM-driven evidence-and-review task. Inspects the user's intent and routes to the right downstream skill(s) — `$lkm-api` directly for raw API access, narrowed search for explicit-topic asks, or the full e2e `$lkm-api → $evidence-subgraph → $scholarly-review` pipeline for "graph + review on a topic" requests. Includes a mandatory user-selection checkpoint between discovery and the build, and supports a graph-only mode (skip the review). Domain-agnostic: works for physics, chemistry, materials, biology, ML, climate, astrophysics, etc. Any agent handling an LKM-related user prompt should route through this skill first.
---

# Evidence Graph Review (LKM Universal Entry Point)

## Role

This is the **single front door** for every LKM-driven request. The orchestrator inspects the user's intent and routes:

- **Raw API access** (e.g. "match claims in LKM for X", "fetch evidence for `gcn_…`", "look up paper metadata Y") → delegate to **`$lkm-api`** directly. No graph, no review.
- **Topical evidence graph + review** (e.g. broad topic, family of materials/systems, specific phenomenon) → run the full pipeline `$lkm-api` discovery → user-selection checkpoint → `$evidence-subgraph` → `$scholarly-review`.
- **Graph-only on a topic** ("just build the evidence graph, no review") → run the pipeline through `$evidence-subgraph` and stop; do not invoke `$scholarly-review`.
- **Already-narrowed input** (user names a specific system AND a specific quantity / paper / claim id) → skip the broad-discovery step; go straight to graph (+ review unless graph-only).

The orchestrator does **not** retrieve, draw, or write itself. It sequences the downstream skills, gates the user-selection checkpoint, and hands artifacts forward.

## Routing decision tree (in order)

Apply each rule until one matches; that determines the path.

1. **User supplies a claim id or paper id directly and asks only for raw data** → route to `$lkm-api`. Return the raw JSON to the user. Stop.
2. **User asks for graph only** (explicitly: "no review", "just the graph", "evidence subgraph only") → run discovery + checkpoint + `$evidence-subgraph`. Stop after handing the graph + audit table back. Do not invoke `$scholarly-review`.
3. **User supplies a specific narrow target** (system + quantity, or a specific paper) and wants the e2e build → skip discovery; verify the chain-backed gate; graph; review.
4. **User supplies a broad / topical prompt** (no specific system + value yet) and wants the e2e build (graph + review) → run discovery → user-selection checkpoint → continue with chosen root → graph → review.
5. **Ambiguous** → ask the user one short clarifying question: "do you want raw API access, the evidence graph alone, or the full graph + review?" Default if the user does not answer: full e2e (option 4).

## End-to-End Workflow (full pipeline path)

The pipeline has a **mandatory user-selection checkpoint** between discovery and the build. Do not skip it: different chain-backed roots produce structurally different graphs, and the user must own the choice.

### 1. `$lkm-api` — broad-topic discovery (skip if narrow target supplied)

Convert the user's prompt to one or more free-text queries in the language(s) most likely to maximize recall on the corpus (often English for scientific corpora; preserve the user's terminology and named entities). If the prompt names a system or a quantity, include them; otherwise query by topic terms. Run `POST /claims/match` with body `{"text": "<query>", "top_k": ≥ 20, "filters": {"visibility": "public"}}` and save raw JSON. The candidate list is at `data.variables`. Vary the query (alternate names of the same effect, formula-level vs concept-level, synonyms across sub-fields) until the union of top results stops yielding new chain-backed candidates.

### 2. `$lkm-api` — chain-backed candidate filter (skip if narrow target supplied)

For each distinct candidate (deduplicated by claim id), call `GET /claims/{id}/evidence` with `sort_by=comprehensive`. Retain candidates with `total_chains > 0`. Drop the rest from root consideration.

### 3. **User-selection checkpoint (mandatory unless narrow target supplied)**

Present the chain-backed candidates to the user as a numbered short-list — typically 3–8 entries; never more than 10 — each as a single line of:

```
[N] <system / setting> | <quantitative claim> | <paper author–year> | <one-line takeaway why this is a meaningful root>
```

Then **stop and ask the user to pick one** (or to ask for more candidates, or to refine the topic). Do not pre-select. Do not proceed silently.

If you are running in an autonomous-test harness where the user cannot be reached interactively, stop after writing the candidate list to a file and return — do not autonomously pick a root. The harness operator is responsible for handing the chosen claim id back into a follow-up invocation.

The candidate list itself is a **first-class deliverable**: write it to `candidates.md` in the run folder so the choice is reproducible and auditable.

### 4. `$lkm-api` — pin the root and persist `data.papers`

Once the user has selected a candidate (claim id supplied) — or the user already supplied a narrow target:

- Re-fetch `evidence` for the chosen claim if more than a few minutes have passed (corpus may have changed). Confirm `total_chains > 0`.
- Identify the root paper id via `data.papers[<source_package>]` if populated; otherwise via `evidence_chains[].source_package`.
- Persist the relevant subset of `data.papers` (the entries for the root paper and any background-cited papers surfacing in the chain) — `$scholarly-review` will need them for the references list.

### 5. `$evidence-subgraph`

Hand off `(root evidence JSON, data.papers subset, save-folder path)`. The graph skill produces:

- a rendered graph in **DOT (Graphviz `neato` / `sfdp`)** as the canonical artifact, optionally with a **Mermaid `flowchart`** secondary using `linkStyle` for per-edge classes. Mermaid `mindmap` is **not** acceptable. Defer to `$evidence-subgraph` §5 for the authoritative renderer rules.
- an audit table with one row per non-trivial edge, anchored to the chain payload (premise / factor / step references);
- a cycle-check report.

Verify that:

- the edge taxonomy is exactly the three **semantic** classes — *chain support*, *background*, *verification support* — rendered in any locale (e.g. `链式支撑` / `背景` / `核验支撑` for Chinese). No fourth class such as `文献支撑`, `upstream_conclusion_support`, or `tier-2 文献支撑`;
- the graph is strictly chain-bounded — every node and edge traces back to LKM-returned content, no synthetic bridging;
- the best-effort numerical-anchor check has been run, and any unconfirmed anchors are explicitly noted in the audit (not silently dropped);
- CJK glyphs render correctly (no `□` tofu boxes) in any rendered PNG/SVG.

If a check fails, return to the graph skill with the gap report.

**Graph-only mode:** if the user requested graph-only, return the graph + audit table + cycle-check + relevant `data.papers` to the user here and **stop**. Skip step 6.

### 6. `$scholarly-review`

Hand off `(graph artifact, audit table, data.papers subset, save-folder path)`. The review skill produces a Markdown or LaTeX article following the 9-section closure-chain structure. Run the verification suite the review skill specifies:

- mandatory-inputs check (graph + audit table + `data.papers` all present);
- banned-phrase grep with English + locale-mirror lists (zero hits in main narrative or references);
- best-effort numerical-anchor check (each number located in the chain payload where possible; rows where it cannot be located are noted, not deleted);
- citation completeness (body ↔ references list, references built from `data.papers`);
- equation-number consistency.

If LaTeX, compile to PDF and inspect the log for missing-glyph / overfull / undefined-reference warnings before declaring done.

### 7. Final hand-off to the user

Report:

- the user-chosen root (system + value + paper id + author–year);
- artefact paths (`candidates.md`, graph source, audit table, review markdown / LaTeX, compiled PDF);
- the relevant `data.papers` metadata so the user can refer to the original sources for further detail;
- any unresolved gaps (anchors that could not be page-confirmed, candidate roots that almost matched, LKM endpoint anomalies, empty-content premises flagged for revisit).

## Reproducibility contract

The orchestrator is "reproducible" when, given the **same loose prompt**, two independent runs produce:

1. **Steady candidate list.** The same broad-topic match query yields essentially the same set of chain-backed candidates (order may drift; membership should not).
2. **Steady graph for any chosen candidate.** Once the user picks a candidate, the produced graph has the same root, same factor diamonds, same typed reasoning nodes (within wording tolerance), same three-class edge taxonomy, same audit anchors.
3. **Same-quality review for any chosen candidate.** The review covers the same closure chain, same banned-phrase compliance, same equation/units discipline, same citation set drawn from `data.papers`.

The reproducibility target is *not* byte-equivalence — it is steady **behaviour**.

## Invariants

- **Chain-backed root only.** No synthetic premises without explicit waiver.
- **User-selected root only** when more than one chain-backed candidate exists at the discovery step. The orchestrator never picks a root autonomously; it surfaces them and waits.
- **Chain payload is the source of truth.** The LKM JSON returned by `$lkm-api` (premise / factor / step / claim content + `data.papers`) is the only admissible source for graph nodes, edges, and audit anchors. No external paper text — no PDFs, no rendered article fetches, no web scrapes — is admitted.
- **Strict chain-bounded graph.** No synthetic bridging nodes for missing intermediates; gaps are recorded in the audit table, not papered over.
- **Three edge classes only** in the graph (any locale).
- **Banned-phrase main narrative** in the review (English + locale-mirror).
- **Mandatory graph for the review** — `$scholarly-review` does not run without an audited graph from `$evidence-subgraph`.
- **`data.papers` is the citation source** — no external bibliographic services; the references list is built from this block.

## When to use a different orchestrator

There is none — this is the unified entry point. Tasks that don't fit any of the routing rules above are out of scope; ask the user to reformulate.
