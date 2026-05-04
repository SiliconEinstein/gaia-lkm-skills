# Contradiction-Driven Expansion SOP

Use this SOP when the user explicitly asks to find contradictions, explore
contradictions, or grow an existing Gaia package through contradiction-driven
LKM search.

This SOP owns the exploration workflow. It does not redefine contradiction
semantics: strict contradiction and open-question behavior remains canonical in
`$lkm-to-gaia/references/mapping-contract.md` §4.

## Primary Path

```text
explicit contradiction request
  -> inspect existing package, audit state, and inquiry state
  -> select target claims, branches, or open questions
  -> query LKM for candidate conflicts
  -> preserve raw payloads and candidate-pair records
  -> classify candidates by the mapping contract
  -> user-selection checkpoint for non-trivial package changes
  -> $lkm-to-gaia refresh mode emits selected DSL/audit updates
  -> Gaia quality gates
```

## Preconditions

- Prefer an existing standalone Gaia package with source files,
  `artifacts/lkm-discovery/`, and `.gaia/` state.
- If no package exists, first run the LKM-to-Gaia cold-start SOP or ask the user
  for a narrow target claim/paper/system.
- Read previous `contradictions.md`, `mapping_audit.md`, `merge_audit.md`,
  `merge_decisions.todo`, `dismissed/`, and `.gaia/inquiry/` before searching.
- Run the LKM-to-Gaia SOP Environment Preflight before editing package source.

## Target Selection

Choose explicit targets before querying. Valid targets include:

- user-named claims, papers, systems, quantities, or methods,
- low-belief or high-impact frontier claims from the package,
- existing open questions or inquiry hypotheses,
- weak premises or obligations from `.gaia/inquiry/`,
- branches whose scientific scope suggests possible theory/theory,
  theory/experiment, or method/method conflict.

If several targets are plausible and the user did not specify one, stop for a
checkpoint with a short rationale for each option.

## Query Construction

For each target claim, extract a scope tuple before searching:

```text
system/material | quantity/effect | asserted value/sign/direction |
method/model | conditions/regime | source paper/LKM id
```

Generate LKM match queries from that tuple. Use multiple query families when the
target is broad enough:

- **Direct falsification:** keep system and quantity, challenge value, sign, or
  direction.
- **Same-system different-method:** keep system and quantity, vary experimental,
  theoretical, or computational method.
- **Theory/experiment comparison:** search for observations or measurements that
  test a model claim's stated applicability.
- **Boundary-condition probing:** vary temperature, field, density, sample
  quality, dimensionality, approximation domain, or protocol.
- **Keyword dropping:** remove narrowing qualifiers to find edge cases or older
  conflicting formulations.

Use LKM API matches and evidence/source payloads as the evidence source. Preserve
every raw response verbatim under `artifacts/lkm-discovery/input/`.

## Candidate Pair Records

Before editing Gaia source, append candidate rows to
`artifacts/lkm-discovery/contradictions.md` or a topic-specific audit file.
Each row should include:

- target Gaia label and LKM id when available,
- candidate LKM id and evidence status (`chain-backed`, `lkm_no_chain`, or
  `search_lead`),
- raw input filename(s),
- query text that found the candidate,
- scope comparison across system, quantity, method/model, regime, and
  conditions,
- classification: `promoted`, `open_question_only`, `dismissed`, or
  `needs_user`,
- rationale and next action.

## Classification And Handoff

Classify each candidate by the mapping contract:

- **Promoted:** strict same-scope incompatibility. Queue the pair for
  `$lkm-to-gaia` refresh so the relevant claims and `contradiction(...)`
  operator can be emitted.
- **Open question only:** scientifically interesting tension that fails the
  strict gate. Keep it in audit files and add an inquiry hypothesis when useful.
- **Dismissed:** false alarm, duplicate wording, different scope, or insufficient
  provenance. Preserve rationale under `dismissed/` or the audit row.
- **Needs user:** scientifically ambiguous or scope-sensitive; stop for user
  judgment before source edits.

Use `$lkm-to-gaia` refresh mode for selected package changes. It owns source
emission, claim provenance, priors, operators, and audit continuity.

## Quality Gates

After refresh edits, run:

```bash
gaia compile .
gaia check --brief .
gaia check --hole .
gaia infer .
gaia inquiry review --strict .
```

If holes, duplicate diagnostics, unreviewed warrants, or unresolved obligations
appear, repair through another focused turn and preserve the audit trail.
