// test_lkm_to_gaia.mjs — primitive-level tests + 1 small integration.
// Pure node built-ins (node:test, node:assert). Run with:
//   node --test skills/lkm-to-gaia/scripts/test_lkm_to_gaia.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadRunFolder,
  resolvePointer,
  iterateRoots,
  iterateAllFactors,
  collectPremises,
  collectPapers,
  loadPair,
  resolvePairClaim,
  classifyEquivalenceLineage,
} from "./lkm_io.mjs";

import {
  betaForPremise,
  betaForEquivalence,
  betaForContradiction,
  validateBetaPrior,
} from "./prior_heuristic.mjs";

import {
  validateLabel,
  validateReasonPriorPairing,
  mintLabel,
  pythonString,
  formatBetaPrior,
  emitClaim,
  emitDeduction,
  emitSupport,
  emitInduction,
  emitContradiction,
  emitEquivalence,
  emitDisjunction,
  emitAllExport,
  IMPORTS_BLOCK,
} from "./dsl_emit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures/sample_run_folder");

// --------------------------------------------------------------------------- //
// resolvePointer                                                               //
// --------------------------------------------------------------------------- //

test("resolvePointer: empty pointer returns root", () => {
  assert.deepEqual(resolvePointer({ a: 1 }, ""), { a: 1 });
});

test("resolvePointer: descends into objects and arrays", () => {
  const json = { data: { items: [{ x: 10 }, { x: 20 }] } };
  assert.equal(resolvePointer(json, "/data/items/1/x"), 20);
});

test("resolvePointer: handles ~0 / ~1 escapes", () => {
  const json = { "a/b": { "c~d": 7 } };
  assert.equal(resolvePointer(json, "/a~1b/c~0d"), 7);
});

test("resolvePointer: throws on missing key", () => {
  assert.throws(() => resolvePointer({ a: 1 }, "/b"), /missing key/);
});

test("resolvePointer: throws on out-of-range index", () => {
  assert.throws(() => resolvePointer({ items: [1, 2] }, "/items/5"), /out of range/);
});

// --------------------------------------------------------------------------- //
// loadRunFolder + iterators                                                    //
// --------------------------------------------------------------------------- //

test("loadRunFolder: loads fixture without error", async () => {
  const rf = await loadRunFolder(FIXTURE);
  assert.equal(rf.schemaVersion, "evidence-graph-run/2.0");
  assert.equal(rf.selectedRootId, "gcn_root_a");
  assert.equal(rf.discoveryPerformed, true);
  assert.equal(rf.evidence.size, 2);
  assert.equal(rf.matches.size, 1);
});

test("loadRunFolder: rejects non-existent folder", async () => {
  await assert.rejects(
    loadRunFolder(path.join(FIXTURE, "no-such-folder")),
    /not found or not a directory/
  );
});

test("iterateRoots: yields both roots, marks selected", async () => {
  const rf = await loadRunFolder(FIXTURE);
  const roots = [...iterateRoots(rf)];
  assert.equal(roots.length, 2);
  const a = roots.find((r) => r.rootId === "gcn_root_a");
  const b = roots.find((r) => r.rootId === "gcn_root_b");
  assert.ok(a && b);
  assert.equal(a.isSelected, true);
  assert.equal(b.isSelected, false);
  assert.equal(a.chains.length, 2);
  assert.equal(b.chains.length, 1);
});

test("iterateAllFactors: yields all factors across all roots", async () => {
  const rf = await loadRunFolder(FIXTURE);
  const facts = [...iterateAllFactors(rf)];
  assert.equal(facts.length, 3);
  const ids = facts.map((f) => f.factorId).sort();
  assert.deepEqual(ids, ["gfac_a1", "gfac_a2", "gfac_b1"]);
});

test("collectPremises: dedupes shared premise across chains", async () => {
  const rf = await loadRunFolder(FIXTURE);
  const premises = collectPremises(rf);
  // gcn_phonon_pairing appears in both gfac_a1 and gfac_a2
  const phonon = premises.get("gcn_phonon_pairing");
  assert.ok(phonon);
  const phononFactorIds = phonon.occurrences
    .filter((o) => o.role === "premise")
    .map((o) => o.factorId)
    .sort();
  assert.deepEqual(phononFactorIds, ["gfac_a1", "gfac_a2"]);
  // gcn_unexpanded_premise has empty content
  const unexpanded = premises.get("gcn_unexpanded_premise");
  assert.ok(unexpanded);
  assert.equal(unexpanded.content, "");
});

