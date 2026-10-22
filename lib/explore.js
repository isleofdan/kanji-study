'use strict';
// The Explore page's Themes: angles into the data, each a title line in
// plain words and the groups or characters it opens. Computed here by code,
// from KANJIDIC2 (lib/kanji.js) and from Dan's records (lib/db.js), never by
// a model. A theme drawn from his records shows groups, never counts of
// what he did (CLAUDE.md, rule 5); it is left out of the list while his
// records give it nothing.
//   themes()        the themes to list, each { id, title, href }
//   theme(id)       one theme: { id, title, groups: [{ kind, value, label, count }] }
//                   or { id, title, chars: [c, …] }; an unknown id is refused
//                   naming the valid ids
//   ask(question)   Ask: saves the question, reads it into stops through the
//                   model, keeps only stops the data holds (below)

const kanji = require('./kanji');
const db = require('./db');
const upstream = require('./upstream');
const vision = require('./vision');

const group = (kind, value) => ({ kind, value: String(value), label: kanji.label(kind, value), count: kanji.group(kind, value).length });
const onKey = (r) => r.replace(/-/g, '');
const distinct = (items) => [...new Map(items.map((g) => [`${g.kind}\u0000${g.value}`, g])).values()];

// A group named by an opens row may be anything typed into an address;
// only one with characters in the data counts.
function groupOrNull(kind, value) {
  try { return group(kind, value); } catch { return null; }
}

// --- from the data alone, computed once ------------------------------------

const once = (make) => { let v; return () => (v ??= make()); };

const byStrokes = (a, b) => a.strokes - b.strokes || a.c.codePointAt(0) - b.c.codePointAt(0);

// Every character, by way of the 画数 groups (each has one stroke count).
const everyChar = once(() => kanji.values('strokes').flatMap((s) => kanji.group('strokes', s)));

// The `n` groups of a kind with the fewest (or most) characters, counted in
// one pass over the data rather than one pass per group.
function ranked(kind, keysOf, n, fewest) {
  const counts = new Map();
  for (const k of everyChar()) for (const key of new Set(keysOf(k))) counts.set(key, (counts.get(key) || 0) + 1);
  const cmp = (a, b) => (fewest ? a[1] - b[1] : b[1] - a[1]) || (typeof a[0] === 'number' ? a[0] - b[0] : String(a[0]).localeCompare(String(b[0]), 'ja'));
  return [...counts].sort(cmp).slice(0, n).map(([key]) => group(kind, key));
}

const DATA = {
  'names-only': {
    title: 'Characters that appear only in names',
    groups: once(() => [group('list', 'jinmeiyo')]),
  },
  'joyo-unranked': {
    title: '常用 characters with no newspaper frequency rank',
    chars: once(() => kanji.group('list', 'joyo').filter((k) => k.freq === null).sort(byStrokes).map((k) => k.c)),
  },
  'most-variants': {
    title: 'Characters with the most 異体字',
    chars: once(() => everyChar().filter((k) => k.variants.length)
      .sort((a, b) => b.variants.length - a.variants.length || byStrokes(a, b)).slice(0, 30).map((k) => k.c)),
  },
  'rare-radicals': {
    title: 'Radicals with the fewest characters',
    groups: once(() => ranked('radical', (k) => [k.radical], 20, true)),
  },
  'most-strokes': {
    title: 'The most strokes',
    chars: once(() => everyChar().filter((k) => k.strokes >= 25)
      .sort((a, b) => b.strokes - a.strokes || a.c.codePointAt(0) - b.c.codePointAt(0)).map((k) => k.c)),
  },
  'many-readings': {
    title: 'Readings that mean many characters',
    groups: once(() => ranked('on', (k) => k.on.map(onKey), 20, false)),
  },
};

// --- from his records, computed on every request ---------------------------

const savedChars = () => db.savedList().map((s) => kanji.get(s.char)).filter(Boolean);

