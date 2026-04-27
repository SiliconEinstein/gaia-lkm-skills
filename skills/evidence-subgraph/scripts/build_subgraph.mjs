#!/usr/bin/env node
import fs from "node:fs/promises";

function usage() {
  console.log(`Usage:
  build_subgraph.mjs --evidence file1.json [file2.json ...] [--out graph.dot]

Reads evidence JSON files (output of lkm.mjs evidence) and builds a
Graphviz DOT dependency subgraph from claims, premises, and factors.
`);
}

function parseArgs(argv) {
  const args = { evidence: [], out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help") { usage(); process.exit(0); }
    if (argv[i] === "--out") { args.out = argv[++i]; continue; }
    if (argv[i] === "--evidence") {
      i++;
      while (i < argv.length && !argv[i].startsWith("--")) {
        args.evidence.push(argv[i++]);
      }
      i--;
      continue;
    }
  }
  return args;
}

function truncate(text, max = 60) {
  if (!text) return "(empty)";
  const clean = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

function escDot(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.evidence.length === 0) { usage(); process.exit(1); }

  const nodes = new Map();
  const edges = [];

  for (const file of args.evidence) {
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    const data = raw.data || raw;
    const claim = data.claim;
    if (!claim) continue;

    nodes.set(claim.id, {
      id: claim.id,
      label: truncate(claim.content),
      style: "filled",
      fillcolor: "#e8f4fd",
      shape: "box",
    });

    for (const chain of data.evidence_chains || []) {
      for (const factor of chain.factors || []) {
        const factorNodeId = factor.id;
        nodes.set(factorNodeId, {
          id: factorNodeId,
          label: `${factor.factor_type}/${factor.subtype}`,
          shape: "diamond",
          style: "filled",
          fillcolor: "#fff3e0",
        });

        edges.push({
          from: factorNodeId,
          to: claim.id,
          style: "solid",
          color: "#333333",
          label: "supports",
        });

        for (const premise of factor.premises || []) {
          if (!nodes.has(premise.id)) {
            const isEmpty = !premise.content || premise.content.trim() === "";
            nodes.set(premise.id, {
              id: premise.id,
              label: isEmpty ? "(empty premise)" : truncate(premise.content),
              shape: "box",
              style: isEmpty ? "dashed" : "filled",
              fillcolor: isEmpty ? "#eeeeee" : "#e8f8e8",
              fontcolor: isEmpty ? "#999999" : "#000000",
            });
          }
          edges.push({
            from: premise.id,
            to: factorNodeId,
            style: "solid",
            color: "#333333",
            label: "",
          });
        }
      }
    }
  }

  const lines = ['digraph evidence_subgraph {', '  rankdir=BT;', '  node [fontsize=10, fontname="sans-serif"];', '  edge [fontsize=8, fontname="sans-serif"];', ''];

  for (const n of nodes.values()) {
    const attrs = [];
    attrs.push(`label="${escDot(n.label)}"`);
    if (n.shape) attrs.push(`shape=${n.shape}`);
    if (n.style) attrs.push(`style=${n.style}`);
    if (n.fillcolor) attrs.push(`fillcolor="${n.fillcolor}"`);
    if (n.fontcolor) attrs.push(`fontcolor="${n.fontcolor}"`);
    lines.push(`  "${escDot(n.id)}" [${attrs.join(", ")}];`);
  }

  lines.push('');

  for (const e of edges) {
    const attrs = [];
    if (e.style) attrs.push(`style=${e.style}`);
    if (e.color) attrs.push(`color="${e.color}"`);
    if (e.label) attrs.push(`label="${escDot(e.label)}"`);
    lines.push(`  "${escDot(e.from)}" -> "${escDot(e.to)}" [${attrs.join(", ")}];`);
  }

  lines.push('}', '');
  const dot = lines.join('\n');

  if (args.out) {
    await fs.writeFile(args.out, dot);
  } else {
    process.stdout.write(dot);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
