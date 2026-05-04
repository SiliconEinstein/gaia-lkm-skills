# Step 2 — Bootstrap, Refine, Decompose, And Map DSL

Load this file only after Step 1 is complete. This step turns accepted LKM
payload content into Gaia DSL source.

## Required References

- `mapping-contract.md` §§0–2, 5–7 for claim, deduction, references, exports,
  and module placement rules.
- `package-skeleton.md` when creating or reshaping package files.

## Bootstrap

For each chain-backed root claim, load the LKM evidence payload. Write:

- one `claim(...)` for the root conclusion,
- one `claim(...)` for every distinct premise with usable content,
- one placeholder `claim(...)` for a chain-internal empty-content premise only
  when needed to preserve a factor-derived `deduction(...)`,
- one `deduction([premises], conclusion, reason="<numbered LKM steps>",
  prior=0.95)` for every `gfac_*` factor.

When `factors[].steps[]` contains usable `reasoning`, the deduction reason is
the full LKM evidence formatted as a numbered markdown list, preserving step
order and figure/table references.

When `factors[].steps[]` is missing or empty, still emit the factor-derived
`deduction(...)`, but use an explicit fallback reason:
`LKM factor <gfac_id> links premises <ids> to conclusion <id>; step-level
reasoning was not returned by the API.` Record `steps_missing=true` for that
factor in `mapping_audit.md`.

For an accepted no-chain LKM source claim (`total_chains=0`), write only a
leaf/source `claim(...)` with:

- `provenance_source="lkm_no_chain"`,
- preserved `lkm_id`,
- preserved `lkm_original`,
- `source_paper` when available.

Do not fabricate premises, factors, steps, or `deduction(...)` for no-chain
source claims.

## Empty-Content Premises Vs Search Leads

If a premise is inside an accepted chain-backed factor but has an empty
`content`, it may enter Gaia as a placeholder only to preserve that factor's
deduction structure. Use a content string such as
`"<unexpanded LKM premise gcn_xxx>"`, preserve the LKM id, add
`todo="revisit when LKM corpus populates this premise"`, and log
`content_missing=true` in `mapping_audit.md`.

If an empty or under-provenanced item came from match/search output outside an
accepted chain-backed factor, classify it as a search lead. Keep it in
audit/search notes only; do not emit a placeholder claim.

## Claim Self-Containment

Every executable claim must be judgeable true/false without reading the LKM
payload. If raw LKM text omits context, rewrite the claim using only context
available in the LKM claim, factor steps/premises, and `data.papers`.

Include the missing scientific scope when available:

- system/material,
- method/model/measurement protocol,
- quantity and value,
- temperature, pressure, field, sample regime, approximation domain, and
  boundary conditions.

Always preserve raw wording in `lkm_original`.

Do not add a `prior` kwarg on `claim(...)`; leaf priors go in `priors.py` after
`gaia check --hole`.

## Decompose Compound Claims

Decompose only when both sides can be made self-contained and source-grounded.

Detect compound claims such as:

- "method A predicts X, method B measures Y, they disagree",
- "M1 and M2 agree",
- "theory vs experiment differs by N%".

For each side, write an atomic claim with explicit system, method, quantity,
value, and conditions. If the evidence does not support two self-contained
atomic claims, keep the original compound claim and log the limitation.

Connect decomposed claims through `mapping-contract.md` §4:

- Accepted scientific contradiction -> emit direct `contradiction(A, B)` with
  the associated `open_problem:` reason and high operator prior.
- Same proposition -> `equivalence(A, B, reason="...", prior=...)`.
- Useful but not-yet-promoted tension -> no Gaia operator; log an audit row and
  optional inquiry hypothesis.

Preserve the original LKM meta-claim as `claim(C, lkm_original="...")`. When an
accepted contradiction represents the meta-claim, follow the operator rules in
`mapping-contract.md` §4. If the result is hypothesis-only, keep C and record
the decomposition in the audit trail instead.

## References And Modules

Build `references.json` from the union of `data.papers` across raw evidence and
match/source files. Key records as `<FirstAuthorSurname><Year>`, deduped with
suffixes when needed. Cite via `[@<key>]`.

Place source:

- canonical claims in the module of the first paper they appear in,
- `gfac_*` deductions in the module of `factor.source_package`,
- cross-paper operators in `cross_paper.py`,
- a single `__all__` in `__init__.py` containing selected root claims.

## Step-Completion Gate

Before moving to Step 3:

- All accepted claims are self-contained or explicitly logged as placeholders.
- Chain-backed factors have corresponding `deduction(...)` calls.
- Factors without step-level reasoning have explicit fallback reasons and
  `steps_missing=true` audit entries.
- Chain-internal empty premises are placeholders only when needed for a factor,
  and have `content_missing=true` audit entries.
- Search leads outside accepted chains do not enter executable DSL.
- No-chain source claims are leaf/source claims only.
- Compound claims have been decomposed according to `mapping-contract.md` §4 or
  explicitly retained with reason.
- References and module placement decisions are ready.
- Mark Step 2 complete, mark Step 3 in progress, then load
  `step-3-contradictions-and-open-questions.md`.
