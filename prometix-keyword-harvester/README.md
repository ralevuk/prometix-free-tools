# Prometix Keyword Harvester

**English** | [Srpski](README.sr.md)

A small command-line tool that collects keyword ideas from Google Autocomplete (Google Suggest). You give it one seed phrase; it asks Google for completions of that phrase and of many variations of it, then exports the unique keywords to TXT, CSV and JSON, sorted by Google's own relevance score.

- No API key, no account, no dependencies — a single script.
- Requires **Node.js 18 or later**.
- Console messages are in Serbian; defaults target Serbia (`--hl=sr --gl=RS`). Both are easy to change, see [Options](#options).

Background and a walkthrough of the method (in Serbian): [Tajni Google link: besplatno istraživanje ključnih reči](https://prometix.net/blog/tajni-google-link-besplatno-istrazivanje-kljucnih-reci).

## Quick start

**Windows (double-click):** run `start.bat`, type the keyword and the depth when asked.

**Any OS (terminal):**

```bash
node prometix-keyword-harvester.js "protein u prahu"
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--hl=` | `sr` | Interface language of the suggestions. |
| `--gl=` | `RS` | Country of the suggestions. |
| `--source=` | `web` | Which Google property to query: `web`, `youtube`, `news`, `shopping`, `images`, `books`, `videos`. |
| `--depth=` | `1` | `1` or `2`. See [How it works](#how-it-works). |
| `--delay=` | `1200` | Pause between requests, in milliseconds. |
| `--max-requests=` | `120` | Maximum number of HTTP requests per run. |
| `--max-results=` | `1000` | Stop after this many unique keywords. |
| `--out=` | `<seed>-<source>` | Base name of the output files, without extension. |

## Examples

Deeper search:

```bash
node prometix-keyword-harvester.js "protein u prahu" --depth=2 --max-requests=200
```

YouTube suggestions:

```bash
node prometix-keyword-harvester.js "protein u prahu" --source=youtube
```

Another language and country:

```bash
node prometix-keyword-harvester.js "running shoes" --hl=en --gl=US
```

Custom output name:

```bash
node prometix-keyword-harvester.js "running shoes" --hl=en --gl=US --out=shoes-us
```

## Output

Three files are written to the folder you run the command from (with `start.bat`, that is the tool's own folder). By default they are named after the seed and the source, e.g. `protein-u-prahu-web.txt`.

| File | Contents |
| --- | --- |
| `.txt` | Keyword list only, one per line, already sorted. |
| `.csv` | Detailed table (columns below). |
| `.json` | The same data as the CSV, as JSON. |

### Columns

| CSV column | JSON field | Meaning |
| --- | --- | --- |
| `keyword` | `keyword` | The keyword. |
| `google_relevance` | `googleRelevance` | The highest Google Suggest relevance score the keyword received. |
| `avg_relevance` | `averageRelevance` | Average relevance across all queries in which it appeared. |
| `seed_relevance` | `seedRelevance` | Relevance received for the original seed query, if it appeared there. |
| `best_rank` | `bestRank` | Best position in the autocomplete results (1 is best). |
| `occurrences` | `occurrences` | How many times the keyword was found across all queries. |
| `source_queries` | `sourceQueries` | The queries through which the keyword was found. |

### Sorting

1. `google_relevance` — higher is better
2. `avg_relevance` — higher is better
3. `occurrences` — higher is better
4. `best_rank` — lower is better

## Next step: analyze the results with AI

The raw list still contains noise. Paste the prompt below into an AI assistant (ChatGPT, Claude, Gemini…), fill in your business, and paste the contents of the `.csv` file at the end. You get the keywords cleaned, grouped by search intent, and a shortlist to target first.

```text
I'm pasting a CSV exported from a Google Suggest keyword harvester for my business's main search term. Columns: keyword, google_relevance, avg_relevance, seed_relevance, best_rank, occurrences, source_queries.

MY BUSINESS: [what you do, city/service area]

Do this:
1. Remove keywords that are clearly irrelevant to my business, duplicates with only spelling differences, and competitor brand names.
2. Group the remaining keywords by search intent: informational, commercial, transactional, local.
3. Within each group, sort by google_relevance (higher first), then occurrences (higher first), then best_rank (lower first).
4. Note: google_relevance is NOT search volume. Treat it as a relative signal only.

Output as a table: Keyword | Intent | Relevance | Occurrences | Suggested Use (blog topic / service page / FAQ / product page).
Then list the top 10 keywords I should target first and explain why in one sentence each.

[PASTE CSV HERE]
```

## How it works

**Depth 1** sends the seed itself plus a fan-out of variations — 53 queries in total:

- the seed followed by each letter `a`–`z` and digit `0`–`9` (`protein u prahu a`, `protein u prahu b`, …)
- the seed followed by each of 16 modifiers (`kako`, `koliko`, `gde`, `cena`, `iskustva`, `najbolji`, `vs`, `srbija`, …)

**Depth 2** additionally takes up to 100 of the keywords found at depth 1 and asks Google for suggestions for each of them directly (without a new a–z fan-out). Raise `--max-requests` to make room for these — the default of 120 leaves only 67 requests after the first 53.

The modifiers are Serbian. For another language, edit the `DEFAULT_MODIFIERS` list at the top of `prometix-keyword-harvester.js`.

## Important

- **Google Suggest relevance is NOT search volume.** It is an internal signal for ranking Autocomplete results, and Google does not officially document it as a public SEO metric. Use the results as a relevance signal and a discovery tool, not as data on monthly search volume.
- The tool uses Google's unofficial, undocumented suggest endpoint. It may change or be rate-limited without notice. Keep `--delay` reasonable; on HTTP 429 or 5xx the tool retries up to three times with increasing pauses.

## License

[MIT](../LICENSE) © Radovan Vukovic / Prometix
