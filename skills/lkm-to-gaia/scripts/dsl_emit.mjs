// dsl_emit.mjs — emit Python source strings for $gaia-lang DSL nodes.
//
// PREREQUISITE: read $gaia-lang first (~/.codex/skills/gaia-lang/SKILL.md or the
// installed equivalent). This file encodes only the *mechanical correctness*
// of $gaia-lang syntax; semantics, signatures, and conventions are governed by
// the language reference. Discrepancies between this file and $gaia-lang are
// bugs in this file -- fix here so they agree.
//
// Mechanics enforced:
//   * label grammar [a-z_][a-z0-9_]* with Python + DSL reserved-word avoidance
//   * claim(content, **metadata) -- NO `prior` kwarg ($gaia-lang signature)
//     leaf priors live in priors.py per $gaia-cli §6
//   * strategies are positional-first: deduction([p1,p2], conclusion, reason=, prior=)
//     `reason` and `prior` must be paired (both or neither)
//   * operators are positional: contradiction(a, b, reason=, prior=), prior is float
//   * priors.py: PRIORS = {leaf_claim: (float, "justification."), ...}
//
// Beta priors do NOT appear in any emitted Python -- internal Beta heuristics
// are collapsed to floats via betaMean() before they reach this module.

import { validateFloatPrior, betaMean } from "./prior_heuristic.mjs";

const LABEL_RE = /^[a-z_][a-z0-9_]*$/;

// --------------------------------------------------------------------------- //
// validators                                                                   //
// --------------------------------------------------------------------------- //

export function validateLabel(label) {
  if (typeof label !== "string" || !LABEL_RE.test(label)) {
    throw new Error(
      `Invalid Gaia DSL label ${JSON.stringify(label)}: must match ${LABEL_RE} (lowercase, snake_case)`
    );
  }
  return true;
}

export function validateReasonPriorPairing(reason, prior) {
  const hasReason = reason !== undefined && reason !== null && reason !== "";
  const hasPrior = prior !== undefined && prior !== null;
  if (hasReason !== hasPrior) {
    throw new Error(
      `'reason' and 'prior' must be paired (both or neither) per $gaia-lang. ` +
        `Got reason=${JSON.stringify(reason)}, prior=${JSON.stringify(prior)}`
    );
  }
  if (hasPrior) validateFloatPrior(prior);
  return true;
}

// --------------------------------------------------------------------------- //
// label minting                                                                //
// --------------------------------------------------------------------------- //

const RESERVED = new Set([
  "from", "import", "as", "def", "class", "return", "if", "elif", "else",
  "for", "while", "True", "False", "None", "and", "or", "not", "in", "is",
  "lambda", "with", "yield", "global", "nonlocal", "pass", "break", "continue",
  "claim", "setting", "question",
  "support", "deduction", "abduction", "induction", "mathematical_induction",
  "analogy", "case_analysis", "extrapolation", "compare", "elimination",
  "composite", "fills", "infer",
  "contradiction", "equivalence", "complement", "disjunction",
]);

// Convert a free-form id (e.g. gcn_xxx) into a valid label. Caller is
// responsible for cross-source uniqueness; mintLabel just sanitises.
export function mintLabel(rawId, { prefix = "" } = {}) {
  let s = String(rawId || "").toLowerCase().trim();
  s = s.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (s === "") s = "anon";
  if (/^[0-9]/.test(s)) s = `_${s}`;
  if (prefix) s = `${prefix}_${s}`;
  if (RESERVED.has(s)) s = `${s}_`;
  if (!LABEL_RE.test(s)) {
    throw new Error(`mintLabel could not produce a valid label from ${JSON.stringify(rawId)}; got ${JSON.stringify(s)}`);
  }
  return s;
}

// --------------------------------------------------------------------------- //
// quoting / formatting                                                         //
// --------------------------------------------------------------------------- //

export function pythonString(s) {
  if (typeof s !== "string") s = String(s);
  if (s.includes("\n") || s.includes('"""')) {
    const safe = s.replaceAll('"""', '\\"\\"\\"');
    return `"""${safe}"""`;
  }
  const escaped = s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}"`;
}

// Format a float prior in (0, 1) for emission. Up to 4 decimal places, trailing
// zeros stripped, but at least one decimal preserved (so it parses as a float
// and not an int literal).
export function formatFloatPrior(p) {
  validateFloatPrior(p);
  let s = p.toFixed(4);
  s = s.replace(/0+$/, "").replace(/\.$/, ".0");
  return s;
}

function formatPyValue(v, indent = 0) {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return JSON.stringify(v);
  if (typeof v === "string") return pythonString(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const items = v.map((x) => formatPyValue(x, indent + 4));
    return `[${items.join(", ")}]`;
  }
  if (typeof v === "object") return formatPyDict(v, indent);
  return pythonString(String(v));
}

