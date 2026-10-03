#!/usr/bin/env node

/**
 * Prometix Keyword Harvester
 * Prikuplja keyword ideje iz Google Suggest-a (Autocomplete).
 * Node.js 18+ (bez dodatnih paketa)
 *
 * Primer:
 *   node prometix-keyword-harvester.js "protein u prahu"
 *
 * Opcije:
 *   --hl=sr                  jezik (default: sr)
 *   --gl=RS                  zemlja (default: RS)
 *   --source=web             web|youtube|news|shopping|images|books|videos
 *   --delay=1200             pauza između zahteva u ms
 *   --depth=1                dubina rekurzije, 1 ili 2 (default: 1)
 *   --max-results=1000       maksimalan broj jedinstvenih keyworda
 *   --max-requests=120       maksimalan broj HTTP zahteva
 *   --out=moji-keywordi      naziv izlaznih fajlova bez ekstenzije
 */

const fs = require('fs');
const path = require('path');

const SOURCE_MAP = {
  web: null,
  youtube: 'yt',
  news: 'n',
  shopping: 'sh',
  images: 'i',
  books: 'bo',
  videos: 'v',
};

const DEFAULT_MODIFIERS = [
  'kako',
  'koliko',
  'gde',
  'koji',
  'koja',
  'cena',
  'cene',
  'iskustva',
  'recenzija',
  'recenzije',
  'najbolji',
  'najbolje',
  'vs',
  'ili',
  'srbija',
  'beograd',
];

function parseArgs(argv) {
  const opts = {
    hl: 'sr',
    gl: 'RS',
    source: 'web',
    delay: 1200,
    depth: 1,
    maxResults: 1000,
    maxRequests: 120,
    out: null,
  };

  const seedParts = [];

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      seedParts.push(arg);
      continue;
    }

    const [rawKey, ...rawValue] = arg.slice(2).split('=');
    const value = rawValue.join('=');

    switch (rawKey) {
      case 'hl': opts.hl = value || opts.hl; break;
      case 'gl': opts.gl = value || opts.gl; break;
      case 'source': opts.source = value || opts.source; break;
      case 'delay': opts.delay = Number(value); break;
      case 'depth': opts.depth = Number(value); break;
      case 'max-results': opts.maxResults = Number(value); break;
      case 'max-requests': opts.maxRequests = Number(value); break;
      case 'out': opts.out = value || null; break;
      default:
        console.warn(`Nepoznata opcija: --${rawKey}`);
    }
  }

  return { seed: seedParts.join(' ').trim(), opts };
}

