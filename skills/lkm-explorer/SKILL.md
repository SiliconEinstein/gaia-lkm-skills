---
name: lkm-explorer
description: Contract-driven LKM exploration in service of populating a Gaia knowledge package per the upstream Gaia spec. Maps LKM evidence/source payloads (raw match/evidence/variables JSON) into Gaia DSL via a progressive five-step workflow with contradiction-driven graph expansion. Modes are `batch` (create a fresh `<name>-gaia/` package) and `refresh` (extend or repair an existing package in place). Owns the LKM-driven `lkm-discovery/` audit dir (retrieval log + LKM-specific decisions) and the `graph_growth_log.jsonl` chronological growth log. Generic claim/derive/contradict emission rules and package layout are owned upstream (see upstream `SiliconEinstein/Gaia` docs `docs/for-users/`). Domain-agnostic.
---

# LKM-Explorer

## Mission

Use LKM as the source of truth to explore evidence and build or update a
standalone Gaia knowledge package. This skill turns raw LKM payloads,
exploration/audit state, and package requirements into executable, auditable,
and iteratively extensible Gaia DSL through contradiction-driven frontier
expansion. It also maintains the package's chronological retrieval and
graph-growth logs so the full search-to-DSL history can be replayed later.

It is not only a one-shot converter. During mapping it may continue focused
LKM-grounded checks for claim-driven supports, open questions, contradictions,
equivalences, provenance, and obligations. Every newly retrieved LKM payload
must be preserved verbatim and classified through the local mapping contract
before it enters executable DSL or audit files.

A Gaia package produced here compiles via `gaia build compile`, propagates beliefs
via `gaia run infer`, and carries LKM provenance into `**metadata` kwargs of every
claim.

> **Contract ownership.** Gaia knowledge-package shape (`<name>-gaia/` layout,
> file templates), `claim` / `derive` / `contradict` body discipline, label
> rules, and module placement are owned upstream by `SiliconEinstein/Gaia` —
> see `docs/for-users/language-reference.md` and
> `docs/for-users/quick-start.md`. This skill adds the LKM-specific
> exploration workflow, the `lkm-discovery/` audit dir, the
> `retrieval_log.jsonl`, the `graph_growth_log.jsonl` chronological growth
> log, and LKM-side metadata kwargs (`provenance_source`, `claim_kind`,
> `weak_types`, `p1` / `p2` / `review_prior`, `refs` whitelist, `lkm_id` /
> `lkm_original`) — all currently transitional, pending LKM-side refresh.

```
$lkm-api raw JSON + orchestrator flag files
        |
        v
  $lkm-explorer
  (Gaia package source per the upstream Gaia spec)
```

Routed via [`$orchestrator`](../orchestrator/SKILL.md) when the user asks for
a "Gaia package", "Gaia DSL", "knowledge package", or "formalized into Gaia"
from LKM evidence.

## Output Modes

- **Batch** creates a fresh standalone `<name>-gaia/` package.
- **Refresh** extends or repairs an existing standalone package while preserving
  prior labels, priors, raw inputs, and audit verdicts.

Broad topic discovery, root candidate ranking, user-selection checkpoints, and
claim-driven frontier iteration are organized by the LKM-explorer SOP through
`$orchestrator` and `$lkm-api`. Once a mapping run starts, this skill may
request focused LKM retrievals needed to complete its five-step workflow.

## Progressive Workflow

At the start of each `$lkm-explorer` run, create a session todo/checklist with
these five items. Mark only Step 1 as in progress. Do not load later step
documents until the current step is complete.

1. **Inputs, scope, and evidence status** — load
   `references/step-1-inputs-and-scope.md`.
2. **Bootstrap, refine, decompose, and map DSL** — load
   `references/step-2-bootstrap-and-map.md`.
3. **Screen contradictions and open questions** — load
   `references/step-3-contradictions-and-open-questions.md`.
4. **Add supports, priors, obligations, and duplicate controls** — load
   `references/step-4-supports-priors-and-review.md`.
5. **Emit package and hand off to quality gates** — load
   `references/step-5-emit-and-handoff.md`.

After each step, immediately mark that todo complete, mark the next todo in
progress, and only then load the next step document. If quality gates reveal new
obligations, start a new five-step iteration with the new target.

## Non-Negotiable Invariants

- Raw LKM JSON and `data.papers` are the source of truth for science-facing
  claims, factors, steps, provenance, references, and audit anchors.
- Chain-backed claims (`total_chains > 0`) may produce factor-derived
  `derive(...)`; no-chain LKM source claims may enter after cold start only
  as leaf/source `claim(...)` nodes.
- Search leads outside accepted chain-backed factors or accepted post-cold-start
  source claims do not enter executable DSL.
