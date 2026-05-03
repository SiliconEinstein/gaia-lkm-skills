#!/usr/bin/env node
import fs from "node:fs/promises";

const DEBUG = process.env.LKM_DEBUG_INTERNAL === "1";
const BASE_URL = DEBUG
  ? "https://lkm.bohrium.com/api/v1"
  : "https://open.bohrium.com/openapi/v1/lkm";

function usage() {
  const lines = [
    "Usage:",
    '  lkm.mjs match     --text "terms" [--top-k 10] [--out file]',
    "  lkm.mjs evidence  --id CLAIM_ID [--max-chains 10] [--sort-by comprehensive] [--out file]",
    "  lkm.mjs variables --ids id1,id2,... [--out file]",
  ];
  if (DEBUG) {
    lines.push("  lkm.mjs papers-ocr --paper-ids id1,id2,... [--out file]");
  }
  lines.push("");
  lines.push("Auth: every request requires a Bohrium access key in the LKM_ACCESS_KEY env var.");
  console.log(`${lines.join("\n")}\n`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function getAccessKey() {
  const ak = process.env.LKM_ACCESS_KEY;
  if (!ak) {
    throw new Error(
      "LKM_ACCESS_KEY is not set. Ask the user for their Bohrium access key, then export it in this shell session: `export LKM_ACCESS_KEY=<key>`. Do not commit the key to any file in the repo."
    );
  }
  return ak;
}

function authHeaders(extra = {}) {
  if (DEBUG) {
    return {
      accept: "*/*",
      ...extra,
    };
  }
  return {
    accessKey: getAccessKey(),
    accept: "*/*",
    ...extra,
  };
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw_text: text };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url}`);
    err.response = json;
    throw err;
  }
  return json;
}

async function writeResult(result, outPath) {
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (outPath) {
    await fs.writeFile(outPath, text);
  } else {
    process.stdout.write(text);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || args.help) {
    usage();
    return;
  }

  if (command === "match") {
    if (!args.text) throw new Error("Missing --text");
    const topK = Number(args["top-k"] || 10);
    const result = await fetchJson(`${BASE_URL}/claims/match`, {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        text: args.text,
        top_k: topK,
        filters: { visibility: "public" },
      }),
    });
    await writeResult(result, args.out);
    return;
  }

  if (command === "evidence") {
    if (!args.id) throw new Error("Missing --id");
    const maxChains = Number(args["max-chains"] || 10);
    const sortBy = args["sort-by"] || "comprehensive";
    const url = `${BASE_URL}/claims/${encodeURIComponent(args.id)}/evidence?max_chains=${maxChains}&sort_by=${encodeURIComponent(sortBy)}`;
    const result = await fetchJson(url, { headers: authHeaders() });
    await writeResult(result, args.out);
    return;
  }

  if (command === "variables") {
    if (!args.ids) throw new Error("Missing --ids (comma-separated)");
    const ids = args.ids.split(",").map((s) => s.trim());
    const result = await fetchJson(`${BASE_URL}/variables/batch`, {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ ids }),
    });
    await writeResult(result, args.out);
    return;
  }

  if (DEBUG && command === "papers-ocr") {
    if (!args["paper-ids"]) throw new Error("Missing --paper-ids (comma-separated)");
    const paperIds = args["paper-ids"].split(",").map((s) => s.trim());
    const result = await fetchJson(`${BASE_URL}/papers/ocr/batch`, {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ paper_ids: paperIds }),
    });
    await writeResult(result, args.out);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.response) console.error(JSON.stringify(error.response, null, 2));
  process.exit(1);
});
