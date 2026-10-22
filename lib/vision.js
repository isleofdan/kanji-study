'use strict';
// Reading a drawing or a photo: one call to OpenRouter, through
// lib/upstream.js, only when Dan presses "Read it". The model is asked for
// the kanji it sees as one JSON object; the server keeps only characters in
// the data (KANJIDIC2) and answers them as candidates for Dan to tap. The
// model never writes a fact (CLAUDE.md, this app's rule 2).
// The pattern is the Hebrew reader's lib/lookup.js: the model, the key from
// OPENROUTER_API_KEY, OPENROUTER_URL (the stand-in in the checks), a time
// limit.

const upstream = require('./upstream');
const kanji = require('./kanji');

// The Hebrew reader's card model; OpenRouter lists it with image input.
const MODEL = 'anthropic/claude-sonnet-4.6';
const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 60000;
const MAX_TOKENS = 200;
const MAX_DRAWN = 5;

const ASK = {
  drawn: 'This is one handwritten Japanese kanji, drawn with a finger. Answer with ONE JSON object and nothing else: {"kanji": [up to five single characters, the most likely first]}.',
  photo: 'This is a photo that may hold Japanese text (a sign, a menu, a plaque, subtitles). Answer with ONE JSON object and nothing else: {"kanji": [every kanji you can read in it, each once, in reading order]}. Kana, latin letters and digits are left out.',
};

class ReadError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function firstJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

// kind: 'drawn' or 'photo'; image: a data URL.
// Answers { candidates, answered, dropped }.
async function read(kind, image) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ReadError(503, 'Could not read it: no OpenRouter key is set on the server (OPENROUTER_API_KEY).');
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let res, text;
  try {
    res = await upstream.call('OpenRouter', OPENROUTER_URL, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'http-referer': 'https://kanji-study-dan.fly.dev',
        'x-title': 'kanji-study',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: ASK[kind] }, { type: 'image_url', image_url: { url: image } }] }],
      }),
    });
    text = await res.text();
  } catch (e) {
    if (e.name === 'AbortError') {
      upstream.record('OpenRouter', null, `no answer within ${TIMEOUT_MS / 1000} seconds`);
      throw new ReadError(504, `Could not read it: the model did not answer within ${TIMEOUT_MS / 1000} seconds.`);
    }
    throw new ReadError(502, `Could not read it: OpenRouter could not be reached (${e.cause?.message || e.message}).`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.parse(text).error?.message || ''; } catch {}
    throw new ReadError(502, `Could not read it: the model answered ${res.status}${detail ? ` (${detail})` : ''}.`);
  }
  let content = '';
  try { content = JSON.parse(text).choices?.[0]?.message?.content || ''; } catch {}
  const got = firstJsonObject(content);
  if (!got || !Array.isArray(got.kanji)) throw new ReadError(502, 'Could not read it: the model did not answer the kanji as JSON.');
  const answered = got.kanji.map(String);
  const seen = new Set();
  for (const c of answered) if (kanji.get(c)) seen.add(c);
  let candidates = [...seen];
  if (kind === 'drawn') candidates = candidates.slice(0, MAX_DRAWN);
  return { candidates, answered, dropped: answered.filter((c) => !kanji.get(c)) };
}

module.exports = { read, ReadError, MODEL, TIMEOUT_MS, MAX_TOKENS };
