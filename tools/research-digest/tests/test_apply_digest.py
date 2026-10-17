"""Tests for applying ticked digest candidates to a list."""

import json

import apply_digest as ad

README = """# Awesome Example

Some intro text.

## Projects

- [Existing](https://existing.example) - already on the list.

## Resources

- [Docs](https://docs.example) - the docs.
"""


def _body(url, section="Projects", checked=True):
    box = "x" if checked else " "
    payload = {
        "version": 2,
        "candidates": [{"url": url, "entry": f"- [New Thing]({url}) - does a thing.",
                        "section": section, "title": "New Thing"}],
    }
    return (
        "# Research digest — 2026-10-17\n\n"
        f"## Other candidates\n\n"
        f"- [{box}] **[New Thing]({url})** — RSS · 3 pts · `high`\n\n"
        "<!-- digest-payload\n"
        + json.dumps(payload)
        + "\n-->\n"
    )


def test_checked_urls_only_returns_ticked_items():
    assert ad.checked_urls(_body("https://new.example")) == ["https://new.example"]
    assert ad.checked_urls(_body("https://new.example", checked=False)) == []
    assert ad.checked_urls("no payload here") == []


def test_parse_payload_normalises_urls():
    payload = ad.parse_payload(_body("https://www.new.example/x/?utm_source=y"))
    assert "https://new.example/x" in payload
    assert payload["https://new.example/x"]["section"] == "Projects"


def test_apply_inserts_under_existing_section(tmp_path, monkeypatch):
    readme = tmp_path / "README.md"
    readme.write_text(README, encoding="utf-8")
    body = tmp_path / "body.md"
    body.write_text(_body("https://new.example"), encoding="utf-8")

    monkeypatch.setattr("sys.argv", ["apply_digest", "--root", str(tmp_path),
                                     "--body-file", str(body), "--apply"])
    assert ad.main() == 0

    text = readme.read_text(encoding="utf-8")
    assert "- [New Thing](https://new.example) - does a thing." in text
    # inserted inside Projects, before the Resources heading
    assert text.index("New Thing") < text.index("## Resources")
    assert text.index("## Projects") < text.index("New Thing")


def test_apply_creates_missing_section(tmp_path, monkeypatch):
    readme = tmp_path / "README.md"
    readme.write_text("# Awesome Example\n\n## Existing\n\n- [a](https://a.example) - a.\n",
                      encoding="utf-8")
    body = tmp_path / "body.md"
    body.write_text(_body("https://new.example", section="Fresh Finds"), encoding="utf-8")

    monkeypatch.setattr("sys.argv", ["apply_digest", "--root", str(tmp_path),
                                     "--body-file", str(body), "--apply"])
    ad.main()

    text = readme.read_text(encoding="utf-8")
    assert "\n## Fresh Finds\n" in text
    assert "- [New Thing](https://new.example) - does a thing." in text


def test_apply_skips_urls_already_present(tmp_path, monkeypatch):
    readme = tmp_path / "README.md"
    readme.write_text(README, encoding="utf-8")
    body = tmp_path / "body.md"
    body.write_text(_body("https://www.existing.example/?utm_source=x"), encoding="utf-8")

    monkeypatch.setattr("sys.argv", ["apply_digest", "--root", str(tmp_path),
                                     "--body-file", str(body), "--apply"])
    ad.main()

    text = readme.read_text(encoding="utf-8")
    assert text.count("existing.example") == 1  # unchanged


def test_dry_run_does_not_write(tmp_path, monkeypatch, capsys):
    readme = tmp_path / "README.md"
    readme.write_text(README, encoding="utf-8")
    body = tmp_path / "body.md"
    body.write_text(_body("https://new.example"), encoding="utf-8")

    monkeypatch.setattr("sys.argv", ["apply_digest", "--root", str(tmp_path),
                                     "--body-file", str(body)])
    ad.main()

    assert "New Thing" not in readme.read_text(encoding="utf-8")
    assert "New Thing" in capsys.readouterr().out  # diff preview shown instead


def test_insert_into_section_returns_unchanged_for_no_entries():
    new_text, created = ad.insert_into_section(README, "Projects", [])
    assert created is False
    assert "- [Existing](https://existing.example)" in new_text


def test_insert_resolves_heading_without_emoji():
    text = "# List\n\n## 📚 Contents\n\n## 🧪 Projects\n\n- [a](https://a.example) - a.\n"
    new_text, created = ad.insert_into_section(text, "Projects", ["- [b](https://b.example) - b."])
    assert created is False
    assert new_text.index("## 🧪 Projects") < new_text.index("- [b](https://b.example)")
    assert "## Projects\n" not in new_text  # no duplicate heading created
