---
name: lkm-to-gaia
description: Convert LKM evidence/source payloads directly into Gaia DSL source for a standalone knowledge package. Modes are `batch` (create a fresh `<name>-gaia/` package) and `refresh` (extend or repair an existing package in place). Reads raw LKM JSON plus orchestrator audit flags, maps claims/deductions/operators, and writes Gaia package source directly. No intermediate graph artifact. Domain-agnostic.
---

# LKM-to-Gaia

## Mission

Use LKM as the source of truth to build or update a standalone Gaia knowledge
package. This skill turns raw LKM payloads, exploration/audit state, and package
requirements into executable, auditable, and iteratively extensible Gaia DSL.
For LKM-to-Gaia package work, it also maintains the package's chronological
retrieval and graph-growth logs so the full search-to-DSL history can be
replayed later.

It is not only a one-shot converter. During mapping it may continue focused
LKM-grounded checks for claim-driven supports, open questions, contradictions,
equivalences, provenance, and obligations. Every newly retrieved LKM payload must
be preserved verbatim and classified through the mapping contract before it
enters executable DSL or audit files.

A Gaia package produced here compiles via `gaia compile`, propagates beliefs via
`gaia infer`, and carries LKM provenance into `**metadata` kwargs of every
claim.

```
$lkm-api raw JSON + orchestrator flag files
        |
        v
  $lkm-to-gaia
  (standalone Gaia package source)
```

Routed via [`$orchestrator`](../orchestrator/SKILL.md) when the user asks for a "Gaia package", "Gaia DSL", "knowledge package", or "formalized into Gaia".

## Output Modes

- **Batch** creates a fresh standalone `<name>-gaia/` package.
- **Refresh** extends or repairs an existing standalone package while preserving
  prior labels, priors, raw inputs, and audit verdicts.

Broad topic discovery, root candidate ranking, user-selection checkpoints, and
claim-driven frontier iteration are organized by the LKM-to-Gaia SOP through
`$orchestrator` and `$lkm-api`. Once a mapping run starts, this skill may
request focused LKM retrievals needed to complete its five-step workflow.

## Progressive Workflow

At the start of each `$lkm-to-gaia` run, create a session todo/checklist with
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
- No `prior` kwarg on `claim(...)`; leaf priors live in `priors.py`.
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
- `retrieval_log.jsonl` and `graph_growth_log.jsonl` are append-only and follow
  `references/timeline-log-contract.md`. This logging contract applies only to
  LKM-to-Gaia package work, not to sibling skills.
- Package-level quality gates are run by the orchestrator/caller after source
  emission.

## Responsibility Boundaries

- The SOP/orchestrator owns turn shape, broad root discovery, user checkpoints,
  sibling-skill routing, and final quality-gate acceptance.
- `$lkm-api` owns endpoint mechanics and raw API contract details.
- `$lkm-to-gaia` owns package source emission and mapping-time LKM-grounded
  exploration needed by the progressive workflow.
- Evidence-graph rendering, scholarly prose synthesis, external host
  integration, and final scientific review are separate responsibilities.

## Reference files

- [`references/mapping-contract.md`](references/mapping-contract.md) — detailed mapping rules and module placement conventions
- [`references/package-skeleton.md`](references/package-skeleton.md) — package output layout + templates aligned with current Gaia CLI conventions
- [`references/timeline-log-contract.md`](references/timeline-log-contract.md) — chronological replay logs for LKM-to-Gaia retrievals and graph growth
- [`references/step-1-inputs-and-scope.md`](references/step-1-inputs-and-scope.md) — progressive workflow Step 1
- [`references/step-2-bootstrap-and-map.md`](references/step-2-bootstrap-and-map.md) — progressive workflow Step 2
- [`references/step-3-contradictions-and-open-questions.md`](references/step-3-contradictions-and-open-questions.md) — progressive workflow Step 3
- [`references/step-4-supports-priors-and-review.md`](references/step-4-supports-priors-and-review.md) — progressive workflow Step 4
- [`references/step-5-emit-and-handoff.md`](references/step-5-emit-and-handoff.md) — progressive workflow Step 5
