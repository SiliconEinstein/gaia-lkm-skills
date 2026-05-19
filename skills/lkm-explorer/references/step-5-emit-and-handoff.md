# Step 5 — Emit And Hand Off

Load this file only after Step 4 is complete. This step finalizes the source
artifact and hands it back to the orchestrator/caller for quality gates.

## Authoring surface — `gaia author` (cli-as-client)

Step 5 emits the package through the upstream **agent-first authoring CLI**
(`SiliconEinstein/Gaia` `docs/reference/cli/author.md`), not by writing raw
Python DSL by hand. The CLI:

- pre-validates each statement (identifier collision, reference resolution,
  syntactic well-formedness, structural self-loop) before writing,
- appends the rendered Python to the target source file,
- runs `gaia build check` automatically after each successful write
  (default `--check` on),
- emits a uniform JSON envelope on stdout — `json.loads(stdout)` once and
  dispatch on `verb` / `status` / `code`.

Per Step 4's mapping outputs, the DSL primitives this skill emits map to
author verbs as follows (canonical v0.5 names; legacy aliases in
`gaia.engine.lang.compat` emit `DeprecationWarning` and must not be used in
fresh packages):

| Step 4/5 emission | DSL primitive | Author verb |
|---|---|---|
| LKM source / no-chain claim | `claim(...)` | `gaia author claim` |
| Background context | `note(...)` | `gaia author note` |
| Open inquiry | `question(...)` | `gaia author question` |
| Factor-derived deduction | `derive(...)` | `gaia author derive` |
| Frontier support warrant (`support([U], target)`) | `derive(target, given=[U])` | `gaia author derive` |
| Accepted scientific contradiction (`contradiction(A, B)`) | `contradict(a, b)` | `gaia author contradict` |
| Cross-paper equivalence (`equivalence(A, B)`) | `equal(a, b)` | `gaia author equal` |
| Mutually-exclusive hypothesis pair | `exclusive(a, b)` | `gaia author exclusive` |
| Leaf prior record | `register_prior(...)` | `gaia author register-prior` |

The legacy `support([U], target, reason=..., prior=...)` strategy is
replaced by `derive(target, given=[U], rationale=...)` per the migration
table at `docs/for-users/language-reference.md` "Notable migration rows".
The warrant strength carries over via `--metadata '{"warrant_prior":
<float>}'` instead of the legacy `prior=` kwarg on the strategy.

Errors surface in the envelope's `diagnostics` array with a `kind`
dispatch key (`prewrite.collision`, `prewrite.reference_unresolved`,
`prewrite.syntax`, `prewrite.self_loop`, `postwrite.check_fail`, ...).
Treat non-zero `code` as a fix-and-retry obligation before moving on; the
CLI guarantees no partial writes on pre-write failure.

## Batch Output

For batch mode, emit a new standalone `<name>-gaia/` package. Bootstrap the
package directory and sibling modules with the CLI:

```bash
gaia pkg scaffold \
    --target <name>-gaia \
    --name <name>-gaia \
    --with-uuid \
    --description "<one-line description of this LKM-rooted package>"

gaia pkg add-module --target <name>-gaia --name paper_<key>
gaia pkg add-module --target <name>-gaia --name cross_paper
gaia pkg add-module --target <name>-gaia --name priors
```

`gaia pkg scaffold` writes `pyproject.toml` (with `[tool.gaia] type =
"knowledge-package"` and a freshly-minted `uuid`),
`src/<import_name>/__init__.py` seeded with a minimal DSL import and
`__all__: list[str] = []`, and `.gaia/.gitkeep`. Each `add-module` call
creates `src/<import_name>/<module>.py` with a literal empty `__all__`
that subsequent `gaia author --file <module>.py` invocations auto-extend.

Add one `paper_<key>.py` sibling per source paper as the package grows.
`cross_paper.py` is the canonical target for cross-paper `equal` /
`contradict` / `exclusive` operators (per `mapping-contract.md` §4).
`priors.py` collects every `register_prior(...)` call.

Resulting layout after Step 4 + Step 5 emissions complete:

```text
<name>-gaia/
├── pyproject.toml
├── references.json
├── src/<import>/
│   ├── __init__.py
│   ├── paper_<key>.py
│   ├── cross_paper.py
│   └── priors.py
└── artifacts/lkm-discovery/
    ├── input/
    ├── retrieval_log.jsonl
    ├── graph_growth_log.jsonl
    ├── candidates.md
    ├── contradictions.md
    ├── equivalences.md
    ├── mapping_audit.md
    ├── merge_audit.md
    ├── merge_decisions.todo
    └── dismissed/
```

