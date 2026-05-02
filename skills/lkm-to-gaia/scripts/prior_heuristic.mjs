// prior_heuristic.mjs — content + score -> Beta(a, b) + justification text.
//
// Beta is the *internal* currency of this module — the "20 mass units" intuition
// is useful for tuning ("an experimental observation is [18, 2], not 0.90,
// because [18, 2] also encodes evidence weight"). Callers convert to a float
// for emission via `betaMean([a, b])`, since `$gaia-lang` priors are float
// (Cromwell-bounded `[1e-3, 0.999]`) -- see docs/lkm-to-gaia-design.md §"The
// $gaia-lang vs gaia-discovery boundary".
//
// Public surface:
//   betaForPremise({content, lkmScore, sourcePackage}) -> {prior:[a,b], ...}
//   betaForEquivalence({lineageTag})                   -> {prior:[a,b], ...}
//   betaForContradiction({hypothesizedCauses})         -> {prior:[a,b], ...}
//   betaMean([a, b])                                   -> float in (0, 1)
//   validateBetaPrior([a, b])                          -> true | throws
//   validateFloatPrior(p)                              -> true | throws
//
// All heuristics are deliberately weak; every output carries a TODO marker so
// the human reviewer is forced through `gaia check --hole` before publishing.

const TODO = "TODO:review";

// Keyword buckets ordered by precedence (first match wins).
const BUCKETS = [
  {
    tag: "experimental_observation",
    keywords: [
      /\bmeasured?\b/i, /\bmeasurement\b/i,
      /\bobserved?\b/i, /\bobservation\b/i,
      /\bexperimental(ly)?\b/i,
      /\b(detect|detected|detection)\b/i,
      /\b(spectroscop\w+|XRD|ARPES|STM|TEM|SEM|NMR|EPR)\b/i,
      /\bfour[-\s]?probe\b/i,
    ],
    prior: [18, 2], // mean 0.90
    justification: "experimental observation (lkm chain premise)",
  },
  {
    tag: "computational_result",
    keywords: [
      /\bcomputed?\b/i, /\bcomputation\b/i,
      /\bsimulat\w+/i,
      /\bDFT\b|\bdensity[-\s]functional/i,
      /\bMonte[-\s]Carlo\b/i,
      /\bfirst[-\s]principles\b/i,
      /\bab[-\s]initio\b/i,
      /\bmolecular[-\s]dynamics\b|\bMD\b/i,
      /\b(eliashberg|migdal)\b/i,
      /\bfit(ted|ting)?\b/i,
    ],
    prior: [16, 4], // mean 0.80
    justification: "computational / theoretical result (lkm chain premise)",
  },
  {
    tag: "assumed_or_proposed",
    keywords: [
      /\bassum(e|es|ed|ing|ption)\b/i,
      /\bpropos(e|es|ed|ing)\b/i,
      /\bconjectur(e|es|ed|ing)\b/i,
      /\bhypothes(is|ize|ized)\b/i,
      /\bspeculat\w+/i,
    ],
    prior: [14, 6], // mean 0.70
    justification: "assumed / proposed proposition (lkm chain premise)",
  },
];

const DEFAULT_PRIOR = [10, 10]; // mean 0.50, neutral
const DEFAULT_JUSTIFICATION = "default neutral prior; reviewer must refine";

const EMPTY_PRIOR = [1, 1]; // Cromwell-safe; mean 0.50 with low confidence
const EMPTY_JUSTIFICATION = `Cromwell-safe default; LKM premise content unavailable (corpus not yet populated); ${TODO}`;

// --------------------------------------------------------------------------- //
// validation                                                                   //
// --------------------------------------------------------------------------- //

const CROMWELL_LO = 0.001;
const CROMWELL_HI = 0.999;

export function validateBetaPrior(prior) {
  if (!Array.isArray(prior) || prior.length !== 2) {
    throw new Error(`Beta prior must be [a, b] (got ${JSON.stringify(prior)})`);
  }
  const [a, b] = prior;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    throw new Error(`Beta prior [a, b] must be strictly positive finite (got [${a}, ${b}])`);
  }
  const mean = a / (a + b);
  if (mean <= CROMWELL_LO || mean >= CROMWELL_HI) {
    throw new Error(
      `Beta prior mean ${mean} outside Cromwell bounds (${CROMWELL_LO}, ${CROMWELL_HI}); choose a less extreme [a, b]`
    );
  }
  return true;
}

// Cromwell-bounded [1e-3, 0.999], per $gaia-lang §3.
export function validateFloatPrior(p) {
  if (typeof p !== "number" || !Number.isFinite(p)) {
    throw new Error(`Float prior must be a finite number (got ${JSON.stringify(p)})`);
  }
  if (p <= CROMWELL_LO || p >= CROMWELL_HI) {
    throw new Error(
      `Float prior ${p} outside Cromwell bounds (${CROMWELL_LO}, ${CROMWELL_HI})`
    );
  }
  return true;
}

// Mean of a Beta(a, b) -- the canonical Beta -> float collapse used when
// emitting $gaia-lang source.
export function betaMean(prior) {
  validateBetaPrior(prior);
  const [a, b] = prior;
  return a / (a + b);
}