- Claims must be self-contained and preserve `lkm_original`, `lkm_id`, and
  `source_paper` when available.
- No `prior` kwarg on `claim(...)`; leaf priors live in `priors.py` (see
  upstream `SiliconEinstein/Gaia` `docs/for-users/language-reference.md` for
  package layout and DSL discipline).
- Post-cold-start expansion follows the cold-start root frontier selected by the
  user. For every frontier science claim, the orchestrator runs both support and
  open-question/conflict LKM channels; this skill maps accepted candidates.
- Support handling follows `mapping-contract.md` §3: real Gaia
  `derive(target, given=[premises], rationale=..., metadata={"warrant_prior": ...})`
  syntax (canonical replacement for the legacy named-strategy
  `support(...)`), LKM-grounded endpoints, no synthetic bridge facts, and
  duplicate/shared-factor controls.
- Contradiction handling follows `mapping-contract.md` §4: prioritize open
  questions, then final-scan accepted scientific contradictions into direct
  `contradict(a, b)` operators with `xx_vs_yy` labels and audit
  `relation_type: scientific_inconsistency`; other useful tensions remain audit
  rows plus optional inquiry hypotheses.
- Audit-trail files are cumulative and must not silently overwrite prior
  verdicts.
- `retrieval_log.jsonl` is append-only and LKM-specific (see
  `references/timeline-log-contract.md` for the LKM-only event subset).
- `graph_growth_log.jsonl` is append-only and emitted by this skill (current
  shape: transitional, pending LKM-side refresh). This logging contract
  applies only to LKM-driven Gaia package work, not to sibling skills.
- Package-level quality gates are run by the orchestrator/caller after source
  emission.

## Responsibility Boundaries

- The SOP/orchestrator owns turn shape, broad root discovery, user checkpoints,
  sibling-skill routing, and final quality-gate acceptance.
- `$lkm-api` owns endpoint mechanics and raw API contract details.
- Upstream `SiliconEinstein/Gaia` owns the unified Gaia knowledge-package
  shape and generic DSL body discipline (see
  `docs/for-users/language-reference.md` and
  `docs/for-users/quick-start.md`).
- `$lkm-explorer` owns LKM-driven exploration, the `lkm-discovery/` audit dir,
  the `retrieval_log.jsonl`, and LKM-specific mapping rules (evidence-status
  vocabulary, no-chain source claims, frontier supports, open-question-first
  contradiction handling).
- Evidence-graph rendering, scholarly prose synthesis, external host
  integration, and final scientific review are separate responsibilities.

## Reference files

LKM-explorer-specific (in this skill):

- [`references/mapping-contract.md`](references/mapping-contract.md) —
  LKM-specific mapping rules: evidence-status vocabulary, no-chain source
  claims, root-claim frontier supports, open-question-first contradiction
  handling, timeline emission requirement.
- [`references/package-skeleton.md`](references/package-skeleton.md) —
  `artifacts/lkm-discovery/` audit dir contents and `mapping_audit.md` LKM
  table conventions.
- [`references/timeline-log-contract.md`](references/timeline-log-contract.md)
  — LKM-specific `retrieval_log.jsonl` schema and the `graph_growth_log.jsonl`
  events this skill emits.
- [`references/step-1-inputs-and-scope.md`](references/step-1-inputs-and-scope.md)
  — progressive workflow Step 1.
- [`references/step-2-bootstrap-and-map.md`](references/step-2-bootstrap-and-map.md)
  — progressive workflow Step 2.
- [`references/step-3-contradictions-and-open-questions.md`](references/step-3-contradictions-and-open-questions.md)
  — progressive workflow Step 3.
- [`references/step-4-supports-priors-and-review.md`](references/step-4-supports-priors-and-review.md)
  — progressive workflow Step 4.
- [`references/step-5-emit-and-handoff.md`](references/step-5-emit-and-handoff.md)
  — progressive workflow Step 5.

Upstream Gaia knowledge-package contract (in `SiliconEinstein/Gaia` —
read-only pointer targets; do not duplicate locally):

- `docs/for-users/quick-start.md` — end-to-end Gaia knowledge-package
  workflow (directory layout, file templates, package initialization).
- `docs/for-users/language-reference.md` — DSL primitives
  (`claim` / `derive` / `contradict` / `equal` / `exclusive`),
  label discipline, module placement.
- `docs/for-users/cli-commands.md` — full CLI reference
  (`gaia build compile` / `build check` / `run infer` / `run render` / etc.).
- `docs/for-users/hole-bridge-tutorial.md` — prior calibration tutorial.

For runtime help, prefer `gaia <group> <cmd> --help`.
