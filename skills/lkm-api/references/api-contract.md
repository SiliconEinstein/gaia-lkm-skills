# API Contract

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
