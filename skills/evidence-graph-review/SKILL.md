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

### 2b. Discovery flag pass — contradictions and equivalences

Run a best-effort scan over the **full** match response from step 1 (both chain-backed and chain-less candidates — open questions whose conflicting side has no chain are still valuable). The discovery flow itself (chain-backed filter, user-selection checkpoint) is unaffected by this pass; the saved files are consumed downstream by `$evidence-subgraph` (for equivalence-pair dedup decisions) and `$scholarly-review` (for §5 cross-method narrative and §6 open-problems narrative).

For each candidate-vs-candidate comparison, the agent uses semantic judgement on `content` fields plus paper metadata in `data.papers`:

- **Contradiction pair** — two claims that, on the same topic with the same system / setting, assert numerically or qualitatively conflicting values, signs, scaling regimes, or directional outcomes. (e.g. one says μ\* = 0.13, another μ\* = 0.21 for the same compound; one says effect-X is positive, another says it is negative.) Save to **`contradictions.md`** in the run folder, one row per pair:

  ```
  | pair (id_a / id_b) | topic | side A claim | side B claim | source A (paper, role) | source B (paper, role) | why contradictory |
  ```

- **Equivalence pair** — two claims that assert the same proposition on the same topic. For each pair, classify the lineage using `data.papers`:
  - **same paper, different version** — both `source_packages` resolve to the same paper, OR one is an arXiv preprint and the other is the published journal version of the same work. Detect via DOI prefix `10.48550/arxiv.` and `area: "arXiv-…"` on one entry plus a matching non-arXiv DOI / journal entry; matching titles or author lists make this near-certain.
  - **independent experimental** — different papers, both observational / experimental in method.
  - **independent theoretical / computational** — different papers, both derive the result by theory / computation / simulation.
  - **cross-paradigm confirmation** — different papers, one experimental and one theoretical / computational.
  - **unclassified** — lineage cannot be confidently assigned from `data.papers` alone; flag for user inspection.

  Save to **`equivalences.md`** in the run folder:

  ```
  | pair (id_a / id_b) | topic | shared claim | source A | source B | lineage classification | note |
  ```

**Caps.** Cap each list at the **top 10 most-interesting pairs**. If more candidates exist, append a single trailing line `…and N more (see raw match JSON: <path>)`. "Most interesting" means: high-relevance candidates (top of the match score), pairs that disagree about a quantity central to the user's prompt, or pairs whose papers are widely cited.

**Empty case.** If no pairs are found, still write the file with a single line `(no pairs detected in this run)` so downstream skills can detect the empty case unambiguously.

**Narrow-target case (discovery skipped).** When the user supplies a narrow target and step 1 is skipped, the orchestrator still must produce both files for the downstream skills, even though there is no broad match response to scan. Write both files with a single line `(discovery skipped — narrow target supplied; no pairs scanned)` and proceed to step 4. Do **not** invent pairs from the chain payload alone; the discovery scan needs the broader candidate set to be meaningful.

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

Hand off `(root evidence JSON, data.papers subset, equivalences.md path, save-folder path)`. The graph skill produces:

- a **graph source** in **DOT (Graphviz `neato` / `sfdp`)** as the canonical format, optionally with a **Mermaid `flowchart`** secondary using `linkStyle` for per-edge classes. Mermaid `mindmap` is **not** acceptable. Defer to `$evidence-subgraph` §5 for the authoritative renderer rules.
- a **rendered raster** of the graph (PNG, PDF, or SVG) — required, not optional. `$scholarly-review` embeds this raster as Figure 1 of the body, so it must render with the right fonts (no `□` CJK tofu) before this step is considered complete.
- an audit table with one row per non-trivial edge, anchored to the chain payload (premise / factor / step references);
- a cycle-check report.

The graph skill consults `equivalences.md` when deciding whether to merge or keep separate two claims that assert the same proposition (see `$evidence-subgraph` §2's no-duplicate-nodes rule).

Verify that:

- the edge taxonomy is exactly the three **semantic** classes — *chain support*, *background*, *verification support* — rendered in any locale (e.g. `链式支撑` / `背景` / `核验支撑` for Chinese). No fourth class such as `文献支撑`, `upstream_conclusion_support`, or `tier-2 文献支撑`;
- the graph is strictly chain-bounded — every node and edge traces back to LKM-returned content, no synthetic bridging;
- the best-effort numerical-anchor check has been run, and any unconfirmed anchors are explicitly noted in the audit (not silently dropped);
- CJK glyphs render correctly (no `□` tofu boxes) in any rendered PNG/SVG.

If a check fails, return to the graph skill with the gap report.

**Graph-only mode:** if the user requested graph-only, return the graph + audit table + cycle-check + relevant `data.papers` to the user here and **stop**. Skip step 6.

### 6. `$scholarly-review`

Hand off `(graph artifact, audit table, data.papers subset, contradictions.md path, equivalences.md path, save-folder path)`. The review skill produces a Markdown or LaTeX article following the closure-chain structure. The **rendered graph is Figure 1 of the body**, placed immediately after the abstract — see `$scholarly-review` for the figure-placement rules. Run the verification suite the review skill specifies:

- mandatory-inputs check (graph + audit table + `data.papers` all present; `contradictions.md` and `equivalences.md` present even if empty);
- Figure 1 presence at the front of the body, with a domain-language caption that satisfies the banned-phrase rule;
- banned-phrase grep with English + locale-mirror lists (zero hits in main narrative or references);
- best-effort numerical-anchor check (each number located in the chain payload where possible; rows where it cannot be located are noted, not deleted);
- citation completeness (body ↔ references list, references built from `data.papers`);
- equation-number consistency.

If LaTeX, compile to PDF and inspect the log for missing-glyph / overfull / undefined-reference warnings before declaring done.

### 7. Final hand-off to the user

Report:

- the user-chosen root (system + value + paper id + author–year);
- artefact paths (`candidates.md`, graph source `.dot` / `.mmd`, **rendered graph raster** `.png` / `.pdf` / `.svg`, audit table, review markdown / LaTeX, compiled PDF, `contradictions.md`, `equivalences.md`, `missing-material.md` if the review skill produced one);
- the relevant `data.papers` metadata so the user can refer to the original sources for further detail;
- a **discovery-flags summary**: a one-paragraph reminder that `contradictions.md` lists potential open questions surfaced during discovery and `equivalences.md` lists same-proposition pairs with lineage classification; encourage the user to skim both. Mention the count of pairs in each file. If a file is empty, say so explicitly rather than omitting the line;
- a **missing-material reminder**, sourced from `missing-material.md` (which `$scholarly-review` writes when its best-effort figure/table reproduction needs to leave gaps): every place in the review where the prose references a figure or data table from a source paper that the chain payload could not supply verbatim — listed by section, with the cited paper's DOI so the user can fetch it for camera-ready. If `missing-material.md` is empty or absent (e.g. graph-only mode), say so explicitly rather than omitting the line;
- any unresolved gaps (chain-payload anchors that could not be located, candidate roots that almost matched, LKM endpoint anomalies, empty-content premises flagged for revisit).

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
