# Phase 4 — Emit the Gaia Package

Load this file after Phase 3 is complete. This is the only phase that writes
files. It composes the working notes from Phases 1–3 into a standalone Gaia
knowledge package on disk.

## Goal

Produce a `<name>-gaia/` package on disk per the upstream Gaia
knowledge-package spec (file layout: `SiliconEinstein/Gaia`
`docs/for-users/quick-start.md`; `claim` / `derive` / `question` body
discipline, label rules, `__all__` rules:
`docs/for-users/language-reference.md`). After emission, the package must be
ready for `gaia build compile` and `gaia build check --hole .` (see upstream
`docs/for-users/cli-commands.md`).

## Authoring surface — `gaia author` (cli-as-client)

Phase 4 emits the package through the upstream **agent-first authoring CLI**
(`SiliconEinstein/Gaia` `docs/reference/cli/author.md`), not by writing raw
Python DSL by hand. The CLI:

- pre-validates each statement (identifier collision, reference resolution,
  syntactic well-formedness) before writing,
- appends the rendered Python to the target source file,
- runs `gaia build check` automatically after each successful write
  (default `--check` on),
- emits a uniform JSON envelope on stdout — `json.loads(stdout)` once and
  dispatch on `verb` / `status` / `code`.

Every Phase 4 sub-step below names the specific `gaia author <verb>`
invocations to use. The DSL primitives this skill emits map to author verbs
as follows (canonical v0.5 names; legacy aliases in
`gaia.engine.lang.compat` emit `DeprecationWarning` and must not be used in
fresh packages):

| Phase 4 emission | DSL primitive | Author verb |
|---|---|---|
| Motivation question | `question(...)` | `gaia author question` |
| Conclusion / weak-point claim | `claim(...)` | `gaia author claim` |
| Deduction (1+ premises → conclusion) | `derive(...)` | `gaia author derive` |
| Leaf prior record | `register_prior(...)` | `gaia author register-prior` |

Errors surface in the envelope's `diagnostics` array with a `kind`
dispatch key (`prewrite.collision`, `prewrite.reference_unresolved`,
`prewrite.syntax`, `prewrite.self_loop`, `postwrite.check_fail`, ...).
Treat non-zero `code` as a fix-and-retry obligation before moving on; the
CLI guarantees no partial writes on pre-write failure.

## Step 0 — Decide the package name and import name

- Extract the paper's reference key from its bibliographic metadata
  (`<FirstAuthorSurname><Year>`, e.g., `Liu2015`). If multiple papers shared
  a key in this run, append `a`, `b`, ...
- Derive a short topic slug (1–4 lowercase tokens) from the paper title or
  the dominant conclusion's title.
- Package directory: `<author-lowercase><year>-<topic-slug>-gaia` (kebab
  case), e.g., `liu2015-fibonacci-anyons-gaia`.
- Python import name: derived **by the CLI** from `--name` by stripping the
  trailing `-gaia` and converting hyphens to underscores
  (`liu2015-fibonacci-anyons-gaia` → `liu2015_fibonacci_anyons`). Per
  `docs/reference/cli/author.md` `gaia pkg scaffold` section, the cli does
  not accept an `--import-name` override.

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

## Step 2 — Scaffold the package and copy the input

Bootstrap the package directory with the CLI:

```bash
gaia pkg scaffold \
    --target <name>-gaia \
    --name <name>-gaia \
    --with-uuid \
    --description "<one-line description from Phase 1 motivation>"
```

This writes `pyproject.toml` (with `[tool.gaia] type = "knowledge-package"`
and a freshly-minted `uuid`), `src/<import_name>/__init__.py` seeded with
`from gaia.engine.lang import claim` plus `__all__: list[str] = []`, and
`.gaia/.gitkeep`. The cli refuses to write into a non-empty target.

Then add the sibling modules Phase 4 will write into:

```bash
gaia pkg add-module --target <name>-gaia --name paper_<key>
gaia pkg add-module --target <name>-gaia --name weak_points_<key>
gaia pkg add-module --target <name>-gaia --name priors
```

Each `add-module` invocation creates `src/<import_name>/<module>.py` with a
literal `__all__: list[str] = []`. Subsequent `gaia author --file <module>.py`
calls auto-extend that list with every labeled statement they emit (see
`docs/reference/cli/author.md` shared-flag table for `--file` semantics).

