# Step 1 — Inputs, Scope, And Checklist

Load this file first when `$lkm-to-gaia` starts a batch or refresh mapping
task. Do not load later step files until this step is complete.

## Goal

Establish the mapping mode, accepted inputs, evidence status for every selected
claim, output target, and audit-trail location before writing Gaia DSL.

## Required Session Todos

The agent running `$lkm-to-gaia` must create a session todo/checklist with these
five steps, mark Step 1 in progress, and update statuses as each step completes:

1. Step 1 — Inputs, scope, and evidence status.
2. Step 2 — Bootstrap, refine, decompose, and map DSL.
3. Step 3 — Screen contradictions and open questions.
4. Step 4 — Add supports, priors, obligations, and duplicate controls.
5. Step 5 — Emit package and hand off to quality gates.

The checklist is ephemeral and is not written to the package.

## Inputs

- Raw LKM evidence JSON from `$lkm-api` for each selected chain-backed claim:
  `GET /claims/{id}/evidence`, with `data.claim`,
  `data.evidence_chains[].factors[]`, and `data.papers`.
- Raw LKM source/match JSON for no-chain source claims when accepted after
  cold start.
- Raw LKM match JSON: `POST /claims/match`, with `data.variables` and
  `data.papers`.
- Orchestrator discovery/selection files: `candidates.md`,
  `contradictions.md`, `equivalences.md` when available.
- Existing package path for refresh work, including `artifacts/lkm-discovery/`,
  `.gaia/inquiry/`, and prior source files.

These are loose files. `$lkm-to-gaia` reads raw LKM payloads directly and does
not use an intermediate graph artifact.

## Modes

### Batch

Input: one or more selected LKM roots/leads plus desired package name.

Output: a standalone `<name>-gaia/` package:

- `pyproject.toml`
- `references.json`
- `src/<import>/__init__.py`
- `src/<import>/paper_<key>.py`
- `src/<import>/cross_paper.py`
- `src/<import>/priors.py`
- `artifacts/lkm-discovery/` with verbatim raw inputs and audit files

Read `package-skeleton.md` before creating or substantially reshaping a package.

### Refresh

Input: batch inputs plus an existing standalone package directory.

Output: edits to the existing package source and audit trail. Preserve existing
labels, prior decisions, raw inputs, dismissed candidates, and merge verdicts
unless the user explicitly asks to revise a prior decision.

Read `package-skeleton.md` before substantially reshaping package files.

## Evidence-Status Vocabulary

Use the canonical terms from `mapping-contract.md`:

- **Chain-backed claim**: LKM returned claim content and evidence has
  `total_chains > 0`. It can produce claims plus factor-derived
  `deduction(...)`.
- **LKM source claim**: LKM returned claim content and provenance, but
  `total_chains = 0`. After cold start, it may enter Gaia as a leaf/source
  `claim(...)`; do not invent premises or deductions.
- **Search lead**: insufficient content or provenance for a self-contained
  claim outside an accepted chain-backed factor. Keep it in audit/search notes
  only.

`total_chains > 0` is a cold-start root-selection gate, not a global
admissibility rule after a package already has a chain-backed root.

## Step-Completion Gate

Before moving to Step 2:

- Mode is known: batch or refresh.
- The SOP Environment Preflight has passed before any package file is edited.
- Every selected item is classified as chain-backed claim, LKM source claim, or
  search lead.
- Raw LKM payload paths are known and will be preserved verbatim.
- Existing audit trail has been read for refresh work.
- The next todo is marked in progress before loading
  `step-2-bootstrap-and-map.md`.
