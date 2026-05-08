# Phase 3 — Audit Weak Points and Highlights, Calibrate Probabilities

Load this file after Phase 2 is complete. Phase 3 is the analytical heart of
the skill: it produces the load-bearing uncertainties (weak points) and
load-bearing strengths (highlights) for each conclusion, and the probability
calibrations that drive `priors.py` and the `deduction(...)` warrants.

## Goal

For every Phase 1 conclusion, audit the reasoning chain reconstructed in
Phase 2 and produce in working notes:

1. **Weak points** — load-bearing uncertainties between the paper's evidence
   and the conclusion. Each weak point will become a leaf `claim(...)` plus a
   `priors.py` entry in Phase 4.
2. **Highlights** — load-bearing strengths whose presence is a substantive
   reason to credit the conclusion. Highlights stay in `mapping_audit.md`;
   they may also raise the `deduction(...)` warrant prior.
3. **Per-conclusion synthesis** — an integrated `prior_probability` and a
   short narrative explaining how the weak points and highlights interact for
   that conclusion.

## What Counts as a Weak Point

A weak point is a **load-bearing uncertainty** in the path from evidence to
conclusion. It is **not** a generic limitation, a caveat about future work,
or a boilerplate hedge. A claim is a weak point only if **weakening or
negating it would materially weaken, invalidate, or narrow the conclusion**.

### Classify by Argument Pattern, Not by Field

For each conclusion, identify which of the following nine reasoning patterns
its derivation rests on, then surface weak points specific to those
patterns. Do not classify by academic field (physics, ML, biology).

1. **`measurement`** — does the observed/measured/computed quantity really
   capture the stated object? Cues: proxies, instrument assumptions, label
   noise, construct validity, simulation fidelity.
2. **`causal`** — does the evidence support a causal mechanism rather than
   mere association? Cues: confounders, reverse causality, missing
   interventional controls.
3. **`model`** — is the model / idealization / simplification / asymptotic
   regime adequate? Cues: validity regime, neglected terms, linearization,
   mean-field assumptions.
4. **`statistical`** — is the treatment of uncertainty / sample size /
   significance strong enough? Cues: sample size, posterior choices, error
   bars, ignored correlations.
5. **`generalization`** — does extrapolation from tested cases to the
   broader target scope hold? Cues: dataset-specific artifacts, regime
   extrapolation, benchmark-vs-deployment gap.
6. **`comparative`** — is the comparison fair and the baseline appropriate?
   Cues: baseline strength, hyperparameter asymmetry, metric choice, leakage.
7. **`formal`** — is the mathematical / logical / algorithmic transition
   fully established? Cues: skipped proofs, regularity assumptions,
   convergence, limit exchange.
8. **`computational`** — is the code / solver / numerical method reliable?
   Cues: tolerance, stability, code correctness, seed dependence.
9. **`external`** — is a cited result / dataset / pretrained component
   applicable here? Cues: results used outside their stated regime,
   pretrained components not re-validated.

A single conclusion typically rests on several patterns simultaneously. Tag
each weak point with 1–3 of these patterns (`weak_types`), in dominance
order — first key is the dominant pattern.

### Gating Questions for Each Candidate Weak Point

Before committing to a weak point, it must pass all five:

- **Which conclusion does it threaten?** — Name **one** conclusion by
  Phase 1 id. Every weak point is bound to a single conclusion — the one
  whose derivation it directly undermines. If the underlying scientific
  uncertainty seems to threaten several conclusions, see `mapping-contract.md
  §2a`: pick the conclusion with the most catastrophic failure mode (tie-
  break by smaller id), and let cross-conclusion influence propagate
  through the logic graph (`W → C2 → C4` if C2 is upstream of C4) rather
  than re-binding W to C4. For independent conclusions that share a
  foundational assumption with no logic-graph link, the BP-invisible
  effect on the other conclusion(s) is recorded in `mapping_audit.md` as
  `also_threatens`, audit-only.
