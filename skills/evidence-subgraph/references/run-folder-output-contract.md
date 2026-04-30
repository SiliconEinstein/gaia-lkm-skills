# Run-folder output contract (mandatory artifacts)

This file is the **canonical contract** for what every evidence-graph-generating run must leave on disk. It is referenced by `$evidence-subgraph`'s `SKILL.md` and `$evidence-graph-synthesis`'s `SKILL.md` and supersedes any earlier `.md` artifact mentions in those skills (e.g. `contradictions.md`, `equivalences.md`).

The judgement criteria that drive whether a pair is **promoted** to `contradictions.json` / `cross_validation.json` or **dismissed** to `dismissed_pairs.json` are specified in `pair-classification.md` (sibling reference file). This contract fixes the **schema** and the **self-check**; `pair-classification.md` fixes the **semantics**.

## 1. When this contract applies

Any task that produces an evidence graph — whether by direct invocation of `$evidence-subgraph` or by routing through `$evidence-graph-synthesis` — must satisfy this contract. The `<run-folder>` is supplied by the caller (agent or user). Every artifact below is written under `<run-folder>`.

`$scholarly-synthesis` is **out of scope**: this contract governs graph-generation outputs only.

## 2. Required layout

```
<run-folder>/
├── evidence_graph.json         required
├── evidence_graph.dot          required — re-renderable canonical source
├── evidence_graph.png          required — human-readable raster
├── contradictions.json         required (may be empty) — promoted contradictions only
├── equivalences.json           required (may be empty)
├── cross_validation.json       required (may be empty) — promoted cross-validations only
├── dismissed_pairs.json        required (may be empty) — audit log of pairs that failed the promotion gate
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
{ "schema_version": "evidence-graph-run/2.0", ... }
```

A single unified version covers all five contract JSON files (`evidence_graph.json` + the four pair files: `contradictions.json`, `equivalences.json`, `cross_validation.json`, `dismissed_pairs.json`). Future schema revisions bump the version string in lockstep.

The `2.0` major bump (from `1.0`) marks the addition of `dismissed_pairs.json` to the required layout, the addition of `verdict` / `new_question` / `hypothesized_cause` to promoted contradictions, the addition of `verdict` / `independence_basis` / `scientific_weight` to promoted cross-validations, and the corresponding self-check expansions in §8. `1.x` runs are not forward-compatible — see §9.

## 4. Source-pointer convention (traceability)

Every node and every edge in `evidence_graph.json` carries a `source` object that identifies the exact LKM-payload location it derives from. Pair records (in the four pair JSON files) carry their provenance differently — through one `{claim_id, file, pointer}` entry per side inside `claims[]`, rather than a top-level `source` object — because a pair is provenance-linked to **two** claims, not one location. `evidence_graph.json.pair_relations[]` does **not** carry direct provenance; each entry references a pair record via `external_record_id`, and the provenance lives in that pair record's `claims[]`. The two conventions share the same `file` + `pointer` semantics defined below; they differ only in shape.

### 4.1 `source` object — used on `evidence_graph.json` nodes and edges

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

### 4.2 `claims[]` entries — used on every pair record in `contradictions.json`, `equivalences.json`, `cross_validation.json`, and `dismissed_pairs.json`

Each pair record has `claims: [<entry>, <entry>]` (always exactly two entries — one per side of the pair). Each entry has the shape:

```json
{ "claim_id": "<gcn-id>", "file": "<filename under raw/>", "pointer": "<RFC 6901 JSON Pointer>" }
```

The `file` and `pointer` semantics are the same as in §4.1; the `kind` field is omitted because pair sides are always claim-level. The full schema for the pair-record envelope is in §6.

### 4.3 Pointer syntax (shared)

The `pointer` syntax is **RFC 6901 JSON Pointer**, not JSONPath. Examples:
- root claim: `/data/claim`
- a premise: `/data/evidence_chains/0/factors/0/premises/1`
- a step's reasoning text: `/data/evidence_chains/0/factors/0/steps/3/reasoning`

## 5. `evidence_graph.json` required fields