The `artifacts/lkm-discovery/` audit dir is SOP-owned (not part of the
upstream package skeleton). Create the audit dir and copy raw LKM JSON
verbatim into `artifacts/lkm-discovery/input/`. Do not strip, summarize, or
rewrite raw payloads. Create or append `retrieval_log.jsonl` and
`graph_growth_log.jsonl` according to `timeline-log-contract.md`.

For refreshes, extend existing modules and audit files rather than replacing
prior verdicts. Reuse existing labels and priors where possible.

### Example invocations

Source claim with LKM provenance (no-chain):

```bash
gaia author claim "<self-contained claim body>" \
    --label <key>_<suffix> \
    --target <name>-gaia \
    --file paper_<key>.py \
    --metadata '{"provenance_source": "lkm_no_chain", "lkm_id": "<lkm_id>", "lkm_original": "<original-content-string>", "source_paper": "<key>", "claim_kind": "lkm_source"}'
```

Factor-derived deduction (chain-backed):

```bash
gaia author derive \
    --conclusion <key>_c<id>_<suffix> \
    --given <premise_label_1>,<premise_label_2> \
    --label <key>_c<id>_chain \
    --rationale "<factor-chain rationale>" \
    --target <name>-gaia \
    --file paper_<key>.py \
    --metadata '{"warrant_prior": 0.93, "provenance_source": "lkm:factor_chain", "lkm_id": "<chain_id>"}'
```

Frontier support warrant (legacy `support([U], target, prior=p)` → canonical
`derive(target, given=[U], rationale=...)`):

```bash
gaia author derive \
    --conclusion <target_label> \
    --given <upstream_label> \
    --label <upstream>_supports_<target> \
    --rationale "<what U says and why it supports target>" \
    --target <name>-gaia \
    --file paper_<key>.py \
    --metadata '{"warrant_prior": 0.85, "provenance_source": "lkm:frontier_support", "channel": "support"}'
```

Cross-paper equivalence (routed to `cross_paper.py`):

```bash
gaia author equal --a <claim_label_from_paper_A> --b <claim_label_from_paper_B> \
    --label <key_a>_<key_b>_<short_suffix>_equiv \
    --rationale "<why these refer to the same scientific assertion>" \
    --target <name>-gaia \
    --file cross_paper.py \
    --metadata '{"provenance_source": "lkm:factor_chain.equivalence", "lkm_id": "<lkm_equiv_id>"}'
```

Accepted scientific contradiction (per `mapping-contract.md` §4; routed to
`cross_paper.py`):

```bash
gaia author contradict --a <side_a_label> --b <side_b_label> \
    --label <side_a>_vs_<side_b>[_<quantity_or_regime>] \
    --rationale "<why these claims are adjudicably conflicting> | open_problem: <specific discriminating question>" \
    --target <name>-gaia \
    --file cross_paper.py \
    --metadata '{"warrant_prior": 0.95, "relation_type": "scientific_inconsistency", "provenance_source": "lkm:contradiction_scan"}'
```

Per author.md "the contradiction operator binds the helper Claim to
`--label`; do not mint fresh claims by design" — `<side_a>_vs_<side_b>` is
the contradiction's helper-Claim label, not a synthesized side claim. The
`open_problem:` convention lives inside `--rationale`.

Leaf prior record:

```bash
gaia author register-prior \
    --claim <claim_label> \
    --value <float> \
    --justification "<terse rationale ending in TODO:review>" \
    --target <name>-gaia \
    --file priors.py \
    --source-id wp_prior_inline
```

## Refresh Output

For an existing standalone package, extend the existing package in place.
`gaia author` writes are append-only by design (pre-write collision check
refuses to overwrite a binding):

- append new raw payloads under `artifacts/lkm-discovery/input/`,
- append retrieval and graph-growth events without rewriting prior events,
- extend existing paper modules with new `gaia author` invocations carrying
  `--target <existing-pkg>` (and `--file paper_<key>.py` to route to the
  right module), or create new `paper_<key>.py` modules via `gaia pkg
  add-module`,
- reuse existing labels in `--given` / `--a` / `--b` / `--claim` to weave
  new statements into the prior graph; the CLI's pre-write reference
  resolution catches typos at write time,
- preserve existing labels and priors where possible — `gaia author
  register-prior` is additive (a Claim can carry multiple prior records
  from distinct `--source-id`s; Gaia's `ResolutionPolicy` picks the
  winning value at compile time and keeps the losing records for audit),
- append audit decisions rather than replacing prior history,
- keep previous `dismissed/` entries and unresolved `merge_decisions.todo`
  items unless the user explicitly reopens them.

## Local Source Checks

Pre-write CLI validation handles the syntactic / structural slice — every
`gaia author <verb>` invocation runs identifier-collision, reference-
resolution, and `ast.parse`-equivalent checks before writing, and aborts
with a `prewrite.*` diagnostic on failure (see `docs/reference/cli/author.md`
"Pre-write invariants"). So legacy items "Python source parses with
`ast.parse`", "Gaia labels are lowercase identifiers", and "no claim has a
`prior` kwarg" (the CLI renders `--prior` as a `register_prior(...)` call
attached to the claim, never as a `prior=` claim kwarg) are enforced at the
verb boundary.

