# Step 3 — Screen Contradictions And Open Questions

Load this file only after Step 2 is complete. This step is mandatory for every
new claim. It is a baseline package-quality screen before source handoff, not a
broad contradiction-discovery pass.

## Canonical Policy

Read `mapping-contract.md` §4 before making any contradiction decision. If this
file and the mapping contract disagree, the mapping contract wins.

Executable `contradiction()` is only for strict same-scope incompatibility:
both sides cannot simultaneously be true once system/material, quantity,
method/model, temperature, pressure/field, sample regime, approximation domain,
and boundary conditions are explicit. Accepting A must force rejection of B, or
vice versa.

Research-worthy tensions that fail the strict gate are open questions, not Gaia
operators.

## Baseline Sources To Check

Check every new claim against:

- orchestrator discovery flags in `contradictions.md`,
- other new claims in the current batch,
- existing package claims,
- upstream/support claims found while resolving obligations,
- `.gaia/ir.json` when available for internal tensions.

Do not skip a claim because it looks obvious, narrow, or already accepted.

Focused LKM retrieval is allowed only when needed to classify a current candidate
pair, hydrate a prior discovery flag, or verify scope/provenance for a claim
already being mapped. Preserve every new raw payload under
`artifacts/lkm-discovery/input/`. Do not use external PDFs or web summaries as
evidence unless the user explicitly changes the rule.

## Baseline Candidate Records

For every possible conflict or tension surfaced during this step, append an
audit row to `artifacts/lkm-discovery/contradictions.md` or
`mapping_audit.md` before source handoff.

Record:

- new claim label and LKM id,
- compared claim label/LKM id when available,
- raw input filename(s),
- scope comparison across system/material, quantity, method/model, conditions,
  and regime,
- verdict: `promoted`, `open_question_only`, `dismissed`, or
  `needs_more_evidence`,
- rationale and next action.

## Strict Contradiction Output

For each promoted strict contradiction, write:

```python
<op_label> = contradiction(
    A,
    B,
    prior=<float>,
    reason="<why A and B cannot both be true> | new_question: <specific investigable open problem>",
)
```

The `reason` field must include `new_question:`. If a specific investigable
question is not yet available, use:

```text
new_question: no specific investigable question identified yet
```

When `new_question:` contains a specific investigable question, register it:

```bash
gaia inquiry hypothesis add "<open question>" --scope <namespace>::<op_label>
```

Prior ranges:

- Experiment vs theory/computation on the same scoped quantity: 0.90–0.95.
- Direct conflict on the same quantity and paradigm: 0.85–0.90.
- Same-system method/method conflict with comparable conditions: 0.85–0.92.

## Open-Question-Only Output

For model-applicability tensions, boundary-condition gaps, coverage gaps,
quantitative surprises, unclear mechanisms, or any under-scoped candidate:

- write no Gaia operator,
- append a row to `artifacts/lkm-discovery/contradictions.md` or a topic audit
  file,
- include raw LKM anchors, why it is scientifically interesting, why it fails
  the strict contradiction gate, and the next query,
- add an inquiry hypothesis scoped to the most relevant claim when useful.

## Step-Completion Gate

Before moving to Step 4:

- Every new claim has completed baseline screening against available package and
  audit context.
- Strict same-scope conflicts have Gaia operators plus scoped inquiry
  hypotheses when a specific investigable `new_question` exists.
- Non-strict tensions are audit rows, not operators.
- False alarms are logged or dismissed with reason.
- Mark Step 3 complete, mark Step 4 in progress, then load
  `step-4-supports-priors-and-review.md`.