```json
{
  "schema_version": "evidence-graph-run/2.0",
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
      "class": "<one of: 链式支撑 | 背景 | 核验支撑>",
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
- `edges[]` carries the DAG backbone of the graph — exactly the three classes from `$evidence-subgraph` §4 (chain support / background / verification support), rendered in the user's locale (`链式支撑` / `背景` / `核验支撑` for Chinese; equivalent terms for other locales). Pair-comparison semantics (`矛盾` / `等价` / `核验`) are **not** edge classes — they live exclusively in `pair_relations[]`.
- `pair_relations[]` lists **only those pair edges that are actually drawn in the graph**. Pairs whose two endpoints are not both chain-internal nodes are out of scope here and live exclusively in the corresponding pair JSON file.
- `pair_relations[]` may reference records in `contradictions.json`, `equivalences.json`, or `cross_validation.json` only. It must **not** reference records in `dismissed_pairs.json` — dismissed pairs are never drawn as graph pair edges. Because every record in `contradictions.json` and `cross_validation.json` is promoted by construction, this rule keeps dismissed pairs out of the rendered graph automatically.
- `discovery_performed: false` (narrow-target case) ⇒ `raw_files.match` is `[]` and no `match_*.json` file is present under `<run-folder>/raw/`. The four pair JSON files are still required to exist with `pairs: []`.
- Node and edge `id` values are required to be unique within the file but otherwise free-form (the contract does not mandate any prefix).

## 6. Pair JSON files — `contradictions.json`, `equivalences.json`, `cross_validation.json`, `dismissed_pairs.json`

All four files share the same envelope:

```json
{
  "schema_version": "evidence-graph-run/2.0",
  "pairs": [
    {
      "id": "<unique within this file>",
      "claims": [
        { "claim_id": "...", "file": "<raw/-relative filename>", "pointer": "<RFC 6901>" },
        { "claim_id": "...", "file": "<raw/-relative filename>", "pointer": "<RFC 6901>" }
      ],
      "drawn_in_graph": true | false,
      "graph_pair_edge_id": "<id from evidence_graph.json.pair_relations[]>" | null,
      "rationale": "<one to two sentences; semantics depend on the file — see per-file rules below>"
    }
  ]
}
```

Common rules:
- `pairs: []` is the contract-conformant empty case. The four files **must always exist**, even when no pairs were detected — missing files are a contract violation.
- `drawn_in_graph: true` ⇔ both `claims[*].claim_id` correspond to chain-internal nodes in `evidence_graph.json`, **and** `graph_pair_edge_id` points to a real entry in `evidence_graph.json.pair_relations[]`.
- `drawn_in_graph: false` ⇒ `graph_pair_edge_id: null`. Records in this state are flagged out-of-graph (e.g. one or both claims live in a different match candidate or a different chain's evidence).
- Records in `dismissed_pairs.json` always have `drawn_in_graph: false` and `graph_pair_edge_id: null`. Dismissed pairs are never drawn — see §5 `pair_relations[]` rule.

### 6.1 `contradictions.json` — promoted contradictions

Every record additionally carries:

```json
{
  "verdict": "promoted",
  "new_question": "<one-sentence checkable new question generated by the tension>",
  "hypothesized_cause": ["hidden_variable" | "boundary_condition" | "measurement_protocol" | "model_assumption" | "evidence_reliability", ...]
}
```

Rules:
- `verdict` is always the literal string `"promoted"`. A contradiction record exists in this file only because it passed the promotion gate defined in `pair-classification.md` §3.
- `new_question` is non-empty. Generic gestures ("more work is needed") are not acceptable; see `pair-classification.md` §3.
- `hypothesized_cause` is a non-empty array. Each element is one of the five enum values listed above. Multi-select is allowed; `other` and any other value not in the enum are not allowed.
- `rationale` explains why the tension cannot be dissolved by an obvious difference in conditions (one to two sentences). It is distinct from `new_question`: `rationale` defends the existence of a real tension; `new_question` says what to do with it.

### 6.2 `equivalences.json` — same-proposition pairs

Equivalence classification is unaffected by the contradiction / cross-validation promotion gate. Records carry the common fields plus the lineage classification produced by `$evidence-graph-synthesis` §2b (e.g. `same paper, different version`, `independent experimental`, `independent theoretical / computational`, `cross-paradigm confirmation`, `unclassified`). Lineage may be stored in `rationale` or in an additional implementation-defined field.

### 6.3 `cross_validation.json` — promoted cross-validations

Every record additionally carries:

```json
{
  "verdict": "promoted",
  "polarity": "confirm" | "partial_confirm" | "partial_disconfirm",
  "independence_basis": "<one sentence: what specifically makes the two pathways independent>",
  "scientific_weight": "<one sentence: what the agreement or partial disagreement actually buys>"
}
```

Rules:
- `verdict` is always the literal string `"promoted"`. A cross-validation record exists in this file only because it passed the promotion gate defined in `pair-classification.md` §8.
- `polarity` retains its existing meaning.
- `independence_basis` is non-empty and names a specific independence axis (independent samples, instruments, formalisms, codes, datasets, calibrations, etc.).
- `scientific_weight` is non-empty and names a specific gain in confidence or a specific open question opened by partial disagreement. Generic gestures ("confirms the result", "supports the literature") are not acceptable.
- `rationale` (one to two sentences) summarises why the pair is non-trivial cross-validation rather than a trivial dependency or a re-statement.

### 6.4 `dismissed_pairs.json` — audit log of pairs that failed the promotion gate

Every record additionally carries:

```json
{
  "origin": "contradiction" | "cross_validation",
  "verdict": "confirmed_equivalence" | "resolved_moderator" | "trivially_dependent" | "non_generative"
}
```

Rules:
- `origin` identifies which gate the candidate was first considered under. The two allowed values are `contradiction` and `cross_validation`. Equivalence pairs are not dismissed through this file — they go directly to `equivalences.json`.
- `verdict` must be compatible with `origin` per the matrix in `pair-classification.md` §11:
  - `origin: "contradiction"` → `verdict ∈ {confirmed_equivalence, resolved_moderator, non_generative}`.
  - `origin: "cross_validation"` → `verdict ∈ {confirmed_equivalence, trivially_dependent, non_generative}`.
- Dismissed records do **not** carry `new_question`, `hypothesized_cause`, `independence_basis`, `scientific_weight`, or `polarity`. Their `rationale` (one to two sentences) explains why the dismissal applies — what specifically about the pair triggered the chosen verdict.
- `drawn_in_graph` is always `false` and `graph_pair_edge_id` is always `null` for dismissed records.

## 7. `raw/` contract

- Every file under `raw/` is a **verbatim, unmodified** LKM API response. Stripping fields, pretty-reformatting, sorting keys, or annotating in-place is forbidden.
- `evidence_<gcn-id>.json` contains the full `/claims/{id}/evidence` response, including `code`, `data`, `trace_id`, and `data.papers`.
- `match_<NN>.json` contains the full `/claims/match` response, including `code`, `data`, `trace_id`, and `data.variables` / `data.papers`.
- No other files (no derived markdown, no rendered figures, no hash sidecars) may be placed under `raw/`.

## 8. Pre-success self-check (mandatory before declaring task complete)

Before signalling success, the skill must run and pass these checks:

1. All eight required artifacts exist in the layout above (three `evidence_graph.*` files + four pair JSON files including `dismissed_pairs.json` + at least one `evidence_<id>.json` under `raw/`).
2. For every `source` object in `evidence_graph.json` (nodes and edges) and every `claims[*]` in the four pair JSON files, the referenced `file` exists under `raw/` **and** the `pointer` resolves successfully against that file's JSON.
3. `evidence_graph.json.selected_root_id` corresponds to an existing `raw/evidence_<id>.json`.
4. For every pair record with `drawn_in_graph: true`, the referenced `graph_pair_edge_id` exists in `evidence_graph.json.pair_relations[]`, and conversely every `pair_relations[].external_record_id` resolves to a real record in the corresponding pair file. `pair_relations[]` references must point only to records in `contradictions.json`, `equivalences.json`, or `cross_validation.json` — never to `dismissed_pairs.json`.
5. No `source.file` value points outside `raw/`.
6. `evidence_graph.png` renders without missing-glyph (CJK tofu) artifacts — this is enforced by the existing CJK-rendering rule in `$evidence-subgraph` and is not relaxed by this contract.
7. **Promoted-contradictions integrity.** Every record in `contradictions.json` has `verdict == "promoted"`, a non-empty `new_question`, and a non-empty `hypothesized_cause` array whose every element is one of the five enum values (`hidden_variable`, `boundary_condition`, `measurement_protocol`, `model_assumption`, `evidence_reliability`).
8. **Promoted-cross-validation integrity.** Every record in `cross_validation.json` has `verdict == "promoted"`, a `polarity` value in `{confirm, partial_confirm, partial_disconfirm}`, a non-empty `independence_basis`, and a non-empty `scientific_weight`.
9. **Dismissed-pairs integrity.** Every record in `dismissed_pairs.json` has `drawn_in_graph == false`, `graph_pair_edge_id == null`, an `origin` in `{contradiction, cross_validation}`, and a `verdict` compatible with that `origin` per the matrix in `pair-classification.md` §11. No dismissed record carries `new_question`, `hypothesized_cause`, `independence_basis`, `scientific_weight`, or `polarity`.

Failing any of the above is a hard failure: the skill must not declare partial success and must surface the failed check to the caller.

## 9. Backward compatibility

This contract is **forward-only**. Earlier run folders that wrote `audit.md`, `cycle_check.md`, `contradictions.md`, `equivalences.md`, `candidates.md`, etc. are not in scope and are not migrated automatically. Earlier `contradictions.json` / `cross_validation.json` records that lack the `verdict` / `new_question` / `hypothesized_cause` / `independence_basis` / `scientific_weight` fields are also out of scope; runs that produced them are not retro-fitted. New runs must conform; legacy migration, if needed, is the caller's responsibility.
