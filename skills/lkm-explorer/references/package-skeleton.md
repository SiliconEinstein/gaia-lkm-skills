# LKM-Explorer Audit Dir

> Generic Gaia knowledge-package layout, naming conventions, and file
> templates (`pyproject.toml`, `__init__.py`, `paper_<key>.py`,
> `cross_paper.py`, `priors.py`, `references.json`) are owned upstream by
> `SiliconEinstein/Gaia` — see `docs/for-users/quick-start.md` and
> `docs/for-users/language-reference.md`. This file documents ONLY the
> `artifacts/lkm-discovery/` audit directory specific to LKM-driven
> exploration.

## Audit-dir layout

`$lkm-explorer` writes its audit dir under
`artifacts/lkm-discovery/` (the audit-dir name and its contents are fixed by
this skill):

```
<name>-gaia/
  artifacts/
    lkm-discovery/
      retrieval_log.jsonl     # append-only chronological LKM API call log (LKM-specific)
      graph_growth_log.jsonl  # append-only chronological Gaia growth/decision log
      merge_audit.md          # dedup decisions
      mapping_audit.md        # per-claim and per-pair transformation log
      merge_decisions.todo    # surfaced ambiguous pairs (if any)
      input/                  # verbatim copy of input files (raw evidence JSON + .md flag files)
      dismissed/              # candidate tension pairs dismissed as false alarms
      candidates.md           # discovery flag file
      contradictions.md       # discovery flag file
      equivalences.md         # discovery flag file
```

## What ships in `artifacts/lkm-discovery/`

- `merge_audit.md` — every shared-premise dedup decision
- `mapping_audit.md` — per-claim and per-pair transformation log; LKM table
  conventions documented below.
- `merge_decisions.todo` — surfaced ambiguous pairs (agent couldn't decide
  merge vs keep)
- `retrieval_log.jsonl` — ordered index of LKM match/evidence/variables calls,
  with raw payload filename, query/request, frontier/channel, response code,
  and `trace_id`. LKM-specific schema lives in
  [`timeline-log-contract.md`](timeline-log-contract.md)
- `graph_growth_log.jsonl` — ordered index of selected roots, admitted claims,
  deductions, supports, contradictions, equivalences, dismissals, priors,
  repairs, and quality-gate results.
- `input/` — verbatim copy of all input files (raw evidence JSON,
  `contradictions.md`, `equivalences.md`, `candidates.md`)
- `dismissed/` — candidate tension pairs the agent dismissed as false alarms,
  with rationale

The two JSONL logs are the replay index; the markdown audit files carry the
detailed scientific rationale.

## What ships in `artifacts/lkm-discovery/mapping_audit.md`

LKM-explorer-specific table format. A flat decision log:

```markdown
# Mapping audit log — <package name>

## Factors -> derivations

| factor_id | source_paper | premises | conclusion | dsl_kind |
|---|---|---|---|---|
| gfac_9d88a6f8 | paper:814606014073536517 | gcn_2386d1b6, gcn_9f7a3e33 | gcn_66ac13c8 | derive |

## Equivalences

| pair | a | b | decision | dsl_action |
|---|---|---|---|---|
| gcn_73c88cf / gcn_66ac13c8 | gcn_73c88cf | gcn_66ac13c8 | same paper (arXiv->PRB) | merged; no equal() |

## Contradictions

| pair | open_problem | decision | relation_type | dsl_action |
|---|---|---|---|---|
| (none in this run) | | | | |

## Dismissed

| pair | origin | rationale |
|---|---|---|
| (none in this run) | | |
```

This audit log is the reviewer's first stop after `gaia run infer .` returns
surprising beliefs.

The "Factors -> deductions / Equivalences / Contradictions / Dismissed"
section structure is the LKM-explorer convention for `mapping_audit.md`.