// --------------------------------------------------------------------------- //
// premise heuristic                                                            //
// --------------------------------------------------------------------------- //

export function betaForPremise({ content, lkmScore, sourcePackage } = {}) {
  if (!content || content.trim() === "") {
    return {
      prior: EMPTY_PRIOR,
      justification: EMPTY_JUSTIFICATION,
      tag: "empty_content",
      todo: TODO,
    };
  }
  for (const bucket of BUCKETS) {
    if (bucket.keywords.some((re) => re.test(content))) {
      return {
        prior: adjustForScore(bucket.prior, lkmScore),
        justification: justificationText(bucket.justification, sourcePackage, lkmScore),
        tag: bucket.tag,
        todo: TODO,
      };
    }
  }
  return {
    prior: adjustForScore(DEFAULT_PRIOR, lkmScore),
    justification: justificationText(DEFAULT_JUSTIFICATION, sourcePackage, lkmScore),
    tag: "default",
    todo: TODO,
  };
}

// --------------------------------------------------------------------------- //
// equivalence-warrant heuristic                                                //
// --------------------------------------------------------------------------- //

const EQ_LINEAGE_PRIORS = {
  same_paper_different_version: { prior: [99, 1], justification: "same paper, different version (auto-merged separately; this prior used only if not merged)" },
  independent_experimental: { prior: [19, 1], justification: "independent experimental confirmations of the same proposition" },
  independent_theoretical: { prior: [16, 4], justification: "independent theoretical / computational confirmations of the same proposition" },
  cross_paradigm: { prior: [19, 1], justification: "cross-paradigm confirmation (one experimental + one theoretical / computational) of the same proposition" },
  unclassified: { prior: [10, 10], justification: "unclassified equivalence lineage; reviewer must classify and refine" },
};

export function betaForEquivalence({ lineageTag } = {}) {
  const fallback = EQ_LINEAGE_PRIORS.unclassified;
  const entry = EQ_LINEAGE_PRIORS[lineageTag] || fallback;
  return { prior: entry.prior, justification: entry.justification, tag: lineageTag || "unclassified", todo: TODO };
}

// --------------------------------------------------------------------------- //
// contradiction-warrant heuristic                                              //
// --------------------------------------------------------------------------- //

// Map hypothesized_cause enum (multi-select) to a prior on the contradiction
// gate. Order by how directly the cause indicts a real tension.
const CAUSE_WEIGHTS = {
  evidence_reliability: 0.95, // direct: at least one side is unreliable -> tension is real
  measurement_protocol: 0.92, // direct: protocol mismatch is mechanistic
  hidden_variable: 0.88, // moderate: speculative but actionable
  model_assumption: 0.85, // moderate: tension is conditional on the model
  boundary_condition: 0.80, // weakest: conditions might just differ
};

function meanToBeta(mean, totalMass = 20) {
  // Returns integer-friendly Beta[a, b] with a/(a+b) ~ mean.
  const a = Math.max(1, Math.round(mean * totalMass));
  const b = Math.max(1, totalMass - a);
  return [a, b];
}

export function betaForContradiction({ hypothesizedCauses } = {}) {
  const causes = Array.isArray(hypothesizedCauses) ? hypothesizedCauses : [];
  if (causes.length === 0) {
    return { prior: [10, 10], justification: "contradiction with no hypothesized cause; reviewer must classify", tag: "no_cause", todo: TODO };
  }
  const weights = causes
    .map((c) => CAUSE_WEIGHTS[c])
    .filter((w) => Number.isFinite(w));
  if (weights.length === 0) {
    return { prior: [10, 10], justification: `contradiction with unknown cause(s) ${JSON.stringify(causes)}; reviewer must classify`, tag: "unknown_cause", todo: TODO };
  }
  const meanWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  const prior = meanToBeta(meanWeight);
  return {
    prior,
    justification: `contradiction warrant from causes ${JSON.stringify(causes)} (mean weight ${meanWeight.toFixed(2)})`,
    tag: causes.join("+"),
    todo: TODO,
  };
}

// --------------------------------------------------------------------------- //
// helpers                                                                      //
// --------------------------------------------------------------------------- //

function adjustForScore(basePrior, lkmScore) {
  // If LKM provides a match score in [0, 1], nudge confidence: high score
  // tightens (raises a relative to b within the same total mass), low score
  // loosens. Conservative: change at most one unit of mass.
  if (!Number.isFinite(lkmScore)) return basePrior;
  const [a, b] = basePrior;
  const total = a + b;
  if (lkmScore >= 0.85) return [Math.min(a + 1, total - 1), Math.max(b - 1, 1)];
  if (lkmScore <= 0.50) return [Math.max(a - 1, 1), Math.min(b + 1, total - 1)];
  return basePrior;
}

function justificationText(base, sourcePackage, lkmScore) {
  const bits = [base];
  if (sourcePackage) bits.push(`source=${sourcePackage}`);
  if (Number.isFinite(lkmScore)) bits.push(`lkm_score=${lkmScore.toFixed(2)}`);
  bits.push(TODO);
  return bits.join("; ");
}

export const _internals = { BUCKETS, EQ_LINEAGE_PRIORS, CAUSE_WEIGHTS, EMPTY_PRIOR, DEFAULT_PRIOR, TODO, meanToBeta };
