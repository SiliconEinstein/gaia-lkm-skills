# API Contract

Production base URL: **`https://lkm.bohrium.com/api/v1`** (no credentials required for public-visibility queries). All endpoints below assume this base.

## Search

Endpoint:

```http
POST https://lkm.bohrium.com/api/v1/search
```

Default body:

```json
{
  "query": "search terms",
  "scopes": ["claim", "setting"],
  "visibility": "public",
  "top_k": 10
}
```

Response shape:

```json
{
  "code": 0,
  "data": {
    "claims": [
      {
        "id": "gcn_…",
        "type": "claim",
        "role": "premise" | "conclusion",
        "content": "...",
        "score": 0.0,
        "provenance": {
          "source_packages": ["paper:<id>"],
          "representative_lcn": { "local_id": "...", "package_id": "...", "version": "..." }
        }
      }
    ],
    "papers": {
      "paper:<id>": { /* paper-metadata block, see below */ }
    }
  }
}
```

`data.claims` is the list field (not `items` or `results`). For each candidate, record: `id`, `score`, `content`, `provenance.source_packages`, and the corresponding `data.papers[<source_package>]` entry.

## Evidence

Endpoint:

```http
GET https://lkm.bohrium.com/api/v1/claims/{id}/evidence?max_chains=10&sort_by=comprehensive
```

Response shape:

```json
{
  "code": 0,
  "data": {
    "claim": { "id": "gcn_…", "content": "..." },
    "total_chains": 1,
    "evidence_chains": [
      {
        "source_package": "paper:<id>",
        "factors": [
          {
            "id": "gfac_…",
            "factor_type": "strategy",
            "subtype": "noisy_and",
            "premises": [
              { "id": "gcn_…", "content": "..." }
            ],
            "conclusion": { "id": "gcn_…", "content": "..." },
            "steps": [ /* optional, see notes */ ]
          }
        ],
        "motivating_questions": [...]
      }
    ],
    "papers": {
      "paper:<id>": { /* paper-metadata block, see below */ }
    }
  }
}
```

Record:

- `claim.content`
- `total_chains`
- `source_package` per chain
- `factor.id` / `factor.factor_type` / `factor.subtype`
- every premise `id` and `content`
- the relevant `data.papers[<paper_id>]` entries

`sort_by=premises` may not be valid on all deployments. Prefer `comprehensive` or `recent`.

## Paper metadata block (`data.papers`)

Both `/search` and `/claims/{id}/evidence` return a `data.papers` map keyed by `paper:<id>`. Each entry has:

```json
{
  "id": "812085204238729217",
  "doi": "10.1088/0963-0252/15/3/021",
  "publication_id": "500",
  "publication_name": "Plasma Sources Science and Technology _ Plasma Sources Sci. Technol.",
  "zh_title": "...",
  "en_title": "...",
  "authors": "Last1 First1 | Last2 First2 | ...",
  "publication_date": "2006-8-1",
  "available_online": "2006-5-16",
  "cover_date_start": "2006-05-16",
  "area": "...",
  "research_categories": "...",
  "keywords": "...",
  "created_at": "..."
}
```

This is the authoritative paper-id → bibliographic-metadata map. Use it for:

- resolving `source_package` (`paper:<id>`) to a citation;
- building the references list in `$scholarly-review` (author–year, DOI, title);
- surfacing source pointers to the user ("for further information, refer to the original paper" with the DOI).

If `data.papers` is empty or missing a key the chain references, fall back to `evidence_chains[].source_package` for the id alone — but log the absence as a corpus-quality observation; do not silently substitute.

## Variables (Batch)

```http
POST https://lkm.bohrium.com/api/v1/variables/batch
```

Body:

```json
{ "ids": ["var_id_1", "var_id_2"] }
```

Call only when a chain step references a `var_*` id. If no `var_*` ids appear in the chain, skip this endpoint.

## Papers OCR (Batch)

```http
POST https://lkm.bohrium.com/api/v1/papers/ocr/batch
```

Body:

```json
{ "paper_ids": ["812114964624965633", "812079052750848000"] }
```

Field / id format pitfalls:

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
- The body response does **not** inline the markdown; fetch `markdown_url` separately (e.g. `curl "$url" -o paper.md`).
- The markdown is OCR-cleaned: preserves LaTeX, figure captions, section headers, reference keys. Use as a **ground-truth anchor** for `$evidence-subgraph` (see `references/source-ground-truth.md` in that skill).

## Known transient: `code=290001`

Sometimes the first call after a quiet period returns:

```json
{ "code": 290001, "error": { "msg": "hydrate provenance failed: batch get global variables failed: ... context deadline exceeded" } }
```

Transient downstream timeout in the variable-hydration sub-call. Retry once after 1–3 s. If it persists across multiple retries, escalate as a server-side issue — do not work around it.

## Known temporary: id-only premises

Some `factors[].premises[].id` entries currently come back with **empty `content`** even within the parent chain — only the id is populated. This is a temporary state of the corpus (LKM is being progressively populated). Treatment:

- preserve the id in raw JSON;
- attempt one standalone `GET /claims/{premise_id}/evidence` to recover content (often fails — see "premise A2 pit" below);
- in the audit table, mark as `content unavailable (temporary)`;
- in the graph, render only if user explicitly asks for full premise coverage; otherwise omit (default).

## Retrieval discipline

Search results are candidates. Evidence chains are stronger, but still require semantic inspection before use in prose. A candidate with no evidence chain may still be useful context but cannot anchor a graph.

For evidence-graph rooting, treat **`total_chains > 0`** on `GET /claims/{id}/evidence` as the **gate** for an acceptable root. Probe additional search hits until such a root is found, or obtain an explicit user waiver for chain-less mode.

## Premise A2 pit

Premise ids listed inside `evidence_chains[].factors[].premises[]` may **not** resolve as standalone `GET /claims/{premise_id}/evidence` targets (`claim not found` or `total_chains == 0` despite full content recoverable from the parent chain). Downstream skills must fall back to `factors[].premises[].content` from the parent chain as the primary text source. Do not treat the 404-style outcome as grounds to delete the premise node.