Create the audit-dir and copy the input paper:

- `mkdir -p <name>-gaia/artifacts/paper-extract/input/`
- Copy the input paper Markdown verbatim to
  `<name>-gaia/artifacts/paper-extract/input/<paper>.md`.
- Initialize `<name>-gaia/artifacts/paper-extract/graph_growth_log.jsonl` and
  append a `package_initialized` event. Establish your `actor_id`
  (e.g. `formalize-<short-uuid>`) and `seq` counter starting at 1.

`gaia pkg scaffold` does not create `artifacts/paper-extract/` — that
directory is SOP-owned, not part of the upstream package skeleton.

## Step 3 — Write `references.json`

Emit a CSL-JSON record for the paper using its reference key. Fields:

- `type`: `article-journal` (default; switch to `paper-conference`,
  `book-chapter`, etc. only if the paper Markdown clearly indicates so).
- `title`, `DOI`, `container-title`, `issued`, `author`.
- Use the paper's own metadata; do not invent fields. Missing fields are
  omitted, not stubbed.

`references.json` is SOP-owned — the CLI does not manage it. Write the file
directly with the file-write tooling of choice.

## Step 4 — Emit the DSL statements via `gaia author`

Emit one CLI invocation per DSL statement, in the order below. Each
invocation auto-runs `gaia build check` post-write (default), so a failure
in any statement halts the chain at that statement.

### 4a. `paper_<key>.py` — motivation, conclusions, deductions

Route all `paper_<key>.py` emissions with `--file paper_<key>.py`.

1. **Motivation as `question(...)`** — one invocation for Phase 1's
   motivation block:

   ```bash
   gaia author question "<motivation prose>" \
       --label <key>_problem \
       --target <name>-gaia \
       --file paper_<key>.py \
       --metadata '{"provenance_source": "paper_extract", "source_paper": "<key>"}'
   ```

   Aligns `$formalize` with pipeline B (XML→LKM), where `<problem>` from
   `select_conclusion.xml` becomes a `LocalVariableNode(type="question")`.

2. **Conclusions section** — one `gaia author claim` per Phase 1 conclusion,
   in topological order:

   ```bash
   gaia author claim "<self-contained conclusion body>" \
       --label <key>_c<id>_<suffix> \
       --target <name>-gaia \
       --file paper_<key>.py \
       --metadata '{"claim_kind": "conclusion", "review_prior": <float>, "provenance_source": "paper_extract", "source_paper": "<key>", "refs": [{"type": "equation", "id": "Eq.3"}, ...]}'
   ```

   `review_prior` carries the Phase 3 per-conclusion synthesis posterior
   (capped at 0.9). It is **distinct from** the deduction's warrant
   `--metadata '{"warrant_prior": ...}'` (see Step 4a step 4 below); both
   numbers may differ and that is expected.

