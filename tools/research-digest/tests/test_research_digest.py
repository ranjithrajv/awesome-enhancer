"""Tests for the research digest engine."""

import json
from datetime import date
from pathlib import Path

import pytest

import apply_digest
import research_digest as rd

FIXTURES = Path(__file__).parent / "fixtures"


# --------------------------------------------------------------------------- #
# URL normalisation and escaping
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("raw,expected", [
    ("https://www.Example.com/a/b/", "https://example.com/a/b"),
    ("http://www.example.com/x/", "http://example.com/x"),
    ("http://example.com/a?utm_source=x&utm_medium=y", "http://example.com/a"),
    ("https://example.com/a?keep=1&fbclid=abc", "https://example.com/a?keep=1"),
    ("https://example.com/a#section", "https://example.com/a"),
    ("https://example.com/a.", "https://example.com/a"),
    ("not a url", "not a url"),
])
def test_normalize_url(raw, expected):
    assert rd.normalize_url(raw) == expected


def test_dedupe_key_collapses_www_and_scheme():
    assert rd.dedupe_key("http://www.example.com/x/") == rd.dedupe_key("https://example.com/x")
    assert rd.dedupe_key("https://example.com/x") == "https://example.com/x"


def test_esc_escapes_markdown_metacharacters():
    assert rd.esc("a [b] | c `d`") == r"a \[b\] \| c \`d\`"


def test_esc_collapses_newlines_and_truncates():
    assert rd.esc("line one\nline two") == "line one line two"
    assert rd.esc("x" * 500, limit=10).endswith("…")


@pytest.mark.parametrize("url,expected", [
    ("https://example.com/a", "https://example.com/a"),
    ("https://example.com/a b", "<https://example.com/a b>"),
    ("https://example.com/a(1)", "<https://example.com/a(1)>"),
    ("javascript:alert(1)", ""),
    ("", ""),
])
def test_md_url(url, expected):
    assert rd._md_url(url) == expected


def test_build_entry_with_and_without_description():
    with_desc = rd.Candidate(url="https://example.com/a", title="Thing", description="Does a thing.")
    assert rd.build_entry(with_desc) == "- [Thing](https://example.com/a) - Does a thing."
    without = rd.Candidate(url="https://example.com/a", title="Thing")
    assert rd.build_entry(without) == "- [Thing](https://example.com/a)"


# --------------------------------------------------------------------------- #
# RSS / Atom parsing
# --------------------------------------------------------------------------- #

def _config(**overrides):
    cfg = dict(rd.DEFAULTS)
    cfg.update(overrides)
    cfg["request_delay"] = 0  # never sleep in tests
    return cfg


def _ctx():
    return rd.Context(since_date="2026-09-01", since_epoch=0, today=date(2026, 10, 17))


def test_fetch_rss_rss2(monkeypatch):
    payload = (FIXTURES / "rss.xml").read_bytes()
    monkeypatch.setattr(rd, "http_request", lambda *a, **k: payload)
    cfg = _config(keywords=["volunteer computing", "boinc"], rss_feeds=["https://example.org/feed"])
    out = rd.fetch_rss(cfg, _ctx())
    assert len(out) == 1
    item = out[0]
    assert item.url == "https://example.org/boinc-news"
    assert item.published == "2026-10-06"
    assert "boinc" in item.signal.lower()


def test_fetch_rss_atom_link_and_date(monkeypatch):
    payload = (FIXTURES / "atom.xml").read_bytes()
    monkeypatch.setattr(rd, "http_request", lambda *a, **k: payload)
    cfg = _config(keywords=["citizen science"], rss_feeds=["https://example.net/feed"])
    out = rd.fetch_rss(cfg, _ctx())
    assert len(out) == 1
    assert out[0].url == "https://example.net/citizen-science"
    assert out[0].published == "2026-10-06"


def test_fetch_rss_survives_a_broken_feed(monkeypatch):
    def boom(*_a, **_k):
        raise rd.HTTPError("https://x", 500, "server error", {}, None)  # type: ignore[arg-type]

    monkeypatch.setattr(rd, "http_request", boom)
    cfg = _config(keywords=["x"], rss_feeds=["https://example.org/feed"])
    assert rd.fetch_rss(cfg, _ctx()) == []


# --------------------------------------------------------------------------- #
# De-duplication and ranking
# --------------------------------------------------------------------------- #