test("collectPapers: merges across evidence + match files", async () => {
  const rf = await loadRunFolder(FIXTURE);
  const papers = collectPapers(rf);
  // Four unique papers across the fixture:
  //   paper:p_an2001     (evidence_a + match)
  //   paper:p_choi2002   (evidence_a only)
  //   paper:p_xrd2003    (evidence_b + match)
  //   paper:p_pressure2004 (match only)
  assert.equal(papers.size, 4);
  assert.ok(papers.has("paper:p_an2001"));
  assert.ok(papers.has("paper:p_choi2002"));
  assert.ok(papers.has("paper:p_xrd2003"));
  assert.ok(papers.has("paper:p_pressure2004"));
});

test("loadPair + resolvePairClaim: roundtrip pair-claim provenance", async () => {
  const rf = await loadRunFolder(FIXTURE);
  const eqs = loadPair(rf, "equivalences");
  assert.equal(eqs.length, 1);
  const sides = eqs[0].claims.map((c) => resolvePairClaim(rf, c));
  assert.equal(sides[0].id, "gcn_root_a");
  assert.equal(sides[1].id, "gcn_root_b");
});

test("classifyEquivalenceLineage: catches independent_experimental", () => {
  assert.equal(
    classifyEquivalenceLineage({ rationale: "lineage=independent_experimental" }),
    "independent_experimental"
  );
});

test("classifyEquivalenceLineage: catches same paper, different version", () => {
  assert.equal(
    classifyEquivalenceLineage({ rationale: "Lineage: same paper, different version" }),
    "same_paper_different_version"
  );
});

test("classifyEquivalenceLineage: defaults to unclassified", () => {
  assert.equal(classifyEquivalenceLineage({ rationale: "no clear signal" }), "unclassified");
});

// --------------------------------------------------------------------------- //
// prior_heuristic                                                              //
// --------------------------------------------------------------------------- //

test("validateBetaPrior: accepts valid Beta", () => {
  assert.equal(validateBetaPrior([18, 2]), true);
  assert.equal(validateBetaPrior([1, 1]), true);
});

test("validateBetaPrior: rejects shape errors", () => {
  assert.throws(() => validateBetaPrior([1]), /\[a, b\]/);
  assert.throws(() => validateBetaPrior([0, 5]), /strictly positive/);
  assert.throws(() => validateBetaPrior([1, 0]), /strictly positive/);
  assert.throws(() => validateBetaPrior([-1, 5]), /strictly positive/);
});

test("validateBetaPrior: enforces Cromwell bounds", () => {
  assert.throws(() => validateBetaPrior([1000, 0.0001]), /Cromwell/);
});

test("betaForPremise: empty content -> [1,1] + Cromwell-safe", () => {
  const r = betaForPremise({ content: "" });
  assert.deepEqual(r.prior, [1, 1]);
  assert.equal(r.tag, "empty_content");
  assert.match(r.justification, /Cromwell-safe/);
});

test("betaForPremise: experimental keyword -> [18,2]", () => {
  const r = betaForPremise({ content: "Sample held at ambient pressure; XRD-coupled four-probe resistivity measurement." });
  assert.deepEqual(r.prior, [18, 2]);
  assert.equal(r.tag, "experimental_observation");
});

test("betaForPremise: computational keyword -> [16,4]", () => {
  const r = betaForPremise({ content: "Eliashberg-equation fit yields lambda = 0.87 for MgB2." });
  assert.deepEqual(r.prior, [16, 4]);
  assert.equal(r.tag, "computational_result");
});

test("betaForPremise: lkmScore tightens experimental prior", () => {
  const r = betaForPremise({
    content: "Direct measurement of resistivity",
    lkmScore: 0.95,
  });
  // base [18, 2] -> [19, 1]
  assert.deepEqual(r.prior, [19, 1]);
});

test("betaForPremise: lkmScore loosens marginal prior", () => {
  const r = betaForPremise({
    content: "Direct measurement of resistivity",
    lkmScore: 0.40,
  });
  // base [18, 2] -> [17, 3]
  assert.deepEqual(r.prior, [17, 3]);
});

test("betaForEquivalence: lineage tag mapping", () => {
  assert.deepEqual(betaForEquivalence({ lineageTag: "independent_experimental" }).prior, [19, 1]);
  assert.deepEqual(betaForEquivalence({ lineageTag: "independent_theoretical" }).prior, [16, 4]);
  assert.deepEqual(betaForEquivalence({ lineageTag: "cross_paradigm" }).prior, [19, 1]);
  assert.deepEqual(betaForEquivalence({ lineageTag: "unclassified" }).prior, [10, 10]);
  assert.deepEqual(betaForEquivalence({ lineageTag: "wholly_unknown" }).prior, [10, 10]);
});