function formatPyDict(obj, indent = 0) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  const pad = " ".repeat(indent + 4);
  const close = " ".repeat(indent);
  const lines = keys.map((k) => `${pad}${pythonString(k)}: ${formatPyValue(obj[k], indent + 4)},`);
  return `{\n${lines.join("\n")}\n${close}}`;
}

// --------------------------------------------------------------------------- //
// canonical $gaia-lang imports header                                          //
// --------------------------------------------------------------------------- //

// Single source of truth: $gaia-lang §1. If gaia-lang adds new primitives,
// regenerate this constant from the language reference.
export const IMPORTS_BLOCK = `from gaia.lang import (
    claim, setting, question,
    contradiction, equivalence, complement, disjunction,
    support, compare, deduction, abduction, induction,
    analogy, extrapolation, elimination, case_analysis,
    mathematical_induction, composite, infer, fills,
)
`;

// --------------------------------------------------------------------------- //
// claim -- $gaia-lang signature: claim(content, *, title, background,
//          parameters, provenance, **metadata)
// --------------------------------------------------------------------------- //

export function emitClaim({
  label,
  content,
  title = null,
  background = null,
  parameters = null,
  provenance = null,
  metadata = {},
}) {
  validateLabel(label);
  if (!content || typeof content !== "string") {
    throw new Error(`emitClaim: content must be a non-empty string (label=${label})`);
  }
  if (background !== null && (!Array.isArray(background) || background.length === 0)) {
    throw new Error(`emitClaim: background must be a non-empty list of labels or null (label=${label})`);
  }
  if (background) background.forEach(validateLabel);

  const lines = [`${label} = claim(`, `    ${pythonString(content)},`];
  if (title) lines.push(`    title=${pythonString(title)},`);
  if (background) lines.push(`    background=[${background.join(", ")}],`);
  if (parameters !== null) lines.push(`    parameters=${formatPyValue(parameters, 4)},`);
  if (provenance !== null) lines.push(`    provenance=${formatPyValue(provenance, 4)},`);
  for (const [k, v] of Object.entries(metadata || {})) {
    if (RESERVED.has(k) || k === "prior") {
      throw new Error(`emitClaim: metadata key ${JSON.stringify(k)} is reserved or shadows a kwarg`);
    }
    lines.push(`    ${k}=${formatPyValue(v, 4)},`);
  }
  lines.push(")");
  return lines.join("\n");
}

// --------------------------------------------------------------------------- //
// strategies -- positional-first per $gaia-lang §4                             //
// --------------------------------------------------------------------------- //

function emitStrategy(kind, { positional, kwargs, reason, prior, resultLabel = null }) {
  validateReasonPriorPairing(reason, prior);

  const lines = [];
  for (const arg of positional) {
    if (Array.isArray(arg.value)) {
      arg.value.forEach(validateLabel);
      lines.push(`    [${arg.value.join(", ")}],`);
    } else {
      validateLabel(arg.value);
      lines.push(`    ${arg.value},`);
    }
  }
  for (const [k, v] of Object.entries(kwargs || {})) {
    if (Array.isArray(v)) {
      v.forEach(validateLabel);
      lines.push(`    ${k}=[${v.join(", ")}],`);
    } else if (v !== null && v !== undefined) {
      validateLabel(v);
      lines.push(`    ${k}=${v},`);
    }
  }
  if (reason !== undefined && reason !== null && reason !== "") {
    lines.push(`    reason=${pythonString(reason)},`);
    lines.push(`    prior=${formatFloatPrior(prior)},`);
  }
  const head = resultLabel ? `${resultLabel} = ${kind}(` : `${kind}(`;
  return `${head}\n${lines.join("\n")}\n)`;
}

export function emitDeduction({
  premiseLabels,
  conclusionLabel,
  reason = null,
  prior = null,
  resultLabel = null,
}) {
  if (!Array.isArray(premiseLabels) || premiseLabels.length === 0) {
    throw new Error("emitDeduction: premiseLabels must be a non-empty list");
  }
  return emitStrategy("deduction", {
    positional: [{ value: premiseLabels }, { value: conclusionLabel }],
    reason,
    prior,
    resultLabel,
  });
}

export function emitSupport({
  premiseLabels,
  conclusionLabel,
  reason = null,
  prior = null,
  resultLabel = null,
}) {
  if (!Array.isArray(premiseLabels) || premiseLabels.length === 0) {
    throw new Error("emitSupport: premiseLabels must be a non-empty list");
  }
  return emitStrategy("support", {
    positional: [{ value: premiseLabels }, { value: conclusionLabel }],
    reason,
    prior,
    resultLabel,
  });
}

