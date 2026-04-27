# API Contract

默认 Base：`https://lkm.bohrium.com/api/v1`。联调其他部署时用 `lkm.mjs --base-url …` 或环境变量 `LKM_API_BASE_URL`（须含 `/api/v1`）。

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
GET https://lkm.bohrium.com/api/v1/claims/{id}/evidence?max_chains=10&sort_by=comprehensive
```

Record:

- claim content
- `total_chains`
- source package for each chain
- factor/reasoning node ID
- factor type/subtype/strategy
- every premise ID and content

`sort_by=premises` may not be valid on all deployments. Prefer `comprehensive` or `recent`.

## Retrieval Discipline

Search results are candidates. Evidence chains are stronger, but still require semantic inspection before being used in prose. A candidate with no evidence chain may still be useful context, but should not be promoted to dependency without manual reasoning.

For **conclusion-rooted dependency graphs**, treat **`total_chains > 0`** on `GET /claims/{id}/evidence` as the **gate** for an acceptable root: without packaged chains, downstream skills cannot enumerate **native premises** to trace backward. Probe additional search hits until such a root is found, or obtain an explicit user waiver for chain-less mode.

**Premise ids** listed inside `evidence_chains[].factors[].premises[]` may **not** resolve as standalone `GET /claims/{premise_id}/evidence` targets (`claim not found`). Downstream skills must fall back to the **parent claim’s chain JSON** and structured **`steps`** text for retrieval anchoring—do not treat the 404-style outcome as grounds to delete the premise node.
