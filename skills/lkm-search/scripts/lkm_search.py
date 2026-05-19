#!/usr/bin/env python3
"""CLI helper for the Bohrium LKM public search API.

Five verbs: search / reasoning / reasoning-search / variables / papers-graph.
Standard library only — no third-party deps. Reads the access key from the
LKM_ACCESS_KEY env var.

Each invocation forks a detached async subprocess that checks the upstream
GitHub repo for a newer CalVer release tag (best-effort, silent on failure).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE_URL = "https://open.bohrium.com/openapi/v1/lkm"

SKILL_DIR = Path(__file__).resolve().parent.parent
VERSION_MARKER = SKILL_DIR / ".skill-version"
VERSION_NOTIF = SKILL_DIR / ".skill-version-notif"
UPSTREAM_REPO = "https://github.com/SiliconEinstein/gaia-lkm-skills.git"
CALVER_RE = re.compile(r"^v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$")

VALID_SCOPES = {"claim", "question"}
VALID_RETRIEVAL_MODES = {"semantic", "lexical", "hybrid"}


# ---- HTTP infra ----------------------------------------------------------


def get_access_key() -> str:
    ak = os.environ.get("LKM_ACCESS_KEY")
    if not ak:
        raise RuntimeError(
            "LKM_ACCESS_KEY is not set. Export your Bohrium access key: "
            "`export LKM_ACCESS_KEY=<key>`. "
            "Do not commit the key to any file in the repo."
        )
    return ak


def auth_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers: dict[str, str] = {
        "accept": "*/*",
        "accessKey": get_access_key(),
    }
    if extra:
        headers.update(extra)
    return headers


def fetch_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: Any = None,
) -> Any:
    data: bytes | None = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers=headers or {}, method=method
    )
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        status = exc.code
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = {"raw_text": text}
        err = RuntimeError(f"HTTP {status} {url}")
        err.response = payload  # type: ignore[attr-defined]
        raise err
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = {"raw_text": text}
    if not (200 <= status < 300):
        err = RuntimeError(f"HTTP {status} {url}")
        err.response = payload  # type: ignore[attr-defined]
        raise err
    return payload


def write_result(result: Any, out_path: str | None) -> None:
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if out_path:
        Path(out_path).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


# ---- skill auto-update ---------------------------------------------------


def emit_pending_notification() -> None:
    try:
        if VERSION_NOTIF.exists():
            msg = VERSION_NOTIF.read_text(encoding="utf-8").strip()
            if msg:
                sys.stderr.write(f"[lkm-search] {msg}\n")
            VERSION_NOTIF.unlink()
    except Exception:
        pass


def kick_off_async_version_check() -> None:
    try:
        subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "_version_check"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )
    except Exception:
        pass


def run_version_check() -> int:
    try:
        current = ""
        if VERSION_MARKER.exists():
            current = VERSION_MARKER.read_text(encoding="utf-8").strip()

        proc = subprocess.run(
            ["git", "ls-remote", "--tags", UPSTREAM_REPO],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if proc.returncode != 0 or not proc.stdout:
            return 0

        tags: list[str] = []
        for line in proc.stdout.splitlines():
            parts = line.split("refs/tags/", 1)
            if len(parts) != 2:
                continue
            tag = parts[1].strip()
            if tag.endswith("^{}"):
                tag = tag[:-3]
            if CALVER_RE.match(tag):
                tags.append(tag)

        if not tags:
            return 0

        latest = sorted(set(tags))[-1]

        if latest != current:
            VERSION_MARKER.write_text(latest + "\n", encoding="utf-8")
            current_label = current or "none"
            msg = (
                f"new tag {latest} available (current: {current_label}). "
                f"Run: git fetch --tags && git checkout {latest} "
                f"(or update via your skill manager)."
            )
            VERSION_NOTIF.write_text(msg, encoding="utf-8")
        return 0
    except Exception:
        return 0


# ---- verbs ---------------------------------------------------------------


def cmd_search(args: argparse.Namespace) -> None:
    if not args.query:
        raise RuntimeError("Missing --query")
    body: dict[str, Any] = {
        "query": args.query,
        "top_k": args.top_k,
    }
    if args.offset:
        body["offset"] = args.offset
    if args.scopes:
        scopes = [s.strip() for s in args.scopes.split(",")]
        unknown = [s for s in scopes if s not in VALID_SCOPES]
        if unknown:
            raise RuntimeError(
                f"Unknown scope(s) {unknown!r}. Valid: {sorted(VALID_SCOPES)}"
            )
        body["scopes"] = scopes
    if args.retrieval_mode:
        if args.retrieval_mode not in VALID_RETRIEVAL_MODES:
            raise RuntimeError(
                f"Unknown --retrieval-mode {args.retrieval_mode!r}. "
                f"Valid: {sorted(VALID_RETRIEVAL_MODES)}"
            )
        body["retrieval_mode"] = args.retrieval_mode
    if args.keywords:
        body["keywords"] = [k.strip() for k in args.keywords.split(",")]
    if args.reasoning_only:
        body["reasoning_only"] = True
    if args.evidence_only:
        body["evidence_only"] = True
    filters: dict[str, str] = {"visibility": args.visibility}
    if args.role:
        filters["role"] = args.role
    body["filters"] = filters
    result = fetch_json(
        f"{BASE_URL}/search",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body=body,
    )
    write_result(result, args.out)


def cmd_reasoning(args: argparse.Namespace) -> None:
    if not args.id:
        raise RuntimeError("Missing --id")
    claim_id = urllib.parse.quote(args.id, safe="")
    sort_by = urllib.parse.quote(args.sort_by, safe="")
    url = (
        f"{BASE_URL}/claims/{claim_id}/reasoning"
        f"?max_chains={args.max_chains}&sort_by={sort_by}"
    )
    result = fetch_json(url, headers=auth_headers())
    write_result(result, args.out)


def cmd_reasoning_search(args: argparse.Namespace) -> None:
    if not args.query:
        raise RuntimeError("Missing --query")
    body: dict[str, Any] = {
        "query": args.query,
        "limit": args.limit,
    }
    if args.offset:
        body["offset"] = args.offset
    if args.retrieval_mode:
        if args.retrieval_mode not in VALID_RETRIEVAL_MODES:
            raise RuntimeError(
                f"Unknown --retrieval-mode {args.retrieval_mode!r}. "
                f"Valid: {sorted(VALID_RETRIEVAL_MODES)}"
            )
        body["retrieval_mode"] = args.retrieval_mode
    if args.keywords:
        body["keywords"] = [k.strip() for k in args.keywords.split(",")]
    if args.paper_id:
        body["filters"] = {"paper_id": args.paper_id}
    result = fetch_json(
        f"{BASE_URL}/reasoning/search",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body=body,
    )
    write_result(result, args.out)


def cmd_variables(args: argparse.Namespace) -> None:
    if not args.ids:
        raise RuntimeError("Missing --ids (comma-separated)")
    ids = [s.strip() for s in args.ids.split(",")]
    result = fetch_json(
        f"{BASE_URL}/variables/batch",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body={"ids": ids},
    )
    write_result(result, args.out)


def cmd_papers_graph(args: argparse.Namespace) -> None:
    body: dict[str, Any] = {}
    if args.paper_id:
        body["paper_id"] = args.paper_id
    if args.doi:
        body["doi"] = args.doi
    if args.title:
        body["title"] = args.title
    if args.package_id:
        body["package_id"] = args.package_id
    if args.include:
        body["include"] = [s.strip() for s in args.include.split(",")]
    if args.no_hydrate:
        body["hydrate_factor_refs"] = False
    if args.title_resolve_limit:
        body.setdefault("title_resolve", {})["limit"] = int(
            args.title_resolve_limit
        )
    if not any(k in body for k in ("paper_id", "doi", "title", "package_id")):
        raise RuntimeError(
            "At least one of --paper-id, --doi, --title, --package-id "
            "is required"
        )
    result = fetch_json(
        f"{BASE_URL}/papers/graph",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body=body,
    )
    write_result(result, args.out)


# ---- argparse plumbing ---------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lkm_search.py",
        description="CLI helper for the Bohrium LKM public search API.",
        epilog=(
            "Auth: every request requires a Bohrium access key in the "
            "LKM_ACCESS_KEY env var."
        ),
    )
    sub = parser.add_subparsers(dest="command", metavar="VERB")

    # ---- search ----
    p_search = sub.add_parser("search", help="POST /search")
    p_search.add_argument("--query", required=False)
    p_search.add_argument("--top-k", type=int, default=20)
    p_search.add_argument("--offset", type=int, default=0)
    p_search.add_argument("--scopes", help="comma-separated: claim,question")
    p_search.add_argument(
        "--retrieval-mode", choices=["semantic", "lexical", "hybrid"]
    )
    p_search.add_argument("--keywords", help="comma-separated BM25 keywords")
    p_search.add_argument(
        "--reasoning-only", action="store_true", default=False
    )
    p_search.add_argument(
        "--evidence-only", action="store_true", default=False
    )
    p_search.add_argument("--visibility", default="public")
    p_search.add_argument("--role", choices=["conclusion", "premise"])
    p_search.add_argument("--out")
    p_search.set_defaults(func=cmd_search)

    # ---- reasoning ----
    p_reasoning = sub.add_parser(
        "reasoning", help="GET /claims/{id}/reasoning"
    )
    p_reasoning.add_argument("--id", required=False)
    p_reasoning.add_argument("--max-chains", type=int, default=10)
    p_reasoning.add_argument("--sort-by", default="comprehensive")
    p_reasoning.add_argument("--out")
    p_reasoning.set_defaults(func=cmd_reasoning)

    # ---- reasoning-search ----
    p_rsearch = sub.add_parser(
        "reasoning-search", help="POST /reasoning/search"
    )
    p_rsearch.add_argument("--query", required=False)
    p_rsearch.add_argument("--limit", type=int, default=20)
    p_rsearch.add_argument("--offset", type=int, default=0)
    p_rsearch.add_argument(
        "--retrieval-mode", choices=["semantic", "lexical", "hybrid"]
    )
    p_rsearch.add_argument("--keywords", help="comma-separated BM25 keywords")
    p_rsearch.add_argument("--paper-id", help="filter by paper ID")
    p_rsearch.add_argument("--out")
    p_rsearch.set_defaults(func=cmd_reasoning_search)

    # ---- variables ----
    p_variables = sub.add_parser("variables", help="POST /variables/batch")
    p_variables.add_argument("--ids", required=False)
    p_variables.add_argument("--out")
    p_variables.set_defaults(func=cmd_variables)

    # ---- papers-graph ----
    p_graph = sub.add_parser("papers-graph", help="POST /papers/graph")
    p_graph.add_argument("--paper-id")
    p_graph.add_argument("--doi")
    p_graph.add_argument("--title")
    p_graph.add_argument("--package-id")
    p_graph.add_argument(
        "--include",
        help="comma-separated: paper,variables,factors,motivations,priors,factor_params",
    )
    p_graph.add_argument(
        "--no-hydrate",
        action="store_true",
        default=False,
        help="return premise_ids/conclusion_id instead of full objects",
    )
    p_graph.add_argument("--title-resolve-limit", type=str, default="5")
    p_graph.add_argument("--out")
    p_graph.set_defaults(func=cmd_papers_graph)

    return parser


def main(argv: list[str] | None = None) -> int:
    raw = sys.argv[1:] if argv is None else argv
    if raw and raw[0] == "_version_check":
        return run_version_check()

    emit_pending_notification()
    kick_off_async_version_check()

    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "command", None):
        parser.print_help()
        return 0
    try:
        args.func(args)
    except RuntimeError as exc:
        sys.stderr.write(f"{exc}\n")
        response = getattr(exc, "response", None)
        if response is not None:
            sys.stderr.write(
                json.dumps(response, ensure_ascii=False, indent=2) + "\n"
            )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
