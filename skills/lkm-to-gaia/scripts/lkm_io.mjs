// lkm_io.mjs — load and walk an `evidence-graph-run/2.0` run-folder.
//
// Pure I/O + validation + typed iteration over the artefacts produced by
// `$evidence-subgraph`. Knows nothing about Gaia DSL.
//
// Public surface (importable):
//   loadRunFolder(path)              -> RunFolder
//   resolvePointer(json, rfc6901)    -> any  (RFC 6901 JSON Pointer resolver)
//   iterateRoots(rf)                 -> { rootId, evidenceFile, claim, sourcePapers, chains }[]
//   iterateAllFactors(rf)            -> { factorId, subtype, sourcePackage, premises[], conclusion, root }[]
//   collectPremises(rf)              -> Map<gcnId, { id, content, occurrences[] }>
//   collectPapers(rf)                -> Map<paperId, paperMetadata>
//   loadPair(rf, kind)               -> Pair[]   kind ∈ {"contradictions","equivalences","crossValidation","dismissed"}
//
// Hard contract: schema_version must be exactly "evidence-graph-run/2.0";
// older or newer versions throw with a clear message.

import fs from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = "evidence-graph-run/2.0";

const PAIR_FILES = {
  contradictions: "contradictions.json",
  equivalences: "equivalences.json",
  crossValidation: "cross_validation.json",
  dismissed: "dismissed_pairs.json",
};

// --------------------------------------------------------------------------- //
// RFC 6901 JSON Pointer (subset; supports /-separated paths and ~0 / ~1 escapes)
// --------------------------------------------------------------------------- //

export function resolvePointer(root, pointer) {
  if (pointer === "" || pointer === "/") return root;
  if (!pointer.startsWith("/")) {
    throw new Error(`RFC 6901 pointer must start with '/' (got: ${JSON.stringify(pointer)})`);
  }
  const tokens = pointer
    .slice(1)
    .split("/")
    .map((t) => t.replaceAll("~1", "/").replaceAll("~0", "~"));
  let cursor = root;
  for (const t of tokens) {
    if (cursor === null || cursor === undefined) {
      throw new Error(`RFC 6901 pointer ${pointer} dereferenced through null/undefined at token ${t}`);
    }
    if (Array.isArray(cursor)) {
      const idx = Number(t);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) {
        throw new Error(`RFC 6901 pointer ${pointer}: array index ${t} out of range (len=${cursor.length})`);
      }
      cursor = cursor[idx];
    } else if (typeof cursor === "object") {
      if (!Object.prototype.hasOwnProperty.call(cursor, t)) {
        throw new Error(`RFC 6901 pointer ${pointer}: missing key ${JSON.stringify(t)}`);
      }
      cursor = cursor[t];
    } else {
      throw new Error(`RFC 6901 pointer ${pointer}: cannot descend into ${typeof cursor} at token ${t}`);
    }
  }
  return cursor;
}

// --------------------------------------------------------------------------- //
// Loader                                                                       //
// --------------------------------------------------------------------------- //

async function readJson(p) {
  const text = await fs.readFile(p, "utf8");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse JSON at ${p}: ${e.message}`);
  }
}

function checkSchemaVersion(json, file) {
  const v = json && json.schema_version;
  if (v !== SCHEMA_VERSION) {
    throw new Error(
      `Schema mismatch in ${file}: expected schema_version=${JSON.stringify(SCHEMA_VERSION)}, got ${JSON.stringify(v)}`
    );
  }
}

export async function loadRunFolder(folderPath) {
  const root = path.resolve(folderPath);
  const stat = await fs.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Run-folder not found or not a directory: ${root}`);
  }

  // 1. graph
  const graphPath = path.join(root, "evidence_graph.json");
  const graph = await readJson(graphPath);
  checkSchemaVersion(graph, graphPath);

  // 2. raw evidence files
  const rawDir = path.join(root, "raw");
  const rawFiles = (graph.raw_files && graph.raw_files.evidence) || [];
  if (rawFiles.length === 0) {
    throw new Error(`evidence_graph.json declares no evidence files under raw_files.evidence`);
  }
  const evidenceByFile = new Map();
  for (const fname of rawFiles) {
    const p = path.join(rawDir, fname);
    const json = await readJson(p);
    if (json.code !== 0) {
      throw new Error(`Evidence ${fname} carries non-zero LKM code=${json.code}; cannot use as input`);
    }
    if (!json.data || !json.data.claim || !json.data.evidence_chains) {
      throw new Error(`Evidence ${fname} missing data.claim or data.evidence_chains`);
    }
    evidenceByFile.set(fname, json);
  }

  // 3. selected root must be one of them
  const rootEvidenceFile = rawFiles.find((f) => {
    const j = evidenceByFile.get(f);
    return j && j.data && j.data.claim && j.data.claim.id === graph.selected_root_id;
  });
  if (!rootEvidenceFile) {
    throw new Error(
      `evidence_graph.json.selected_root_id=${graph.selected_root_id} does not match any raw/evidence_*.json claim id`
    );
  }

  // 4. pair files (all four required, may be empty)
  const pairs = {};
  for (const [key, fname] of Object.entries(PAIR_FILES)) {
    const p = path.join(root, fname);
    const json = await readJson(p);
    checkSchemaVersion(json, p);
    if (!Array.isArray(json.pairs)) {
      throw new Error(`${fname} missing 'pairs' array`);
    }
    pairs[key] = json.pairs;
  }

  // 5. match files (optional, present iff discovery was performed)
  const matchFiles = (graph.raw_files && graph.raw_files.match) || [];
  const matchByFile = new Map();
  for (const fname of matchFiles) {
    const p = path.join(rawDir, fname);
    const json = await readJson(p);
    matchByFile.set(fname, json);
  }

  return {
    folderPath: root,
    schemaVersion: SCHEMA_VERSION,
    selectedRootId: graph.selected_root_id,
    discoveryPerformed: !!graph.discovery_performed,
    graph,
    evidence: evidenceByFile, // file -> raw json
    matches: matchByFile, // file -> raw json
    pairs, // {contradictions, equivalences, crossValidation, dismissed}
  };
}

