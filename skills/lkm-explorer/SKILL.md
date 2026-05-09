---
name: lkm-explorer
description: Contract-driven LKM exploration in service of populating a Gaia knowledge package per `$gaia-package`. Maps LKM evidence/source payloads (raw match/evidence/variables JSON) into Gaia DSL via a progressive five-step workflow with contradiction-driven graph expansion. Modes are `batch` (create a fresh `<name>-gaia/` package) and `refresh` (extend or repair an existing package in place). Owns the LKM-driven `lkm-discovery/` audit dir (retrieval log + LKM-specific decisions). Generic claim/deduction/support emission rules, package layout, and the `graph_growth_log.jsonl` schema live in `$gaia-package`. Domain-agnostic.
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

A Gaia package produced here compiles via `gaia compile`, propagates beliefs
via `gaia infer`, and carries LKM provenance into `**metadata` kwargs of every
claim.

> **Contract ownership.** Package shape (`<name>-gaia/` layout, file
> templates), generic emit-mapping rules (claim/deduction/support body
> discipline, `provenance_source` enum, `claim_kind`, `weak_types`, `p1`/`p2`/
> `review_prior`, `refs` whitelist, label rules, module placement), and the
> `graph_growth_log.jsonl` v1 audit schema are owned by
> [`$gaia-package`](../gaia-package/). This skill adds the LKM-specific
> exploration workflow, the `lkm-discovery/` audit dir, the `retrieval_log.jsonl`,
> and LKM-only mapping rules on top.

```
$lkm-api raw JSON + orchestrator flag files
        |
        v
  $lkm-explorer
  (Gaia package source per $gaia-package contract)
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
  `deduction(...)`; no-chain LKM source claims may enter after cold start only
  as leaf/source `claim(...)` nodes.
- Search leads outside accepted chain-backed factors or accepted post-cold-start
  source claims do not enter executable DSL.
- Claims must be self-contained and preserve `lkm_original`, `lkm_id`, and
  `source_paper` when available.
- No `prior` kwarg on `claim(...)`; leaf priors live in `priors.py` (see
  `$gaia-package/references/package-shape.md`).
- Post-cold-start expansion follows the cold-start root frontier selected by the
  user. For every frontier science claim, the orchestrator runs both support and
  open-question/conflict LKM channels; this skill maps accepted candidates.
- Support handling follows `mapping-contract.md` §3: real Gaia
  `support([premises], conclusion, reason=..., prior=...)` syntax, LKM-grounded
  endpoints, no synthetic bridge facts, and duplicate/shared-factor controls.
- Contradiction handling follows `mapping-contract.md` §4: prioritize open
  questions, then final-scan accepted scientific contradictions into direct
  `contradiction(A, B)` operators with `xx_vs_yy` labels and audit
  `relation_type: scientific_inconsistency`; other useful tensions remain audit
  rows plus optional inquiry hypotheses.
- Audit-trail files are cumulative and must not silently overwrite prior
  verdicts.
- `retrieval_log.jsonl` is append-only and LKM-specific (see
  `references/timeline-log-contract.md` for the LKM-only event subset).
- `graph_growth_log.jsonl` is append-only and follows the canonical v1 schema
  in `$gaia-package/references/audit-log.md`. This logging contract applies
  only to LKM-driven Gaia package work, not to sibling skills.
- Package-level quality gates are run by the orchestrator/caller after source
  emission.

## Responsibility Boundaries

- The SOP/orchestrator owns turn shape, broad root discovery, user checkpoints,
  sibling-skill routing, and final quality-gate acceptance.
- `$lkm-api` owns endpoint mechanics and raw API contract details.
- `$gaia-package` owns the unified package shape, generic emit-mapping rules,
  and the `graph_growth_log.jsonl` audit schema.
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
  — LKM-specific `retrieval_log.jsonl` schema and pointer to canonical
  `graph_growth_log.jsonl` schema in `$gaia-package`.
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

Generic Gaia-package contract (in `$gaia-package`):

- [`$gaia-package/references/package-shape.md`](../gaia-package/references/package-shape.md)
  — directory layout, naming, file templates, audit-dir layout.
- [`$gaia-package/references/emit-mapping.md`](../gaia-package/references/emit-mapping.md)
  — generic claim/deduction/support/contradiction/equivalence emission rules,
  metadata kwarg taxonomy, label discipline, module placement.
- [`$gaia-package/references/audit-log.md`](../gaia-package/references/audit-log.md)
  — `graph_growth_log.jsonl` v1 schema, `mapping_audit.md` table conventions,
  decision vocabulary, append-only / `supersedes_event_id` rules.