test("betaForContradiction: weighted by hypothesized causes", () => {
  const r = betaForContradiction({ hypothesizedCauses: ["evidence_reliability", "measurement_protocol"] });
  // mean weight = (0.95 + 0.92)/2 = 0.935 -> a/(a+b) ~ 0.935 over total 20
  validateBetaPrior(r.prior);
  const mean = r.prior[0] / (r.prior[0] + r.prior[1]);
  assert.ok(mean > 0.85 && mean < 0.99);
});

test("betaForContradiction: empty causes -> neutral", () => {
  const r = betaForContradiction({ hypothesizedCauses: [] });
  assert.deepEqual(r.prior, [10, 10]);
  assert.equal(r.tag, "no_cause");
});

// --------------------------------------------------------------------------- //
// dsl_emit: validators                                                         //
// --------------------------------------------------------------------------- //

test("validateLabel: accepts snake_case", () => {
  assert.equal(validateLabel("phonon_pairing"), true);
  assert.equal(validateLabel("_alt"), true);
  assert.equal(validateLabel("a"), true);
});

test("validateLabel: rejects uppercase / spaces / punctuation", () => {
  assert.throws(() => validateLabel("PhononPairing"), /Invalid Gaia DSL label/);
  assert.throws(() => validateLabel("phonon pairing"), /Invalid Gaia DSL label/);
  assert.throws(() => validateLabel("phonon-pairing"), /Invalid Gaia DSL label/);
  assert.throws(() => validateLabel(""), /Invalid Gaia DSL label/);
});

test("validateReasonPriorPairing: both or neither", () => {
  assert.equal(validateReasonPriorPairing(null, null), true);
  assert.equal(validateReasonPriorPairing("because", [9, 1]), true);
  assert.throws(() => validateReasonPriorPairing("because", null), /must be paired/);
  assert.throws(() => validateReasonPriorPairing(null, [9, 1]), /must be paired/);
});

test("mintLabel: sanitises raw ids", () => {
  assert.equal(mintLabel("gcn_phonon_pairing"), "gcn_phonon_pairing");
  assert.equal(mintLabel("Gcn-PHONON_pairing"), "gcn_phonon_pairing");
  assert.equal(mintLabel("paper:p_an2001"), "paper_p_an2001");
  assert.equal(mintLabel("123start"), "_123start");
  assert.equal(mintLabel(""), "anon");
});

test("mintLabel: avoids reserved Python / DSL words", () => {
  assert.equal(mintLabel("class"), "class_");
  assert.equal(mintLabel("deduction"), "deduction_");
  assert.equal(mintLabel("equivalence"), "equivalence_");
});

test("pythonString: escapes backslash and double-quote", () => {
  assert.equal(pythonString('a"b\\c'), '"a\\"b\\\\c"');
});

test("pythonString: switches to triple-quoted on newline", () => {
  const s = "line1\nline2";
  const out = pythonString(s);
  assert.ok(out.startsWith('"""'));
  assert.ok(out.endsWith('"""'));
});

test("formatBetaPrior: returns Python list literal", () => {
  assert.equal(formatBetaPrior([18, 2]), "[18, 2]");
});

// --------------------------------------------------------------------------- //
// dsl_emit: emitters                                                           //
// --------------------------------------------------------------------------- //

