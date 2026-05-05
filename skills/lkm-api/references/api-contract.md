# API Contract

Production base URL: **`https://open.bohrium.com/openapi/v1/lkm`**. Every endpoint below requires the header `accessKey: <bohrium-access-key>` (see `SKILL.md` → "Authentication" for the agent flow that obtains and persists the key).

## Match (claim retrieval by free text)

Endpoint:

```http
POST https://open.bohrium.com/openapi/v1/lkm/claims/match
```

Headers:

```
accessKey: <bohrium-access-key>
content-type: application/json
```

Default body:

```json
{
  "text": "search terms",
  "top_k": 10,
  "filters": {
    "visibility": "public"
  }
}
```

Body field name is **`text`** (required). The old field name `query` is rejected with `code=290002` (`Field validation for 'Text' failed on the 'required' tag`).

Current endpoint behavior is understood as BM25-like free-text retrieval. Put
concise domain keywords or anchor phrases in `text`. Retrieval methodology
(number of queries, query families, candidate admission, and handoff rules)
belongs to the caller's SOP, not this API contract.

Response shape:

```json
{
  "code": 0,
  "data": {
    "new_claim_likely": false,
    "variables": [
      {
        "id": "gcn_…",
        "type": "claim",
        "role": "premise" | "conclusion",
        "content": "...",
        "score": 0.0,
        "provenance": {
          "source_packages": ["paper:<id>"],
          "representative_lcn": { "local_id": "...", "package_id": "...", "version": "..." }
        },
        "visibility": "public"
      }
    ],
    "papers": {
      "paper:<id>": { /* paper-metadata block, see below */ }
    }
  },
  "trace_id": "..."
}
```

The candidate list is at **`data.variables`** — note the rename from the previous endpoint family, which used `data.claims`. Per-entry structure: `id`, `type` (`"claim"`), `role` (`"premise"` | `"conclusion"`), `content`, `score`, `provenance` (with `source_packages` and `representative_lcn`), and `visibility`.

`score` is a retrieval ranking/debug signal from the match engine. Do not treat
it as scientific confidence, a truth probability, or a Gaia prior.

`data.new_claim_likely` and the top-level `trace_id` are diagnostic.

## Evidence

Endpoint:

```http
GET https://open.bohrium.com/openapi/v1/lkm/claims/{id}/evidence?max_chains=10&sort_by=comprehensive
```

Headers:

```
accessKey: <bohrium-access-key>
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

Per-chain fields: `source_package`, `factors[]` (each with `id`, `factor_type`, `subtype`, `premises[]`, `conclusion`, optional `steps[]`), and `motivating_questions[]`. The top-level `data.total_chains` reports how many chains the API found for the claim.

`sort_by=premises` may not be valid on all deployments. Prefer `comprehensive` or `recent`.

## Paper metadata block (`data.papers`)

Both `/claims/match` and `/claims/{id}/evidence` return a `data.papers` map keyed by `paper:<id>`. Each entry has:

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

This is the API's authoritative paper-id → bibliographic-metadata map. Each chain's `source_package` (`paper:<id>`) keys into it. The API does not hydrate further: if `data.papers` is empty or missing a key the chain references, the only id available from this endpoint is `evidence_chains[].source_package` itself.

## Variables (Batch)

```http
POST https://open.bohrium.com/openapi/v1/lkm/variables/batch
```

Headers:

```
accessKey: <bohrium-access-key>
content-type: application/json
```

Body:

```json
{ "ids": ["var_id_1", "var_id_2"] }
```

Response shape:

```json
{
  "code": 0,
  "data": {
    "variables": [ /* hydrated variable objects */ ],
    "papers": { "paper:<id>": { /* paper-metadata block */ } },
    "not_found": ["var_id_unknown"]
  },
  "trace_id": "..."
}
```

Call only when a chain step references a `var_*` id. If no `var_*` ids appear in the chain, skip this endpoint.

## Known transient: `code=290001`

Sometimes the first call after a quiet period returns:

```json
{ "code": 290001, "error": { "msg": "hydrate provenance failed: batch get global variables failed: ... context deadline exceeded" } }
```

Transient downstream timeout in the variable-hydration sub-call. Retry once after 1–3 s. If it persists across multiple retries, escalate as a server-side issue — do not work around it.

## Known temporary: id-only premises

Some `factors[].premises[].id` entries currently come back with **empty `content`** even within the parent chain — only the id is populated. This is a temporary state of the corpus (LKM is being progressively populated); the id itself is preserved in the response. A standalone `GET /claims/{premise_id}/evidence` may recover content but often fails (see "premise A2 pit" below).

## Premise A2 pit

Premise ids listed inside `evidence_chains[].factors[].premises[]` may **not** resolve as standalone `GET /claims/{premise_id}/evidence` targets (`claim not found` or `total_chains == 0` despite full content being recoverable from the parent chain's `factors[].premises[].content`). This is a property of the API: the embedded id is not always indexed as a standalone claim.