const RECORDS = {
  'saved-radicals': {
    title: 'The radicals of your saved characters',
    groups: () => distinct(savedChars().map((k) => group('radical', k.radical)))
      .sort((a, b) => Number(a.value) - Number(b.value)),
  },
  'saved-readings': {
    title: 'Readings shared by your saved characters',
    groups: () => {
      const by = new Map();
      for (const k of savedChars()) {
        const keys = new Set([...k.on.map((r) => `on\u0000${onKey(r)}`), ...k.kun.map((r) => `kun\u0000${kanji.stem(r)}`)]);
        for (const key of keys) by.set(key, (by.get(key) || 0) + 1);
      }
      return [...by].filter(([, n]) => n >= 2).map(([key]) => groupOrNull(...key.split('\u0000'))).filter(Boolean);
    },
  },
  'last-catch': {
    title: 'Where your last catch leads',
    groups: () => {
      const last = db.latest(1)[0];
      const k = last && kanji.get(last.char);
      if (!k) return [];
      return distinct([group('radical', k.radical), group('strokes', k.strokes),
        ...k.on.map((r) => groupOrNull('on', onKey(r))), ...k.kun.map((r) => groupOrNull('kun', kanji.stem(r)))].filter(Boolean));
    },
  },
  'opened-unsaved': {
    title: 'Groups you opened but have no character saved in',
    groups: () => {
      const saved = db.savedSet();
      const opened = distinct(db.opens().filter((o) => kanji.KINDS.includes(o.from_kind))
        .map((o) => ({ kind: o.from_kind, value: o.from_value })));
      return opened.map((o) => groupOrNull(o.kind, o.value)).filter(Boolean)
        .filter((g) => !kanji.group(g.kind, g.value).some((k) => saved.has(k.c)));
    },
  },
};

// Records first: they are his own way in.
const ALL = { ...RECORDS, ...DATA };
const IDS = Object.keys(ALL);

function build(id) {
  const t = ALL[id];
  return t.chars ? { id, title: t.title, chars: t.chars() } : { id, title: t.title, groups: t.groups() };
}

// A theme of one group opens that group's page; any other its theme page.
const href = (t) => (t.groups && t.groups.length === 1
  ? `/g/${encodeURIComponent(t.groups[0].kind)}/${encodeURIComponent(t.groups[0].value)}`
  : `/explore/theme/${t.id}`);

function themes() {
  return IDS.map(build)
    .filter((t) => (t.chars || t.groups).length > 0)
    .map((t) => ({ id: t.id, title: t.title, href: href(t) }));
}

function theme(id) {
  if (!IDS.includes(id)) throw Object.assign(new Error(`theme must be one of ${IDS.join(', ')}`), { status: 404 });
  return build(id);
}

// --- Ask: a question read into stops by a model ----------------------------
// Only when Dan presses "Explore". The model (the one lib/vision.js uses)
// may name a group (kind and value) or a character, with one sentence on
// why; the server keeps only stops the data holds, labels each from the
// data, and saves the rest as a count (CLAUDE.md, rule 2). The reading
// sentence and each why are the only model-written words on screen, shown
// under "In the model's words".

const QUESTION_MAX = 500;
const ASK_TIMEOUT_MS = 90000;
const ASK_MAX_TOKENS = 1500;
const MAX_STOPS = 10;
const SENTENCE_MAX = 400;

function instructions(question) {
  const radicals = kanji.values('radical').map((r) => `${r} ${kanji.label('radical', r).replace(/^部首 (.*) \(\d+\)$/, '$1')}`).join(', ');
  const strokes = kanji.values('strokes');
  return [
    'You help a fluent reader of Japanese explore KANJIDIC2, a kanji dictionary file. They asked:',
    `"""${question}"""`,
    '',
    'Answer with groups of characters the app already has, or single characters. The kinds of group, and what the value is:',
    `- list: "joyo" (常用漢字) or "jinmeiyo" (人名用漢字).`,
    `- grade: one of ${kanji.GRADES.join(', ')} (1–6 the school grade of a 教育 kanji, 8 the rest of 常用, 9 人名用, 10 人名用 variants of 常用).`,
    `- radical: the classical (KangXi) radical number, 1–214. The radicals: ${radicals}.`,
    `- strokes: a stroke count, ${strokes[0]}–${strokes.at(-1)}.`,
    '- on: an 音読み in katakana, as KANJIDIC2 writes it (e.g. "ショウ").',
    '- kun: a 訓読み in hiragana, the part before the okurigana dot (e.g. "あめ").',
    '- nanori: a name reading in hiragana.',
    '- variant: one kanji; the group is it and its 異体字.',
    '',
    `Answer with ONE JSON object and nothing else: {"reading": "<one sentence: how you read the question>", "stops": [{"kind": "<kind>", "value": "<value>", "why": "<one sentence>"} or {"char": "<one kanji>", "why": "<one sentence>"}]}.`,
    `At most ${MAX_STOPS} stops, best first. Each "why" says in one sentence why that stop answers the question. Neither "reading" nor any "why" may state a dictionary fact (a meaning, a reading, a stroke count, a grade): the app shows those from the data itself.`,
  ].join('\n');
}

