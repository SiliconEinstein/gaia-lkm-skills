// _smoke_emit.mjs — quick smoke: build a Python source from the fixture and
// print it to stdout. Used by the dev for eyeballing + by the Python AST
// sanity-check (see test_lkm_to_gaia.mjs integration test for the in-Node
// lexical version). Not required at runtime; safe to delete.
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadRunFolder, collectPremises, collectPapers, iterateAllFactors, loadPair, classifyEquivalenceLineage,
} from "./lkm_io.mjs";
import { betaForPremise, betaForEquivalence, betaForContradiction } from "./prior_heuristic.mjs";
import {
  IMPORTS_BLOCK, mintLabel, emitClaim, emitDeduction,
  emitSupport, emitInduction, emitEquivalence, emitContradiction, emitAllExport,
} from "./dsl_emit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const folder = process.argv[2] || path.join(__dirname, "fixtures/sample_run_folder");
const rf = await loadRunFolder(folder);

const premises = collectPremises(rf);
const labelById = new Map();
for (const id of premises.keys()) labelById.set(id, mintLabel(id));

const out = [IMPORTS_BLOCK, ""];

// claims
for (const [id, p] of premises) {
  const ph = betaForPremise({ content: p.content });
  out.push(emitClaim({
    label: labelById.get(id),
    content: p.content || `(LKM premise ${id}; content unavailable in corpus)`,
    prior: ph.prior,
    prior_justification: ph.justification,
    metadata: { provenance: "lkm", lkm_id: id },
  }));
}

// chain backbone (always deduction)
for (const fac of iterateAllFactors(rf)) {
  out.push(emitDeduction({
    premiseLabels: fac.premises.map((pp) => labelById.get(pp.id)),
    conclusionLabel: labelById.get(fac.conclusion.id),
  }));
}

// equivalences (skip same-paper-different-version; merge those manually elsewhere)
for (const eq of loadPair(rf, "equivalences")) {
  const lineage = classifyEquivalenceLineage(eq);
  if (lineage === "same_paper_different_version") continue;
  const beta = betaForEquivalence({ lineageTag: lineage });
  out.push(emitEquivalence({
    a: labelById.get(eq.claims[0].claim_id),
    b: labelById.get(eq.claims[1].claim_id),
    reason: `${eq.rationale} (lineage=${lineage})`,
    prior: beta.prior,
  }));
}

// contradictions
for (const ct of loadPair(rf, "contradictions")) {
  // claim sides may live in match_*.json (not a chain root); ensure label exists
  for (const side of ct.claims) {
    if (!labelById.has(side.claim_id)) labelById.set(side.claim_id, mintLabel(side.claim_id));
  }
  const beta = betaForContradiction({ hypothesizedCauses: ct.hypothesized_cause });
  out.push(emitContradiction({
    a: labelById.get(ct.claims[0].claim_id),
    b: labelById.get(ct.claims[1].claim_id),
    reason: `${ct.rationale} | new_question: ${ct.new_question}`,
    prior: beta.prior,
  }));
}

// cross-validation confirm -> support + support + induction
for (const cv of loadPair(rf, "crossValidation")) {
  if (cv.polarity !== "confirm") continue;
  const lawId = cv.claims[0].claim_id;
  const obsId = cv.claims[1].claim_id;
  const lawLabel = labelById.get(lawId);
  const obsLabel = labelById.get(obsId);
  const sLabelA = mintLabel(`s_${lawId}_a`);
  const sLabelB = mintLabel(`s_${lawId}_b`);
  out.push(emitSupport({
    premiseLabels: [lawLabel],
    conclusionLabel: lawLabel,
    resultLabel: sLabelA,
  }));
  out.push(emitSupport({
    premiseLabels: [lawLabel],
    conclusionLabel: obsLabel,
    resultLabel: sLabelB,
  }));
  out.push(emitInduction({
    support1Label: sLabelA,
    support2Label: sLabelB,
    lawLabel: lawLabel,
    reason: `cross-validation: ${cv.independence_basis} | weight: ${cv.scientific_weight}`,
    prior: [19, 1],
  }));
}

// __all__: exported roots only
const exportedLabels = [...rf.evidence.values()].map((j) => labelById.get(j.data.claim.id));
out.push(emitAllExport(exportedLabels));

process.stdout.write(out.join("\n\n"));
