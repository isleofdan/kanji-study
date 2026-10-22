'use strict';
// The kanji data (data/kanji.json, from KANJIDIC2) and its groups.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const kanji = require('../lib/kanji');

const FIELDS = ['c', 'list', 'grade', 'radical', 'radical_char', 'strokes', 'freq', 'on', 'kun', 'nanori', 'variants'];

test('the data file has every field for 雨, 峠, 辻, 學 and 一', () => {
  for (const c of ['雨', '峠', '辻', '學', '一']) {
    const k = kanji.get(c);
    assert.ok(k, `${c} is in the data`);
    assert.deepEqual(Object.keys(k), FIELDS, c);
  }
  assert.deepEqual(kanji.get('雨'), { c: '雨', list: 'joyo', grade: 1, radical: 173, radical_char: '雨', strokes: 8, freq: 950, on: ['ウ'], kun: ['あめ', 'あま-', '-さめ'], nanori: [], variants: [] });
  assert.equal(kanji.get('峠').list, 'joyo');
  assert.equal(kanji.get('峠').radical_char, '山');
  assert.equal(kanji.get('辻').list, 'jinmeiyo');
  assert.equal(kanji.get('辻').grade, 9);
  assert.ok(kanji.get('學').variants.includes('学'), '學 names 学 as its variant');
  assert.ok(kanji.get('学').variants.includes('學'), '学 names 學 as its variant');
  assert.equal(kanji.get('一').freq, 2);
});

test('the counts: 13,108 characters, 2,136 常用 and 863 人名用, with the licence line in the header', () => {
  assert.equal(kanji.count, 13108);
  assert.equal(kanji.header.joyo, 2136);
  assert.equal(kanji.header.jinmeiyo, 863);
  assert.equal(kanji.group('list', 'joyo').length, 2136);
  assert.equal(kanji.group('list', 'jinmeiyo').length, 863);
  assert.match(kanji.header.licence, /KANJIDIC2 dictionary file.*Electronic Dictionary Research and Development Group/);
});

const sortedByFrequency = (members) => {
  for (let i = 1; i < members.length; i++) {
    const a = members[i - 1], b = members[i];
    const fa = a.freq ?? Infinity, fb = b.freq ?? Infinity;
    if (fa > fb || (fa === fb && a.strokes > b.strokes)) return `${a.c} (${a.freq}, ${a.strokes}) before ${b.c} (${b.freq}, ${b.strokes})`;
  }
  return true;
};

test('each kind of group answers and sorts by frequency, unranked last, then by strokes', () => {
  const cases = [['list', 'jinmeiyo', '辻'], ['grade', '1', '雨'], ['radical', '173', '雨'], ['strokes', '9', '峠'],
    ['on', 'ウ', '雨'], ['kun', 'あめ', '雨'], ['nanori', 'かず', '一'], ['variant', '學', '学']];
  for (const [kind, value, member] of cases) {
    const g = kanji.group(kind, value);
    assert.ok(g.some((k) => k.c === member), `${kind} ${value} holds ${member}`);
    assert.equal(sortedByFrequency(g), true, `${kind} ${value}`);
  }
  const rain = kanji.group('radical', 173).map((k) => k.c);
  assert.deepEqual(rain.slice(0, 5), ['電', '震', '露', '需', '雨']);
  // a kun reading groups by its stem, before the okurigana dot
  assert.ok(kanji.group('kun', 'まな.ぶ').some((k) => k.c === '学'));
  assert.ok(kanji.group('kun', 'まな').some((k) => k.c === '学'));
});

test('an unknown kind, value or character is refused naming what is valid', () => {
  assert.throws(() => kanji.group('colour', '1'), { status: 400, message: 'kind must be one of list, grade, radical, strokes, on, kun, nanori, variant' });
  assert.throws(() => kanji.group('list', 'kyoiku'), { status: 400, message: 'list must be one of joyo, jinmeiyo' });
  assert.throws(() => kanji.group('grade', '7'), { status: 400, message: 'grade must be one of 1, 2, 3, 4, 5, 6, 8, 9, 10' });
  assert.throws(() => kanji.group('radical', '215'), { status: 400, message: 'radical must be a number from 1 to 214' });
  assert.throws(() => kanji.mustGet('A'), { status: 404, message: /^character must be one of the 13108 kanji in the data/ });
});