function validate(seed, opts) {
  if (!seed) {
    throw new Error('Nedostaje početni pojam. Primer: node prometix-keyword-harvester.js "protein u prahu"');
  }
  if (!(opts.source in SOURCE_MAP)) {
    throw new Error(`Nepoznat source: ${opts.source}. Dozvoljeno: ${Object.keys(SOURCE_MAP).join(', ')}`);
  }
  if (![1, 2].includes(opts.depth)) {
    throw new Error('--depth mora biti 1 ili 2.');
  }
  for (const [name, value] of [
    ['delay', opts.delay],
    ['max-results', opts.maxResults],
    ['max-requests', opts.maxRequests],
  ]) {
    if (!Number.isFinite(value) || value < 1) {
      throw new Error(`--${name} mora biti pozitivan broj.`);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'keywords';
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildFanoutQueries(base) {
  const chars = [...'abcdefghijklmnopqrstuvwxyz0123456789'];
  const queries = new Set([base]);

  for (const ch of chars) queries.add(`${base} ${ch}`);
  for (const modifier of DEFAULT_MODIFIERS) queries.add(`${base} ${modifier}`);

  return [...queries];
}

async function fetchSuggestions(query, opts, attempt = 1) {
  const url = new URL('https://suggestqueries.google.com/complete/search');
  url.searchParams.set('client', 'chrome');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', opts.hl);
  url.searchParams.set('gl', opts.gl);

  const ds = SOURCE_MAP[opts.source];
  if (ds) url.searchParams.set('ds', ds);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json,text/plain,*/*',
        'accept-language': `${opts.hl},en;q=0.8`,
      },
      signal: controller.signal,
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt <= 3) {
        const backoff = Math.min(15000, 1500 * (2 ** (attempt - 1)));
        console.warn(`HTTP ${response.status} za "${query}". Retry za ${backoff} ms...`);
        await sleep(backoff);
        return fetchSuggestions(query, opts, attempt + 1);
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const suggestions = Array.isArray(data?.[1]) ? data[1] : [];

    // client=chrome često vraća metadata objekat sa google:suggestrelevance.
    // Ne oslanjamo se na fiksni indeks metadata objekta, jer se format može menjati.
    const metadata = Array.isArray(data)
      ? data.find(item => item && typeof item === 'object' && !Array.isArray(item) && Array.isArray(item['google:suggestrelevance']))
      : null;
    const relevance = metadata?.['google:suggestrelevance'] || [];

    return suggestions
      .map((keyword, index) => ({
        keyword: typeof keyword === 'string' ? keyword : '',
        relevance: Number.isFinite(Number(relevance[index])) ? Number(relevance[index]) : null,
        rank: index + 1,
      }))
      .filter(item => item.keyword);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const { seed, opts } = parseArgs(process.argv.slice(2));
  validate(seed, opts);

  const outputBase = opts.out || `${slugify(seed)}-${opts.source}`;
  const stats = new Map();
  const seenQueries = new Set();
  const queuedBases = new Set([seed.toLowerCase()]);
  const baseQueue = [{ keyword: seed, level: 1 }];

  let requestCount = 0;

  console.log(`Seed: ${seed}`);
  console.log(`Lokacija: ${opts.hl}/${opts.gl}`);
  console.log(`Izvor: ${opts.source}`);
  console.log(`Depth: ${opts.depth}`);
  console.log(`Limit: ${opts.maxResults} keyworda / ${opts.maxRequests} zahteva\n`);

  while (baseQueue.length > 0 && stats.size < opts.maxResults && requestCount < opts.maxRequests) {
    const current = baseQueue.shift();
    const queries = current.level === 1
      ? buildFanoutQueries(current.keyword)
      : [current.keyword]; // depth 2: direktan Suggest poziv, bez novog a-z fanout-a

    for (const query of queries) {
      if (stats.size >= opts.maxResults || requestCount >= opts.maxRequests) break;

      const normalizedQuery = query.trim().toLowerCase();
      if (seenQueries.has(normalizedQuery)) continue;
      seenQueries.add(normalizedQuery);

      requestCount++;
      process.stdout.write(`[${requestCount}/${opts.maxRequests}] ${query} ... `);

      try {
        const suggestions = await fetchSuggestions(query, opts);
        console.log(`${suggestions.length}`);

        for (const suggestion of suggestions) {
          const keyword = suggestion.keyword.trim();
          if (!keyword) continue;

          const key = keyword.toLowerCase();
          const existing = stats.get(key) || {
            keyword,
            count: 0,
            relevanceMax: null,
            relevanceSum: 0,
            relevanceCount: 0,
            bestRank: null,
            seedRelevance: null,
            sourceQueries: new Set(),
          };

          existing.count += 1;
          existing.sourceQueries.add(query);

          if (suggestion.relevance !== null) {
            existing.relevanceMax = existing.relevanceMax === null
              ? suggestion.relevance
              : Math.max(existing.relevanceMax, suggestion.relevance);
            existing.relevanceSum += suggestion.relevance;
            existing.relevanceCount += 1;

            if (normalizedQuery === seed.trim().toLowerCase()) {
              existing.seedRelevance = suggestion.relevance;
            }
          }

          existing.bestRank = existing.bestRank === null
            ? suggestion.rank
            : Math.min(existing.bestRank, suggestion.rank);
          stats.set(key, existing);

          if (
            opts.depth >= 2 &&
            current.level === 1 &&
            !queuedBases.has(key) &&
            baseQueue.length < 100
          ) {
            queuedBases.add(key);
            baseQueue.push({ keyword, level: 2 });
          }

          if (stats.size >= opts.maxResults) break;
        }
      } catch (error) {
        console.log(`GREŠKA: ${error.message}`);
      }

      if (requestCount < opts.maxRequests) {
        await sleep(opts.delay);
      }
    }
  }

  const rows = [...stats.values()]
    .map(r => ({
      ...r,
      relevanceAvg: r.relevanceCount > 0 ? r.relevanceSum / r.relevanceCount : null,
    }))
    .sort((a, b) => {
      // Primarno sortiramo po Google-ovom najjačem relevance signalu.
      // Zatim prosečna relevantnost, broj pojavljivanja i najbolja pozicija.
      const maxA = a.relevanceMax ?? -1;
      const maxB = b.relevanceMax ?? -1;
      if (maxB !== maxA) return maxB - maxA;

      const avgA = a.relevanceAvg ?? -1;
      const avgB = b.relevanceAvg ?? -1;
      if (avgB !== avgA) return avgB - avgA;

      if (b.count !== a.count) return b.count - a.count;

      const rankA = a.bestRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.bestRank ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;

      return a.keyword.localeCompare(b.keyword, opts.hl);
    });

  const txtPath = path.resolve(`${outputBase}.txt`);
  const csvPath = path.resolve(`${outputBase}.csv`);
  const jsonPath = path.resolve(`${outputBase}.json`);

  fs.writeFileSync(
    txtPath,
    rows.map(r => r.keyword).join('\n') + (rows.length ? '\n' : ''),
    'utf8'
  );

  const csv = [
    ['keyword', 'google_relevance', 'avg_relevance', 'seed_relevance', 'best_rank', 'occurrences', 'source_queries'].map(csvEscape).join(','),
    ...rows.map(r => [
      r.keyword,
      r.relevanceMax ?? '',
      r.relevanceAvg === null ? '' : r.relevanceAvg.toFixed(2),
      r.seedRelevance ?? '',
      r.bestRank ?? '',
      r.count,
      [...r.sourceQueries].join(' | '),
    ].map(csvEscape).join(',')),
  ].join('\n');

  fs.writeFileSync(csvPath, csv + '\n', 'utf8');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(rows.map(r => ({
      keyword: r.keyword,
      googleRelevance: r.relevanceMax,
      averageRelevance: r.relevanceAvg === null ? null : Number(r.relevanceAvg.toFixed(2)),
      seedRelevance: r.seedRelevance,
      bestRank: r.bestRank,
      occurrences: r.count,
      sourceQueries: [...r.sourceQueries],
    })), null, 2) + '\n',
    'utf8'
  );

  console.log(`\nGotovo.`);
  console.log(`Jedinstvenih keyworda: ${rows.length}`);
  console.log('Sortiranje: Google relevance ↓, prosek ↓, occurrences ↓, best rank ↑');
  console.log(`HTTP zahteva: ${requestCount}`);
  console.log(`TXT:  ${txtPath}`);
  console.log(`CSV:  ${csvPath}`);
  console.log(`JSON: ${jsonPath}`);
}

main().catch(error => {
  console.error(`\nGreška: ${error.message}`);
  process.exit(1);
});
