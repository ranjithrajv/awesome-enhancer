# Research Digest

A shared engine that scans the web for projects worth adding to an awesome list,
de-duplicates them against the list, ranks them, and turns each weekly digest
into a tick-box issue whose selections become a pull request.

It lives here so that every list repository shares one implementation instead of
maintaining its own copy. A list repository only owns its `.github/research-digest.json`.

```
tools/research-digest/
├── research_digest.py       # scan → dedupe → rank → render markdown + payload
├── apply_digest.py          # ticked issue items → README edits (+ report)
├── digest_config.example.json
└── tests/                   # pytest suite with RSS/Atom fixtures
```

The reusable workflows live in `../../.github/workflows/`:

| Workflow | Purpose |
| --- | --- |
| `research-digest.yml` | Scans sources, opens the weekly digest issue with tick-boxes. |
| `digest-apply.yml` | Reads ticked items from an issue and opens a PR. |
| `research-digest-tests.yml` | Lints and tests this tool. |

## Sources

Hacker News (Algolia), GitHub (keyword and topic search), Reddit, Lobsters,
arXiv, Mastodon, Bluesky, generic RSS/Atom feeds and Product Hunt. Any source
that fails is logged and skipped, so one dead API never fails a run.

## Ranking

Raw signals are not comparable across sources (HN points vs GitHub stars vs
upvotes), so each source is:

1. capped at `max_per_source` (or a `per_source_caps` override),
2. normalised against its own best candidate, and
3. multiplied by `source_weights[<source>]` and a freshness decay
   (`0.5 ** (age_days / half_life_days)`).

The merged list is then optionally re-ranked by a model on GitHub Models.

## Using it from a list repository

In the caller repository:

```yaml
# .github/workflows/research.yml
name: Research Digest

on:
  schedule:
    - cron: '17 7 * * 1'
  workflow_dispatch:
    inputs:
      days_back:
        description: Lookback window in days (0 = config)
        default: '0'
      dry_run:
        type: boolean
        default: true

permissions:
  contents: read
  issues: write
  models: read          # lets GITHUB_TOKEN call GitHub Models

jobs:
  digest:
    uses: ranjithrajv/awesome-enhancer/.github/workflows/research-digest.yml@main
    with:
      config-path: .github/research-digest.json
      days-back: ${{ fromJSON(github.event.inputs.days_back || '0') }}
      dry-run: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.dry_run == 'true' }}
    secrets: inherit
```

```yaml
# .github/workflows/digest-apply.yml
name: Digest Apply

on:
  issues:
    types: [edited]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  apply:
    if: contains(github.event.issue.labels.*.name, 'research') && github.event.issue.state == 'open'
    uses: ranjithrajv/awesome-enhancer/.github/workflows/digest-apply.yml@main
    with:
      issue-number: ${{ github.event.issue.number }}
    secrets: inherit
```

### From a digest issue to a merge

1. The scheduled run opens an issue titled `[auto] Research digest <date>`.
2. Each candidate is a task-list item with a copy-paste entry and a suggested
   section, plus a hidden `<!-- digest-payload -->` JSON block.
3. Tick the boxes you want. Editing an issue body fires the apply workflow.
4. The apply workflow inserts the entries under the suggested `## heading`
   (creating it if missing), never duplicating a URL already on the list, and
   opens a pull request on `digest/issue-<n>` for review.

Unticking and re-editing updates the same branch and PR.

## Configuration

All keys are optional; defaults live in `research_digest.py:DEFAULTS`. See
`digest_config.example.json` for a complete example.

| Key | Default | Meaning |
| --- | --- | --- |
| `list_description` | `""` | Prompt context for the LLM relevance check. |
| `keywords` | `[]` | Substring match for RSS and Product Hunt. |
| `days_back` | `14` | Lookback window. |
| `max_llm_candidates` | `25` | Candidates sent to the LLM and shown. |
| `max_per_source` | `12` | Per-source cap before merging. |
| `per_source_caps` | `{}` | Per-source override, e.g. `{"Reddit": 6}`. |
| `source_weights` | `{}` | Per-source multiplier, e.g. `{"RSS": 0.8}`. |
| `half_life_days` | `21` | Freshness decay half-life. |
| `sections` | `[]` | Allowed sections; empty means auto-detect `##` headings from `README.md`. |
| `default_section` | `""` | Fallback when the LLM cannot pick a section. |
| `readme_files` | `["README.md"]` | Files scanned for headings. |
| `hn_queries`, `min_hn_points` | `[]`, `3` | Hacker News queries. |
| `github_queries`, `min_github_stars` | `[]`, `5` | GitHub search queries (supports `created:` filters). |
| `github_topics` | `[]` | GitHub `topic:` searches, not date-restricted. |
| `reddit_subreddits`, `min_reddit_score` | `[]`, `5` | Subreddits via the public JSON API. |
| `lobsters_queries`, `min_lobsters_score` | `[]`, `5` | Lobsters search. |
| `arxiv_queries` | `[]` | arXiv `search_query` strings, e.g. `cat:cs.DC AND all:"volunteer computing"`. |
| `mastodon_instances`, `mastodon_tags` | `[]`, `[]` | Instance × tag timelines. |
| `bluesky_queries` | `[]` | Bluesky post search (public AppView). |
| `rss_feeds` | `[]` | RSS or Atom feed URLs. |
| `producthunt` | `true` | Enabled only when `PRODUCTHUNT_TOKEN` is set. |
| `llm.model` | `openai/gpt-4o-mini` | Model id. |

### Credentials

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | yes (Actions) | GitHub search, issue dedupe, GitHub Models inference. |
| `LLM_API_KEY` | no | Overrides `GITHUB_TOKEN` for inference (any OpenAI-compatible endpoint). |
| `LLM_BASE_URL` | no | Defaults to `https://models.github.ai/inference`. |
| `PRODUCTHUNT_TOKEN` | no | Enables the Product Hunt source. |

Because GitHub Models accepts the Actions token, **no LLM secret is required**:
grant `models: read` and the digest gets LLM rankings out of the box.

## Running locally

```sh
cd tools/research-digest
python3 research_digest.py --root /path/to/list --config /path/to/list/.github/research-digest.json \
    --out /tmp/digest.md --json /tmp/digest.json --no-llm

python3 apply_digest.py --root /path/to/list --body-file /tmp/digest.md        # dry-run diff
python3 apply_digest.py --root /path/to/list --body-file /tmp/digest.md --apply
```

Useful flags: `--days-back N`, `--no-llm`, `--today YYYY-MM-DD`, `--source`
is not supported yet — narrow the config instead.

## Tests

```sh
cd tools/research-digest
python3 -m pytest      # pytest, pythonpath is configured in pyproject.toml
ruff check .
```
