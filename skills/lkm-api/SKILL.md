---
name: lkm-api
description: Query Bohrium LKM or compatible claim/evidence-chain APIs, including public search, claim evidence lookup, reasoning-chain retrieval, raw JSON preservation, and API-error handling. Use when Codex needs to search LKM, fetch claim evidence for IDs such as gcn_* or claim IDs, inspect reasoning chains behind retrieved claims, or prepare retrieval artifacts for downstream graph/review skills.
---

# LKM API

## Purpose

Use LKM as a retrieval and evidence-chain backend. Preserve raw responses, because downstream graph auditing depends on exact claim IDs, source packages, factors, premises, and empty-chain status.

## Default Endpoints

Use `https://lkm.bohrium.com/api/v1` unless the user provides a different base URL.

Common operations:

- search: `POST /search`
- evidence: `GET /claims/{id}/evidence`

Read `references/api-contract.md` for request/response expectations.

## Workflow

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

## CLI Helper

Use `scripts/lkm.mjs` for deterministic API calls:

```bash
node skills/lkm-api/scripts/lkm.mjs search --query "your query" --top-k 10 --out search.json
node skills/lkm-api/scripts/lkm.mjs evidence --id gcn_xxx --max-chains 10 --out evidence.json
```

The helper uses Node built-in `fetch` and writes JSON to stdout or `--out`.

## Handoff

After retrieval:

- Use `$evidence-subgraph` to classify dependencies and draw a graph.
- Use `$scholarly-review` to write a standalone review.
