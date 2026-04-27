#!/usr/bin/env node
import fs from "node:fs/promises";

const DEFAULT_BASE_URL = "https://lkm.test.bohrium.com/api/v1";

function usage() {
  console.log(`Usage:
  lkm.mjs search --query "terms" [--top-k 10] [--base-url URL] [--out file]
  lkm.mjs evidence --id CLAIM_ID [--max-chains 10] [--sort-by comprehensive] [--base-url URL] [--out file]
  lkm.mjs variables --ids id1,id2,... [--base-url URL] [--out file]
  lkm.mjs papers-ocr --ids id1,id2,... [--base-url URL] [--out file]

Optional env: LKM_API_BASE_URL (full base including /api/v1) when --base-url is omitted.
`);
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
  const baseUrl = args["base-url"] || process.env.LKM_API_BASE_URL || DEFAULT_BASE_URL;

  if (!command || args.help) {
    usage();
    return;
  }

  if (command === "search") {
    if (!args.query) throw new Error("Missing --query");
    const topK = Number(args["top-k"] || 10);
    const result = await fetchJson(`${baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: args.query,
        scopes: ["claim", "setting"],
        filters: { visibility: "public" },
        top_k: topK,
      }),
    });
    await writeResult(result, args.out);
    return;
  }

  if (command === "evidence") {
    if (!args.id) throw new Error("Missing --id");
    const maxChains = Number(args["max-chains"] || 10);
    const sortBy = args["sort-by"] || "comprehensive";
    const url = `${baseUrl}/claims/${encodeURIComponent(args.id)}/evidence?max_chains=${maxChains}&sort_by=${encodeURIComponent(sortBy)}`;
    const result = await fetchJson(url);
    await writeResult(result, args.out);
    return;
  }

  if (command === "variables") {
    if (!args.ids) throw new Error("Missing --ids (comma-separated)");
    const ids = args.ids.split(",").map((s) => s.trim());
    const result = await fetchJson(`${baseUrl}/variables/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    await writeResult(result, args.out);
    return;
  }

  if (command === "papers-ocr") {
    if (!args.ids) throw new Error("Missing --ids (comma-separated paper IDs)");
    const paper_ids = args.ids
      .split(",")
      .map((s) => s.trim())
      .map((s) => (s.startsWith("paper:") ? s.slice("paper:".length) : s));
    const result = await fetchJson(`${baseUrl}/papers/ocr/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paper_ids }),
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
