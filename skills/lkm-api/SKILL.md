---
name: lkm-api
description: Query the Bohrium Large Knowledge Model (LKM) HTTP API; discover chain-backed roots; fetch evidence chains; resolve paper metadata; OCR root papers; preserve raw JSON. Returned reasoning chains are sourced from the papers listed in `data.papers` (paper metadata block) on every response — agents and downstream skills should treat that block as the authoritative paper-id → bibliographic-metadata map and surface it to the user as "for further information, refer to the original paper(s)". Hands off to `$evidence-subgraph` (graph) and `$scholarly-review` (review), orchestrated by `$evidence-graph-review`.
---

# LKM API

## Purpose

Use LKM as a retrieval and evidence-chain backend. Preserve raw responses, because downstream graph auditing depends on exact claim IDs, source packages, factors, premises, and `total_chains` status.

The reasoning chains returned by `evidence` are the LKM's distilled summary of the cited papers' propositional content; **they are not a substitute for the original paper.** Always pass the `data.papers` metadata block through to the user / downstream skills so the user can locate the source papers (DOI, title, journal, authors, publication date) for any claim that interests them.

## Default endpoint (production)

Use **`https://lkm.bohrium.com/api/v1`** as the base URL. No credentials are required for public-visibility queries. Do not point the skill at any non-production deployment.

Common operations (all on this base):

- search: `POST /search`
- evidence: `GET /claims/{id}/evidence`
- variables: `POST /variables/batch`
- papers-ocr: `POST /papers/ocr/batch`

Read `references/api-contract.md` for request/response field-level expectations.

## Response shape — paper metadata block

Both `/search` and `/claims/{id}/evidence` return a `data.papers` map keyed by paper id (`paper:<id>`):

```json
{
  "data": {
    "claims": [...]  /* or "claim" + "evidence_chains" for /evidence */,
    "papers": {
      "paper:812085204238729217": {
        "id": "812085204238729217",
        "doi": "10.1088/...",
        "publication_id": "500",
        "publication_name": "...",
        "zh_title": "...",
        "en_title": "...",
        "authors": "A. Last | B. Last | ...",
        "publication_date": "YYYY-M-D",
        "available_online": "...",
        "cover_date_start": "YYYY-MM-DD",
        "area": "...",
        "research_categories": "...",
        "keywords": "...",
        "created_at": "..."
      }
    }
  }
}
```

**Use this block for paper resolution.** When you need to translate a `source_package` (`paper:<id>`) into a citation, look it up in `data.papers`, not in any external service. When you hand off to `$scholarly-review`, include the relevant subset of `data.papers` so the review's references list can cite by author–year.

If `data.papers` is empty or missing a key the chain references, fall back to `evidence_chains[].source_package` — but log the absence as a corpus-quality observation; do not silently substitute.

## Known transient: `code=290001`

Sometimes the first call after a quiet period returns:

```json
{ "code": 290001, "error": { "msg": "hydrate provenance failed: batch get global variables failed: ... context deadline exceeded" } }
```

This is a transient downstream timeout in the variable-hydration sub-call. **Retry once after a short delay (1–3 s).** If it persists across multiple retries, escalate as a server-side issue rather than working around it.

## Known temporary: premises with id-only, no content

Some premises currently come back with only their `id` populated and an empty `content` field, even within the parent chain. **This is a temporary state of the corpus** — the LKM is being progressively populated, and these premises will get content over time.

When you encounter such a premise:

1. Preserve the id in your raw JSON and downstream artifacts. Do not drop the premise.
2. Try a standalone `GET /claims/{premise_id}/evidence` once. If that also returns empty content (or `claim not found`), log it.
3. In the audit table, mark the premise as `content unavailable (temporary)`.
4. The graph node may still be drawn (with a placeholder label such as "未展开前提 / unexpanded premise") if the user wants full premise coverage; otherwise it can be omitted by the graph skill's empty-text policy.

Do **not** invent or paraphrase content for an empty-content premise.

## Workflow

1. **Normalize the query.** Pick the language with highest expected recall on the corpus (often English for science corpora; preserve the user's terminology and named entities). User-prompt language and search-query language are independent.
2. **Search.** Use scopes `["claim","setting"]`, `visibility: "public"`, an explicit `top_k` (start at 10–20, raise as needed). Save raw JSON. Note that `data.claims` is the list field (not `items` or `results`).
3. **Filter to chain-backed candidates.** For each promising claim id, call `GET /claims/{id}/evidence` with `sort_by=comprehensive` and a generous `max_chains`. Retain claims with `total_chains > 0`. Drop the rest from root consideration; chain-less claims may still be useful as background references but cannot anchor a graph.
4. **Preserve all empty results explicitly.** A chain-less claim id, an `total_chains == 0` response, or a content-empty premise — log each, do not silently drop.
5. **OCR the chosen root paper.** Once a user-selected (or orchestrator-resolved) root id is anchored and its `source_package` known, call `POST /papers/ocr/batch` with that paper id. The OCR is the source of truth for downstream numerical / equation anchors. Signed download URLs from OCR responses expire in 24 hours — `curl` them and persist the markdown locally before they expire.
6. **Premise ids may not round-trip standalone (API pit).** Some `factors[].premises[].id` values exist only embedded in a parent claim's `evidence_chains`. Calling `GET /claims/{premise_id}/evidence` may return `claim not found` or `total_chains == 0` despite full content being recoverable from the parent chain. This is **not** an agent error — log the response once and stop standalone probing for that id; use `factors[].premises[].content` from the parent chain as the primary text source.
7. **Return compact summaries.** Summaries should include claim id, source package (paper id), content snippet, total chains, factor ids, premise ids, and the relevant `data.papers` entry. Keep raw JSON for exact inspection.

## Handoff

After retrieval, hand off to:

- **`$evidence-subgraph`** for the audited evidence graph (factor diamonds, typed reasoning nodes, three-class edge taxonomy, OCR-page-anchored audit table).
- **`$scholarly-review`** for the closure-chain academic review (graph + audit table + OCR markdown are mandatory inputs).

The whole flow is orchestrated by **`$evidence-graph-review`**, which is the unified entry point for any LKM-driven evidence-and-review task. Agents handling user prompts should route through that orchestrator first.

## CLI helper

Use `scripts/lkm.mjs` for deterministic API calls:

```bash
node skills/lkm-api/scripts/lkm.mjs search --query "your query" --top-k 10 --out search.json
node skills/lkm-api/scripts/lkm.mjs evidence --id gcn_xxx --max-chains 10 --out evidence.json
node skills/lkm-api/scripts/lkm.mjs variables --ids var1,var2 --out variables.json
node skills/lkm-api/scripts/lkm.mjs papers-ocr --ids 812114964624965633,paper:812079052750848000 --out ocr.json
```

The helper uses Node built-in `fetch` and writes JSON to stdout or `--out`.

`papers-ocr` accepts both raw numeric ids and ids prefixed with `paper:` (the helper strips the prefix); the response carries **signed TOS URLs that expire in 24 hours** — follow up with `curl` on `markdown_url` / `images[].url` to persist the content. See `references/api-contract.md` for field and id-format details.
