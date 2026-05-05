# Timeline Log Contract

This contract applies **only** to the maintained LKM-to-Gaia package workflow.
It does not change the raw `$lkm-api` skill, the evidence-subgraph skill, or
the scholarly-synthesis skill.

The goal is frontend replayability. A static web UI should be able to read the
timeline logs and replay the Gaia starmap from `t=0` without calling LKM again
or parsing Python source. Therefore every fact that is observable during skill
execution but hard to reconstruct later must be logged in structured form.

The replay layers are:

- LKM call layer: successful query/evidence results and raw payload pointers.
- Decision layer: candidate scope comparison, accept/dismiss/hypothesis-only or
  contradiction rationale.
- Graph-construction layer: per-round node/edge deltas, rejected candidates,
  frontier changes, and stage transitions.

Retry and failure events may still be logged for debugging, but frontend replay
is expected to ignore unsuccessful retrieval events.

## Required files

Every LKM-to-Gaia package stores two append-only chronological logs under
`artifacts/lkm-discovery/`:

```text
artifacts/lkm-discovery/
├── input/
├── retrieval_log.jsonl
└── graph_growth_log.jsonl
```

`retrieval_log.jsonl` records LKM API calls and their raw payload files.
`graph_growth_log.jsonl` records source/audit graph-growth decisions that use
those payloads.

Both files are line-delimited JSON. Each line is one event. Do not rewrite older
events to fix interpretation; append a later correction event with
`supersedes_event_id` when needed.

## Schema versioning

Every event includes:

```json
{"schema_version": "1"}
```

Rules:

- `schema_version` is a string, not a number.
- Additive optional fields may remain in the same schema version.
- Removing fields, changing meanings, or changing enum values requires a new
  schema version.
- Consumers should branch on `schema_version` before rendering.

## Event identity

Every event has:

```json
{
  "schema_version": "1",
  "event_id": "2026-05-05T14:00:00.123Z__orchestrator-18422__root_discovery__1",
  "timestamp_utc": "2026-05-05T14:00:00.123Z",
  "stage": "cold_start",
  "round_id": "round_0000",
  "actor": "orchestrator",
  "actor_id": "orchestrator-18422",
  "seq": 1
}
```

Rules:

- `timestamp_utc` is an ISO-8601 UTC timestamp with millisecond precision:
  `YYYY-MM-DDTHH:mm:ss.SSSZ`.
- Each actor maintains a monotonically increasing integer `seq`.
- `actor_id` identifies the emitting actor and should include a worker name plus
  pid or uuid, e.g. `orchestrator-18422` or `worker-support-a-550e8400`.
- `event_id` format is
  `<timestamp_ms>__<actor_id>__<channel_or_decision>__<seq>`.
- `stage` is one of `cold_start`, `frontier_expansion`, `mapping`,
  `duplicate_prior_maintenance`, `quality_gate`, or `repair`.
- `round_id` is stable for a unit of graph growth. Cold start uses
  `round_0000`; later frontier rounds use `round_0001`, `round_0002`, etc.
- `actor` is `orchestrator`, `lkm-to-gaia`, or a delegated worker name.

## Retrieval events

Append one retrieval event for every `$lkm-api` call made for an LKM-to-Gaia
package: `match`, `evidence`, or `variables`.

Minimum schema:

```json
{
  "schema_version": "1",
  "event_id": "2026-05-05T14:00:00.123Z__orchestrator-18422__support__12",
  "timestamp_utc": "2026-05-05T14:00:00.123Z",
  "stage": "frontier_expansion",
  "round_id": "round_0001",
  "actor": "orchestrator",
  "actor_id": "orchestrator-18422",
  "seq": 12,
  "frontier_claim": {
    "label": "gcn_example",
    "lkm_id": "gcn_example"
  },
  "channel": "support",
  "endpoint": "match",
  "request": {
    "text": "2D HEG effective mass finite-size extrapolation",
    "top_k": 10,
    "filters": {"visibility": "public"}
  },
  "raw_output": "input/round_0001_001_match_support_effective_mass.json",
  "trace_id": "trace-from-response",
  "response_code": 0,
  "result_summary": {
    "candidate_count": 10,
    "candidate_ids": ["gcn_x", "gcn_y"],
    "evidence_ids": []
  },
  "scope_tuple": null,
  "scope_diff": null,
  "open_problem": null,
  "rejection_reason": null,
  "warrant_prior": null,
  "retry_of_event_id": null,
  "notes": "optional short rationale"
}
```