- **Which part of that conclusion's derivation depends on it?** — Point to
  the specific argumentative move (a Phase 2 step, an experimental design
  choice, an assumption, a comparison).
- **If false or weaker, what specifically would fail?** — Describe the
  concrete failure: which part of the conclusion collapses, narrows, or
  becomes unsupported.
- **Is the failure specific and load-bearing?** — If the same objection
  could be pasted against almost any paper in the field, it is not specific.
- **Is the claim already directly established by the paper?** — If the paper
  proves it, validates it with independent evidence, or it is a universally
  accepted fact, it is not a weak point.

### Do Not Extract

- Definitions ("let $H$ denote the Hamiltonian").
- Direct reported observations (what a figure or table shows).
- Mechanical algebra or identities.
- Generic limitations ("no model is perfect", "more data would be better").
- Background facts not in question here.
- Caveats that do not affect the conclusion.

## What Counts as a Highlight

A highlight is a **load-bearing strength**: a specific element of the
derivation that gives the conclusion substantively more credit than a
default well-written paper would have, and whose absence would leave the
conclusion materially less credible. Use the same nine patterns
(`strength_types`) to classify.

### Common Forms of Highlight

- **Independent validation / cross-check** — the same claim reached by two
  independent methods (analytical vs. simulation, two non-overlapping
  datasets, etc.).
- **Formal proof or rigorous derivation** — a step typically assumed in the
  field is here actually proved or bounded.
- **Quantitative agreement with prior independent results** — the paper's
  number reproduces a previously reported, independently obtained value
  within stated error bars.
- **Strong baseline / ablation design** — credible, well-tuned baseline plus
  ablations that isolate the contribution.
- **Statistical robustness** — large sample, multiple seeds, sensitivity
  sweeps, calibrated intervals beyond the field's default.
- **Computational reproducibility / numerical control** — explicit
  convergence tests, solver-tolerance sweeps, code/data release sufficient
  for re-execution.
- **Direct mechanistic evidence** — interventional controls, ablation
  experiments, do-style interventions when the conclusion is mechanistic.
- **Tight scope discipline** — the conclusion is explicitly bounded to the
  regime where evidence is strong; out-of-scope claims declared as conjecture.

### Gating Questions for Each Candidate Highlight

- **Which conclusion does it underwrite?** — Name by id.
- **Which part of the derivation gains credit?** — Point to the specific
  move whose strength is materially elevated.
- **What concretely would the conclusion lose without it?** — Describe the
  loss: which quantitative figure, qualitative regime, comparative ranking,
  or interpretive attribution would no longer be credibly supported.
- **Is the strength specific and load-bearing?** — If the same praise could
  be pasted onto any competently written paper, it is not specific.
- **Is the strength actually supplied?** — If the paper merely declares the
  property without evidence (claims robustness without showing the sweep),
  it is not a highlight.

### Do Not Extract

- Restatement of the conclusion (the conclusion is not its own highlight).
- Generic compliments about clarity, importance, writing.
- Standard-practice elements (routine train/test split, ordinary baseline,
  ordinary statistical reporting).
- Strengths with no specific conclusion-level credibility effect.
- Mere absence of weakness.

## Body-Writing Rule (Same for Weak Points and Highlights)

Each weak point and each highlight gets a **body** — a self-standing
scientific proposition that, in Phase 4, will become the string body of a
`claim(...)` (for weak points) or a row in the audit log (for highlights).
The writing rules are identical:

- **Self-standing setup**: every model / system / procedure / dataset /
  regime / variable named inside the body must be **introduced inside the
  same body**. If the claim concerns "a model", first characterize that
  model; do not appeal to "the model" as if the reader knows.
- **Paper-specific specifics**: concrete quantities, parameter values,
  regimes, equation forms, dataset identifiers — not abstract placeholders.
- **Inlined content, not pointers**: any equation, value, protocol,
  figure/table finding, or cited result the body relies on must appear,
  translated into prose, inside the body itself. No "Eq. (5)" or "Fig. 3"
  inside the body.
