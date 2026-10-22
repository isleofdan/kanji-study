# Kanji

A personal kanji tool for one reader of Japanese, used mostly on a phone,
behind a passphrase. It is a reader's tool, not a course: it is for the
rare character met away from a desk, in film subtitles, on a menu, on a
plaque at a temple, in a novel.

What you see when you sign in:

- **Catch** (the front page). Four large buttons: **Type** (type the
  character or the words around it; the kanji in it show as large
  characters to tap), **Draw** (draw it with a finger, then **Read it**),
  **Photo** (take or pick a picture, then **Read it**) and **Note** (a
  note to yourself, such as "the plaque at the temple gate, something with
  雨 on top"), with an optional **Where?** line. A catch need not end in a
  character: **Keep as a loose end** keeps it for later. Below the buttons,
  **Loose ends** (open one to finish it by typing, drawing, or reading its
  picture) and **Latest** (the last ten characters caught).
- **A page for each character**: the character, **Save** (it then reads
  **Saved**, in the same place), where and when it was caught, and its
  facts under the names a Japanese reader knows them by: 常用漢字 or
  人名用漢字, 学年, 部首, 画数, 音読み, 訓読み, 名乗り, 異体字. Every fact is
  a link to the group of characters that share it.
- **A group page**: what the characters share ("部首 山 (46)"), how many
  there are, and the characters as a grid, most frequent first, with the
  one you came from outlined and your saved ones tinted. Groups of more
  than 300 show the first 300 and a **Show all** button.
- **Yours**: your saved characters, newest first.
- **Status**: when this copy started, which version it runs, the last
  failure from outside the app, and where the kanji facts come from.

Nothing reminds, counts streaks, or awards anything. A model is used for
one thing only: reading a drawing or a photo, when **Read it** is pressed.
It never supplies a fact; the app keeps only the characters it names that
are in the dataset, and offers them to tap.

## Where the kanji facts come from

This app uses the KANJIDIC2 dictionary file. This file is the property of
the Electronic Dictionary Research and Development Group, and is used in
conformance with the Group's licence (Creative Commons
Attribution-ShareAlike 4.0): https://www.edrdg.org/edrdg/licence.html.
The project page: https://www.edrdg.org/wiki/index.php/KANJIDIC_Project.
`scripts/build-kanji.mjs` downloads the file and writes the compact
`data/kanji.json` the app reads (13,108 characters; 2,136 常用 and 863
人名用 as KANJIDIC2's grades mark them); only that file is kept here. Run
`node scripts/build-kanji.mjs` to rebuild it from the current KANJIDIC2.

## How it is built

Made from `isleofdan/starting-kit`: one plain Node server
(`server.js`), plain HTML, CSS and browser scripts in `public/`, no build
step. Dan's records (catches, saved characters, and which character pages
were opened from which group) are one SQLite file under `DATA_DIR`, with
caught pictures beside it (`lib/db.js`). The kanji facts and groups come
from `lib/kanji.js`; reading a picture goes through `lib/vision.js` to
OpenRouter. It goes live only through the Deploy workflow, run by hand.
The rules every session on it follows: `CLAUDE.md`. State and decisions:
`PLAN.md`.

## Running it on a computer

    npm install
    APP_PASSWORD=try-me COOKIE_SECRET=any-long-text npm run dev

Then open http://localhost:8080 and sign in with `try-me`. Records go to
`./var`. **Read it** needs `OPENROUTER_API_KEY` (and, to use the stand-in
model, `OPENROUTER_URL` pointing at `node scripts/mock-openrouter.mjs`);
without a key it says so and keeps the catch as a loose end.
`npm run check` runs every check (`npm test`, then `npm run screenshots`,
which saves the screens at both sizes, light and dark, into
`docs/reports/`). They also run by themselves after every edit an agent
makes and on every push and pull request: `docs/CHECKS.md`. What an agent
may and may not touch: `CLAUDE.md`.