def test_dedupe_matches_normalised_urls():
    known = {rd.dedupe_key("https://github.com/a/b")}
    candidates = [
        rd.Candidate(url=rd.normalize_url("http://www.github.com/a/b/?utm_source=x")),
        rd.Candidate(url="https://example.com/new"),
    ]
    out = rd.dedupe(candidates, known)
    assert [c.url for c in out] == ["https://example.com/new"]


def test_dedupe_keeps_first_of_a_run():
    candidates = [
        rd.Candidate(url="https://example.com/a", title="first"),
        rd.Candidate(url="https://www.example.com/a/", title="second"),
    ]
    out = rd.dedupe(candidates, set())
    assert len(out) == 1
    assert out[0].title == "first"


# --------------------------------------------------------------------------- #
# Keyword gate (compensates for the missing relevance model)
# --------------------------------------------------------------------------- #

def test_keyword_gate_drops_off_topic_hacker_news():
    cfg = _config(keywords=["boinc"], keyword_gate=["Hacker News"])
    candidates = [
        rd.Candidate(url="https://a", title="BOINC hits a milestone", source="Hacker News"),
        rd.Candidate(url="https://b", title="Something is falling apart at GNOME", source="Hacker News"),
        rd.Candidate(url="https://c", title="Some repo", source="GitHub"),
    ]
    assert [c.url for c in rd.apply_keyword_gate(candidates, cfg)] == ["https://a", "https://c"]


def test_keyword_gate_matches_the_description_too():
    cfg = _config(keywords=["citizen science"], keyword_gate=["Hacker News"])
    cand = rd.Candidate(url="https://a", title="Untitled",
                        description="A citizen science project", source="Hacker News")
    assert rd.apply_keyword_gate([cand], cfg) == [cand]


def test_keyword_gate_is_a_noop_when_unconfigured():
    cand = rd.Candidate(url="https://a", title="anything", source="Hacker News")
    assert rd.apply_keyword_gate([cand], _config(keywords=[], keyword_gate=["Hacker News"])) == [cand]
    assert rd.apply_keyword_gate([cand], _config(keywords=["boinc"], keyword_gate=[])) == [cand]


def test_rank_and_cap_normalises_and_caps_per_source():
    cfg = _config(max_per_source=2, source_weights={"GitHub": 0.5})
    candidates = [
        rd.Candidate(url="https://hn/1", source="Hacker News", score=100),
        rd.Candidate(url="https://hn/2", source="Hacker News", score=50),
        rd.Candidate(url="https://hn/3", source="Hacker News", score=10),
        rd.Candidate(url="https://gh/1", source="GitHub", score=20),
        rd.Candidate(url="https://gh/2", source="GitHub", score=10),
    ]
    ranked = rd.rank_and_cap(candidates, cfg, date(2026, 10, 17))
    urls = [c.url for c in ranked]
    assert "https://hn/3" not in urls                       # capped at max_per_source
    hn_top = next(c for c in ranked if c.url == "https://hn/1")
    gh_top = next(c for c in ranked if c.url == "https://gh/1")
    assert hn_top.rank_score == pytest.approx(1.0)
    assert gh_top.rank_score == pytest.approx(0.5)          # normalised then weighted
    assert ranked[0].url == "https://hn/1"


def test_rank_and_cap_applies_freshness_decay():
    cfg = _config(max_per_source=5, half_life_days=21)
    fresh = rd.Candidate(url="https://a", source="GitHub", score=10, published="2026-10-17")
    stale = rd.Candidate(url="https://b", source="GitHub", score=10, published="2026-08-01")
    ranked = rd.rank_and_cap([fresh, stale], cfg, date(2026, 10, 17))
    assert ranked[0].url == "https://a"
    assert ranked[1].rank_score < ranked[0].rank_score


def test_decay_bounds():
    assert rd._decay("", date(2026, 10, 17), 21) == 1.0
    assert rd._decay("2026-10-17", date(2026, 10, 17), 21) == 1.0
    assert 0 < rd._decay("2026-01-01", date(2026, 10, 17), 21) < 1.0


# --------------------------------------------------------------------------- #
# Sections
# --------------------------------------------------------------------------- #

def test_read_sections_from_readme(tmp_path):
    (tmp_path / "README.md").write_text("# List\n\n## Alpha\n\n## Beta\n\n### Nested\n", encoding="utf-8")
    assert rd.read_sections(tmp_path, _config()) == ["Alpha", "Beta"]


def test_read_sections_strips_emoji_and_navigation(tmp_path):
    (tmp_path / "README.md").write_text(
        "# List\n\n## 📚 Contents\n\n## ⚙️ Platforms & Infra\n\n## Contributing\n\n## 🧪 Projects\n",
        encoding="utf-8",
    )
    assert rd.read_sections(tmp_path, _config()) == ["⚙️ Platforms & Infra", "🧪 Projects"]