// --------------------------------------------------------------------------- //
// Iterators                                                                    //
// --------------------------------------------------------------------------- //

export function* iterateRoots(rf) {
  for (const [file, j] of rf.evidence) {
    const claim = j.data.claim;
    const sourcePapers = Object.keys(j.data.papers || {});
    const chains = j.data.evidence_chains || [];
    yield {
      rootId: claim.id,
      isSelected: claim.id === rf.selectedRootId,
      evidenceFile: file,
      claim,
      sourcePapers,
      chains,
    };
  }
}

export function* iterateAllFactors(rf) {
  for (const root of iterateRoots(rf)) {
    for (let ci = 0; ci < root.chains.length; ci += 1) {
      const chain = root.chains[ci];
      const sourcePackage = chain.source_package;
      for (let fi = 0; fi < (chain.factors || []).length; fi += 1) {
        const fac = chain.factors[fi];
        yield {
          factorId: fac.id,
          subtype: fac.subtype,
          factorType: fac.factor_type,
          sourcePackage,
          premises: fac.premises || [],
          conclusion: fac.conclusion,
          steps: fac.steps || null,
          rootId: root.rootId,
          evidenceFile: root.evidenceFile,
          chainIndex: ci,
          factorIndex: fi,
        };
      }
    }
  }
}

// Collect every distinct premise (and conclusion) across the run-folder,
// keyed by gcn_* id. Records every (factorId, role) it appears in so we can
// dedup mechanically and surface candidate semantic-equivalents later.
export function collectPremises(rf) {
  const out = new Map(); // gcnId -> {id, content, occurrences:[{factorId, role, sourcePackage, evidenceFile}]}
  function note(gcn, content, role, ctx) {
    if (!gcn) return;
    let entry = out.get(gcn);
    if (!entry) {
      entry = { id: gcn, content: content || "", occurrences: [] };
      out.set(gcn, entry);
    } else if (!entry.content && content) {
      // backfill content if a later occurrence has it
      entry.content = content;
    }
    entry.occurrences.push({ role, ...ctx });
  }
  for (const fac of iterateAllFactors(rf)) {
    for (const p of fac.premises) {
      note(p.id, p.content, "premise", {
        factorId: fac.factorId,
        sourcePackage: fac.sourcePackage,
        evidenceFile: fac.evidenceFile,
      });
    }
    if (fac.conclusion && fac.conclusion.id) {
      note(fac.conclusion.id, fac.conclusion.content, "conclusion", {
        factorId: fac.factorId,
        sourcePackage: fac.sourcePackage,
        evidenceFile: fac.evidenceFile,
      });
    }
  }
  return out;
}

export function collectPapers(rf) {
  const out = new Map();
  for (const [, j] of rf.evidence) {
    const papers = j.data.papers || {};
    for (const [k, v] of Object.entries(papers)) {
      if (!out.has(k)) out.set(k, v);
    }
  }
  for (const [, j] of rf.matches) {
    const papers = (j.data && j.data.papers) || {};
    for (const [k, v] of Object.entries(papers)) {
      if (!out.has(k)) out.set(k, v);
    }
  }
  return out;
}

export function loadPair(rf, kind) {
  if (!Object.prototype.hasOwnProperty.call(rf.pairs, kind)) {
    throw new Error(
      `Unknown pair kind ${JSON.stringify(kind)}; allowed: ${Object.keys(rf.pairs).join(", ")}`
    );
  }
  return rf.pairs[kind];
}

// --------------------------------------------------------------------------- //
// Pair-record provenance (resolves both sides into raw JSON via RFC 6901)
// --------------------------------------------------------------------------- //

export function resolvePairClaim(rf, claimSide) {
  const fname = claimSide.file;
  // claim side may live under raw/ (evidence_*.json or match_*.json)
  const fromEvidence = rf.evidence.get(fname);
  const fromMatch = rf.matches.get(fname);
  const root = fromEvidence || fromMatch;
  if (!root) {
    throw new Error(
      `Pair claim file ${fname} not found in run-folder; expected under raw/ and registered in evidence_graph.json.raw_files`
    );
  }
  return resolvePointer(root, claimSide.pointer);
}

// --------------------------------------------------------------------------- //
// Equivalence lineage extractor (lineage may live in `rationale` or a sibling)
// --------------------------------------------------------------------------- //

const LINEAGE_PATTERNS = [
  { tag: "same_paper_different_version", re: /same\s*paper,?\s*different\s*version/i },
  { tag: "independent_experimental", re: /independent[\s_-]+experimental/i },
  { tag: "independent_theoretical", re: /independent[\s_-]+theoretical/i },
  { tag: "cross_paradigm", re: /cross[\s_-]+paradigm/i },
  { tag: "unclassified", re: /unclassified/i },
];

export function classifyEquivalenceLineage(pair) {
  const text = `${pair.lineage || ""} ${pair.rationale || ""}`;
  for (const { tag, re } of LINEAGE_PATTERNS) {
    if (re.test(text)) return tag;
  }
  return "unclassified";
}

// --------------------------------------------------------------------------- //

export const _internals = { SCHEMA_VERSION, PAIR_FILES, LINEAGE_PATTERNS };