Field rules:

- `frontier_claim` is `null` during broad cold-start search before a root exists.
- `channel` is one of `root_discovery`, `support`,
  `open_question_conflict`, `evidence_hydration`, `variables_hydration`,
  `duplicate_review`, `quality_repair`, or `other`.
- `raw_output` points to a verbatim JSON file under
  `artifacts/lkm-discovery/input/`.
- `result_summary` must include enough successful-return facts for the frontend
  to show what the query hit without reparsing the raw JSON.
- Record transient failures too when useful. If a `code=290001` response is
  retried, log the failed event and the retry event; the retry's
  `retry_of_event_id` points to the failed event. Frontend replay can ignore
  events whose `response_code` is not `0`.
- Never include access keys, shell environment, or other secrets in a log event.

If discovery occurs before the package directory exists, raw payloads may be
staged temporarily, but before the user-selection checkpoint the agent must copy
them into `artifacts/lkm-discovery/input/` and backfill retrieval events that
preserve the actual call order as accurately as available.

## Graph-growth events

Append graph-growth events whenever candidate classification, inquiry state, or
Gaia source/audit state changes because of LKM-to-Gaia work. This includes
no-op decisions such as `support_not_found`, `conflict_not_found`, `dismissed`,
or `hypothesis_only`, because those decisions explain why the graph did not
grow.

Minimum schema:

```json
{
  "schema_version": "1",
  "event_id": "2026-05-05T14:05:00.123Z__lkm-to-gaia-18430__accepted_support__7",
  "timestamp_utc": "2026-05-05T14:05:00.123Z",
  "stage": "mapping",
  "round_id": "round_0001",
  "actor": "lkm-to-gaia",
  "actor_id": "lkm-to-gaia-18430",
  "seq": 7,
  "frontier_claim": {
    "label": "gcn_target",
    "lkm_id": "gcn_target"
  },
  "retrieval_event_ids": [
    "2026-05-05T14:00:00.123Z__orchestrator-18422__support__12"
  ],
  "input_files": [
    "input/round_0001_001_match_support_effective_mass.json"
  ],
  "decision": "accepted_support",
  "payload": {},
  "scope_tuple": {
    "system_material": "2D homogeneous electron gas",
    "quantity_effect": "quasiparticle effective mass",
    "asserted_value_sign_direction": "m*/m remains close to unity",
    "method_model_measurement": "DMC finite-size extrapolation",
    "role": "computation",
    "conditions_regime": "r_s=1,5,10",
    "source": "paper:867751779943579657 / gcn_target"
  },
  "scope_diff": {
    "system_material": "same broad model family",
    "quantity_effect": "same quantity",
    "method_model_measurement": "different extrapolation protocol"
  },
  "open_problem": null,
  "rejection_reason": null,
  "warrant_prior": 0.85,
  "gaia_actions": [
    {
      "action": "support",
      "symbol": "smith_supports_target",
      "file": "src/example/cross_paper.py"
    }
  ],
  "graph_delta": {
    "nodes_added": [
      {
        "id": "gcn_supporting_claim",
        "kind": "claim",
        "label": "Supporting effective-mass benchmark",
        "lkm_id": "gcn_supporting_claim",
        "source_paper": "paper:123",
        "prior": null,
        "content_excerpt": "The extrapolated quasiparticle effective mass..."
      }
    ],
    "edges_added": [
      {
        "from": "gcn_supporting_claim",
        "to": "gcn_target",
        "kind": "support",
        "prior": 0.85,
        "reason_excerpt": "Same clean 2D HEG quantity and compatible regime."
      }
    ],
    "nodes_removed": [],
    "edges_removed": []
  },
  "audit_files": [
    "artifacts/lkm-discovery/mapping_audit.md"
  ],
  "next_frontier": [
    {"label": "gcn_supporting_claim", "lkm_id": "gcn_supporting_claim"}
  ],
  "quality_gate": {
    "status": "not_run",
    "commands": []
  },
  "notes": "why this changed the graph"
}
```