test("emitClaim: includes content, prior, prior_justification, label", () => {
  const out = emitClaim({
    label: "phonon_pairing",
    content: "Phonon-mediated pairing dominates in MgB2.",
    prior: [16, 4],
    prior_justification: "computational result; source=paper:p_an2001",
  });
  assert.match(out, /^phonon_pairing = claim\(/);
  assert.match(out, /"Phonon-mediated pairing dominates in MgB2."/);
  assert.match(out, /prior=\[16, 4\]/);
  assert.match(out, /"prior_justification"/);
});

test("emitClaim: rejects missing prior_justification", () => {
  assert.throws(
    () =>
      emitClaim({
        label: "x",
        content: "y",
        prior: [1, 1],
      }),
    /prior_justification must be a non-empty string/
  );
});

test("emitDeduction: kwargs-style with no warrant prior", () => {
  const out = emitDeduction({
    premiseLabels: ["a", "b"],
    conclusionLabel: "t",
  });
  assert.match(out, /^deduction\(/);
  assert.match(out, /premises=\[a, b\]/);
  assert.match(out, /conclusion=t/);
  assert.doesNotMatch(out, /reason=/);
  assert.doesNotMatch(out, /prior=/);
});

test("emitDeduction: with reason+prior pair", () => {
  const out = emitDeduction({
    premiseLabels: ["a"],
    conclusionLabel: "t",
    reason: "by axiom",
    prior: [9, 1],
  });
  assert.match(out, /reason="by axiom"/);
  assert.match(out, /prior=\[9, 1\]/);
});

test("emitDeduction: reject reason without prior", () => {
  assert.throws(
    () => emitDeduction({ premiseLabels: ["a"], conclusionLabel: "t", reason: "x" }),
    /must be paired/
  );
});

test("emitDeduction: reject empty premise list", () => {
  assert.throws(
    () => emitDeduction({ premiseLabels: [], conclusionLabel: "t" }),
    /non-empty list/
  );
});

test("emitSupport: kwargs-style", () => {
  const out = emitSupport({ premiseLabels: ["law"], conclusionLabel: "obs" });
  assert.match(out, /^support\(/);
  assert.match(out, /premises=\[law\]/);
  assert.match(out, /conclusion=obs/);
});

test("emitInduction: support_1 / support_2 / law kwargs + result label", () => {
  const out = emitInduction({
    support1Label: "s_a",
    support2Label: "s_b",
    lawLabel: "law",
    resultLabel: "ind_law",
  });
  assert.match(out, /^ind_law = induction\(/);
  assert.match(out, /support_1=s_a/);
  assert.match(out, /support_2=s_b/);
  assert.match(out, /law=law/);
});

test("emitContradiction: positional, no premises/conclusion kwargs", () => {
  const out = emitContradiction({ a: "x", b: "y" });
  assert.match(out, /^contradiction\(/);
  assert.doesNotMatch(out, /premises=/);
  assert.doesNotMatch(out, /conclusion=/);
});

test("emitEquivalence: with reason+prior pair", () => {
  const out = emitEquivalence({
    a: "x",
    b: "y",
    reason: "independent confirmation",
    prior: [19, 1],
  });
  assert.match(out, /^equivalence\(/);
  assert.match(out, /reason="independent confirmation"/);
  assert.match(out, /prior=\[19, 1\]/);
});

test("emitDisjunction: needs >= 2 members", () => {
  assert.throws(
    () => emitDisjunction({ members: ["x"] }),
    />= 2 labels/
  );
  const out = emitDisjunction({ members: ["x", "y", "z"] });
  assert.match(out, /^disjunction\(/);
  assert.match(out, /\s+x,\s+y,\s+z,/s);
});

test("emitAllExport: __all__ list of labels", () => {
  const out = emitAllExport(["a", "b"]);
  assert.match(out, /^__all__ = \[/);
  assert.match(out, /"a",/);
  assert.match(out, /"b",/);
});

// --------------------------------------------------------------------------- //
// integration: build a small Python source from the fixture
// --------------------------------------------------------------------------- //

test("integration: fixture -> well-formed Python source (lexical sanity)", async () => {
  const rf = await loadRunFolder(FIXTURE);
  const premises = collectPremises(rf);

  // Mint stable labels for every collected gcn_*.
  const labelById = new Map();
  for (const id of premises.keys()) labelById.set(id, mintLabel(id));

  const fragments = [IMPORTS_BLOCK, ""];

  for (const [id, p] of premises) {
    const ph = betaForPremise({ content: p.content });
    fragments.push(
      emitClaim({
        label: labelById.get(id),
        content: p.content || `(LKM premise ${id}; content unavailable in corpus)`,
        prior: ph.prior,
        prior_justification: ph.justification,
        metadata: { provenance: "lkm", lkm_id: id },
      })
    );
  }

  for (const fac of iterateAllFactors(rf)) {
    fragments.push(
      emitDeduction({
        premiseLabels: fac.premises.map((pp) => labelById.get(pp.id)),
        conclusionLabel: labelById.get(fac.conclusion.id),
      })
    );
  }

  const source = fragments.join("\n\n");

  // Lexical sanity: balanced parens and brackets.
  const counts = (s, ch) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
  assert.equal(counts(source, "("), counts(source, ")"));
  assert.equal(counts(source, "["), counts(source, "]"));
  assert.equal(counts(source, "{"), counts(source, "}"));

  // Spot-check structural fragments.
  assert.match(source, /from gaia\.lang import/);
  assert.match(source, /gcn_phonon_pairing = claim\(/);
  assert.match(source, /deduction\(\n\s+premises=\[gcn_phonon_pairing, gcn_two_band\],\n\s+conclusion=gcn_root_a,\n\)/);
  assert.match(source, /deduction\(\n\s+premises=\[gcn_phonon_pairing, gcn_eliashberg_fit\],\n\s+conclusion=gcn_root_a,\n\)/);
  // Empty-content premise produces a placeholder claim.
  assert.match(source, /gcn_unexpanded_premise = claim\(\n\s+"\(LKM premise gcn_unexpanded_premise; content unavailable in corpus\)"/);
});