def test_read_sections_prefers_explicit_config():
    assert rd.read_sections(".", _config(sections=["Only"])) == ["Only"]


def test_match_section_is_emoji_and_case_tolerant():
    sections = ["⚙️ Platforms & Infrastructure", "🧪 Volunteer Projects"]
    assert rd._match_section("Platforms & Infrastructure", sections) == sections[0]
    assert rd._match_section("platforms & INFRASTRUCTURE", sections) == sections[0]
    assert rd._match_section("Infrastructure", sections) == sections[0]  # substring
    assert rd._match_section("Volunteer Projects", sections) == sections[1]
    assert rd._match_section("Nowhere", sections) == ""


# --------------------------------------------------------------------------- #
# LLM ranking
# --------------------------------------------------------------------------- #

def _llm_config(default_section=""):
    return _config(list_description="A list.", default_section=default_section)


def test_llm_rank_matches_urls_and_validates_sections(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    response = {
        "choices": [{"message": {"content": json.dumps({"candidates": [
            {"url": "https://a.example/1", "relevance": "high", "reason": "fits", "section": "Servers"},
            {"url": "https://a.example/2", "relevance": "bogus", "reason": "x", "section": "Nope"},
        ]})}}],
    }
    monkeypatch.setattr(rd, "http_request", lambda *a, **k: json.dumps(response).encode())
    candidates = [
        rd.Candidate(url="https://a.example/1", title="One", source="GitHub"),
        rd.Candidate(url="https://a.example/2", title="Two", source="GitHub"),
    ]
    used = rd.llm_rank(candidates, _llm_config(), ["Projects", "Servers"])
    assert used[0] is True
    assert candidates[0].relevance == "high"
    assert candidates[0].section == "Servers"
    assert candidates[1].relevance == "unrated"   # invalid relevance is rejected
    assert candidates[1].section == ""            # unknown section is dropped


def test_llm_rank_skips_without_credentials(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GH_TOKEN", raising=False)
    assert rd.llm_rank([rd.Candidate(url="https://a.example/1")], _llm_config(), []) == (False, "")


def test_llm_rank_reports_a_non_json_body(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setattr(rd, "http_request", lambda *a, **k: b"OK")
    used, note = rd.llm_rank([rd.Candidate(url="https://a.example/1", title="A")], _llm_config(), [])
    assert used is False
    assert "OK" in note  # the unexpected body is surfaced, not hidden


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #

def test_render_roundtrips_through_apply_payload():
    candidates = [
        rd.Candidate(url="https://example.com/a", title="A [beta]", description="desc",
                     source="Hacker News", signal="10 pts", relevance="high", section="Projects"),
        rd.Candidate(url="https://example.com/b", title="Bee", source="RSS",
                     signal="matched: x", relevance="low"),
    ]
    meta = {"raw": 3, "unique": 2, "ranked": 2, "today": "2026-10-17"}
    report, payload = rd.render(candidates, _config(), True, meta)

    assert "# Research digest — 2026-10-17" in report
    assert "Ranked by LLM." in report
    assert r"- [A \[beta\]](https://example.com/a) - desc" in report
    assert len(payload) == 2

    parsed = apply_digest.parse_payload(report)
    assert parsed["https://example.com/a"]["section"] == "Projects"
    assert parsed["https://example.com/b"]["entry"] == "- [Bee](https://example.com/b)"
    assert apply_digest.checked_urls(report) == []  # nothing ticked yet


def test_render_handles_no_candidates():
    report, payload = rd.render([], _config(), False, {"raw": 0, "unique": 0, "ranked": 0,
                                                       "today": "2026-10-17"})
    assert "No new candidates found this week." in report
    assert "Heuristic ranking only." in report
    assert payload == []


def test_render_surfaces_an_llm_failure():
    candidates = [rd.Candidate(url="https://a.example/1", title="A", source="GitHub")]
    meta = {"raw": 1, "unique": 1, "ranked": 1, "today": "2026-10-17",
            "llm_note": "JSONDecodeError (response began: OK)"}
    report, _ = rd.render(candidates, _config(), False, meta)
    assert "LLM unavailable" in report
    assert "OK" in report


# --------------------------------------------------------------------------- #
# Sources whose public endpoints are picky about their request shape
# --------------------------------------------------------------------------- #

def test_fetch_arxiv_encodes_spaces_as_plus_and_filters_by_date(monkeypatch):
    payload = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><id>http://arxiv.org/abs/1</id><title>Volunteer computing at scale</title>
        <summary>d</summary><published>2026-10-10T00:00:00Z</published></entry>
      <entry><id>http://arxiv.org/abs/2</id><title>Too old</title>
        <summary>d</summary><published>2026-01-01T00:00:00Z</published></entry>
    </feed>"""
    seen = {}

    def fake(url, **kwargs):
        seen["url"] = url
        return payload

    monkeypatch.setattr(rd, "http_request", fake)
    cfg = _config(arxiv_queries=['cat:cs.DC AND all:"volunteer computing"'])
    out = rd.fetch_arxiv(cfg, _ctx())

    search = seen["url"].split("search_query=", 1)[1].split("&", 1)[0]
    assert "+AND+" in search and "%20" not in search  # arXiv 400s on %20
    assert [c.url for c in out] == ["http://arxiv.org/abs/1"]


def test_fetch_lobsters_uses_tag_feeds_and_keyword_filter(monkeypatch):
    payload = json.dumps([
        {"title": "BOINC grid news", "url": "https://ex.com/a", "score": 12,
         "created_at": "2026-10-10T00:00:00.000-05:00", "description": ""},
        {"title": "Unrelated high scorer", "url": "https://ex.com/b", "score": 30,
         "created_at": "2026-10-10T00:00:00.000-05:00", "description": ""},
        {"title": "BOINC but downvoted", "url": "https://ex.com/c", "score": 1,
         "created_at": "2026-10-10T00:00:00.000-05:00", "description": ""},
    ]).encode()
    seen = {}

    def fake(url, **kwargs):
        seen["url"] = url
        return payload

    monkeypatch.setattr(rd, "http_request", fake)
    cfg = _config(lobsters_tags=["distributed"], keywords=["boinc"])
    out = rd.fetch_lobsters(cfg, _ctx())

    assert seen["url"] == "https://lobste.rs/t/distributed.json"  # not /search.json
    assert [c.url for c in out] == ["https://ex.com/a"]
    assert out[0].signal == "12 pts · t/distributed"


def test_fetch_lobsters_is_a_noop_without_tags():
    assert rd.fetch_lobsters(_config(keywords=["boinc"]), _ctx()) == []


REDDIT_ATOM = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>New BOINC project</title>
    <link href="https://www.reddit.com/r/BOINC/comments/x/new/"/>
    <content type="html">&lt;p&gt;a volunteer computing project&lt;/p&gt; submitted by /u/someone [link] [comments]</content>
    <updated>2026-10-10T00:00:00Z</updated></entry>
  <entry><title>Off topic</title>
    <link href="https://www.reddit.com/r/BOINC/comments/y/off/"/>
    <content type="html">nothing relevant</content>
    <updated>2026-10-10T00:00:00Z</updated></entry>
</feed>"""


def test_fetch_reddit_reads_the_atom_feed(monkeypatch):
    seen = {}

    def fake(url, **kwargs):
        seen["url"] = url
        return REDDIT_ATOM

    monkeypatch.setattr(rd, "http_request", fake)
    cfg = _config(reddit_subreddits=["BOINC"], keywords=["volunteer computing"])
    out = rd.fetch_reddit(cfg, _ctx())

    assert seen["url"] == "https://www.reddit.com/r/BOINC/.rss"  # not .json
    assert len(out) == 1
    assert out[0].url == "https://reddit.com/r/BOINC/comments/x/new"  # www. normalised away
    assert out[0].published == "2026-10-10"
    assert "submitted by" not in out[0].description  # feed boilerplate stripped
    assert out[0].description == "a volunteer computing project"


def test_fetch_bluesky_uses_the_read_host(monkeypatch):
    payload = json.dumps({"posts": [{
        "uri": "at://did:plc:x/app.bsky.feed.post/abc",
        "author": {"handle": "someone.bsky.social"},
        "record": {"text": "BOINC news", "createdAt": "2026-10-10T00:00:00Z"},
        "likeCount": 4, "repostCount": 1,
    }]}).encode()
    seen = {}

    def fake(url, **kwargs):
        seen["url"] = url
        return payload

    monkeypatch.setattr(rd, "http_request", fake)
    out = rd.fetch_bluesky(_config(bluesky_queries=["BOINC"]), _ctx())

    assert "api.bsky.app" in seen["url"]
    assert "public.api" not in seen["url"]  # that host 403s
    assert out[0].url == "https://bsky.app/profile/someone.bsky.social/post/abc"
    assert out[0].signal == "5★"
