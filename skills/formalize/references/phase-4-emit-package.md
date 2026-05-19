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
`<topic-slug>-gaia` and note the metadata gap in the hand-off report.

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

## Step 2 — Scaffold the package

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
`from gaia.engine.lang import claim`, and `.gaia/.gitkeep`. The cli refuses
to write into a non-empty target.

Then add the per-paper sibling module Phase 4 will write into:

```bash
gaia pkg add-module --target <name>-gaia --name paper_<key>
```

`add-module` creates `src/<import_name>/paper_<key>.py`. All Phase 4
emissions for this paper — motivation question, conclusions, weak-point
claims, deductions, and `register_prior(...)` calls — route to that single
sibling via `gaia author --file paper_<key>.py`.

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
       --file paper_<key>.py
   ```

   Aligns `$formalize` with pipeline B (XML→LKM), where `<problem>` from
   `select_conclusion.xml` becomes a `LocalVariableNode(type="question")`.

2. **Conclusions section** — one `gaia author claim` per Phase 1 conclusion,
   in topological order:

   ```bash
   gaia author claim "<self-contained conclusion body>" \
       --label <key>_c<id>_<suffix> \
       --target <name>-gaia \
       --file paper_<key>.py
   ```

   Phase 3's per-conclusion synthesis posterior is consumed as the
   conclusion's leaf prior in Step 4b only when the conclusion is isolated
   (no upstream conclusions, no weak points → no `derive(...)`). For
   derived conclusions, Phase 3's synthesis is reflected in the deduction's
   `warrant_prior` calibration (see Step 4a step 4 below).

3. **Weak-point leaf claims section** — one `gaia author claim` per Phase 3
   weak point, routed to the same `paper_<key>.py`:

   ```bash
   gaia author claim "<self-contained weak-point body>" \
       --label <key>_c<id>_wp_<suffix> \
       --target <name>-gaia \
       --file paper_<key>.py
   ```

   Each weak-point claim is defined exactly once and appears as a premise
   in exactly one deduction (its target conclusion's). It is NOT shared
   across deductions; cross-conclusion uncertainty propagates through the
   logic graph instead (weak point ↔ one conclusion (strict) discipline).

4. **Deductions section** — one `gaia author derive` per derived conclusion,
   routed to `paper_<key>.py`. The premises list is the union of upstream
   conclusion labels and weak-point labels:

   ```bash
   gaia author derive \
       --conclusion <key>_c<id>_<suffix> \
       --given <upstream_label_1>,<upstream_label_2>,<wp_label_1>,... \
       --label <key>_c<id>_chain \
       --rationale "<Phase 2 numbered chain prose>" \
       --target <name>-gaia \
       --file paper_<key>.py \
       --metadata '{"warrant_prior": <float>}'
   ```

   Use the `--conclusion <ident>` shape (NOT `--conclusion-content` /
   `--conclusion-prose`) because the conclusion Claim has already been
   minted with a named label in Step 4a step 2.

5. **Open questions section (optional, opt-in)** — only when the user asks,
   emit `gaia author question` calls into `paper_<key>.py` with labels
   `<key>_open_question_<n>`. Pipeline B does not extract open questions;
   this is a `$formalize` extension.

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
- Adjustments are additive from the 0.95 baseline.

### 4b. Leaf priors

For every leaf claim in the package, emit a `gaia author register-prior`
invocation routed to the same `paper_<key>.py`:

- Every Phase 3 weak point is a leaf — its `prior_probability` from working
  notes goes here, capped at 0.9.
- A Phase 1 conclusion that ended up with **no** upstream conclusions and
  **no** weak points is also a leaf — its prior comes from Phase 3's
  per-conclusion `prior_probability`, capped at 0.9.

`register-prior` writes a bare `register_prior(...)` expression (no LHS
binding):

```bash
gaia author register-prior \
    --claim <key>_c<id>_wp_<suffix> \
    --value <float> \
    --justification "<terse rationale ending in TODO:review>" \
    --target <name>-gaia \
    --file paper_<key>.py \
    --source-id wp_prior_inline
```

Justification text format: one line, terse rationale (model assumption /
empirical pattern / cited result / etc.) ending with `TODO:review`. Pull the
rationale from the weak point's `weakness_reason` (compressed to one
sentence) or from the conclusion's `narrative`. The `TODO:review` convention
survives the CLI's `--justification` round-trip verbatim.

## Step 5 — Self-Check Before Reporting Complete

`gaia author --check` runs `gaia build check` automatically after each
statement write, so pre-write reference resolution, label collision, and
syntactic well-formedness are already enforced statement-by-statement.
Treat any non-zero envelope `code` from Step 4 as a fix-and-retry
obligation. The remaining self-check is the SOP-owned semantic content:

1. (manual) Every leaf claim (every weak point + any isolated conclusions)
   has a `register_prior(...)` entry; no entry's prior exceeds 0.9 or falls
   below 0.001.
2. (manual) Every justification in a `register_prior(...)` call ends with
   `TODO:review`.
3. (manual) Every `claim(...)` body passes the self-standing test:
   stripped of all surrounding context, can a reader unfamiliar with the
   paper identify the model / system / regime, the symbols, and the
   claim? If any body fails, rewrite it before reporting completion.
4. (manual) **Pointer and citation hygiene** (two-part check, must both
   pass):
   - **4a.** No paper-internal pointer (`Eq. (X)` / `Fig. Y` / `Table Z` /
     `Sec. W` / `Appendix A` / `Theorem N` / `Lemma M`) appears inside a
     `claim(...)` body, inside a `derive(...)` `--rationale`, or inside
     a `register_prior(...)` justification. External bibliographic
     citations in `[@key]` form are allowed in any prose.
   - **4b.** Every prose citation uses the `[@key]` form, where `key`
     matches an entry in `references.json`. Numeric paper-style
     citations (`[33]`, `Ref. 5`, `Smith et al., 2020`) must not survive
     in any prose; convert at write time. Unresolvable citations are
     emitted as `@unknown_<n>` (bare, **no brackets** — bracketed
     `[@unknown_n]` fails `gaia build compile`'s strict-reference check;
     bare `@key` is treated as opportunistic).
5. (manual) `references.json` contains an entry whose key matches every
   `[@key]` cited in any prose.

The final invocation's envelope `payload.check.knowledge_count` /
`check.strategy_count` / `check.operator_count` give a sanity-report count
of the package's IR contents — surface these in the hand-off report.

If any check fails, fix it before reporting completion. Surface remaining
issues to the user in the final report (e.g., conclusions you could not
derive a self-contained body for, or metadata gaps that prevented a clean
references.json).

## Step 6 — Hand Off

Report to the user:

- The path of the emitted `<name>-gaia/` directory.
- The counts: conclusions, weak points, deductions, priors (plus the
  final `gaia author` envelope's `check.knowledge_count` /
  `check.strategy_count` / `check.operator_count` as IR-side sanity).
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
