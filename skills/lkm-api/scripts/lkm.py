#!/usr/bin/env python3
"""CLI helper for the Bohrium LKM HTTP API.

Mirrors the four public verbs (search / match / evidence / variables) plus
a DEBUG-only papers-ocr verb. Standard library only — no `requests` or other
third-party deps. Reads the access key from the `LKM_ACCESS_KEY` env var.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DEBUG = os.environ.get("LKM_DEBUG_INTERNAL") == "1"
BASE_URL = (
    "https://lkm.bohrium.com/api/v1"
    if DEBUG
    else "https://open.bohrium.com/openapi/v1/lkm"
)


def get_access_key() -> str:
    ak = os.environ.get("LKM_ACCESS_KEY")
    if not ak:
        raise RuntimeError(
            "LKM_ACCESS_KEY is not set. Ask the user for their Bohrium access "
            "key, then export it in this shell session: "
            "`export LKM_ACCESS_KEY=<key>`. "
            "Do not commit the key to any file in the repo."
        )
    return ak


def auth_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers: dict[str, str] = {"accept": "*/*"}
    if not DEBUG:
        headers["accessKey"] = get_access_key()
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


# ---- verbs ---------------------------------------------------------------


def cmd_search(args: argparse.Namespace) -> None:
    if not args.query:
        raise RuntimeError("Missing --query")
    result = fetch_json(
        f"{BASE_URL}/search",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body={
            "query": args.query,
            "top_k": args.top_k,
            "filters": {"visibility": "public"},
        },
    )
    write_result(result, args.out)


def cmd_match(args: argparse.Namespace) -> None:
    if not args.text:
        raise RuntimeError("Missing --text")
    result = fetch_json(
        f"{BASE_URL}/claims/match",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body={
            "text": args.text,
            "top_k": args.top_k,
            "filters": {"visibility": "public"},
        },
    )
    write_result(result, args.out)


def cmd_evidence(args: argparse.Namespace) -> None:
    if not args.id:
        raise RuntimeError("Missing --id")
    claim_id = urllib.parse.quote(args.id, safe="")
    sort_by = urllib.parse.quote(args.sort_by, safe="")
    url = (
        f"{BASE_URL}/claims/{claim_id}/evidence"
        f"?max_chains={args.max_chains}&sort_by={sort_by}"
    )
    result = fetch_json(url, headers=auth_headers())
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


def cmd_papers_ocr(args: argparse.Namespace) -> None:
    if not args.paper_ids:
        raise RuntimeError("Missing --paper-ids (comma-separated)")
    paper_ids = [s.strip() for s in args.paper_ids.split(",")]
    result = fetch_json(
        f"{BASE_URL}/papers/ocr/batch",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body={"paper_ids": paper_ids},
    )
    write_result(result, args.out)


# ---- argparse plumbing ---------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    epilog = (
        "Auth: every request requires a Bohrium access key in the "
        "LKM_ACCESS_KEY env var."
    )
    parser = argparse.ArgumentParser(
        prog="lkm.py",
        description="CLI helper for the Bohrium LKM HTTP API.",
        epilog=None if DEBUG else epilog,
    )
    sub = parser.add_subparsers(dest="command", metavar="VERB")

    p_search = sub.add_parser("search", help="POST /search")
    p_search.add_argument("--query", required=False)
    p_search.add_argument("--top-k", type=int, default=10)
    p_search.add_argument("--out")
    p_search.set_defaults(func=cmd_search)

    p_match = sub.add_parser("match", help="POST /claims/match")
    p_match.add_argument("--text", required=False)
    p_match.add_argument("--top-k", type=int, default=10)
    p_match.add_argument("--out")
    p_match.set_defaults(func=cmd_match)

    p_evidence = sub.add_parser("evidence", help="GET /claims/{id}/evidence")
    p_evidence.add_argument("--id", required=False)
    p_evidence.add_argument("--max-chains", type=int, default=10)
    p_evidence.add_argument("--sort-by", default="comprehensive")
    p_evidence.add_argument("--out")
    p_evidence.set_defaults(func=cmd_evidence)

    p_variables = sub.add_parser("variables", help="POST /variables/batch")
    p_variables.add_argument("--ids", required=False)
    p_variables.add_argument("--out")
    p_variables.set_defaults(func=cmd_variables)

    if DEBUG:
        p_ocr = sub.add_parser(
            "papers-ocr", help="POST /papers/ocr/batch (DEBUG only)"
        )
        p_ocr.add_argument("--paper-ids", required=False)
        p_ocr.add_argument("--out")
        p_ocr.set_defaults(func=cmd_papers_ocr)

    return parser


def main(argv: list[str] | None = None) -> int:
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