The remaining checks before handoff are SOP-owned semantic content:

- Every claim preserves LKM provenance metadata where available
  (`provenance_source`, `lkm_id`, `lkm_original`, `source_paper` flow
  through `--metadata`).
- Every `derive(...)` is factor-derived; no-chain source claims have no
  fabricated deductions (no `gaia author derive` invocation against a
  no-chain source claim's label unless a real factor chain backs it).
- Cross-paper operators are routed to `cross_paper.py` (verify via
  `--file cross_paper.py` in the relevant author invocations).
- Accepted contradictions use direct `contradict(A, B)` per
  `mapping-contract.md` §4, with an `xx_vs_yy` label, `open_problem:` in
  the `--rationale`, high `warrant_prior` metadata, and audit
  `relation_type: scientific_inconsistency`.
- Root `__init__.py.__all__` exports only the package-export-surface
  labels (selectively re-imported from per-paper modules) — not every
  label written into sibling modules. The CLI auto-extends each
  module's local `__all__` with every labeled write; the root export
  surface remains an SOP-managed selective re-export.
- Audit files reflect accepted contradictions, hypothesis-only open
  problems, equivalences, merges, dismissals, and unresolved decisions.
- `retrieval_log.jsonl` covers every package-scoped LKM call consumed by
  this run, and `graph_growth_log.jsonl` covers every source/audit
  decision emitted by this run.
- Every graph-growth event has `schema_version`, `actor_id`, monotonic
  `seq`, and a populated `graph_delta` block. No frontend-visible graph
  node or edge requires parsing Python source to reconstruct.
- Round lifecycle, stage transition, user-selection checkpoint, candidate,
  and inquiry events required by `timeline-log-contract.md` have been
  emitted when applicable.

## Caller Quality Gate

`gaia author --check` (default on) runs `gaia build check` automatically
after each statement write, so per-statement structural / IR-hash drift is
already caught at the verb boundary. The end-of-batch quality gates the
orchestrator/caller still runs collapse to three commands:

```bash
gaia build compile .
gaia run infer .
gaia inquiry review --strict .
```

- `gaia build compile .` — full-package compile catches cross-statement
  issues the per-write check cannot (cyclic imports, IR-hash regeneration,
  manifest emission for `exports` / `premises` / `holes` / `bridges`).
- `gaia run infer .` — belief propagation; emits `.gaia/beliefs.json`.
- `gaia inquiry review --strict .` — strict warrant / obligation /
  duplicate-control review (unchanged subapp).

If `gaia build compile .` reports a hole-related issue or you want a
detailed prior-coverage breakdown, run `gaia build check --hole .` as a
diagnostic and fill `priors.py` (via `gaia author register-prior`) before
re-running the gate. If inquiry review reports unreviewed warrants or
duplicates, log or resolve them according to Step 4 and rerun the gate.

After each quality-gate attempt, append a `quality_gate_result` event to
`graph_growth_log.jsonl` with an empty `graph_delta` unless the gate-triggered
repair actually changed nodes or edges.

## Hand-Off Report

Return:

- files created or changed (including the per-invocation
  `payload.written_to` from each `gaia author` envelope, aggregated),
- raw LKM payloads consumed,
- retrieval-log and graph-growth-log event ids added,
- graph deltas added, including nodes/edges added or removed,
- chain-backed vs no-chain source claims added,
- deductions, supports (now emitted as `derive(...)` with
  `provenance_source="lkm:frontier_support"`), equivalences, accepted
  contradictions, and hypothesis-only open problems added,
- priors added or still needed,
- inquiry obligations/hypotheses opened or closed,
- the three quality-gate commands the caller ran and pass/fail status
  (`gaia build compile .`, `gaia run infer .`, `gaia inquiry review
  --strict .`),
- the final `gaia author` envelope's `check.knowledge_count` /
  `check.strategy_count` / `check.operator_count` as IR-side sanity counts,
- deviations from the mapping contract, if any.

## What This Skill Is Not

- Not orchestration: this skill does not choose user roots or route siblings.
- Not graph rendering: use Gaia CLI/rendering outside this local skill.
- Not a Gaia DSL language guide: syntax details belong to the installed Gaia
  package (`docs/reference/cli/author.md` for the authoring surface;
  `docs/for-users/language-reference.md` for the DSL primitives) and must be
  verified through local Gaia CLI quality gates.

## Step-Completion Gate

When handoff is complete, mark Step 5 complete. If quality gates surface new
obligations, create a new iteration checklist and return to Step 1 with the new
target or obligation.