- **Atomic**: one claim per body. Two independent claims become two findings.
- **LaTeX math** inside `$...$`; no Unicode math symbols.
- **No cross-finding references**: "see P2" / "as in H1" not allowed inside
  the body.
- **Concrete subject**: the procedure, the estimator, the model, the
  measurement — not "the paper" or "this work".

The audit fields (`weakness_reason`, `failure_mode` for weak points;
`credit` for highlights) are reviewer commentary written **about** the body
and live in `mapping_audit.md`, not inside the body itself.

## Probability Calibration

Each weak point carries three numbers in `[0, 1]`. Use the full range; do
not default everything to 0.7–0.8.

- **`prior_probability`** — the weak-point claim's intrinsic credibility on
  its own merits.
  - **0.80–0.90** — standard approximation used within its **known valid
    regime**, or an empirical fact the field treats as settled. The claim
    is defensible by appeal to established practice; the only residual
    doubt is theoretical purity.
  - **0.60–0.80** — plausible but debatable in *this* setting: a reasonable
    assumption that has not been rigorously verified for the specific
    system, dataset, regime, or parameter range under study.
  - **0.40–0.60** — heuristic / extrapolative / single-anchor: assertions
    of asymptotic form supported by 1–6 data points, single-parameter-point
    validations being generalized to other regimes, cited results applied
    outside their stated regime, qualitative arguments substituting for a
    derivation. **The single biggest calibration mistake is to put these
    at 0.80** because the claim "feels reasonable" — they are exactly the
    load-bearing uncertainties this phase is meant to surface.
  - **0.20–0.40** — actively doubtful: contradicted by available evidence,
    internally inconsistent, or relying on a step the field has flagged
    elsewhere.
  - **0.001–0.20** — almost certainly wrong (rare; reserved for clear
    refutations).
  - Cap at 0.9 (no claim is absolutely certain). Lower bound 0.001
    (Cromwell).
- **`p1`** — sufficiency: if the weak-point claim is true, how strongly does
  the conclusion follow? `p1 ≈ P(conclusion | weak point true)`.
- **`p2`** — necessity: if the weak-point claim is false, how strongly does
  the conclusion fail? `p2 ≈ P(conclusion false | weak point false)`.

These three are stored as metadata kwargs on the `claim(...)` in Phase 4
(`prior_probability` goes into `priors.py`; `p1` and `p2` go on the claim).
BP does not consume `p1`/`p2` directly, but reviewers do.

## Per-Conclusion Synthesis

After all weak points and highlights for a conclusion are recorded, write a
synthesis for that conclusion:

- **`prior_probability`** (a number in `[0.001, 0.9]`) — the reviewer's
  overall credibility judgment (posterior) for the conclusion, integrating
  its weak points and highlights. This is **not** a mechanical function of
  the weak points' probabilities; it is informed by both findings. In Phase 4
  this number is emitted as `review_prior=<X>` metadata on the conclusion
  `claim(...)` (capped at 0.9 — see `mapping-contract.md §1a`); for
  isolated conclusions (no upstream, no weak points → no `deduction(...)`)
  it is **also** used as the conclusion's `priors.py` value because the
  conclusion is a leaf in that case. The `deduction(...)` warrant prior is
  a different number — see `mapping-contract.md §3`. Calibration:
  - A conclusion with several high-`p2` weak points cannot have a high
    prior, even with highlights.
  - A conclusion with no load-bearing weak points and at least one
    substantive highlight should be close to 1.
  - A conclusion with neither weak points nor highlights (a routine
    derivation) sits in the upper-middle range, not at the ceiling.
- **`narrative`** (2–4 sentences in reviewer voice) — articulates how the
  attached weak points and highlights interact for this conclusion. Cover
  at least 2–3 of:
  - **Layer of unreliability** — which layer(s) are weak: qualitative
    direction, quantitative magnitude, mechanism / attribution,
    generalization scope, error / uncertainty.
  - **Dominant risks vs refinements** — among the weak points, which would
    materially collapse the conclusion (show-stoppers) versus which only
    shift magnitude (refinements). Reference by working-note id.
  - **Composition of risks and supports** — how weak points and highlights
    interact: compounding, cumulative, partially redundant, offsetting (a
    highlight specifically preempts a failure mode named in a weak point's
    `failure_mode`), or unprotected.
  - **Layers underwritten by highlights** — which layer(s) are positively
    supported by the highlights.
  - **Importance among highlights** — which highlights are doing the
    substantive underwriting versus confirming-but-not-essential.

