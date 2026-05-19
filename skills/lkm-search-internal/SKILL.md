---
name: lkm-search-internal
description: Fetch paper full-text markdown and embedded images from the Bohrium LKM internal API (`POST /papers/content/batch`). Requires internal whitelist access. Use when you need the actual paper body text — for structured knowledge (claims, reasoning, variables), use `$lkm-search` instead.
---

# LKM Search Internal

Retrieve paper full-text markdown and embedded image URLs from the LKM internal API. This skill covers a single endpoint that is restricted to whitelisted internal users.

For all other LKM operations (search, reasoning, variables, papers/graph), use `$lkm-search`.

## When to use this skill

| You want to … | Skill |
|----------------|-------|
| Get paper markdown body text + images | **This skill** — `POST /papers/content/batch` |
| Search claims / questions | `$lkm-search` |
| Trace reasoning behind a claim | `$lkm-search` |
| Inspect a paper's knowledge graph | `$lkm-search` |

## Base URL

```
https://open.bohrium.com/openapi/v1/lkm
```

## Authentication

Same as `$lkm-search`: every request requires `accessKey: <key>` header. The CLI helper reads from `LKM_ACCESS_KEY` env var.

Additionally, the user's access key must be on the internal whitelist for this endpoint. If not, the server returns an authorization error.

## Endpoint: POST /papers/content/batch

Batch-fetch paper markdown full text and pre-signed image download URLs by paper ID, DOI, package ID, or title.

### CLI usage

```bash
export LKM_ACCESS_KEY=<key>

# By paper IDs
python skills/lkm-search-internal/scripts/lkm_internal.py papers-content \
  --paper-ids 811264514073821185,812085204238729217 --out content.json

# By DOIs
python skills/lkm-search-internal/scripts/lkm_internal.py papers-content \
  --dois 10.1038/s41586-023-06408-7 --out content.json

# By titles (uses exact + BM25 matching)
python skills/lkm-search-internal/scripts/lkm_internal.py papers-content \
  --titles "plasma GFAP biomarker" --out content.json
```

### Workflow

1. Obtain paper identifiers — typically from `$lkm-search` results (`provenance.source_packages` → strip `paper:` prefix for paper_id, or use DOI from `data.papers`).
2. Call `papers-content` with one or more identifier types.
3. Download markdown from the pre-signed `markdown_url` in the response. URLs expire — check `data.expires_at`.
4. If the paper has embedded images, download them from `images[].url` using the `rel_path` to match `![](images/<rel>)` references in the markdown.

## Error codes

| Code | Meaning | Action |
|------|---------|--------|
| `290002` | All query params empty | Provide at least one of paper_ids / dois / package_ids / titles |
| `290011` | Paper not found | Verify paper_id / DOI |

## Field-level reference

See `references/api-contract.md` for the complete request/response schema.
