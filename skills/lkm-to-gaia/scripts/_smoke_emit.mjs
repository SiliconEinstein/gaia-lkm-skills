// _smoke_emit.mjs — quick smoke: build a $gaia-lang-clean Python source from
// the fixture run-folder, and a sibling priors.py, and print both to stdout.
// Used by the dev for eyeballing + by the Python AST sanity check. Not a
// production driver; safe to delete.
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadRunFolder,
  collectPremises,
  iterateAllFactors,
  loadPair,
  classifyEquivalenceLineage,
} from "./lkm_io.mjs";
import {
  betaForPremise,
  betaForEquivalence,
  betaForContradiction,
  betaMean,
} from "./prior_heuristic.mjs";
import {
  IMPORTS_BLOCK,
  mintLabel,
  emitClaim,
  emitDeduction,
  emitSupport,
  emitInduction,
  emitEquivalence,
  emitContradiction,
  emitAllExport,
  emitPriorsPyFile,
} from "./dsl_emit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const folder = process.argv[2] || path.join(__dirname, "fixtures/sample_run_folder");
const rf = await loadRunFolder(folder);

const premises = collectPremises(rf);
const labelById = new Map();
for (const id of premises.keys()) labelById.set(id, mintLabel(id));

// Ensure pair-only labels (e.g. contradiction counter-claims that don't appear
// as factor premises in the fixture) are minted too.
for (const ct of loadPair(rf, "contradictions")) {
  for (const side of ct.claims) {
    if (!labelById.has(side.claim_id)) labelById.set(side.claim_id, mintLabel(side.claim_id));
  }
}

const out = [IMPORTS_BLOCK, ""];
const priorsEntries = [];
const conclusionLabels = new Set();

// claims (gaia-lang shape: no prior kwarg, metadata via **kwargs)
for (const [id, p] of premises) {
  const label = labelById.get(id);
  out.push(
    emitClaim({
      label,
      content: p.content || `(LKM premise ${id}; content unavailable in corpus)`,
      metadata: {
        lkm_id: id,
        provenance_source: "lkm",
      },
    })
  );
}

// chain backbone -- always deduction (per design decision 1)
for (const fac of iterateAllFactors(rf)) {
  out.push(
    emitDeduction({
      premiseLabels: fac.premises.map((pp) => labelById.get(pp.id)),
      conclusionLabel: labelById.get(fac.conclusion.id),
    })
  );
  conclusionLabels.add(labelById.get(fac.conclusion.id));
}

// equivalences (skip same-paper-different-version; merge those manually elsewhere)
for (const eq of loadPair(rf, "equivalences")) {
  const lineage = classifyEquivalenceLineage(eq);
  if (lineage === "same_paper_different_version") continue;
  const beta = betaForEquivalence({ lineageTag: lineage });
  out.push(
    emitEquivalence({
      a: labelById.get(eq.claims[0].claim_id),
      b: labelById.get(eq.claims[1].claim_id),
      reason: `${eq.rationale} (lineage=${lineage})`,
      prior: betaMean(beta.prior),
    })
  );
}

// contradictions
for (const ct of loadPair(rf, "contradictions")) {
  const beta = betaForContradiction({ hypothesizedCauses: ct.hypothesized_cause });
  out.push(
    emitContradiction({
      a: labelById.get(ct.claims[0].claim_id),
      b: labelById.get(ct.claims[1].claim_id),
      reason: `${ct.rationale} | new_question: ${ct.new_question}`,
      prior: betaMean(beta.prior),
    })
  );
}

// cross-validation confirm -> support + support + induction (the one exception)
for (const cv of loadPair(rf, "crossValidation")) {
  if (cv.polarity !== "confirm") continue;
  const lawId = cv.claims[0].claim_id;
  const obsId = cv.claims[1].claim_id;
  const lawLabel = labelById.get(lawId);
  const obsLabel = labelById.get(obsId);
  const sLabelA = mintLabel(`s_${lawId}_a`);
  const sLabelB = mintLabel(`s_${lawId}_b`);
  out.push(
    emitSupport({
      premiseLabels: [lawLabel],
      conclusionLabel: lawLabel,
      resultLabel: sLabelA,
      reason: `cross-validation observation A | basis: ${cv.independence_basis}`,
      prior: 0.9,
    })
  );
  out.push(
    emitSupport({
      premiseLabels: [lawLabel],
      conclusionLabel: obsLabel,
      resultLabel: sLabelB,
      reason: `cross-validation observation B | weight: ${cv.scientific_weight}`,
      prior: 0.9,
    })
  );
  out.push(
    emitInduction({
      support1Label: sLabelA,
      support2Label: sLabelB,
      lawLabel,
      reason: `cross-validation: ${cv.independence_basis} | ${cv.scientific_weight}`,
      prior: 0.95,
    })
  );
}

// __all__ -- exported root claims
const exportedLabels = [...rf.evidence.values()].map((j) => labelById.get(j.data.claim.id));
out.push(emitAllExport(exportedLabels));

// priors.py for leaf claims (any claim that is NOT the conclusion of a strategy
// in this run is a leaf and needs a prior). gaia-discovery's `noisy_and`-shaped
// chain backbone makes the conclusions of every gfac_* a non-leaf.
for (const [id, p] of premises) {
  const label = labelById.get(id);
  if (conclusionLabels.has(label)) continue; // not a leaf
  const ph = betaForPremise({ content: p.content });
  priorsEntries.push({
    labelRef: label,
    prior: betaMean(ph.prior),
    justification: ph.justification,
  });
}
// Also pair-only claims that have no chain backbone in the package.
for (const ct of loadPair(rf, "contradictions")) {
  for (const side of ct.claims) {
    const label = labelById.get(side.claim_id);
    if (conclusionLabels.has(label)) continue;
    if (priorsEntries.some((e) => e.labelRef === label)) continue;
    // No content available for match-only claims; use a neutral default with a TODO.
    priorsEntries.push({
      labelRef: label,
      prior: 0.5,
      justification: `pair-only claim with no chain in this package; reviewer must refine; TODO:review`,
    });
  }
}

const planSource = out.join("\n\n");
const priorsSource = emitPriorsPyFile({ entries: priorsEntries });

process.stdout.write(planSource);
process.stdout.write("\n\n# ---- begin priors.py (sibling file) ----\n");
process.stdout.write(priorsSource);
