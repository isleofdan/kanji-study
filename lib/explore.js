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

const kanji = require('./kanji');
const db = require('./db');

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

module.exports = { IDS, RECORD_IDS: Object.keys(RECORDS), themes, theme };
