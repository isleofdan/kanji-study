// Builds data/kanji.json from KANJIDIC2, the Electronic Dictionary Research
// and Development Group's kanji dictionary file. Downloads the file, reads
// the fields the app shows, and writes one compact line per character.
//   node scripts/build-kanji.mjs
// Only the compact file is committed, never the original.
//
// Field meanings, from KANJIDIC2's own documentation (the DTD inside the
// file, and https://www.edrdg.org/wiki/KANJIDIC_Project.html):
//   grade 1–6  a 教育 kanji, taught in that school grade (常用)
//   grade 8    the remaining 常用 kanji, taught in junior high school
//   grade 9    a 人名用 kanji ("regular" name kanji)
//   grade 10   a 人名用 kanji that is a variant of a 常用 kanji
//   rad_value of rad_type "classical": the KangXi radical number, 1–214
//   stroke_count: the first is the accepted count, later ones are miscounts
//   freq: newspaper frequency rank, 1–2,501; absent when not ranked
//   reading ja_on (katakana), ja_kun (hiragana, okurigana after a "."),
//   nanori: readings now only used in names
//   variant: a cross-reference to another kanji, by var_type; jis208,
//     jis212, jis213 (kuten) and ucs (a code point) name a character and
//     are resolved here; the others (deroo, nelson_c, njecd, oneill, s_h)
//     are dictionary index numbers and are left out and counted.
//   meaning with no m_lang attribute: an English meaning; those with one
//     (fr, es, pt) are left out. Kept in file order; a character with
//     none has no meaning field.
import { gunzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'http://www.edrdg.org/kanjidic/kanjidic2.xml.gz';
const PROJECT = 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project';
const LICENCE_URL = 'https://www.edrdg.org/edrdg/licence.html';
const LICENCE = 'This app uses the KANJIDIC2 dictionary file. This file is the property of the Electronic Dictionary Research and Development Group, and is used in conformance with the Group\'s licence (Creative Commons Attribution-ShareAlike 4.0).';
const RESOLVABLE = new Set(['jis208', 'jis212', 'jis213', 'ucs']);

// 人名用 additions newer than KANJIDIC2's edition, applied until KANJIDIC2
// carries them: only to characters already in the file, and only their
// list and grade (9, KANJIDIC2's grade for a 人名用 kanji).
//   勒: added to the 人名用漢字 by the Ministry of Justice (法務省) on
//   26 Jun 2026 (令和8年6月26日), making 864. Source: Japanese Wikipedia's
//   人名用漢字 page (https://ja.wikipedia.org/wiki/人名用漢字, read 22 Oct
//   2026: "2026年（令和08年）6月26日、「勒」を追加し、合計864字となる"); the
//   法務省 page on 人名用漢字 (https://www.moj.go.jp/MINJI/minji86.html) is
//   the official list.
const JINMEIYO_ADDED = ['勒'];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'data', 'kanji.json');

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE} answered ${res.status}`);
const xml = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');

const tag = (s, name) => { const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(s); return m ? m[1] : null; };
const all = (s, re) => [...s.matchAll(re)].map((m) => m[1]);
// Meanings are English text and may hold XML's escapes ("&amp;", "&apos;").
const XML_ESCAPES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescapeXml = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m, k) => XML_ESCAPES[k]);
const header = xml.slice(xml.indexOf('<header>'), xml.indexOf('</header>'));

const blocks = xml.split('<character>').slice(1).map((b) => b.slice(0, b.indexOf('</character>')));
const byCode = new Map(); // "jis208:1-19-56" or "ucs:5b66" → character
const raw = blocks.map((b) => {
  const c = tag(b, 'literal');
  for (const m of b.matchAll(/<cp_value cp_type="([^"]+)">([^<]+)<\/cp_value>/g)) byCode.set(`${m[1]}:${m[2].toLowerCase()}`, c);
  return { c, b };
});

let variantsLeftOut = 0;
const kanji = raw.map(({ c, b }) => {
  const grade = Number(tag(b, 'grade')) || null;
  const list = grade === null ? null : grade <= 8 ? 'joyo' : 'jinmeiyo';
  const radical = Number(/<rad_value rad_type="classical">(\d+)<\/rad_value>/.exec(b)[1]);
  const variants = [];
  for (const m of b.matchAll(/<variant var_type="([^"]+)">([^<]+)<\/variant>/g)) {
    const hit = RESOLVABLE.has(m[1]) ? byCode.get(`${m[1]}:${m[2].toLowerCase()}`) : null;
    if (hit && hit !== c) { if (!variants.includes(hit)) variants.push(hit); } else variantsLeftOut++;
  }
  const freq = Number(tag(b, 'freq')) || null;
  const meaning = all(b, /<meaning>([^<]+)<\/meaning>/g).map(unescapeXml);
  const added = JINMEIYO_ADDED.includes(c) && list === null;
  return {
    c,
    list: added ? 'jinmeiyo' : list,
    grade: added ? 9 : grade,
    radical,
    radical_char: String.fromCodePoint(0x2f00 + radical - 1).normalize('NFKC'),
    strokes: Number(tag(b, 'stroke_count')),
    freq,
    on: all(b, /<reading r_type="ja_on">([^<]+)<\/reading>/g),
    kun: all(b, /<reading r_type="ja_kun">([^<]+)<\/reading>/g),
    nanori: all(b, /<nanori>([^<]+)<\/nanori>/g),
    variants,
    ...(meaning.length ? { meaning } : {}),
  };
});
const addedFound = JINMEIYO_ADDED.filter((c) => kanji.some((k) => k.c === c));

const head = {
  source: 'KANJIDIC2',
  licence: LICENCE,
  licence_url: LICENCE_URL,
  project: PROJECT,
  download: SOURCE,
  file_version: tag(header, 'file_version'),
  database_version: tag(header, 'database_version'),
  date_of_creation: tag(header, 'date_of_creation'),
  characters: kanji.length,
  joyo: kanji.filter((k) => k.list === 'joyo').length,
  jinmeiyo: kanji.filter((k) => k.list === 'jinmeiyo').length,
  jinmeiyo_added: addedFound,
  with_meaning: kanji.filter((k) => k.meaning).length,
  variants_left_out: variantsLeftOut,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `{"header":${JSON.stringify(head)},\n"kanji":[\n${kanji.map((k) => JSON.stringify(k)).join(',\n')}\n]}\n`);
console.log(`wrote ${out}: ${head.characters} characters, 常用 ${head.joyo}, 人名用 ${head.jinmeiyo} (added here: ${addedFound.join(' ') || 'none'}), with meanings ${head.with_meaning}, variants left out ${variantsLeftOut}, KANJIDIC2 ${head.database_version}`);