`graph_delta` is mandatory on every graph-growth event. Use empty arrays for
events that do not change the executable graph. The frontend must be able to draw
the starmap delta from `graph_delta` without parsing Python.

Allowed node `kind` values in `graph_delta.nodes_added`:

- `claim`
- `deduction`
- `support`
- `contradiction`
- `equivalence`

Allowed edge `kind` values are Gaia relation/operator kinds such as
`deduction`, `support`, `contradiction`, `equivalence`, or `inquiry`.

## Decision events

Allowed `decision` values:

- `package_initialized`
- `stage_transition`
- `round_open`
- `round_close`
- `user_selection_checkpoint_opened`
- `user_selection_checkpoint_closed`
- `selected_root`
- `candidate_considered`
- `accepted_claim`
- `accepted_deduction`
- `accepted_support`
- `accepted_contradiction`
- `equivalence`
- `hypothesis_only`
- `dismissed`
- `not_found`
- `support_not_found`
- `conflict_not_found`
- `needs_more_evidence`
- `merge`
- `keep_distinct`
- `prior_added`
- `hypothesis_added`
- `obligation_added`
- `quality_gate_result`
- `repair`

`gaia_actions` should be empty for no-op decisions, but `notes` must explain the
reason and `audit_files` must point to the human-readable audit row.

## Round lifecycle

Every graph-growth round emits explicit lifecycle events.

`round_open` payload:

