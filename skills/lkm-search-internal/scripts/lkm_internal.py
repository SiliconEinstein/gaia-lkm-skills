#!/usr/bin/env python3
"""CLI helper for the Bohrium LKM internal API.

Single verb: papers-content (POST /papers/content/batch).
Standard library only — no third-party deps.
Reads the access key from the LKM_ACCESS_KEY env var.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

BASE_URL = "https://open.bohrium.com/openapi/v1/lkm"


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


# ---- verb ----------------------------------------------------------------


def cmd_papers_content(args: argparse.Namespace) -> None:
    body: dict[str, Any] = {}
    if args.paper_ids:
        body["paper_ids"] = [s.strip() for s in args.paper_ids.split(",")]
    if args.dois:
        body["dois"] = [s.strip() for s in args.dois.split(",")]
    if args.package_ids:
        body["package_ids"] = [s.strip() for s in args.package_ids.split(",")]
    if args.titles:
        body["titles"] = [s.strip() for s in args.titles.split(",")]
    if args.title_resolve_limit:
        body["title_resolve"] = {"limit": int(args.title_resolve_limit)}
    if not any(
        k in body for k in ("paper_ids", "dois", "package_ids", "titles")
    ):
        raise RuntimeError(
            "At least one of --paper-ids, --dois, --package-ids, --titles "
            "is required"
        )
    result = fetch_json(
        f"{BASE_URL}/papers/content/batch",
        method="POST",
        headers=auth_headers({"content-type": "application/json"}),
        body=body,
    )
    write_result(result, args.out)


# ---- argparse ------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lkm_internal.py",
        description="CLI helper for the Bohrium LKM internal API.",
        epilog=(
            "Auth: requires a whitelisted Bohrium access key in the "
            "LKM_ACCESS_KEY env var."
        ),
    )
    sub = parser.add_subparsers(dest="command", metavar="VERB")

    p = sub.add_parser(
        "papers-content", help="POST /papers/content/batch"
    )
    p.add_argument("--paper-ids", help="comma-separated paper IDs")
    p.add_argument("--dois", help="comma-separated DOIs")
    p.add_argument("--package-ids", help="comma-separated package IDs")
    p.add_argument("--titles", help="comma-separated titles")
    p.add_argument("--title-resolve-limit", type=str, default="5")
    p.add_argument("--out")
    p.set_defaults(func=cmd_papers_content)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(
        sys.argv[1:] if argv is None else argv
    )
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
