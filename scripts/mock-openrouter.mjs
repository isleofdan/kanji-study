// A stand-in for OpenRouter for the checks, after the Hebrew reader's
// scripts/mock-openrouter.mjs: the checks set OPENROUTER_URL to it, so they
// never call the real model.
//   node scripts/mock-openrouter.mjs [port]
// For a drawing it answers 雨 and 峠, which are in the data, and 龘, which
// is not (the server must drop it); for a photo, 峠, 雨 and 龘 in that
// order. For an Explore question (text only) it answers EXPLORE below: two
// groups and one character the data holds, then a group of a kind the app
// does not have and a character not in the data (the server keeps three
// and drops two). POST /control sets a failure for the next calls:
//   {"fail": "status"}   answer 402 with OpenRouter's error shape
//   {"fail": "garbage"}  answer text that is not JSON
//   {"fail": null}       answer normally again
//   {"delay": 1500}      wait that many milliseconds before answering
//                        (so a check can see "Thinking…"); 0 for none
// GET /calls answers how many model requests came, and the last one.
import http from 'node:http';

const port = Number(process.argv[2]) || 8931;
const control = { fail: null, delay: 0 };
let calls = 0;
let last = null;

const EXPLORE = {
  reading: 'You want characters you would meet on old signs about weather.',
  stops: [
    { kind: 'radical', value: '173', why: 'Weather words on signs are often built on this part.' },
    { kind: 'on', value: 'ショウ', why: 'A sound that turns up again and again in temple names.' },
    { char: '峠', why: 'Old road signs in the hills often carry this one.' },
    { kind: 'colour', value: 'grey', why: 'A kind the app does not have.' },
    { char: '龘', why: 'A character the data does not hold.' },
  ],
};

const answer = (res, content) => setTimeout(() => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'mock', model: last.model, choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
}, control.delay);

http.createServer((req, res) => {
  if (req.url === '/calls') { res.end(JSON.stringify({ calls, last })); return; }
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (req.url === '/control') { Object.assign(control, JSON.parse(raw || '{}')); res.end(JSON.stringify(control)); return; }
    calls++;
    if (!(req.headers.authorization || '').startsWith('Bearer ')) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'No auth credentials found' } }));
      return;
    }
    const body = JSON.parse(raw);
    const content = body.messages.at(-1).content;
    const ask = content.find((p) => p.type === 'text').text;
    const image = content.find((p) => p.type === 'image_url')?.image_url.url || '';
    last = { model: body.model, max_tokens: body.max_tokens, ask, image_type: image.slice(5, image.indexOf(';')) };
    if (control.fail === 'status') {
      res.writeHead(402, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Insufficient credits', code: 402 } }));
      return;
    }
    if (control.fail === 'garbage') return answer(res, 'I think it is rain.');
    if (ask.includes('help a fluent reader of Japanese explore')) return answer(res, JSON.stringify(EXPLORE));
    const kanji = ask.includes('handwritten') ? ['雨', '峠', '龘'] : ['峠', '雨', '龘'];
    answer(res, JSON.stringify({ kanji }));
  });
}).listen(port, '127.0.0.1', () => console.log(`mock OpenRouter on ${port}`));
