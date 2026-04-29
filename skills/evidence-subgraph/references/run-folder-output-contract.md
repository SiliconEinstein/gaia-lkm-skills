# Run-folder output contract (mandatory artifacts)

This file is the **canonical contract** for what every evidence-graph-generating run must leave on disk. It is referenced by `$evidence-subgraph`'s `SKILL.md` and `$evidence-graph-synthesis`'s `SKILL.md` and supersedes any earlier `.md` artifact mentions in those skills (e.g. `contradictions.md`, `equivalences.md`).

## 1. When this contract applies

Any task that produces an evidence graph — whether by direct invocation of `$evidence-subgraph` or by routing through `$evidence-graph-synthesis` — must satisfy this contract. The `<run-folder>` is supplied by the caller (agent or user). Every artifact below is written under `<run-folder>`.

`$scholarly-synthesis` is **out of scope**: this contract governs graph-generation outputs only.

## 2. Required layout

```
<run-folder>/
├── evidence_graph.json         required
├── evidence_graph.dot          required — re-renderable canonical source
├── evidence_graph.png          required — human-readable raster
├── contradictions.json         required (may be empty)
├── equivalences.json           required (may be empty)
├── cross_validation.json       required (may be empty)
└── raw/
    ├── evidence_<gcn-id>.json  ≥ 1 file (the selected root); plus one per other candidate that had its evidence fetched during discovery
    └── match_<NN>.json         optional — present iff discovery was performed; one file per match query, zero-padded ascending (01, 02, ...)
```

Naming rules:
- Every evidence file is symmetric: `evidence_<gcn-id>.json`. The selected root is identified by the `selected_root_id` field in `evidence_graph.json`, **not** by special filename.
- `match_<NN>.json` files appear in the order match queries were issued. With a single query, the file is `match_01.json`.

No other files are written under `<run-folder>` by this contract. Skills are free to write supplementary human-readable docs (e.g. an `audit.md` companion) but those are **not** part of the contract and must not be relied on by downstream consumers.

## 3. Schema versioning

Every JSON file in this contract carries a top-level `"schema_version"` field:

```json
{ "schema_version": "evidence-graph-run/1.0", ... }
```

A single unified version covers all four contract JSON files (`evidence_graph.json` + the three pair files). Future schema revisions bump the version string in lockstep.

## 4. Source-pointer convention (traceability)

Every node, edge, and pair record carries a `source` object that identifies the exact LKM-payload location it derives from:

```json
"source": {
  "kind": "<one of: claim | factor | factor_steps | factor_step | factor_membership | text_span>",
  "file": "<filename under raw/, e.g. 'evidence_gcn_xxx.json' or 'match_01.json'>",
  "pointer": "<RFC 6901 JSON Pointer, e.g. '/data/evidence_chains/0/factors/0/premises/1'>"
}
```

Additional kind-specific fields (all optional unless noted):
- `claim_id` — when `kind ∈ {claim, factor_membership, text_span}`, the LKM `gcn_*` id of the referenced claim.
- `factor_id` — when `kind ∈ {factor, factor_steps, factor_step, factor_membership}`, the LKM `gfac_*` id.
- `step_index` (single integer) — when `kind == factor_step`.
- `step_indices` (array of integers) — when `kind == factor_steps` (the list of step indices collapsed into one reasoning node).
- `span_text` (string) — when `kind == text_span`, the verbatim substring lifted from the parent's content. The `pointer` resolves to the parent string field; `span_text` must occur as a substring of that resolved value.

The `pointer` syntax is **RFC 6901 JSON Pointer**, not JSONPath. Examples:
- root claim: `/data/claim`
- a premise: `/data/evidence_chains/0/factors/0/premises/1`
- a step's reasoning text: `/data/evidence_chains/0/factors/0/steps/3/reasoning`

## 5. `evidence_graph.json` required fields

```json
{
  "schema_version": "evidence-graph-run/1.0",
  "selected_root_id": "<gcn-id of the chosen root claim>",
  "discovery_performed": true,
  "raw_files": {
    "evidence": ["evidence_<id>.json", "..."],
    "match": ["match_01.json", "..."]
  },
  "nodes": [
    {
      "id": "<unique within this file>",
      "type": "proposition" | "reasoning",
      "subtype": "<role within type — implementation choice; suggested: root | premise | background for proposition; one value for reasoning>",
      "label": "<human-readable label — same string used in the rendered graph>",
      "source": { ... }
    }
  ],
  "edges": [
    {
      "id": "<unique within this file>",
      "from": "<node id>",
      "to": "<node id>",
      "class": "<one of: 链式支撑 | 背景 | 核验支撑 | 矛盾 | 等价>",
      "source": { ... }
    }
  ],
  "pair_relations": [
    {
      "id": "<unique within this file>",
      "type": "矛盾" | "等价" | "核验",
      "between": ["<node id>", "<node id>"],
      "external_record_id": "<id from contradictions.json | equivalences.json | cross_validation.json>"
    }
  ]
}
```

