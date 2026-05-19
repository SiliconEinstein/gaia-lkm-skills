# API Contract — Internal

Production base URL: **`https://open.bohrium.com/openapi/v1/lkm`**. Requires `accessKey` header with internal whitelist access.

---

## POST /papers/content/batch — Paper full text

Batch-fetch paper markdown body text and pre-signed image download URLs.

### Request

```http
POST /papers/content/batch
Content-Type: application/json
accessKey: <key>
```

```json
{
  "paper_ids": ["811264514073821185"],
  "dois": ["10.1038/s41586-023-06408-7"],
  "package_ids": ["paper:811264514073821185"],
  "titles": ["plasma GFAP biomarker"],
  "title_resolve": { "limit": 5 }
}
```

Four identifier types (at least one required; may combine; total resolved papers ≤ 50):

| Field | Type | Description |
|-------|------|-------------|
| `paper_ids` | string[] | Pure numeric IDs. Strip `paper:` prefix from `source_packages` if needed. |
| `package_ids` | string[] | `paper:<digits>` format. Pass `source_package` values directly. |
| `dois` | string[] | Full DOIs. Unresolved DOIs appear in `not_found`. |
| `titles` | string[] | Paper titles. Uses exact (case-insensitive, whitespace-normalized) + BM25 dual matching. A title with at least one candidate hit does not appear in `not_found`. |
| `title_resolve.limit` | int | Max candidates per title. Default 5, max 20. |

### Response

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "paper_id": "811264514073821185",
        "package_id": "paper:811264514073821185",
        "doi": "10.1038/…",
        "title": "Database-resolved title (not input echo)",
        "title_match_type": "exact",
        "markdown_url": "https://…presigned…",
        "images": [
          {
            "rel_path": "fig1.png",
            "url": "https://…presigned…"
          }
        ]
      }
    ],
    "not_found": ["10.9999/nonexistent"],
    "expires_at": "2026-05-18T12:00:00Z"
  },
  "trace_id": "…"
}
```

**`data.items[]` fields:**

| Field | Type | Description |
|-------|------|-------------|
| `paper_id` | string | Pure numeric ID. |
| `package_id` | string | `paper:<id>` format. |
| `doi` | string | DOI. Only present when the item was resolved via a DOI input. |
| `title` | string | Database-resolved title (prefers Chinese, falls back to English). **Not** an echo of the input title. |
| `title_match_type` | string | Only present for title-resolved items. `exact` or `keyword`. |
| `markdown_url` | string | Pre-signed GET URL for the paper's markdown full text. Only returned when the file exists on the server. |
| `images` | object[] | Embedded image URLs. Empty `[]` when the paper has no images. Each: `rel_path` (matches `![](images/<rel>)` in markdown), `url` (pre-signed download). |

**`data.not_found`** — Input values that did not resolve to any paper with a markdown file.

**`data.expires_at`** — Expiration time for all pre-signed URLs in this response. Re-request after expiry.