The narrative is not an index. Naming weak-point and highlight ids is fine,
but a narrative that only lists ids and restates one-line content is not
doing its job.

If a conclusion has zero weak points and zero highlights, the narrative is a
single sentence stating that no load-bearing risks or distinguishing
strengths were identified.

## Working Notes Schema

```yaml
weak_points:
  - id: P1                       # ephemeral id local to working notes
    conclusion_id: 1             # the single conclusion this weak point threatens
    also_threatens: []           # audit-only: independent conclusions this assumption also affects
                                 # (BP cannot see this; do NOT add the weak point to those conclusions' deductions)
    title: <≤ 25-word descriptor>
    body: <self-standing scientific proposition>
    weak_types: [model]
    prior_probability: 0.65
    p1: 0.7
    p2: 0.85
    weakness_reason: <reviewer critique of why the body claim is uncertain>
    failure_mode: <reviewer counterfactual: what breaks in the threatened conclusion if body fails>
    refs: [{type: figure, id: "Fig. 4"}, {type: equation, id: "Eq. (12)"}]   # only figure/equation/citation; section/appendix forbidden

highlights:
  - id: H1
    conclusion_id: 1
    title: <descriptor>
    body: <self-standing scientific proposition>
    strength_types: [computational, statistical]
    credit: <reviewer integrated argument: failure preempted, layer underwritten, scope of credit>
    refs: [{type: figure, id: "Fig. 4"}, {type: equation, id: "Eq. (12)"}]   # only figure/equation/citation; section/appendix forbidden

conclusion_synthesis:
  - conclusion_id: 1
    prior_probability: 0.78
    narrative: |
      <2–4 sentences>
```

P-ids and H-ids are ephemeral and used only for cross-references in the
narrative; the final claim labels for weak points are minted in Phase 4 from
the paper key plus a semantic suffix.

## Calibration Sanity Check

After all weak points have been assigned `prior_probability`, run this
quick distributional sanity check **before** the phase-completion gate:

- If **every** weak point has `prior_probability ≥ 0.80`, the calibration
  is almost certainly miscalibrated. Load-bearing uncertainties in any
  non-trivial paper are not all "plausible standard approximations" — at
  least one is normally heuristic, extrapolative, or single-anchor and
  belongs in the 0.40–0.60 band. Re-read each weak point against the
  bands above; specifically check whether you are giving 0.80+ to a
  claim that the paper itself only supports by extrapolation, asymptotic
  fit, single-parameter-point validation, or qualitative argument.
- The opposite failure (every weak point ≤ 0.40) is also miscalibration:
  if the derivation really had that many actively doubtful steps, the
  conclusion would not be defensible at all. Re-read for whether each
  is genuinely a refutation rather than a heuristic gap.
- A healthy distribution typically spans at least two bands across the
  weak points of a paper. Aim for that, not for a uniform default.

This check guards against a known failure mode: agents tend to cluster
priors at 0.80 because the bodies "look reasonable", losing the signal
the weak-point analysis is supposed to produce.

## Phase-Completion Gate

Before moving to Phase 4:

- Every conclusion has gone through both weak-point and highlight gating.
- Every retained weak point and highlight passes its five gating questions
  and is not on its do-not-extract list.
- Every body satisfies the self-standing rule.
- Each weak point has `prior_probability`, `p1`, `p2`, `weakness_reason`,
  `failure_mode`.
- Each highlight has `credit`.
- Each conclusion has a synthesis (`prior_probability` + `narrative`).
- The next todo is marked in progress before loading
  `phase-4-emit-package.md`.
