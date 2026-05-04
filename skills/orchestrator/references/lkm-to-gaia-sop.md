# LKM-To-Gaia SOP

Use this SOP when the user asks to build, extend, audit, or refine a Gaia
knowledge package from LKM content.

This SOP's contradiction step is the baseline screening gate for claims being
mapped into a package.

## Primary Path

```text
user request
  -> $orchestrator classifies task and preserves audit context
  -> $lkm-api retrieves raw match/evidence/source payloads
  -> user-selection checkpoint when needed
  -> $lkm-to-gaia maps raw payloads directly to Gaia DSL
  -> orchestrator/caller runs Gaia quality gates
  -> repeat from obligations/hypotheses when needed
```

`$evidence-subgraph` is not part of this path. It is a separate graph-only
branch for users who explicitly ask for a closure-chain/evidence graph.

## Environment Preflight

Before writing or validating Gaia package source, check that Gaia is available
in the active environment:

```bash
gaia --help
python -c "import gaia"
```

If either check fails, stop before editing package files and ask the user to
install or activate Gaia following the README at
<https://github.com/SiliconEinstein/Gaia>. Do not add a project-local install
recipe unless the user explicitly asks for one.

## Package Layout

The canonical batch artifact is a single growing `<domain>-gaia/` package:

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

All turns after cold start operate on the same package unless the user
explicitly asks for a fork or fresh package.

## Turn A — Cold-Start Package

Use when no package exists yet or the user asks for a new Gaia package.

1. Read `$lkm-api/SKILL.md`.
2. Run the Environment Preflight.
3. Run broad but field-specific LKM match queries. Preserve raw JSON.
4. Fetch evidence for promising distinct candidates.
5. For cold-start root selection, only offer candidates with
   `total_chains > 0`.
6. Record no-chain LKM source claims as leads for screening, but do not offer
   them as cold-start roots.
7. Write `candidates.md`, `contradictions.md`, and `equivalences.md`.
8. Stop for the mandatory user-selection checkpoint when multiple roots are
   plausible. Do not pre-select.
9. After selection, read `$lkm-to-gaia/SKILL.md` and let it run its progressive
   five-step workflow.
10. Run quality gates and loop on holes, obligations, hypotheses, or review
   findings.

## Turn B — Extend Existing Package

Use when a package already exists and the user asks to explore more, add a
branch, address an already surfaced audit item, or grow the graph.

1. Read previous audit state before searching:
   `artifacts/lkm-discovery/{merge_audit.md, dismissed/, merge_decisions.todo}`
   and `.gaia/inquiry/`.
2. Run the Environment Preflight.
3. Query LKM from user topic, open obligations, weak premises, hypotheses, or
   graph frontier claims.
4. Accept both chain-backed claims and LKM source claims after cold start:
   `total_chains > 0` can produce deductions; `total_chains = 0` with clear
   content/provenance can enter as a leaf/source claim.
5. Clearly label evidence status in any user-selection checkpoint.
6. Append raw JSON and discovery flags; do not overwrite prior audit files.
7. Invoke `$lkm-to-gaia` progressive workflow in refresh mode.
8. Run quality gates and ensure prior verdicts were not silently overturned.

## Turn C — Duplicate / Merge Cleanup

Use when the user asks to traverse, review, or clean duplicated claims.

1. Run `gaia inquiry review --strict .`.
2. Inspect possible duplicate diagnostics and semantic near-duplicates.
3. Classify each pair:
   - exact duplicate -> merge,
   - same-paper helper restatement -> merge when safe,
   - independent same proposition -> keep both and add `equivalence(...)`,
   - different scope/material/method/condition -> keep distinct and log,
   - ambiguous -> keep distinct and add to `merge_decisions.todo`.
4. Use `$lkm-to-gaia` refresh mode to apply DSL changes.
5. Log every verdict in `merge_audit.md`.
6. Re-run quality gates.

## Turn D — Narrow Target

Use when the user supplies a specific claim id, paper, system+quantity, or
branch target.

- Skip broad discovery and the broad user-selection checkpoint.
- Fetch LKM evidence/source payload for the named target.
- On cold start, require `total_chains > 0`.
- On extension, `total_chains = 0` is acceptable if LKM returned clear
  content/provenance; route it to `$lkm-to-gaia` as a leaf/source claim.
- Still produce discovery flag files; if discovery was skipped, write a clear
  one-line note saying no pairs were scanned.

## Turn E — Visualization

There is no local render skill. If the user asks to visualize a Gaia package,
use Gaia CLI/project rendering commands available in the package or repo, after
ensuring `.gaia/ir.json` exists and `gaia infer .` has run when belief shading
is needed.

## Quality Gates

Run before accepting any package turn:

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
- `artifacts/lkm-discovery/input/` is append-only for raw retrievals.
- `merge_audit.md`, `mapping_audit.md`, `merge_decisions.todo`, `dismissed/`,
  and `.gaia/inquiry/` preserve prior decisions across turns.
- When multiple plausible roots/leads exist, stop for a user-selection
  checkpoint unless the user supplied a narrow target.
- `contradictions.md` and `equivalences.md` are discovery/audit flag files, not
  executable truth by themselves.
- Strict contradiction/open-question behavior is canonical in
  `$lkm-to-gaia/references/mapping-contract.md` §4.

## Delegation

For complex or separable LKM->Gaia work, use the audited delegation pattern in
`audited-delegation.md`: partition -> delegate -> audit -> repair -> synthesize
-> verify -> preserve audit trail. Delegation never removes the orchestrator's
responsibility to audit returned artifacts against the relevant skill contract.