3. **Weak-point leaf claims section** — one `gaia author claim` per Phase 3
   weak point, routed to `weak_points_<key>.py` (NOT `paper_<key>.py`) so
   the labels do not leak into the root `__init__.py`'s `__all__`:

   ```bash
   gaia author claim "<self-contained weak-point body>" \
       --label <key>_c<id>_wp_<suffix> \
       --target <name>-gaia \
       --file weak_points_<key>.py \
       --metadata '{"claim_kind": "weak_point", "weak_types": ["<type1>", ...], "p1": <float>, "p2": <float>, "provenance_source": "paper_extract", "source_paper": "<key>", "threatens_conclusion": "<key>_c<id>_<suffix>"}'
   ```

   Each weak-point claim is defined exactly once in `weak_points_<key>.py`
   and appears as a premise in exactly one deduction (its target
   conclusion's). It is NOT shared across deductions; cross-conclusion
   uncertainty propagates through the logic graph instead (weak point ↔ one
   conclusion (strict) discipline).

4. **Deductions section** — one `gaia author derive` per derived conclusion,
   routed to `paper_<key>.py`. The premises list is the union of upstream
   conclusion labels and weak-point labels. Pre-import the weak-point labels
   into `paper_<key>.py` first so they resolve:

   ```bash
   gaia pkg add-import --target <name>-gaia \
       --file paper_<key>.py \
       --from .weak_points_<key> \
       --names <key>_c<id>_wp_<suffix>,<key>_c<id>_wp_<suffix2>,...
   ```

   Then the deduction:

   ```bash
   gaia author derive \
       --conclusion <key>_c<id>_<suffix> \
       --given <upstream_label_1>,<upstream_label_2>,<wp_label_1>,... \
       --label <key>_c<id>_chain \
       --rationale "<Phase 2 numbered chain prose>" \
       --target <name>-gaia \
       --file paper_<key>.py \
       --metadata '{"warrant_prior": <float>, "provenance_source": "paper_extract", "source_paper": "<key>"}'
   ```

   Use the `--conclusion <ident>` shape (NOT `--conclusion-content` /
   `--conclusion-prose`) because the conclusion Claim has already been
   minted with a named label in Step 4a step 2.

5. **Open questions section (optional, opt-in)** — only when the user asks,
   emit `gaia author question` calls into `paper_<key>.py` with labels
   `<key>_open_question_<n>` and the same provenance metadata as the
   motivation question. Pipeline B does not extract open questions; this is
   a `$formalize` extension.

The string body of every `claim(...)` / `question(...)` is the
self-contained body from working notes — no further rewriting in Phase 4.
The Phase 1 self-containment discipline and the Phase 3 body-writing rule
already satisfy what the legacy step-4 prompt enforced; this phase only
relabels and emits.

For each deduction's `warrant_prior` (a warrant strength, **not** the
conclusion's posterior), follow the additive scheme:

- Default 0.95.
- **+0.02 to +0.04** for each Phase 3 highlight that specifically underwrites
  a step in this chain. Cap at 0.99.
- **−0.05 to −0.10** for each explicit logical gap Phase 2 had to flag.
  Floor at 0.80.
- Adjustments are additive from the 0.95 baseline; record each adjustment
  with its rationale in `mapping_audit.md`'s Conclusions table `notes` column.

### 4b. `priors.py`

For every leaf claim in the package, emit a `gaia author register-prior`
invocation routed to `priors.py`:

- Every Phase 3 weak point is a leaf — its `prior_probability` from working
  notes goes here, capped at 0.9.
- A Phase 1 conclusion that ended up with **no** upstream conclusions and
  **no** weak points is also a leaf — its prior comes from Phase 3's
  per-conclusion `prior_probability`, capped at 0.9.

`register-prior` writes a bare `register_prior(...)` expression (no LHS
binding); `--file priors.py` routes it there. The verb requires the target
Claim's label to already be defined in some module the package imports —
pre-import the weak-point labels into `priors.py`:

```bash
gaia pkg add-import --target <name>-gaia \
    --file priors.py \
    --from .weak_points_<key> \
    --names <key>_c<id>_wp_<suffix>,<key>_c<id>_wp_<suffix2>,...

gaia author register-prior \
    --claim <key>_c<id>_wp_<suffix> \
    --value <float> \
    --justification "<terse rationale ending in TODO:review>" \
    --target <name>-gaia \
    --file priors.py \
    --source-id wp_prior_inline
```

Justification text format: one line, terse rationale (model assumption /
empirical pattern / cited result / etc.) ending with `TODO:review`. Pull the
rationale from the weak point's `weakness_reason` (compressed to one
sentence) or from the conclusion's `narrative`. The `TODO:review` convention
survives the CLI's `--justification` round-trip verbatim.

### 4c. `__init__.py` — selective re-export of conclusions only

Root `__init__.py` must `__all__`-export the conclusion labels and ONLY the
conclusion labels (per the existing Phase 4 invariant). Because `gaia
author --file <module>.py` auto-appends every labeled statement to that
module's local `__all__`, conclusions and weak points written to
`paper_<key>.py` would all land in `paper_<key>.py.__all__` if they shared
that file. The Step 4a routing (weak points → `weak_points_<key>.py`,
conclusions+deductions → `paper_<key>.py`) keeps the two label sets
separated at the module-`__all__` boundary already.

Verify the root `__init__.py` then selectively imports the conclusions:

- Use `gaia pkg add-import` to bring conclusion labels into the root
  `__init__.py` (one `--names` csv per per-paper module):

  ```bash
  gaia pkg add-import --target <name>-gaia \
      --file __init__.py \
      --from .paper_<key> \
      --names <key>_c1_<suffix>,<key>_c2_<suffix>,...
  ```

