# Step 3 — Screen Contradictions And Open Questions

Load this file only after Step 2 is complete. This step is mandatory for every
new claim. It is a baseline package-quality screen before source handoff, not a
broad contradiction-discovery pass.

## Canonical Policy

Read `mapping-contract.md` §4 before making any contradiction decision. If this
file and the mapping contract disagree, the mapping contract wins.

`mapping-contract.md` §4 is the sole authority for contradiction semantics. In
this step, prioritize open-question discovery, then run a final scan that either
emits direct `contradiction(A, B)` for accepted scientific contradictions or
keeps the item as hypothesis/audit-only.

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
- open problem or discriminating question raised by the pair,
- verdict: `accepted_contradiction`, `hypothesis_only`, `dismissed`, or
  `needs_more_evidence`,
- rationale and next action.

## Open-Question-First Review

For every plausible tension, ask the model to name the best field-facing open
problem before deciding whether to emit an operator. Register useful open
problems even when the pair is not yet a Gaia contradiction:

```bash
gaia inquiry hypothesis add "<open problem>" --scope <namespace>::<label>
```

Do not wait for perfect contradiction certainty before recording the hypothesis;
the hypothesis is how later refreshes remember what to test.

## Accepted Contradiction Output

For each final-scan `accepted_contradiction`, emit direct
`contradiction(A, B)` using the `xx_vs_yy` label policy in
`mapping-contract.md` §4:

```python
<side_a>_vs_<side_b>[_<quantity_or_regime>] = contradiction(
    A,
    B,
    prior=0.95,
    reason="<why A and B are an adjudicable scientific conflict> | open_problem: <specific discriminating question>",
)
```

The `reason` field must include `open_problem:`. If no specific open problem can
be written, the candidate is not ready for `accepted_contradiction`; keep it as
`hypothesis_only`.

The audit row for an emitted contradiction must include:

```text
decision: accepted_contradiction
relation_type: scientific_inconsistency
```

Register the same open problem:

```bash
gaia inquiry hypothesis add "<open problem>" --scope <namespace>::<op_label>
```

Warrant prior ranges for accepted contradiction operators:

- Clear accepted contradiction: `0.95`.
- Accepted but less crisp scope/test relation: `0.85–0.92`.
- Do not lower the operator prior solely because the pair is method/method,
  theory/computation, or finite-size/extrapolation mediated.

## Hypothesis-Only Output

For tensions that raise useful open problems but do not yet satisfy
`mapping-contract.md` §4's final promotion standard:

- write no Gaia `contradiction(...)` operator,
- append a row to `artifacts/lkm-discovery/contradictions.md` or a topic audit
  file,
- include raw LKM anchors, why it is scientifically interesting, the open
  problem it raises, why it is not yet accepted as a contradiction, and the next
  query,
- add an inquiry hypothesis scoped to the most relevant claim when useful.

Dismiss false alarms, duplicate wording, and unsupported search leads with an
explicit rationale.

## Step-Completion Gate

Before moving to Step 4:

- Every new claim has completed baseline screening against available package and
  audit context.
- Accepted contradictions have direct `contradiction(A, B)` operators whose
  labels identify both sides with the `xx_vs_yy` convention, with an
  `open_problem:` reason, high operator prior, and audit
  `relation_type: scientific_inconsistency`.
- Non-promoted but useful tensions are preserved as hypothesis/audit-only rows.
- False alarms are logged or dismissed with reason.
- Mark Step 3 complete, mark Step 4 in progress, then load
  `step-4-supports-priors-and-review.md`.
