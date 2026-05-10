#!/usr/bin/env python3
"""CLI helper for the Bohrium LKM HTTP API.

Mirrors the four public verbs (search / match / evidence / variables) plus
a DEBUG-only papers-ocr verb. Standard library only — no `requests` or other
third-party deps. Reads the access key from the `LKM_ACCESS_KEY` env var.

Each invocation also forks a detached async subprocess that pings the
upstream GitHub repo for a newer CalVer release tag (best-effort, silent on
failure). When a newer tag than the local `.skill-version` marker is seen,
the async worker writes a one-shot notification to `.skill-version-notif`,
surfaced on stderr by the *next* user-facing invocation. Pull is
agent-guided — this helper never auto-pulls or clears caches.
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

DEBUG = os.environ.get("LKM_DEBUG_INTERNAL") == "1"
BASE_URL = (
    "https://lkm.bohrium.com/api/v1"
    if DEBUG
    else "https://open.bohrium.com/openapi/v1/lkm"
)

# Skill auto-update — files live in the skill directory (parent of scripts/).
SKILL_DIR = Path(__file__).resolve().parent.parent
VERSION_MARKER = SKILL_DIR / ".skill-version"
VERSION_NOTIF = SKILL_DIR / ".skill-version-notif"
UPSTREAM_REPO = "https://github.com/SiliconEinstein/gaia-lkm-skills.git"
CALVER_RE = re.compile(r"^v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$")


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


# ---- skill auto-update ---------------------------------------------------


def emit_pending_notification() -> None:
    """If the async worker left a notification, print it once and remove."""
    try:
        if VERSION_NOTIF.exists():
            msg = VERSION_NOTIF.read_text(encoding="utf-8").strip()
            if msg:
                sys.stderr.write(f"[lkm-api] {msg}\n")
            VERSION_NOTIF.unlink()
    except Exception:
        # Best-effort — notification surface must never break API calls.
        pass


def kick_off_async_version_check() -> None:
    """Fork a detached subprocess to query upstream tags. Fire and forget."""
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
        # Best-effort — never block the user-facing call.
        pass


def run_version_check() -> int:
    """Internal verb: query upstream, update marker + notification on change.

    Wrapped end-to-end in try/except — every failure path is silent. This
    runs in a detached subprocess; nothing here should ever surface to the
    user-facing invocation.
    """
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
            # Format: "<sha>\trefs/tags/<tag>" (sometimes "<tag>^{}").
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

        # Lexical sort works for vYYYY.MM.DD[.N] (zero-padded date,
        # numeric suffix tie-breaks since `.1` < `.2` < `.10` only fails
        # past 9 same-day releases — acceptable for CalVer).
        latest = sorted(set(tags))[-1]

        if latest != current:
            VERSION_MARKER.write_text(latest + "\n", encoding="utf-8")
            current_label = current or "none"
            msg = (
                f"new tag {latest} available (current: {current_label}). "
                f"Pull guidance: cd ~/ThisIsDP/dev/gaia-lkm-skills && "
                f"git fetch --tags && git checkout {latest} "
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
    # Hidden internal verb — handled before argparse so it never appears in
    # --help. Runs entirely silent (best-effort version check).
    raw = sys.argv[1:] if argv is None else argv
    if raw and raw[0] == "_version_check":
        return run_version_check()

    # User-facing path: surface any pending notification, then kick off a
    # fresh async check. Notification first, so the user sees the *previous*
    # detection before this run's check (which may overwrite the notif file)
    # runs to completion.
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
