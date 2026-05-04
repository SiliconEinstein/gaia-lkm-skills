# Step 5 — Emit And Hand Off

Load this file only after Step 4 is complete. This step finalizes the source
artifact and hands it back to the orchestrator/caller for quality gates.

## Batch Output

For batch mode, emit a new standalone `<name>-gaia/` package:

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
    ├── candidates.md
    ├── contradictions.md
    ├── equivalences.md
    ├── mapping_audit.md
    ├── merge_audit.md
    ├── merge_decisions.todo
    └── dismissed/
```

Copy raw LKM JSON verbatim into `artifacts/lkm-discovery/input/`. Do not strip,
summarize, or rewrite raw payloads.

For refreshes, extend existing modules and audit files rather than replacing
prior verdicts. Reuse existing labels and priors where possible.

## Refresh Output

For an existing standalone package, edit the existing package in place:

- append new raw payloads under `artifacts/lkm-discovery/input/`,
- extend existing paper modules or create new `paper_<key>.py` modules,
- preserve existing labels and priors where possible,
- append audit decisions rather than replacing prior history,
- keep previous `dismissed/` entries and unresolved `merge_decisions.todo`
  items unless the user explicitly reopens them.

## Local Source Checks

Before handoff:

- Python source parses with `ast.parse`.
- Gaia labels are lowercase identifiers: `[a-z_][a-z0-9_]*`.
- `__init__.py` has the only package-level `__all__`.
- No claim has a `prior` kwarg.
- Every claim preserves LKM provenance metadata where available.
- Every `deduction(...)` is factor-derived; no-chain source claims have no
  fabricated deductions.
- Cross-paper operators are in `cross_paper.py`.
- Audit files reflect contradictions, open questions, equivalences, merges,
  dismissals, and unresolved decisions.

## Caller Quality Gate

The orchestrator/caller accepts the emitted source only after running:

```bash
gaia compile .
gaia check --brief .
gaia check --hole .
gaia infer .
gaia inquiry review --strict .
```

If `gaia check --hole .` reports missing priors, fill `priors.py` and rerun the
gate. If inquiry review reports unreviewed warrants or duplicates, log or
resolve them according to Step 4 and rerun the gate.

## Hand-Off Report

Return:

- files created or changed,
- raw LKM payloads consumed,
- chain-backed vs no-chain source claims added,
- deductions, supports, equivalences, contradictions, and audit-only open
  questions added,
- priors added or still needed,
- inquiry obligations/hypotheses opened or closed,
- commands the caller ran and pass/fail status,
- deviations from the mapping contract, if any.

## What This Skill Is Not

- Not orchestration: this skill does not choose user roots or route siblings.
- Not graph rendering: use Gaia CLI/rendering outside this local skill.
- Not a Gaia DSL language guide: syntax details belong to the installed Gaia
  package and must be verified through local Gaia CLI quality gates.

## Step-Completion Gate

When handoff is complete, mark Step 5 complete. If quality gates surface new
obligations, create a new iteration checklist and return to Step 1 with the new
target or obligation.
