# API Contract

默认 Base：`https://lkm.test.bohrium.com/api/v1`。联调其他部署时用 `lkm.mjs --base-url …` 或环境变量 `LKM_API_BASE_URL`（须含 `/api/v1`）。

## Search

Endpoint:

```http
POST https://lkm.test.bohrium.com/api/v1/search
```

Default body:

```json
{
  "query": "search terms",
  "scopes": ["claim", "setting"],
  "filters": {"visibility": "public"},
  "top_k": 10
}
```

Record:

- candidate ID
- score
- content
- provenance/source package
- representative local claim if present

## Evidence

Endpoint:

```http
GET https://lkm.test.bohrium.com/api/v1/claims/{id}/evidence?max_chains=10&sort_by=comprehensive
```

Record:

- claim content
- `total_chains`
- source package for each chain
- factor/reasoning node ID
- factor type/subtype/strategy
- every premise ID and content

`sort_by=premises` may not be valid on all deployments. Prefer `comprehensive` or `recent`.

## Variables (Batch)

Endpoint:

```http
POST https://lkm.test.bohrium.com/api/v1/variables/batch
```

Body:

```json
{
  "ids": ["var_id_1", "var_id_2"]
}
```

Returns variable details for each requested ID.

## Papers OCR (Batch)

Endpoint:

```http
POST https://lkm.test.bohrium.com/api/v1/papers/ocr/batch
```

Body:

```json
{
  "paper_ids": ["812114964624965633", "812079052750848000"]
}
```

Field/id format pitfalls (observed in prod and test):

- Body field must be **`paper_ids`** (snake_case). `ids` / `PaperIDs` return `290002` validation errors.
- Ids must be **plain numeric strings without the `paper:` prefix**. Ids carrying the prefix end up in `data.not_found`. The CLI helper (`scripts/lkm.mjs papers-ocr --ids …`) strips the prefix automatically; callers writing raw HTTP must strip it themselves.

Response shape:

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "paper_id": "812114964624965633",
        "markdown_url": "https://…tos-cn-beijing.volces.com/paper_ocr/md/<id>.md?X-Tos-Signature=…",
        "images": [
          {"rel_path": "<id>_1.jpg", "url": "https://…paper_ocr/images/<id>/<id>_1.jpg?…"}
        ]
      }
    ],
    "not_found": [],
    "expires_at": "2026-04-28T19:24:22+08:00"
  }
}
```

- `markdown_url` / `images[].url` are **signed TOS URLs that expire in 24 hours** (see `expires_at`). Download immediately if you need an offline artefact — do not store the URL and rely on it later.
- The body response does **not** inline the markdown; you must fetch `markdown_url` separately (e.g. `curl "$url" -o paper.md`).
- The markdown is OCR-cleaned: preserves LaTeX, figure captions, section headers, and reference keys — suitable as a **ground-truth anchor** for downstream evidence-graph auditing (see `$evidence-subgraph` → `references/source-ground-truth.md`).

## Retrieval Discipline

Search results are candidates. Evidence chains are stronger, but still require semantic inspection before being used in prose. A candidate with no evidence chain may still be useful context, but should not be promoted to dependency without manual reasoning.

For **conclusion-rooted dependency graphs**, treat **`total_chains > 0`** on `GET /claims/{id}/evidence` as the **gate** for an acceptable root: without packaged chains, downstream skills cannot enumerate **native premises** to trace backward. Probe additional search hits until such a root is found, or obtain an explicit user waiver for chain-less mode.

**Premise ids** listed inside `evidence_chains[].factors[].premises[]` may **not** resolve as standalone `GET /claims/{premise_id}/evidence` targets (`claim not found`). Downstream skills must fall back to the **parent claim’s chain JSON** and structured **`steps`** text for retrieval anchoring—do not treat the 404-style outcome as grounds to delete the premise node.