- Then patch the root `__init__.py.__all__` to list the same conclusion
  labels (the scaffold seeded `__all__: list[str] = []`, and `add-import`
  does not edit it). This is a small literal-list edit.

This verification step replaces the legacy "manually write `__init__.py`"
ritual: the CLI manages all per-module Python source, but the cross-module
export surface (root `__all__`) is the SOP's contract.

## Step 5 — Write the audit artifacts

### 5a. `artifacts/paper-extract/mapping_audit.md`

Populate every section of `mapping_audit.md`:

- Phase summary table.
- Conclusions table — one row per conclusion, with the working-note id,
  the final label, upstream labels, weak-point labels (only the ones
  bound to this conclusion per the weak-point ↔ one-conclusion (strict)
  discipline), `warrant_prior` (warrant strength on the deduction; matches
  the `warrant_prior` metadata kwarg on the deduction), `review_prior`
  (Phase 3 conclusion-synthesis posterior; same value as the
  `review_prior` metadata kwarg on the conclusion claim), and free-text
  notes (e.g., per-highlight +0.02/+0.04 adjustments and per-gap
  −0.05/−0.10 adjustments to the warrant prior).
- Weak points table — one row per weak-point label, with label, the single
  threatened `conclusion_id` (mirrors `threatens_conclusion` metadata),
  `also_threatens` (comma-separated audit-only list of independent
  conclusion ids the same scientific assumption also affects but which are
  **not** wired into BP — per the weak-point ↔ one-conclusion (strict)
  discipline), weak_types, prior, p1, p2, full `weakness_reason` text,
  full `failure_mode` text. Default for `also_threatens` is `(none)`.
- Highlights table — one row per highlight with id, conclusion_id,
  strength_types, full `credit` text, and notes (especially: did this
  highlight raise a deduction warrant prior, and by how much).
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
one JSON object. The author-CLI envelope is **not** itself the growth-log
event — read each invocation's envelope (`payload.label`, `payload.snippet`,
`payload.check.knowledge_count`) and emit the matching growth event into
`graph_growth_log.jsonl` as an SOP-owned action. Required event sequence
(paper-extract):

1. **`package_initialized`** (already emitted in Step 2 above) — first
   event, with payload `{"package": "<name>-gaia", "source_paper":
   "<reference_key>"}`.
2. **`accepted_claim`** — one event per `question(...)` and `claim(...)`
   written, in the order they appear:
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
4. **`accepted_deduction`** — one event per `derive(...)` written,
   regardless of how many premises that deduction has. Payload:
   `{"premises": [...labels...], "conclusion": label, "reason_excerpt":
   <first ~200 chars>}`. Set `warrant_prior` to the deduction's
   `warrant_prior` metadata kwarg (the warrant strength, **not** any
   conclusion-level posterior). `graph_delta.edges_added` lists one slim
   `kind: "deduction"` edge per (premise → conclusion) pair carrying only
   `{from, to, kind, prior}` — `reason_excerpt` lives on `payload`, not on
   each edge.
5. **`obligation_added`** — emit only if open-questions are materialized
   as `question(...)` operators (only when explicitly requested).

Every event is single-line JSON. Maintain a single monotonic `seq`
counter for the run. Never rewrite earlier lines; corrections go in a new
event with `supersedes_event_id` pointing at the original.

## Step 6 — Patch `pyproject.toml` with formalize-specific provenance

`gaia pkg scaffold --with-uuid` (Step 2) already wrote `name` and
`[tool.gaia] type = "knowledge-package"`, `uuid`, and `namespace`. The
formalize-specific provenance kwargs are SOP-owned and need a post-scaffold
patch:

- `[tool.gaia].generated_by`: `"formalize"`.
- `[tool.gaia].generated_from_paper`: the reference key.
- `[tool.gaia].generated_from_doi`: the DOI if available; omit otherwise.

Patch with the file-edit tooling of choice (TOML edit). These kwargs do not
participate in the upstream package contract; they are documentation for
downstream reviewers of the audit dir.

## Step 7 — Self-Check Before Reporting Complete

`gaia author --check` runs `gaia build check` automatically after each
statement write, so pre-write reference resolution, label collision, and
syntactic well-formedness (legacy checks 1, 2, and the syntax half of
self-standing) are already enforced statement-by-statement. The remaining
self-check is the SOP-owned semantic content:

