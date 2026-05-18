# Phase 4 — Emit the Gaia Package

Load this file after Phase 3 is complete. This is the only phase that writes
files. It composes the working notes from Phases 1–3 into a standalone Gaia
knowledge package on disk.

## Goal

Produce a `<name>-gaia/` package on disk per the upstream Gaia
knowledge-package spec (file layout: `SiliconEinstein/Gaia`
`docs/for-users/quick-start.md`; `claim` / `deduction` / `question` body
discipline, label rules, `__all__` rules:
`docs/for-users/language-reference.md`). After emission, the package must be
ready for `gaia compile` and `gaia check --hole .` (see upstream
`docs/for-users/cli-commands.md`).

## Step 0 — Decide the package name and import name

- Extract the paper's reference key from its bibliographic metadata
  (`<FirstAuthorSurname><Year>`, e.g., `Liu2015`). If multiple papers shared
  a key in this run, append `a`, `b`, ...
- Derive a short topic slug (1–4 lowercase tokens) from the paper title or
  the dominant conclusion's title.
- Package directory: `<author-lowercase><year>-<topic-slug>-gaia` (kebab
  case), e.g., `liu2015-fibonacci-anyons-gaia`.
- Python import name (under `src/`): the same string in snake_case, with the
  `-gaia` suffix removed, e.g., `liu2015_fibonacci_anyons`.

If the paper Markdown is missing author / year, fall back to
`<topic-slug>-gaia` and record the metadata gap in `mapping_audit.md`.

## Step 1 — Mint claim labels

For every Phase 1 conclusion, mint a label of the form
`<key>_c<id>_<semantic_suffix>`, where the suffix is 1–4 tokens drawn from
the conclusion's title (lowercase, ASCII, underscores only).

For every Phase 3 weak point, mint a label of the form
`<key>_c<id>_wp_<semantic_suffix>`, where the suffix is 1–4 tokens drawn
from the weak point's title.

Label rules (recap; canonical rules owned upstream — see
`SiliconEinstein/Gaia` `docs/for-users/language-reference.md` "label rules"):

- Valid Gaia QID: `[a-z_][a-z0-9_]*`. Lowercase letters, digits, underscores.
- No hyphens, no dots, no uppercase, no diacritics.
- 1–4 token semantic suffixes; do not pack the entire body into the label.

Record the mapping `(working-note id) → (final label)` in working notes; the
audit log in Step 5 needs both columns.

## Step 2 — Create the package directory and copy the input

- Create `<name>-gaia/` and the subdirectories per the upstream Gaia
  single-paper package layout (see `SiliconEinstein/Gaia`
  `docs/for-users/quick-start.md`).
- Copy the input paper Markdown verbatim to
  `artifacts/paper-extract/input/<paper>.md`.
- Initialize `artifacts/paper-extract/graph_growth_log.jsonl` and append a
  `package_initialized` event. Establish your `actor_id`
  (e.g. `formalize-<short-uuid>`) and `seq` counter starting at 1.

## Step 3 — Write `references.json`

Emit a CSL-JSON record for the paper using its reference key. Fields:

- `type`: `article-journal` (default; switch to `paper-conference`,
  `book-chapter`, etc. only if the paper Markdown clearly indicates so).
- `title`, `DOI`, `container-title`, `issued`, `author`.
- Use the paper's own metadata; do not invent fields. Missing fields are
  omitted, not stubbed.

## Step 4 — Write the Python source files

### 4a. `src/<import_name>/paper_<key>.py`

Emit in this order:

1. Module docstring (paper title, DOI, authors, reference key).
2. Imports from `gaia.lang` — minimum `claim`, `question`, `deduction`.
3. **Motivation as `question(...)`** — one `question(...)` for Phase 1's
   motivation block, labeled `<key>_problem`. Aligns `$formalize` with
   pipeline B (XML→LKM), where `<problem>` from `select_conclusion.xml`
   becomes a `LocalVariableNode(type="question")`. `question(...)` DSL
   is upstream — see `SiliconEinstein/Gaia`
   `docs/for-users/language-reference.md`.
