// dsl_emit.mjs — emit Python source strings for Gaia DSL nodes (v0.x conformant).
//
// Mechanics only. Knows nothing about LKM run-folders. Conventions enforced:
//   * label grammar [a-z_][a-z0-9_]* (matches the QID rule used by gaia-discovery)
//   * `claim(...)` carries `prior=[a, b]` (Beta) and metadata.prior_justification
//   * strategies use kwargs: deduction(premises=[...], conclusion=...)
//   * operators use positional args: contradiction(a, b), equivalence(a, b), ...
//   * `reason` and `prior` MUST be paired (both or neither) on strategy / operator
//   * Beta prior bounded by Cromwell (delegated to prior_heuristic.validateBetaPrior)
//
// Each emit_* helper returns a Python source fragment as a string. The caller
// concatenates them. There is no magic: the agent / batch driver / incremental
// driver decides ordering, headers, module placement.

import { validateBetaPrior } from "./prior_heuristic.mjs";

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
      `'reason' and 'prior' must be paired (both or neither). Got reason=${JSON.stringify(
        reason
      )}, prior=${JSON.stringify(prior)}`
    );
  }
  if (hasPrior) validateBetaPrior(prior);
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

// Convert a free-form id (e.g. gcn_xxx or arbitrary content keywords) into a
// valid label. Caller is responsible for uniqueness; mintLabel just sanitises.
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
  // Use a triple-quoted raw-ish string when content has newlines or quotes.
  if (s.includes("\n") || s.includes('"""')) {
    // Escape the closing triple-quote by inserting zero-width split if needed.
    const safe = s.replaceAll('"""', '\\"\\"\\"');
    return `"""${safe}"""`;
  }
  // Standard double-quoted: escape backslash and double-quote.
  const escaped = s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}"`;
}

export function formatBetaPrior(prior) {
  validateBetaPrior(prior);
  return `[${prior[0]}, ${prior[1]}]`;
}

function indentBlock(text, n = 4) {
  const pad = " ".repeat(n);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function formatMetadataDict(metadata, indent = 4) {
  const keys = Object.keys(metadata);
  if (keys.length === 0) return "{}";
  const lines = keys.map((k) => {
    const v = metadata[k];
    let valStr;
    if (typeof v === "number" || typeof v === "boolean" || v === null) {
      valStr = JSON.stringify(v);
    } else if (Array.isArray(v)) {
      valStr = `[${v.map((x) => pythonString(String(x))).join(", ")}]`;
    } else if (typeof v === "object") {
      valStr = formatMetadataDict(v, indent + 4);
    } else {
      valStr = pythonString(String(v));
    }
    return `${" ".repeat(indent)}${pythonString(k)}: ${valStr},`;
  });
  return `{\n${lines.join("\n")}\n${" ".repeat(indent - 4)}}`;
}

// --------------------------------------------------------------------------- //
// canonical imports header                                                     //
// --------------------------------------------------------------------------- //

export const IMPORTS_BLOCK = `from gaia.lang import (
    claim, setting, question,
    support, deduction, abduction, induction, mathematical_induction,
    analogy, case_analysis, extrapolation, compare, elimination,
    composite, fills, infer,
    contradiction, equivalence, complement, disjunction,
)
`;

// --------------------------------------------------------------------------- //
// claim                                                                        //
// --------------------------------------------------------------------------- //

export function emitClaim({
  label,
  content,
  prior,
  prior_justification,
  metadata = {},
  title,
}) {
  validateLabel(label);
  validateBetaPrior(prior);
  if (!content || typeof content !== "string") {
    throw new Error(`emitClaim: content must be a non-empty string (label=${label})`);
  }
  if (!prior_justification || typeof prior_justification !== "string") {
    throw new Error(`emitClaim: prior_justification must be a non-empty string (label=${label})`);
  }
  const metaWithJustification = { prior_justification, ...metadata };

  const titleClause = title ? `\n    title=${pythonString(title)},` : "";
  return [
    `${label} = claim(`,
    `    ${pythonString(content)},`,
    `    prior=${formatBetaPrior(prior)},${titleClause}`,
    `    metadata=${formatMetadataDict(metaWithJustification, 8)},`,
    `)`,
  ].join("\n");
}

// --------------------------------------------------------------------------- //
// strategies (kwargs style)                                                    //
// --------------------------------------------------------------------------- //

function emitStrategy(kind, { resultLabel, kwargs, reason, prior }) {
  validateReasonPriorPairing(reason, prior);
  const lines = [];
  for (const [k, v] of Object.entries(kwargs)) {
    if (Array.isArray(v)) {
      v.forEach(validateLabel);
      lines.push(`    ${k}=[${v.join(", ")}],`);
    } else {
      validateLabel(v);
      lines.push(`    ${k}=${v},`);
    }
  }
  if (reason !== undefined && reason !== null && reason !== "") {
    lines.push(`    reason=${pythonString(reason)},`);
    lines.push(`    prior=${formatBetaPrior(prior)},`);
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
    resultLabel,
    kwargs: { premises: premiseLabels, conclusion: conclusionLabel },
    reason,
    prior,
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
    resultLabel,
    kwargs: { premises: premiseLabels, conclusion: conclusionLabel },
    reason,
    prior,
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
  return emitStrategy("induction", {
    resultLabel,
    kwargs: { support_1: support1Label, support_2: support2Label, law: lawLabel },
    reason,
    prior,
  });
}

// --------------------------------------------------------------------------- //
// operators (positional style; reason/prior still allowed but paired)
// --------------------------------------------------------------------------- //

function emitOperator(kind, { positional, reason, prior, resultLabel = null }) {
  validateReasonPriorPairing(reason, prior);
  positional.forEach(validateLabel);
  const args = positional.slice();
  let body;
  if (reason !== undefined && reason !== null && reason !== "") {
    body = [
      ...args.map((a) => `    ${a},`),
      `    reason=${pythonString(reason)},`,
      `    prior=${formatBetaPrior(prior)},`,
    ].join("\n");
  } else {
    body = args.map((a) => `    ${a},`).join("\n");
  }
  const head = resultLabel ? `${resultLabel} = ${kind}(` : `${kind}(`;
  return `${head}\n${body}\n)`;
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
// __all__ helper                                                               //
// --------------------------------------------------------------------------- //

export function emitAllExport(labels) {
  labels.forEach(validateLabel);
  if (labels.length === 0) return `__all__ = []\n`;
  const items = labels.map((l) => `    ${pythonString(l)},`).join("\n");
  return `__all__ = [\n${items}\n]\n`;
}

// --------------------------------------------------------------------------- //

export const _internals = { LABEL_RE, RESERVED, indentBlock, formatMetadataDict };
