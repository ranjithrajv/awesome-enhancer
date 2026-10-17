#!/usr/bin/env python3
"""Apply ticked candidates from a digest issue to an awesome list.

The digest issue body (produced by ``research_digest.py``) contains, for every
candidate, a GitHub task list item plus a hidden machine-readable payload::

    - [ ] **[Title](https://example.com)** — Hacker News · 42 pts · `high`
      - copy-paste entry:

        ```markdown
        - [Title](https://example.com) - one-line description.
        ```

    <!-- digest-payload
    {"version": 2, "candidates": [{"url": "...", "entry": "...", "section": "..."}]}
    -->

A maintainer ticks the boxes they want. This script reads the issue body,
collects the ticked URLs, matches them against the payload, and inserts the
corresponding entries into the target markdown file(s) under the suggested
section heading. It never edits anything unless ``--apply`` is passed, and it
never inserts an entry whose URL is already present.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from research_digest import HEADING_RE, URL_RE, _match_section, dedupe_key  # noqa: E402

PAYLOAD_RE = re.compile(r"<!--\s*digest-payload\s*(\{.*?\})\s*-->", re.S)
CHECKBOX_RE = re.compile(r"^\s*[-*]\s*\[[xX]\]\s*(.*)$")


def parse_payload(body: str) -> dict:
    """Return ``{normalized_url: {entry, section, title}}`` from the issue body."""
    match = PAYLOAD_RE.search(body or "")
    if not match:
        return {}
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}
    out: dict = {}
    for item in data.get("candidates", []):
        if isinstance(item, dict) and item.get("url"):
            out[dedupe_key(str(item["url"]))] = item
    return out


def checked_urls(body: str) -> list:
    """Return normalised URLs of every ticked task-list item, in order."""
    urls: list = []
    for line in (body or "").splitlines():
        match = CHECKBOX_RE.match(line)
        if not match:
            continue
        found = URL_RE.search(match.group(1))
        if not found:
            continue
        normalized = dedupe_key(found.group(0))
        if normalized and normalized not in urls:
            urls.append(normalized)
    return urls


def _url_in_text(text: str, url: str) -> bool:
    target = dedupe_key(url)
    return any(dedupe_key(u) == target for u in URL_RE.findall(text or ""))


def insert_into_section(text: str, section: str, entries: list) -> tuple:
    """Insert ``entries`` under the ``section`` heading.

    The section name is matched leniently (ignoring emoji, punctuation and
    case) against the headings already in the file, so a payload that says
    ``Volunteer Projects`` still lands under ``## 🧪 Volunteer Projects``.
    Returns ``(new_text, created_section)``. A section with no match is
    appended at the end of the document.
    """
    lines = text.splitlines()
    headings = [(index, len(match.group(1)), match.group(2).strip())
                for index, line in enumerate(lines)
                if (match := HEADING_RE.match(line))]

    start = None
    level = 2
    for index, heading_level, title in headings:
        if title.lower() == section.strip().lower():
            start, level = index, heading_level
            break
    if start is None:
        resolved = _match_section(section, [title for _, _, title in headings])
        for index, heading_level, title in headings:
            if resolved and title == resolved:
                start, level = index, heading_level
                break

    if start is None:
        block = "\n".join(entries)
        return text.rstrip("\n") + f"\n\n## {section}\n\n{block}\n", True

    end = len(lines)
    for index in range(start + 1, len(lines)):
        match = HEADING_RE.match(lines[index])
        if match and len(match.group(1)) <= level:
            end = index
            break

    insert_at = end
    while insert_at - 1 > start and lines[insert_at - 1].strip() == "":
        insert_at -= 1

    tail = [""] if end < len(lines) else []
    new_lines = lines[:insert_at] + list(entries) + tail + lines[insert_at:]
    return "\n".join(new_lines).rstrip("\n") + "\n", False


def _preview(before: str, after: str, name: str) -> str:
    return "\n".join(difflib.unified_diff(before.splitlines(), after.splitlines(),
                                          fromfile=name, tofile=name, lineterm=""))


def apply_body_to_file(path: Path, body: str, default_section: str, apply: bool) -> dict:
    """Insert ticked entries into a single file. Returns a change report."""
    text = path.read_text(encoding="utf-8")
    payload = parse_payload(body)
    urls = checked_urls(body)

    by_section: dict = {}
    skipped: list = []
    for url in urls:
        info = payload.get(url)
        entry = (info or {}).get("entry") or _fallback_entry(url)
        section = ((info or {}).get("section") or default_section or "").strip()
        if not entry:
            skipped.append({"url": url, "reason": "no entry in payload"})
            continue
        if _url_in_text(text, url):
            skipped.append({"url": url, "reason": "already in list"})
            continue
        by_section.setdefault(section, []).append(entry)

    if not by_section:
        return {"file": str(path), "changed": False, "entries": 0, "skipped": skipped,
                "diff": ""}

    updated = text
    created: list = []
    inserted = 0
    for section, entries in by_section.items():
        if section:
            updated, made = insert_into_section(updated, section, entries)
            if made:
                created.append(section)
        else:
            updated = updated.rstrip("\n") + "\n" + "\n".join(entries) + "\n"
        inserted += len(entries)

    changed = updated != text
    if changed and apply:
        path.write_text(updated, encoding="utf-8")
    return {
        "file": str(path),
        "changed": changed,
        "entries": inserted,
        "created_sections": created,
        "skipped": skipped,
        "diff": _preview(text, updated, str(path)) if changed and not apply else "",
    }


def _fallback_entry(url: str) -> str:
    """Best-effort entry when the payload is missing (older digests)."""
    from research_digest import _md_url, esc  # local import to avoid cycles

    link = _md_url(url)
    if not link:
        return ""
    return f"- [{esc(url, 200)}]({link})"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Apply ticked digest candidates to a list.")
    parser.add_argument("--root", default=".")
    parser.add_argument("--body-file", required=True, help="File containing the issue body.")
    parser.add_argument("--file", action="append", default=[],
                        help="Target markdown file (repeatable, default README.md).")
    parser.add_argument("--default-section", default="", help="Section for entries without one.")
    parser.add_argument("--apply", action="store_true", help="Write changes (default is dry-run).")
    parser.add_argument("--report", default="", help="Write a JSON change report here.")
    parser.add_argument("--github-output", action="store_true")
    args = parser.parse_args(argv)

    root = Path(args.root)
    body = Path(args.body_file).read_text(encoding="utf-8")
    targets = [Path(f) for f in (args.file or ["README.md"])]
    targets = [t if t.is_absolute() else root / t for t in targets]

    reports = [apply_body_to_file(path, body, args.default_section, args.apply)
               for path in targets]
    changed = [r["file"] for r in reports if r["changed"]]
    entries = sum(r["entries"] for r in reports)
    skipped = [s for r in reports for s in r["skipped"]]

    summary = {
        "apply": bool(args.apply),
        "checked": len(checked_urls(body)),
        "changed": changed,
        "entries": entries,
        "skipped": skipped,
        "reports": reports,
    }

    if not args.apply:
        for report in reports:
            if report["diff"]:
                sys.stdout.write(report["diff"] + "\n")

    if args.report:
        redacted = dict(summary)
        redacted["reports"] = [{k: v for k, v in r.items() if k != "diff"} for r in reports]
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(json.dumps(redacted, indent=2, ensure_ascii=False), encoding="utf-8")

    if args.github_output and os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as handle:
            handle.write(f"changed={'true' if changed else 'false'}\n")
            handle.write(f"entries={entries}\n")

    print(json.dumps({"changed": changed, "entries": entries, "checked": summary["checked"],
                      "skipped": skipped}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
