# LKM-To-Gaia SOP

Use this SOP as the **single maintained workflow** when the user asks to build,
extend, audit, or refine a Gaia knowledge package from LKM content. There is no
separate expansion SOP: support search and open-question/conflict search are two
channels inside this SOP.

## Primary Path

```text
user request
  -> $orchestrator reads this SOP
  -> $lkm-api retrieves raw match/evidence payloads
  -> cold start: user selects one chain-backed root claim
  -> $lkm-to-gaia maps accepted payloads to Gaia DSL
  -> Gaia quality gates produce .gaia/ir.json
  -> later rounds expand from the cold-start root frontier
```

`$evidence-subgraph` is not part of this path. It is a separate graph-only branch
for users who explicitly ask for a closure-chain/evidence graph.

## Environment Preflight

Before writing or validating Gaia package source, check that Gaia is available:

```bash
gaia --help
python -c "import gaia"
```

If either check fails, stop before editing package files and ask the user to
install or activate Gaia following <https://github.com/SiliconEinstein/Gaia>.
Do not add a project-local install recipe unless the user explicitly asks.

## Package Layout

The canonical artifact is a single growing `<domain>-gaia/` package:

```text
<domain>-gaia/
├── pyproject.toml
├── references.json
├── src/<import>/
│   ├── __init__.py
│   ├── paper_<key>.py
│   ├── cross_paper.py
│   └── priors.py
├── artifacts/lkm-discovery/
│   ├── input/
│   ├── candidates.md
│   ├── contradictions.md
│   ├── equivalences.md
│   ├── mapping_audit.md
│   ├── merge_audit.md
│   ├── merge_decisions.todo
│   └── dismissed/
└── .gaia/
    ├── ir.json
    ├── beliefs.json
    └── inquiry/
```

All work after cold start operates on this same package unless the user
explicitly asks for a fork or fresh package.

## Stage 1 — Cold Start

Use this stage when no package exists yet or the user asks for a fresh package.

1. Read `$lkm-api/SKILL.md`.
2. Run the Environment Preflight.
3. Run a field-specific LKM match query. Use BM25-like keyword/anchor-phrase
   queries and preserve raw JSON under `artifacts/lkm-discovery/input/` once the
   package exists.
4. Fetch evidence for promising distinct candidates.
5. For cold-start root selection, only offer candidates with `total_chains > 0`.
6. Record no-chain LKM source claims as leads, but do not offer them as
   cold-start roots.
7. Write `candidates.md`, `contradictions.md`, and `equivalences.md` when
   applicable.
8. Stop for the mandatory user-selection checkpoint when multiple roots are
   plausible. Do not pre-select.
9. After user selection, read `$lkm-to-gaia/SKILL.md` and run its progressive
   five-step workflow in batch mode.
10. Run the Quality Gates.
11. Record the user-selected root claim as the expansion seed. This root claim is
    the only default starting point for later graph growth.

## Stage 2 — Root-Claim Frontier Expansion

Use this stage for all later graph growth, including requests phrased as
"continue expanding", "find supports", "find contradictions", "explore open
questions", or "grow the graph".

### Frontier Rule

Round 0 frontier is the cold-start root claim selected by the user.

After a completed expansion round, the next frontier is every newly admitted,
LKM-grounded **science claim** added in that round. Do not expand generated
helper claims from `support(...)`, `deduction(...)`, or `contradiction(...)`, and
do not re-expand claims already recorded in the visited frontier log.

If a round adds no new science claims, stop and report that the current frontier
is exhausted.

### Per-Claim Search Contract

For each frontier claim, extract a scope tuple before searching:

```text
system/material | quantity/effect | asserted value/sign/direction |
method/model/measurement | theory/experiment/computation role |
conditions/regime | source paper/LKM id
```

Run both channels for **every** frontier claim:

- Support channel: at least **5 distinct LKM match queries**, each with
  `top_k=10`.
- Open-question/conflict channel: at least **5 distinct LKM match queries**, each
  with `top_k=10`.

`5 queries` and `top_k=10` are different axes: the former is query diversity,
the latter is candidates returned per query. Do not reduce either without
recording the reason in the audit trail.

Preserve every raw match/evidence response verbatim under
`artifacts/lkm-discovery/input/`.

### Support Channel

Goal: find LKM-grounded content that can directly support the frontier claim in
real Gaia DSL.

- Fetch evidence for promising support candidates whenever possible.
- Chain-backed candidates may add `claim(...)` nodes and factor-derived
  `deduction(...)` strategies.
- Clear no-chain LKM source claims may enter after cold start as leaf/source
  `claim(...)` nodes.
- A support edge may be a scientific-review judgment rather than an LKM
  `gfac_*` factor, but both endpoints must be LKM-grounded Gaia claims.
- Accepted support uses real Gaia DSL:

```python
support([upstream_claim], target_claim, reason="<why upstream supports target>", prior=<float>)
```

or, when several upstream claims only support the target jointly:

```python
support([u1, u2], target_claim, reason="<joint support rationale>", prior=<float>)
```

