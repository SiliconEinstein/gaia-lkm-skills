---
name: lkm-api
description: Query Bohrium LKM APIs; discover chain-backed roots; handle premise ids that lack standalone evidence; per-premise search bundles; preserve raw JSON; hand off to evidence-subgraph for labeled graphs and audits.
---

# LKM API

## Purpose

Use LKM as a retrieval and evidence-chain backend. Preserve raw responses, because downstream graph auditing depends on exact claim IDs, source packages, factors, premises, and empty-chain status.

When the task is **conclusion-rooted dependency mapping**, retrieval is **premise-driven**: most API calls should trace back from **each premise** to candidate **upstream conclusions**, not from a single global keyword for the whole paper.

## Default Endpoints

Use `https://lkm.test.bohrium.com/api/v1` unless the user provides a different base URL, CLI `--base-url`, or `LKM_API_BASE_URL` (full base including `/api/v1`).

Common operations:

- search: `POST /search`
- evidence: `GET /claims/{id}/evidence`
- variables: `POST /variables/batch`
- papers-ocr: `POST /papers/ocr/batch`

Read `references/api-contract.md` for request/response expectations.

## Workflow (general)

1. Normalize the query.
   Prefer English scientific/technical terms when the source corpus is mostly English. Keep exact user terms if they are identifiers, names, or quoted phrases.

2. Run search.
   Use scopes `["claim", "setting"]`, public visibility, and an explicit `top_k`. Save raw JSON.

3. Fetch evidence for retained candidates.
   For every candidate that may enter a graph or review, call evidence lookup with `max_chains` and `sort_by=comprehensive` unless the user asks otherwise.

4. Preserve empty results.
   If a claim has empty content or `total_chains=0`, record it explicitly. Do not silently drop empty premises.

5. Return compact summaries.
   Summaries should include claim ID, source package, content snippet, total chains, factor IDs, and premise IDs. Keep raw JSON files for exact inspection.

## Workflow (conclusion root → upstream paper conclusions)

Use this whenever the user’s graph root is a **conclusion** and premises may cite **prior literature**.

### 0. Discover or verify a **chain-backed root** (mandatory default)

The default dependency workflow **starts from a root whose LKM evidence response has `total_chains > 0`**. Otherwise there are **no packaged premises** to walk backward from, and “dependency tracing” collapses into guesswork.

1. **If the user gives a claim ID:** call `GET /claims/{id}/evidence` (high `max_chains`) **immediately**.
2. **If `total_chains == 0`:** do **not** treat that ID as the working root. Instead:
   - run **search** with distinctive phrases from the user’s topic;
   - **probe** `evidence` on ranked hits (and nearby packages if needed) until you find a claim with **`total_chains > 0`** that is still a satisfactory **target conclusion** for the user’s question; **or**
   - ask the user for another ID / paper anchor; **or**
   - only if the user **explicitly waives** chain-backed mode in writing, proceed chain-less and document that waiver in the audit header (synthetic decomposition is **not** the default).
3. Record in artifacts: chosen root ID, `total_chains`, and `source_package`.

### A. Anchor the root (after Step 0)

1. Fix the chosen chain-backed root ID and save full `evidence` JSON.
2. Extract the **ordered premise list** from returned chains (including **empty premise slots** as explicit nodes). This list drives all further search.

### A2. Premise IDs may not round-trip standalone (API pit)

Some `premises[].id` values exist **only embedded** in a parent claim’s `evidence_chains`. Calling `GET /claims/{premise_id}/evidence` can return **`claim not found`** — this is **not** always an agent error.

- Log the response once per id, then **stop standalone probing** that premise.
- Drive text and search queries from the **parent chain** (`steps[].reasoning`, premise order, factor subtype) per `$evidence-subgraph` / `premise-upstream-support.md`.

### B. Per-premise query bundles (mandatory depth)

For **each readable premise** (see also `$evidence-subgraph` → `references/premise-upstream-support.md`):

1. **Decompose** compound premises into the smallest claims you will match separately if the API returns noise when bundled.
2. Run **multiple searches** per premise—aim for **at least three** meaningfully different queries, for example:
   - **Literal core terms** (nouns, relations, bounds).
   - **Formal / mathematical restatement** (symbols, named quantities, limits).
   - **Mechanism or pathway language** (different vocabulary from the premise).
   - **Instrumental or population shift** (same idea, different domain wording—only if still on-topic).
   - **Negation or boundary** (“failure of X under Y”) when that isolates the needed fact.
3. Increase `top_k` when results are homogeneous noise; **do not** stop at rank-1 if rank-2–5 are different packages and might be the real upstream.
4. For each **distinct promising claim** (especially conclusion-shaped text from **other** `source_packages` than the root):
   - call **`evidence`** on that claim ID to inspect its own chains (optional but helps false-positive control);
   - keep a short note: **why** it might support the premise (to be validated in `$evidence-subgraph`).

### C. Near-miss archive

For premises with weak LKM hits, save a small JSON or Markdown list: `{ premise_id, query, top_titles_or_snippets, reject_reason }`. That archive is part of the audit trail.

### D. Handoff

After retrieval:

- Use **`$evidence-subgraph`** to classify edges (including **`upstream_conclusion_support`**) and render the graph.
- Use **`$scholarly-review`** only after auditing.

## CLI Helper

Use `scripts/lkm.mjs` for deterministic API calls:

```bash
node skills/lkm-api/scripts/lkm.mjs search --query "your query" --top-k 10 --out search.json
node skills/lkm-api/scripts/lkm.mjs evidence --id gcn_xxx --max-chains 10 --out evidence.json
node skills/lkm-api/scripts/lkm.mjs variables --ids var1,var2 --out variables.json
node skills/lkm-api/scripts/lkm.mjs papers-ocr --ids paper:123,paper:456 --out ocr.json
```

The helper uses Node built-in `fetch` and writes JSON to stdout or `--out`.

## Handoff

After retrieval:

- Use **`$evidence-subgraph`** to classify dependencies and draw a graph.
- Use **`$scholarly-review`** to write a standalone review.
