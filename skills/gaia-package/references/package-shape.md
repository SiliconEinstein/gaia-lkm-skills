# Package Shape — Layout, Naming, Templates

This document records the on-disk shape of any `<name>-gaia/` knowledge
package emitted by a Gaia-emitting skill. It covers both **multi-paper**
packages (the LKM-driven workflow assembling claims and deductions across
several source papers) and **single-paper** packages (a single paper Markdown
formalized into Gaia DSL). The templates below are aligned with the current
Gaia CLI; verify package files with `gaia compile` and `gaia check --hole .`
rather than relying on this document alone.

## Layout

### Multi-paper layout

Used when the package aggregates evidence across several source papers (the
typical `$lkm-explorer` case):

```
<name>-gaia/
  pyproject.toml                  # Gaia knowledge-package metadata
  references.json                 # CSL-JSON, union of all source papers
  src/<import_name>/
    __init__.py                   # re-exports + `__all__` (root conclusions only)
    paper_<key>.py                # one module per source paper
    cross_paper.py                # cross-paper operators and links
    priors.py                     # leaf-claim priors
  artifacts/<audit-dir>/          # caller-named: `lkm-discovery/`, `paper-extract/`, ...
    graph_growth_log.jsonl        # append-only chronological growth/decision log
    mapping_audit.md              # per-claim and per-pair transformation log
    input/                        # verbatim copy of input files
    [caller-specific files]       # see "Audit-dir layout" below
```

### Single-paper layout

Used when the package is built from one paper Markdown only (the typical
`$formalize` case):

```
<name>-gaia/
  pyproject.toml
  references.json                 # CSL-JSON record(s), starting with the source paper
  src/<import_name>/
    __init__.py                   # re-exports + `__all__`
    paper_<key>.py                # claims, deductions, optional motivation/open-question
    priors.py                     # leaf-claim priors (weak points + isolated conclusions)
    # cross_paper.py is OMITTED for single-paper packages
  artifacts/<audit-dir>/
    graph_growth_log.jsonl
    mapping_audit.md
    input/<paper>.md              # verbatim copy of the input paper
```

`cross_paper.py` is **only** emitted when the package has cross-paper
operators to record. A single-paper package omits it; if a later step merges
the package into a multi-paper package, the merge step adds `cross_paper.py`.

`paper_<key>.py` is **mandatory** in both layouts (every claim must be
attributable to its first source paper).

## Naming conventions

| Surface                          | Convention                       | Example                            |
|----------------------------------|----------------------------------|------------------------------------|
| Package directory + git repo     | `kebab-case-gaia`                | `coulomb-pseudopotential-gaia`     |
| PyPI / pyproject `name`          | same kebab-case                  | `coulomb-pseudopotential-gaia`     |
| Python import (under `src/`)     | `snake_case`, no `-gaia` suffix  | `coulomb_pseudopotential`          |
| Per-paper module file            | `paper_<key>.py`                 | `paper_liu2015.py`                 |
| Cross-paper module file          | `cross_paper.py` (fixed)         | `cross_paper.py`                   |
| Reference key (CSL)              | `<FirstAuthor><Year>[a-z]?`      | `Liu2015`, `Liu2015a`              |
| Conclusion claim label (paper)   | `<key>_c<id>_<suffix>`           | `liu2015_c1_fibonacci_emergence`   |
| Weak-point claim label (paper)   | `<key>_c<id>_wp_<suffix>`        | `liu2015_c1_wp_static_screening`   |
| LKM-derived claim label          | `gcn_<short_hash>` or semantic   | `gcn_66ac13c8`                     |
| `support` strategy result label  | short semantic when assigned     | `dmc_rs5_supports_low_density_mass`|

For single-paper packages, the default package name template is
`<first-author-surname-lowercase><year>-<short-topic-slug>-gaia` — for
example, paper "Non-Abelian phases in two-component ν = 2/3 fractional
quantum Hall states" by Liu et al., 2015 → `liu2015-fibonacci-anyons-gaia`.
If the paper is anonymous or missing a year, fall back to
`<short-topic-slug>-gaia` and record the metadata gap in `mapping_audit.md`.

All Python labels must be valid **Gaia QIDs**: `[a-z_][a-z0-9_]*` — lowercase
letters, digits, underscores only. No uppercase, no hyphens, no dots, no
diacritics. See `emit-mapping.md` §"Label rules" for label-minting policy.

## `pyproject.toml` template

```toml
[project]
name = "<name>-gaia"
version = "0.1.0"
description = "Gaia knowledge package generated from <description of source>."
requires-python = ">=3.12"

[tool.gaia]
type = "knowledge-package"
uuid = "<auto-minted UUID4>"
generated_by = "<emitter skill name, e.g. lkm-explorer or formalize>"
# emitter-specific provenance fields:
# generated_from_search = "<search query>"           # lkm-explorer
# generated_from_roots = ["<root_claim_id>", ...]    # lkm-explorer
# generated_from_paper = "<reference_key>"           # paper-extract
# generated_from_doi = "<paper DOI>"                 # paper-extract

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/<import_name>"]
```

