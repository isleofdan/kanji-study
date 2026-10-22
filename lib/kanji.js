'use strict';
// The kanji data: data/kanji.json, made from KANJIDIC2 by
// scripts/build-kanji.mjs, loaded once. Every fact and every group the app
// shows comes from here, never from a model.
//   get(char)            the character's facts, or null
//   group(kind, value)   the characters sharing that fact, most frequent first
// A wrong kind or value throws an error with status 400 that names the
// valid ones.

const path = require('node:path');
const fs = require('node:fs');

const { header, kanji } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'kanji.json'), 'utf8'));

const KINDS = ['list', 'grade', 'radical', 'strokes', 'on', 'kun', 'nanori', 'variant'];
const LISTS = ['joyo', 'jinmeiyo'];
const GRADES = [1, 2, 3, 4, 5, 6, 8, 9, 10];

const byChar = new Map(kanji.map((k) => [k.c, k]));

// A kun reading's stem: the part before the okurigana dot, without the
// prefix and suffix dashes ("ひと.つ" → "ひと", "-さめ" → "さめ").
const stem = (reading) => reading.split('.')[0].replace(/-/g, '');
const onKey = (reading) => reading.replace(/-/g, '');

// Most frequent first; characters with no rank last, then by strokes.
const order = (a, b) => (a.freq ?? Infinity) - (b.freq ?? Infinity) || a.strokes - b.strokes || a.c.codePointAt(0) - b.c.codePointAt(0);

function refuse(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function get(char) {
  return byChar.get(char) || null;
}

// The characters KANJIDIC2 ties to `char` as variants, either way round,
// with `char` itself.
function variantSet(char) {
  const set = new Set([char, ...byChar.get(char).variants]);
  for (const k of kanji) if (k.variants.includes(char)) set.add(k.c);
  return [...set].filter((c) => byChar.has(c));
}

const number = (value, valid, what) => {
  const n = Number(value);
  if (!/^\d+$/.test(String(value)) || !valid(n)) throw refuse(what);
  return n;
};

function group(kind, value) {
  value = String(value ?? '');
  let members;
  switch (kind) {
    case 'list':
      if (!LISTS.includes(value)) throw refuse(`list must be one of ${LISTS.join(', ')}`);
      members = kanji.filter((k) => k.list === value);
      break;
    case 'grade': {
      const g = number(value, (n) => GRADES.includes(n), `grade must be one of ${GRADES.join(', ')}`);
      members = kanji.filter((k) => k.grade === g);
      break;
    }
    case 'radical': {
      const r = number(value, (n) => n >= 1 && n <= 214, 'radical must be a number from 1 to 214');
      members = kanji.filter((k) => k.radical === r);
      break;
    }
    case 'strokes': {
      const s = number(value, (n) => n >= 1, 'strokes must be a whole number of 1 or more');
      members = kanji.filter((k) => k.strokes === s);
      break;
    }
    case 'on':
      members = kanji.filter((k) => k.on.some((r) => onKey(r) === onKey(value)));
      break;
    case 'kun':
      members = kanji.filter((k) => k.kun.some((r) => stem(r) === stem(value)));
      break;
    case 'nanori':
      members = kanji.filter((k) => k.nanori.includes(value));
      break;
    case 'variant':
      if (!byChar.has(value)) throw refuse(`variant must be a character in the data (KANJIDIC2), got ${JSON.stringify(value)}`);
      members = variantSet(value).map((c) => byChar.get(c));
      break;
    default:
      throw refuse(`kind must be one of ${KINDS.join(', ')}`);
  }
  if (!members.length) throw Object.assign(new Error(`no characters in the data share ${kind} ${value}`), { status: 404 });
  return members.slice().sort(order);
}

// The heading's words for a group: "画数 23", "音読み ショウ", "部首 雨 (173)".
function label(kind, value) {
  switch (kind) {
    case 'list': return value === 'joyo' ? '常用漢字' : '人名用漢字';
    case 'grade': return `学年 ${value}`;
    case 'radical': {
      const k = kanji.find((x) => x.radical === Number(value));
      return `部首 ${k ? k.radical_char : ''} (${value})`;
    }
    case 'strokes': return `画数 ${value}`;
    case 'on': return `音読み ${onKey(value)}`;
    case 'kun': return `訓読み ${stem(value)}`;
    case 'nanori': return `名乗り ${value}`;
    case 'variant': return `異体字 ${value}`;
    default: return `${kind} ${value}`;
  }
}

// Unknown characters are refused naming what is valid.
function mustGet(char) {
  const k = get(char);
  if (!k) throw Object.assign(new Error(`character must be one of the ${kanji.length} kanji in the data (KANJIDIC2), got ${JSON.stringify(char)}`), { status: 404 });
  return k;
}

// The characters of `text` that are in the data, each once, in order.
function inText(text) {
  const seen = new Set();
  for (const ch of String(text || '')) if (byChar.has(ch)) seen.add(ch);
  return [...seen];
}

module.exports = { header, count: kanji.length, KINDS, LISTS, GRADES, get, mustGet, group, label, stem, inText };
