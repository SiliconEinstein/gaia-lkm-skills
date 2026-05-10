# formalize helper scripts

## generate_audit.py

Generate `graph_growth_log.jsonl` + `mapping_audit.md` audit files from an
emitted `$formalize` package, by parsing `paper_<key>.py` + `priors.py` via AST.

### When to use

Phase 4 of the `$formalize` workflow requires emitting the two audit files
per the `$gaia-package` contract. Hand-authoring 4×(N+M) JSONL events for
a package with N conclusions and M weak points is repetitive, drifts from
the Python source over time, and (per group feedback from Tianhan) is the
single biggest workflow friction at the 22+ knowledge node scale.

This script extracts every claim / deduction / prior from the existing
Python source so the audit is regenerated deterministically. Run it after
Phase 4 writes `paper_<key>.py` + `priors.py`.

### Usage

```bash
python3 generate_audit.py <package-dir>
python3 generate_audit.py <package-dir> --dry-run
```

Produces:

- `<package-dir>/artifacts/paper-extract/graph_growth_log.jsonl`
- `<package-dir>/artifacts/paper-extract/mapping_audit.md`

### Schema compliance

Events follow the `$gaia-package/references/audit-log.md` v1 paper-extract
subset: `package_initialized`, `accepted_claim` (with `claim_kind`),
`accepted_deduction`, `prior_added`. No candidate-handling events because
formalize is single-pass.

`stage="mapping"`, `round_id="round_0000"`, `phase=4` on every event
(per Phase 4 emit-time semantics).

### Dependencies

Standard library only (`ast`, `argparse`, `json`, `uuid`, `datetime`, `pathlib`).
No third-party packages, no environment variables.

### Tested with

Output validated to compile via `gaia compile + gaia infer` on packages
emitted by hand-rolled formalize phase 4 workflow (8 conclusion / 8 weak_point
/ 8 deduction case verified).