The `[tool.gaia]` provenance fields are emitter-specific; consumers should
include the fields appropriate for their upstream and may add additional
fields as long as they do not collide with the shared three (`type`, `uuid`,
`generated_by`).

## `__init__.py` template

```python
"""<name>-gaia — Gaia knowledge package generated from <upstream summary>.

Generated by <emitter>. Do not edit by hand for the chain backbone;
add reviewer overrides via priors.py instead.

<emitter-specific provenance lines, e.g. search query, root claims,
 source paper, DOI>
"""
from .paper_<key1> import *
from .paper_<key2> import *      # only for multi-paper packages
from .cross_paper import *       # only when cross_paper.py exists

__all__ = [
    # exported root conclusions (multi-paper) or every Phase 1 conclusion
    # (single-paper), plus the motivation question(...) and any opt-in
    # open-question question(...) nodes
    "<root_or_conclusion_label>",
    # ...
]
```

Rules for `__all__`:

- Define `__all__` **only** in `__init__.py`, not in submodules.
- Multi-paper packages export the **selected root claims**, deduped.
- Single-paper packages export every Phase 1 conclusion, plus the motivation
  `question(...)` (`<key>_problem`), plus any opt-in open-question
  `question(...)` nodes.
- Weak-point claims are imported internally for use in deductions and priors
  but are **not** re-exported.

## `paper_<key>.py` template

```python
"""paper_<key> — claims and deductions for <paper title>.

Source: <paper.title>
DOI: <paper.DOI>
Authors: <paper.authors>
Reference key (CSL): <key>
"""
from gaia.lang import (
    claim, setting, question,
    contradiction, equivalence, complement, disjunction,
    support, compare, deduction, abduction, induction,
    analogy, extrapolation, elimination, case_analysis,
    mathematical_induction, composite, infer, fills,
)

# Motivation as question(...) — single-paper packages only; see
# emit-mapping.md §"Motivation and open questions".
<key>_problem = question(
    r"<self-contained motivation text>",
    source_paper="<key>",
    provenance_source="paper_extract",
)

# Claims first appearing in this paper.
# `claim()` takes no `prior` kwarg; leaf priors live in priors.py.
# Use r"..." raw strings whenever the body contains LaTeX.

<claim(...) calls for premises and conclusions rooted in this paper>

# Weak-point leaf claims (single-paper / paper-extract only) — bound to
# exactly one conclusion; appear as a premise in only that conclusion's
# deduction. See emit-mapping.md §"Weak points".

<claim(...) calls with claim_kind="weak_point">

# Chain backbone: one deduction per `gfac_*` whose source_package is this
# paper (lkm-driven), or one deduction per derived conclusion (paper-driven).
# Strategies are positional-first.

<deduction(...) calls>
```

## `cross_paper.py` template

```python
"""cross_paper — operators that span source papers.

Equivalences, accepted contradictions, and claim-driven support edges
identified by the agent during Gaia formalization.
"""
from gaia.lang import (
    contradiction, equivalence, complement, disjunction,
    support, induction,
)

# Cross-paper claim imports — by label.
from .paper_liu2015 import gcn_66ac13c8
from .paper_koptsev2011 import gcn_95e896eb

# Accepted contradictions use xx_vs_yy labels and record
# relation_type=scientific_inconsistency in the audit row. See
# emit-mapping.md §"Contradictions".
<equivalence(...), contradiction(...), support(...), induction(...) calls>
```

## `priors.py` template

```python
"""priors.py — leaf-claim priors for this package.

Generated by <emitter>. Every entry is auto-seeded and TODO-marked. Run
`gaia check --hole .` to surface any leaves that did not get an entry.
"""
from .paper_<key> import (
    <leaf_label_1>,
    <leaf_label_2>,
    # ... one import per leaf claim ...
)

PRIORS = {
    <leaf_label_1>: (0.80, "computational result (LKM chain premise); TODO:review"),
    <leaf_label_2>: (
        0.65,
        "model assumption — static screening adopted without ab initio "
        "verification at the studied density; TODO:review",
    ),
}
```

Every leaf (claim that is **not** the conclusion of any strategy) gets one
`PRIORS` entry. Conclusions of `deduction(...)` do **not** get entries — BP
computes their beliefs. The float is the agent's direct judgment of how
likely the claim is to be true:

- **Cap: 0.9** (Cromwell upper bound — no claim is absolutely certain).
- **Floor: 0.001** (Cromwell lower bound).
- No heuristic buckets — read the claim and estimate.
- Every justification text ends with `TODO:review` so reviewers can grep for
  unfinalized priors.

See `emit-mapping.md` §"Leaf priors" for sourcing rules.