Notes:
- `discovery_performed: false` → `raw_files.match` is `[]` and `match_*.json` is absent from `<run-folder>/raw/`.
- `pair_relations[]` lists **only those pair edges that are actually drawn in the graph**. Pairs whose two endpoints are not both chain-internal nodes are out of scope here and live exclusively in the corresponding pair JSON file.
- Node and edge `id` values are required to be unique within the file but otherwise free-form (the contract does not mandate any prefix).

## 6. Pair JSON files — `contradictions.json`, `equivalences.json`, `cross_validation.json`

All three files share the same envelope:

```json
{
  "schema_version": "evidence-graph-run/1.0",
  "pairs": [
    {
      "id": "<unique within this file>",
      "claims": [
        { "claim_id": "...", "file": "<raw/-relative filename>", "pointer": "<RFC 6901>" },
        { "claim_id": "...", "file": "<raw/-relative filename>", "pointer": "<RFC 6901>" }
      ],
      "drawn_in_graph": true | false,
      "graph_pair_edge_id": "<id from evidence_graph.json.pair_relations[]>" | null,
      "rationale": "<one short sentence explaining why this pair was flagged>"
    }
  ]
}
```

Rules:
- `pairs: []` is the contract-conformant empty case. The three files **must always exist**, even when no pairs were detected — missing files are a contract violation.
- `drawn_in_graph: true` ⇔ both `claims[*].claim_id` correspond to chain-internal nodes in `evidence_graph.json`, **and** `graph_pair_edge_id` points to a real entry in `evidence_graph.json.pair_relations[]`.
- `drawn_in_graph: false` ⇒ `graph_pair_edge_id: null`. Records in this state are flagged out-of-graph (e.g. one or both claims live in a different match candidate or a different chain's evidence).
- `cross_validation.json` records carry an additional field per pair: `"polarity": "confirm" | "partial_confirm" | "partial_disconfirm"`.

## 7. `raw/` contract

- Every file under `raw/` is a **verbatim, unmodified** LKM API response. Stripping fields, pretty-reformatting, sorting keys, or annotating in-place is forbidden.
- `evidence_<gcn-id>.json` contains the full `/claims/{id}/evidence` response, including `code`, `data`, `trace_id`, and `data.papers`.
- `match_<NN>.json` contains the full `/claims/match` response, including `code`, `data`, `trace_id`, and `data.variables` / `data.papers`.
- No other files (no derived markdown, no rendered figures, no hash sidecars) may be placed under `raw/`.

## 8. Pre-success self-check (mandatory before declaring task complete)

Before signalling success, the skill must run and pass these checks:

1. All seven required artifacts exist in the layout above (three `evidence_graph.*` files + three pair JSON files + at least one `evidence_<id>.json` under `raw/`).
2. For every `source` object in `evidence_graph.json` (nodes / edges / pair_relations) and every `claims[*]` in the three pair JSON files, the referenced `file` exists under `raw/` **and** the `pointer` resolves successfully against that file's JSON.
3. `evidence_graph.json.selected_root_id` corresponds to an existing `raw/evidence_<id>.json`.
4. For every pair record with `drawn_in_graph: true`, the referenced `graph_pair_edge_id` exists in `evidence_graph.json.pair_relations[]`, and conversely every `pair_relations[].external_record_id` resolves to a real record in the corresponding pair file.
5. No `source.file` value points outside `raw/`.
6. `evidence_graph.png` renders without missing-glyph (CJK tofu) artifacts — this is enforced by the existing CJK-rendering rule in `$evidence-subgraph` and is not relaxed by this contract.

Failing any of the above is a hard failure: the skill must not declare partial success and must surface the failed check to the caller.

## 9. Backward compatibility

This contract is **forward-only**. Earlier run folders that wrote `audit.md`, `cycle_check.md`, `contradictions.md`, `equivalences.md`, `candidates.md`, etc. are not in scope and are not migrated automatically. New runs must conform; legacy migration, if needed, is the caller's responsibility.