export function emitInduction({
  support1Label,
  support2Label,
  lawLabel,
  reason = null,
  prior = null,
  resultLabel = null,
}) {
  // $gaia-lang §4: induction(support_1, support_2, law, *, ...) -- positional.
  // Note: support_1 and support_2 are *Strategy* objects (results of support(...)),
  // i.e. variable names of strategy assignments, e.g. `s_a = support(...)`.
  return emitStrategy("induction", {
    positional: [
      { value: support1Label },
      { value: support2Label },
      { value: lawLabel },
    ],
    reason,
    prior,
    resultLabel,
  });
}

// --------------------------------------------------------------------------- //
// operators -- positional, paired reason+prior(float)                          //
// --------------------------------------------------------------------------- //

function emitOperator(kind, { positional, reason, prior, resultLabel = null }) {
  validateReasonPriorPairing(reason, prior);
  positional.forEach(validateLabel);
  const args = positional.map((a) => `    ${a},`);
  if (reason !== undefined && reason !== null && reason !== "") {
    args.push(`    reason=${pythonString(reason)},`);
    args.push(`    prior=${formatFloatPrior(prior)},`);
  }
  const head = resultLabel ? `${resultLabel} = ${kind}(` : `${kind}(`;
  return `${head}\n${args.join("\n")}\n)`;
}

export function emitContradiction({ a, b, reason = null, prior = null, resultLabel = null }) {
  return emitOperator("contradiction", { positional: [a, b], reason, prior, resultLabel });
}

export function emitEquivalence({ a, b, reason = null, prior = null, resultLabel = null }) {
  return emitOperator("equivalence", { positional: [a, b], reason, prior, resultLabel });
}

export function emitComplement({ a, b, reason = null, prior = null, resultLabel = null }) {
  return emitOperator("complement", { positional: [a, b], reason, prior, resultLabel });
}

export function emitDisjunction({ members, reason = null, prior = null, resultLabel = null }) {
  if (!Array.isArray(members) || members.length < 2) {
    throw new Error("emitDisjunction: members must be a list of >= 2 labels");
  }
  return emitOperator("disjunction", { positional: members, reason, prior, resultLabel });
}

// --------------------------------------------------------------------------- //
// priors.py emitter ($gaia-cli §6)                                             //
// --------------------------------------------------------------------------- //

// One row in the PRIORS dict: <labelRef>: (<float>, "<justification>"),
export function emitPriorsPyEntry({ labelRef, prior, justification }) {
  validateLabel(labelRef);
  validateFloatPrior(prior);
  if (!justification || typeof justification !== "string") {
    throw new Error("emitPriorsPyEntry: justification must be a non-empty string");
  }
  return `    ${labelRef}: (${formatFloatPrior(prior)}, ${pythonString(justification)}),`;
}

// Full priors.py file content.
//   importsByModule: { "<relative_module>": ["<label1>", "<label2>", ...] }
//   entries: [{ labelRef, prior, justification }, ...]
//
// Ordering: imports grouped by module (alphabetical); entries in the order
// supplied by the caller (typically insertion order of leaves in the package).
export function emitPriorsPyFile({ importsByModule = {}, entries = [], header = null }) {
  const modules = Object.keys(importsByModule).sort();
  const importLines = [];
  for (const m of modules) {
    const labels = importsByModule[m];
    if (!Array.isArray(labels) || labels.length === 0) continue;
    labels.forEach(validateLabel);
    importLines.push(`from .${m} import ${labels.join(", ")}`);
  }
  const out = [];
  out.push(header || "\"\"\"priors.py — leaf-claim priors for this package.\n\nGenerated by lkm-to-gaia. Floats per $gaia-cli §6 (PRIORS shape).\n\"\"\"");
  out.push("");
  if (importLines.length) {
    out.push(importLines.join("\n"));
    out.push("");
  }
  if (entries.length === 0) {
    out.push("PRIORS = {}");
  } else {
    out.push("PRIORS = {");
    for (const e of entries) out.push(emitPriorsPyEntry(e));
    out.push("}");
  }
  out.push("");
  return out.join("\n");
}

// --------------------------------------------------------------------------- //
// __all__ helper -- only for use in __init__.py per $gaia-lang §5 warning      //
// --------------------------------------------------------------------------- //

export function emitAllExport(labels) {
  // $gaia-lang §5: "Do NOT define __all__ in submodules." Caller is expected
  // to use this only for __init__.py.
  labels.forEach(validateLabel);
  if (labels.length === 0) return `__all__ = []\n`;
  const items = labels.map((l) => `    ${pythonString(l)},`).join("\n");
  return `__all__ = [\n${items}\n]\n`;
}

// --------------------------------------------------------------------------- //

export const _internals = { LABEL_RE, RESERVED, formatPyDict, formatPyValue, betaMean };