1. **(automatic via `--check`)** Every label appearing in any
   `gaia author derive --given` resolved; every `claim` / `question` / `derive`
   label was unique. Treat any non-zero envelope `code` from Step 4 as a
   fix-and-retry obligation, not a self-check item.
2. **(automatic via `--check`)** Every `register_prior` `--claim` target
   resolved.
3. (manual) Every leaf claim (every weak point + any isolated conclusions)
   has a `priors.py` entry; no entry's prior exceeds 0.9 or falls below
   0.001. Every conclusion `claim(...)` has a `review_prior` metadata
   kwarg in `[0.001, 0.9]` (Phase 3 synthesis prior).
4. (manual) Every justification in `priors.py` ends with `TODO:review`.
5. (manual) Every `claim(...)` body — both `claim_kind="conclusion"` and
   `claim_kind="weak_point"` — passes the self-standing test: stripped of
   all surrounding context, can a reader unfamiliar with the paper
   identify the model / system / regime, the symbols, and the claim? If
   any body fails, rewrite it before reporting completion.
6. (manual) **Pointer and citation hygiene** (two-part check, must both
   pass):
   - **6a.** No paper-internal pointer (`Eq. (X)` / `Fig. Y` / `Table Z` /
     `Sec. W` / `Appendix A` / `Theorem N` / `Lemma M`) appears inside a
     `claim(...)` body, inside a `derive(...)` `--rationale`, or inside a
     `priors.py` justification. External bibliographic citations in
     `[@key]` form are allowed in any prose. Pointers are also allowed
     inside `--metadata '{"refs": [...]}'`, but only with
     `type ∈ {"figure", "equation", "citation"}`; any other `type` value
     (especially `"section"`, `"appendix"`, `"theorem"`, `"lemma"`,
     `"paragraph"`, `"footnote"`) is forbidden and must be rewritten or
     moved to `mapping_audit.md` only.
   - **6b.** Every prose citation uses the `[@key]` form, where `key`
     matches an entry in `references.json`. Numeric paper-style
     citations (`[33]`, `Ref. 5`, `Smith et al., 2020`) must not survive
     in any prose; convert at write time. Unresolvable citations are
     emitted as `@unknown_<n>` (bare, **no brackets** — bracketed
     `[@unknown_n]` fails `gaia build compile`'s strict-reference check;
     bare `@key` is treated as opportunistic) and listed under "Metadata
     gaps and rationale" in `mapping_audit.md`.
7. (manual) The `mapping_audit.md` row count matches the DSL: as many
   "Conclusions" rows as `claim_kind="conclusion"` calls; as many "Weak
   points" rows as `claim_kind="weak_point"` calls; as many "Highlights"
   rows as Phase 3 surfaced.
8. (manual) `references.json` contains an entry whose key matches every
   `source_paper="..."` argument used in the DSL.
9. (manual) The input paper is at
   `artifacts/paper-extract/input/<paper>.md` verbatim.

The final invocation's envelope `payload.check.knowledge_count` /
`check.strategy_count` / `check.operator_count` give a sanity-report count
of the package's IR contents — surface these in the hand-off report.

If any check fails, fix it before reporting completion. Surface remaining
issues to the user in the final report (e.g., conclusions you could not
derive a self-contained body for, or metadata gaps that prevented a clean
references.json).

## Step 8 — Hand Off

Report to the user:

- The path of the emitted `<name>-gaia/` directory.
- The counts: conclusions, weak points, highlights, deductions (plus the
  final `gaia author` envelope's `check.knowledge_count` /
  `check.strategy_count` / `check.operator_count` as IR-side sanity).
- Any metadata gaps recorded in `mapping_audit.md`.
- The two follow-up commands the user is expected to run as quality gates:
  - `gaia build compile <name>-gaia/` — full-package compile catches
    cross-statement issues the per-write `gaia build check` cannot
    (cyclic imports, IR-hash drift, manifest emission).
  - `gaia inquiry review --strict <name>-gaia/` — strict warrant /
    obligation / duplicate-control review.

Per-write `gaia build check` already ran after every Step 4 statement; the
end-of-package full compile is implicit in `gaia build compile` (and surfaces
issues that only fire when the full module graph loads together).

This skill does not run the quality gates itself; surfaced compile errors or
inquiry-review findings come back as a follow-up obligation, not a built-in
step.