```json
{
  "decision": "round_open",
  "payload": {
    "round_id": "round_0001",
    "frontier_in": [{"label": "gcn_root", "lkm_id": "gcn_root"}],
    "frontier_visited_so_far": [{"label": "gcn_old", "lkm_id": "gcn_old"}]
  },
  "graph_delta": {
    "nodes_added": [],
    "edges_added": [],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

`round_close` payload:

```json
{
  "decision": "round_close",
  "payload": {
    "round_id": "round_0001",
    "decisions_summary": {
      "accepted_claim": 2,
      "accepted_support": 1,
      "hypothesis_only": 1,
      "dismissed": 3
    },
    "next_frontier": [{"label": "gcn_new", "lkm_id": "gcn_new"}],
    "exhausted": false
  },
  "graph_delta": {
    "nodes_added": [],
    "edges_added": [],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

Emit `stage_transition` whenever the workflow moves between major stages:

```json
{
  "decision": "stage_transition",
  "payload": {"from": "cold_start", "to": "mapping"},
  "graph_delta": {
    "nodes_added": [],
    "edges_added": [],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

Cold start also emits `package_initialized`,
`user_selection_checkpoint_opened`, and `user_selection_checkpoint_closed`
events so the replay UI can show the package creation and human root-selection
pause.

## Candidate-considered events

Before a final candidate decision in support or open-question/conflict handling,
emit one `candidate_considered` event for each candidate that enters scope
comparison.

Required payload:

```json
{
  "decision": "candidate_considered",
  "frontier_claim": {"label": "gcn_target", "lkm_id": "gcn_target"},
  "payload": {
    "frontier_claim": {"label": "gcn_target", "lkm_id": "gcn_target"},
    "candidate_lkm_id": "gcn_candidate",
    "source_query_event_id": "2026-05-05T14:00:00.123Z__orchestrator-18422__support__12",
    "scope_tuple": {
      "system_material": "2D HEG",
      "quantity_effect": "effective mass",
      "asserted_value_sign_direction": "m*/m above unity",
      "method_model_measurement": "QMC extrapolation",
      "role": "computation",
      "conditions_regime": "low density",
      "source": "paper:123 / gcn_candidate"
    },
    "scope_diff": {
      "system_material": "same",
      "method_model_measurement": "different finite-size correction"
    },
    "evidence_status": "chain-backed",
    "preliminary_verdict": "plausible_support"
  },
  "graph_delta": {
    "nodes_added": [],
    "edges_added": [],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

Allowed `preliminary_verdict` values are free-form but should be short stable
tokens such as `plausible_support`, `plausible_conflict`, `likely_duplicate`,
`scope_mismatch`, `needs_evidence`, or `dismiss_likely`.

## Structured rationale fields

Retrieval and graph-growth events may include these top-level fields whenever
applicable:

- `scope_tuple`
- `scope_diff`
- `open_problem`
- `rejection_reason`
- `warrant_prior`

Use these fields for frontend rendering. Keep longer prose in markdown audit
files, but do not make the frontend parse markdown to recover the reason for a
candidate verdict.

## Inquiry events

Every `gaia inquiry hypothesis add` call emits a paired `hypothesis_added`
graph-growth event. Every `gaia inquiry obligation add` call emits a paired
`obligation_added` graph-growth event.

Minimum payload:

```json
{
  "decision": "hypothesis_added",
  "payload": {
    "inquiry_kind": "hypothesis",
    "text": "What finite-size extrapolation discriminates the two claims?",
    "scope": "package::operator_or_claim_label",
    "cli_command": "gaia inquiry hypothesis add \"...\" --scope package::label"
  },
  "graph_delta": {
    "nodes_added": [
      {
        "id": "inquiry:hypothesis:package::label:001",
        "kind": "claim",
        "label": "Open problem: finite-size extrapolation discriminator",
        "content_excerpt": "What finite-size extrapolation discriminates..."
      }
    ],
    "edges_added": [
      {"from": "inquiry:hypothesis:package::label:001", "to": "label", "kind": "inquiry"}
    ],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

## Frontier replay

The two logs must be sufficient to answer:

1. Which package was initialized and when?
2. Which stages were entered and left?
3. Which root-selection checkpoint opened and which root closed it?
4. Which root was selected and when?
5. For each round, which frontier entered and which frontier left?
6. For each frontier claim, which support-channel queries were run?
7. For each frontier claim, which open-question/conflict queries were run?
8. Which raw payload files came from each query or evidence call?
9. Which candidates were considered, admitted, dismissed, or left as search leads?
10. Which Gaia nodes and edges were added or removed by each decision?
11. Which inquiry hypotheses/obligations were added?
12. Which quality gates ran after each growth round and what happened?

Human-readable audit files (`mapping_audit.md`, `contradictions.md`,
`equivalences.md`, `merge_audit.md`, and `merge_decisions.todo`) remain the place
for detailed scientific rationale. The JSONL logs are the ordered structured
index that lets a frontend replay the workflow.

## Quality-gate logging

After package source changes, append a `quality_gate_result` graph-growth event
with the commands run and pass/fail status:

```json
{
  "decision": "quality_gate_result",
  "quality_gate": {
    "status": "failed",
    "commands": [
      {"command": "gaia compile .", "status": "passed"},
      {"command": "gaia check --hole .", "status": "failed", "summary": "2 missing priors"}
    ]
  },
  "graph_delta": {
    "nodes_added": [],
    "edges_added": [],
    "nodes_removed": [],
    "edges_removed": []
  }
}
```

If a failure causes a repair pass, the repair pass gets its own later
graph-growth event with `decision="repair"` and `supersedes_event_id` when it
corrects an earlier event.