4. **Conclusions section** — one `claim(...)` per Phase 1 conclusion with
   `claim_kind="conclusion"`, in topological order. Each conclusion claim
   carries `review_prior=<float>` from Phase 3's per-conclusion synthesis
   (the reviewer's posterior judgment, capped at 0.9). This is **distinct
   from** the deduction's warrant `prior=` (see Step 4a's deduction
   calibration below); both numbers may differ and that is expected.
5. **Weak-point leaf claims section** — one `claim(...)` per Phase 3 weak
   point with `claim_kind="weak_point"`, grouped by the (single)
   conclusion they threaten (use a comment header per conclusion, e.g.
   `# Weak points for <key>_c1_<suffix>`). Each weak-point claim is
   defined exactly once in this file and appears as a premise in exactly
   one deduction (its target conclusion's). It is NOT shared across
   deductions; cross-conclusion uncertainty propagates through the logic
   graph instead (weak point ↔ one conclusion (strict) discipline).
6. **Deductions section** — one `deduction(...)` per derived conclusion.
   The premises list is the union of upstream conclusion labels (from
   Phase 1's logic graph) and weak-point labels (from Phase 3). The
   `reason=` field is the conclusion's full Phase 2 numbered chain.
7. **Open questions section (optional, opt-in)** — only emit
   `<key>_open_question_<n> = question(...)` nodes when the user asks.
   Pipeline B does not extract open questions; this is a `$formalize`
   extension.

The string body of every `claim(...)` is the self-contained body from
working notes — no further rewriting in Phase 4. The Phase 1 self-containment
discipline and the Phase 3 body-writing rule already satisfy what the legacy
step-4 prompt enforced; this phase only relabels and emits.

For each deduction's warrant `prior=` (a warrant strength, **not** the
conclusion's posterior), follow the additive scheme:

- Default 0.95.
- **+0.02 to +0.04** for each Phase 3 highlight that specifically underwrites
  a step in this chain. Cap at 0.99.
- **−0.05 to −0.10** for each explicit logical gap Phase 2 had to flag.
  Floor at 0.80.
- Adjustments are additive from the 0.95 baseline; record each adjustment
  with its rationale in `mapping_audit.md`'s Conclusions table `notes` column.

### 4b. `src/<import_name>/priors.py`

For every leaf claim in the package, emit a `(prior, justification)` tuple:

- Every Phase 3 weak point is a leaf — its `prior_probability` from working
  notes goes here, capped at 0.9.
- A Phase 1 conclusion that ended up with **no** upstream conclusions and
  **no** weak points is also a leaf — its prior comes from Phase 3's
  per-conclusion `prior_probability`, capped at 0.9.

Justification text format: one line, terse rationale (model assumption /
empirical pattern / cited result / etc.) ending with `TODO:review`. Pull the
rationale from the weak point's `weakness_reason` (compressed to one
sentence) or from the conclusion's `narrative`.

Imports inside `priors.py` reference labels from `paper_<key>.py`.

### 4c. `src/<import_name>/__init__.py`

Re-export the per-paper module, then list every conclusion label in
`__all__`. Weak-point claims are imported (so `priors.py` can reference
them) but **not** added to `__all__`.

## Step 5 — Write the audit artifacts

### 5a. `artifacts/paper-extract/mapping_audit.md`

Populate every section of `mapping_audit.md`:

- Phase summary table.
- Conclusions table — one row per conclusion, with the working-note id,
  the final label, upstream labels, weak-point labels (only the ones
  bound to this conclusion per the weak-point ↔ one-conclusion (strict)
  discipline), `deduction_prior` (warrant strength on the deduction),
  `review_prior` (Phase 3 conclusion-synthesis posterior; same value as
  the `review_prior=` metadata kwarg on the conclusion claim), and
  free-text notes (e.g., per-highlight +0.02/+0.04 adjustments and
  per-gap −0.05/−0.10 adjustments to the deduction prior).
- Weak points table — one row per weak-point label, with label, the single
  threatened `conclusion_id`, `also_threatens` (comma-separated audit-only
  list of independent conclusion ids the same scientific assumption also
  affects but which are **not** wired into BP — per the weak-point ↔
  one-conclusion (strict) discipline), weak_types, prior, p1, p2, full
  `weakness_reason` text, full `failure_mode` text. Default for
  `also_threatens` is `(none)`.
- Highlights table — one row per highlight with id, conclusion_id,
  strength_types, full `credit` text, and notes (especially: did this
  highlight raise a deduction prior, and by how much).
- Motivation block (verbatim from Phase 1).
- Open questions block (verbatim from Phase 1).
- Per-conclusion narratives from Phase 3 — one block per conclusion, naming
  the conclusion's final label and its synthesis prior.
- Metadata gaps and rationale (missing DOI, missing year, dropped
  conclusion candidates, etc.).

The audit log is the only place the full `weakness_reason`, `failure_mode`,
and `credit` texts live in the package — they do **not** appear inside the
DSL claim bodies.

### 5b. `artifacts/paper-extract/graph_growth_log.jsonl`

Append one event per emitted DSL element, in emission order. Each line is
one JSON object. Required event sequence (paper-extract):

1. **`package_initialized`** (already emitted in Step 2 above) — first
   event, with payload `{"package": "<name>-gaia", "source_paper":
   "<reference_key>"}`.
2. **`accepted_claim`** — one event per `question(...)` and `claim(...)`
   written in `paper_<key>.py`, in the order they appear:
   - first the **motivation** `question(...)` (`payload.node_kind="question"`,
     `gaia_actions[].action="question"`, `graph_delta.nodes_added[].kind="question"`),
   - then the conclusion `claim(...)` calls (`payload.claim_kind="conclusion"`,
     each carrying `payload.review_prior=<float>` from the Phase 3
     synthesis),
   - then the weak-point `claim(...)` calls (`payload.claim_kind="weak_point"`),
   - then any opt-in open-question `question(...)` calls (same shape as
     the motivation event but with payload labels
     `<key>_open_question_<n>`).
   Each event's `graph_delta.nodes_added` carries one node with the
   appropriate `kind` (`claim` or `question`), `id` matching the symbol
   label, `source_paper` matching the reference key, and a short
   `content_excerpt` (first ~200 chars of the body). For weak-point
   events also include `weak_types`, `p1`, `p2` in `payload`.
3. **`prior_added`** — one event per `priors.py` entry. Payload:
   `{"label", "prior", "justification"}`. `graph_delta` arrays are empty;
   the prior is metadata, not a graph node/edge.
4. **`accepted_deduction`** — one event per `deduction(...)` written,
   regardless of how many premises that deduction has. Payload:
   `{"premises": [...labels...], "conclusion": label, "reason_excerpt":
   <first ~200 chars>}`. Set `warrant_prior` to the deduction's `prior=`
   (the warrant strength, **not** any conclusion-level posterior).
   `graph_delta.edges_added` lists one slim `kind: "deduction"` edge per
   (premise → conclusion) pair carrying only `{from, to, kind, prior}` —
   `reason_excerpt` lives on `payload`, not on each edge.
5. **`obligation_added`** — emit only if open-questions are materialized
   as `question(...)` operators (only when explicitly requested).

Every event is single-line JSON. Maintain a single monotonic `seq`
counter for the run. Never rewrite earlier lines; corrections go in a new
event with `supersedes_event_id` pointing at the original.

## Step 6 — Write `pyproject.toml`

Use the upstream `pyproject.toml` template (`SiliconEinstein/Gaia`
`docs/for-users/quick-start.md`). Fields:

- `name`: the kebab-case package name.
- `[tool.gaia].uuid`: a freshly minted UUID4.
- `[tool.gaia].generated_by`: `"formalize"`.
- `[tool.gaia].generated_from_paper`: the reference key.
- `[tool.gaia].generated_from_doi`: the DOI if available; omit otherwise.

## Step 7 — Self-Check Before Reporting Complete

Before reporting the package as emitted, verify:

1. Every conclusion in `__all__` resolves to a `claim(...)` in
   `paper_<key>.py`.
2. Every label appearing in any `deduction(...)` premises list is defined
   earlier in `paper_<key>.py`.
3. Every leaf claim (every weak point + any isolated conclusions) has a
   `priors.py` entry; no entry's prior exceeds 0.9 or falls below 0.001.
   Every conclusion `claim(...)` has a `review_prior` metadata kwarg in
   `[0.001, 0.9]` (Phase 3 synthesis prior).
4. Every justification in `priors.py` ends with `TODO:review`.
5. Every `claim(...)` body — both `claim_kind="conclusion"` and
   `claim_kind="weak_point"` — passes the self-standing test: stripped of
   all surrounding context, can a reader unfamiliar with the paper
   identify the model / system / regime, the symbols, and the claim? If
   any body fails, rewrite it before reporting completion.
6. **Pointer and citation hygiene** (two-part check, must both pass):
   - **6a.** No paper-internal pointer (`Eq. (X)` / `Fig. Y` / `Table Z` /
     `Sec. W` / `Appendix A` / `Theorem N` / `Lemma M`) appears inside a
     `claim(...)` body, inside a `deduction(...)` `reason=`, or inside a
     `priors.py` justification. External bibliographic citations in
     `[@key]` form are allowed in any prose. Pointers are also allowed
     inside `refs=` metadata, but only with
     `type ∈ {"figure", "equation", "citation"}`; any other `type` value
     (especially `"section"`, `"appendix"`, `"theorem"`, `"lemma"`,
     `"paragraph"`, `"footnote"`) is forbidden and must be rewritten or
     moved to `mapping_audit.md` only.
   - **6b.** Every prose citation uses the `[@key]` form, where `key`
     matches an entry in `references.json`. Numeric paper-style
     citations (`[33]`, `Ref. 5`, `Smith et al., 2020`) must not survive
     in any prose; convert at write time. Unresolvable citations are
     emitted as `@unknown_<n>` (bare, **no brackets** — bracketed
     `[@unknown_n]` fails `gaia compile`'s strict-reference check;
     bare `@key` is treated as opportunistic) and listed under "Metadata gaps and
     rationale" in `mapping_audit.md`.
7. The `mapping_audit.md` row count matches the DSL: as many "Conclusions"
   rows as `claim_kind="conclusion"` calls; as many "Weak points" rows as
   `claim_kind="weak_point"` calls; as many "Highlights" rows as Phase 3
   surfaced.
8. `references.json` contains an entry whose key matches every
   `source_paper="..."` argument used in the DSL.
9. The input paper is at
   `artifacts/paper-extract/input/<paper>.md` verbatim.

If any check fails, fix it before reporting completion. Surface remaining
issues to the user in the final report (e.g., conclusions you could not
derive a self-contained body for, or metadata gaps that prevented a clean
references.json).

## Step 8 — Hand Off

Report to the user:

- The path of the emitted `<name>-gaia/` directory.
- The counts: conclusions, weak points, highlights, deductions.
- Any metadata gaps recorded in `mapping_audit.md`.
- The two follow-up commands the user is expected to run as quality gates:
  - `gaia compile <name>-gaia/`
  - `gaia check --hole <name>-gaia/`

This skill does not run the quality gates itself; surfaced compile errors or
hole-check findings come back as a follow-up obligation, not a built-in
step.