## `references.json` template

Standard CSL-JSON records, cited from claim text with `[@key]`:

```json
{
  "Liu2015": {
    "type": "article-journal",
    "title": "Non-Abelian phases in two-component ν = 2/3 fractional quantum Hall states: Emergence of Fibonacci anyons",
    "DOI": "10.1103/physrevb.92.081102",
    "container-title": "Physical Review B",
    "issued": {"date-parts": [[2015]]},
    "author": [
      {"family": "Liu", "given": "Zhao"},
      {"family": "Vaezi", "given": "Abolhassan"},
      {"family": "Lee", "given": "Kyungmin"},
      {"family": "Kim", "given": "Eun-Ah"}
    ]
  }
}
```

Key format: `<FirstAuthorSurname><Year>` (e.g. `Liu2015`); collide-handle by
appending lowercase suffixes (`Liu2015a`, `Liu2015b`). Authors field is a
list of `{"family", "given"}` objects; multi-source LKM workflows that ingest
authors as pipe-separated strings (`"Surname Given | Surname Given"`) parse
best-effort. Cite from prose with `[@<key>]`.

Include only the fields actually present in the source — do not invent DOIs,
journal names, or years. Record gaps in `mapping_audit.md`.

For multi-paper packages the file is the union of `data.papers` across all
loaded LKM evidence and match files. For single-paper packages it starts
with one record (the source paper) and grows when external citations from
the paper bibliography are ingested.

## Python LaTeX-string convention

Claim bodies and `deduction(...)` `reason=` fields routinely contain LaTeX
math delimited by `$...$`. LaTeX uses backslashes (`\frac`, `\mathrm`,
`\sigma`, `\\`), and Python's default string literal interprets backslash
as an escape — `"\frac"` becomes `frac` with an embedded form-feed-like
char, not the literal `\frac` LaTeX needs. To avoid this, wrap **every**
body or `reason=` string that contains LaTeX in a **raw** string:

```python
<label> = claim(
    r"In the 2D Yukawa Fermi gas at $T = 0.04 T_F$ and dimensionless "
    r"coupling $\lambda / k_F = 0.5$, the static polarization "
    r"$P(q=0,\omega=0)$ obtained from the perturbative expansion ...",
    claim_kind="conclusion",
    ...
)

deduction(
    [...],
    <conclusion_label>,
    reason=r"""
1. The Hamiltonian $H = \sum_k \epsilon_k c^\dagger_k c_k + \frac{1}{2V} \sum ...$
   describes ...
2. ...
""".strip(),
    prior=0.95,
)
```

The `r` prefix turns off backslash interpretation, so `\frac` survives as
the literal four characters `\frac`. For multi-line text the same applies
to triple-quoted raw strings (`r"""..."""`). Plain (non-LaTeX) bodies do
not need the `r` prefix, but using it consistently is harmless and avoids
correctness regressions when LaTeX is added later.

Backslash-newline-substitution intent (`\\` meaning a LaTeX line break)
still works: in an `r"..."` string `r"\\"` produces the literal two
characters `\\`, which is what LaTeX expects.

## Audit-dir layout

The audit directory under `artifacts/` holds the structured replay log and
the human-readable audit tables. **Its name is chosen by the caller**
(`lkm-discovery/` for `$lkm-explorer`, `paper-extract/` for `$formalize`).
This contract specifies the layout *under* that directory, not the directory
name itself.

Common files (defined here, emitted by every Gaia-emitting skill):

```
artifacts/<audit-dir>/
  graph_growth_log.jsonl     # append-only chronological growth/decision log
  mapping_audit.md           # per-claim and per-pair transformation log
  input/                     # verbatim copy of all input files
```

See `audit-log.md` for the `graph_growth_log.jsonl` v1 schema and the
`mapping_audit.md` table conventions.

Caller-specific files (defined by the consumer skill, **not** here):

- **`$lkm-explorer`** adds `retrieval_log.jsonl` (LKM API call log),
  `merge_audit.md` (shared-premise dedup), `merge_decisions.todo` (ambiguous
  pairs), and `dismissed/` (false-alarm tension pairs). These are
  LKM-workflow-specific and stay documented in `$lkm-explorer`.
- **`$formalize`** emits the common files only — there is no
  `retrieval_log.jsonl` because no API calls are made; no `merge_audit.md`
  because the workflow is single-paper; no `dismissed/` because there is no
  candidate-rejection channel.

A consumer that locates the log by glob (`**/graph_growth_log.jsonl`) reads
both audit-dir variants without modification.

## What this contract does NOT cover

- The full `priors.py` shape beyond the template — follow current package
  examples and verify with `gaia check --hole`.
- The full `pyproject.toml` shape beyond the template — follow current
  package examples and verify with `gaia compile`.
- Multi-paper merges of single-paper packages — out of scope for this
  contract.
- The Gaia DSL grammar — governed by the installed Gaia library.