class AskError extends Error {}

// One stop from the model, as the app keeps it: labelled from the data, or
// null when the data does not hold it.
const sentence = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, SENTENCE_MAX) : null);
function keep(stop) {
  if (!stop || typeof stop !== 'object') return null;
  if (typeof stop.char === 'string') {
    const k = kanji.get(stop.char.trim());
    return k ? { char: k.c, label: k.c, meaning: (k.meaning || []).slice(0, 3), why: sentence(stop.why) } : null;
  }
  if (!kanji.KINDS.includes(stop.kind)) return null;
  const g = groupOrNull(stop.kind, stop.value);
  return g ? { ...g, why: sentence(stop.why) } : null;
}

// Answers { reading, stops, dropped }, or throws AskError with the line
// to show.
async function askModel(question) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AskError('Could not explore: no OpenRouter key is set on the server (OPENROUTER_API_KEY).');
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ASK_TIMEOUT_MS);
  let res, text;
  try {
    res = await upstream.call('OpenRouter', vision.OPENROUTER_URL, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'http-referer': 'https://kanji-study-dan.fly.dev',
        'x-title': 'kanji-study',
      },
      body: JSON.stringify({
        model: vision.MODEL,
        temperature: 0,
        max_tokens: ASK_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: instructions(question) }] }],
      }),
    });
    text = await res.text();
  } catch (e) {
    if (e.name === 'AbortError') {
      upstream.record('OpenRouter', null, `no answer within ${ASK_TIMEOUT_MS / 1000} seconds`);
      throw new AskError(`Could not explore: the model did not answer within ${ASK_TIMEOUT_MS / 1000} seconds.`);
    }
    throw new AskError(`Could not explore: OpenRouter could not be reached (${e.cause?.message || e.message}).`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.parse(text).error?.message || ''; } catch {}
    throw new AskError(`Could not explore: the model answered ${res.status}${detail ? ` (${detail})` : ''}.`);
  }
  let content = '';
  try { content = JSON.parse(text).choices?.[0]?.message?.content || ''; } catch {}
  const got = vision.firstJsonObject(content);
  if (!got || !Array.isArray(got.stops)) throw new AskError('Could not explore: the model did not answer the stops as JSON.');
  const stops = [];
  const seen = new Set();
  let dropped = 0;
  for (const s of got.stops) {
    const kept = keep(s);
    const id = kept && (kept.char || `${kept.kind}\u0000${kept.value}`);
    if (!kept || seen.has(id) || stops.length >= MAX_STOPS) { dropped++; continue; }
    seen.add(id);
    stops.push(kept);
  }
  return { reading: sentence(got.reading), stops, dropped };
}

// Saves the question, asks the model, and saves what came back (or the
// failure line) on the same row. Answers the saved exploration.
async function ask(question) {
  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) throw Object.assign(new Error(`question is required: up to ${QUESTION_MAX} characters`), { status: 400 });
  if ([...q].length > QUESTION_MAX) throw Object.assign(new Error(`question must be at most ${QUESTION_MAX} characters; this one is ${[...q].length}`), { status: 400 });
  const row = db.addExploration(q, vision.MODEL);
  const started = Date.now();
  try {
    const got = await askModel(q);
    return db.finishExploration(row.id, { ...got, tookMs: Date.now() - started });
  } catch (e) {
    if (!(e instanceof AskError)) throw e;
    return db.finishExploration(row.id, { error: e.message, tookMs: Date.now() - started });
  }
}

module.exports = { IDS, RECORD_IDS: Object.keys(RECORDS), themes, theme, ask, instructions, QUESTION_MAX, ASK_TIMEOUT_MS, ASK_MAX_TOKENS };