Allow multiple accepted support candidates into the same iteration when they
satisfy the mapping contract. If no candidate satisfies the standard, record
`support_not_found` with the queries checked and rejection rationales.

### Open-Question / Conflict Channel

Goal: find LKM-grounded content that raises a scientifically meaningful open
question against or around the frontier claim.

Priority order:

1. Theory-vs-experiment or experiment-vs-theory. If the frontier claim is
   theoretical/computational, first search for experimental observations or
   measurements that disagree with, qualify, or fail to confirm it. If the
   frontier claim is experimental, first search for theoretical/computational
   results that disagree with or reinterpret it.
2. Computation-vs-experiment or measurement-vs-model comparisons not covered by
   the first category.
3. Same-system different-method conflicts.
4. Approximation, boundary-condition, regime, dimensionality, temperature,
   disorder, sample-quality, or protocol conflicts.
5. Broader adjacent tensions that may become useful hypotheses but are not yet
   promotable.

For every plausible candidate pair, write the best discriminating open question
before deciding whether it becomes executable DSL. Useful open questions should
be added to `.gaia/inquiry/` as hypotheses when they may guide later rounds.

Accepted contradictions follow the mapping contract's open-question-first
standard and use direct Gaia DSL:

```python
<side_a>_vs_<side_b>[_<quantity_or_regime>] = contradiction(
    A,
    B,
    reason="<why A and B are adjudicably conflicting> | open_problem: <question>",
    prior=0.95,
)
```

If no candidate satisfies the hypothesis or contradiction standards, record
`conflict_not_found` with the queries checked and rejection rationales.

### Candidate Records

Before editing Gaia source, append candidate rows to
`artifacts/lkm-discovery/mapping_audit.md`, `contradictions.md`, or a
topic-specific audit file. Each row should include:

- frontier claim label and LKM id when available,
- channel: `support` or `open_question_conflict`,
- query text and `top_k`,
- candidate LKM id and evidence status (`chain-backed`, `lkm_no_chain`, or
  `search_lead`),
- raw input filename(s),
- scope comparison across system, quantity, method/model, theory/experiment
  role, regime, and conditions,
- proposed Gaia action: `claim`, `deduction`, `support`,
  `accepted_contradiction`, `hypothesis_only`, `dismissed`, or `not_found`,
- rationale and next action.

After candidate classification, run `$lkm-to-gaia` progressive workflow in
refresh mode for accepted package changes.

## Stage 3 — Duplicate And Prior Maintenance

This is not a separate workflow; it is the maintenance step applied whenever
quality gates or review identify issues.

1. Run `gaia inquiry review --strict .`.
2. Inspect duplicate diagnostics and semantic near-duplicates.
3. Classify each pair:
   - exact duplicate -> merge,
   - same-paper helper restatement -> merge when safe,
   - independent same proposition -> keep both and add `equivalence(...)`,
   - different scope/material/method/condition -> keep distinct and log,
   - ambiguous -> keep distinct and add to `merge_decisions.todo`.
4. Fill leaf priors surfaced by `gaia check --hole .` in `priors.py`.
5. Log every verdict in `merge_audit.md` or `mapping_audit.md`.
6. Re-run the Quality Gates.

## Quality Gates

Run before accepting any package state:

```bash
gaia compile .
gaia check --brief .
gaia check --hole .
gaia infer .
gaia inquiry review --strict .
```

If holes appear, fill `priors.py` and rerun. If review reports duplicates,
unreviewed warrants, or unresolved obligations/hypotheses, log or resolve them
and rerun.

## Audit-Trail Invariants

- Raw LKM JSON and `data.papers` are the source of truth for science-facing
  Gaia claims, factors, provenance, references, and audit anchors.
- Do not use external PDFs, paper text, web summaries, or synthetic bridge
  claims as evidence unless the user explicitly changes the rule.
- For cold-start Gaia packages, the selected root must be chain-backed
  (`total_chains > 0`).
- After cold start, LKM source claims with `total_chains = 0` may enter
  `$lkm-to-gaia` as leaf/source claims when content and provenance are clear.
- Iterative graph growth after cold start follows root-claim frontier expansion
  from the user-selected root claim. Do not substitute a graph-centrality,
  belief-based, contradiction-side, or arbitrary frontier policy unless the user
  explicitly asks for a different workflow.
- `artifacts/lkm-discovery/input/` is append-only for raw retrievals.
- `merge_audit.md`, `mapping_audit.md`, `merge_decisions.todo`, `dismissed/`,
  and `.gaia/inquiry/` preserve prior decisions across rounds.
- `contradictions.md` and `equivalences.md` are discovery/audit flag files, not
  executable truth by themselves.
- Open-question-first contradiction handling is canonical in
  `$lkm-to-gaia/references/mapping-contract.md` §4.

## Delegation

For complex or separable LKM->Gaia work, use the audited delegation pattern in
`audited-delegation.md`. Delegation must follow this single SOP, force subagents
to load `$lkm-to-gaia/SKILL.md`, and never removes the orchestrator's
responsibility to audit returned artifacts against the relevant skill contract.
