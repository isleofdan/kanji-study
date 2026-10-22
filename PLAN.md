# Plan

## Decisions (kanji-one, 22 Oct 2026)

- **What the app is.** Dan's kanji catch and reference: the catch (typed,
  drawn, photo, note) is the front page; one page per character where each
  fact links to the group that shares it; his saved set grows from real
  catches. The groups come from KANJIDIC2, never from a model.
- **Name.** `app.json`: `kanji-study`, title `Kanji`. The Fly app is
  `kanji-study-dan`, the site `https://kanji-study-dan.fly.dev`.
- **Records.** SQLite through `better-sqlite3`, one file under `DATA_DIR`
  (`/data` on Fly, on the volume `kanji_data`; `./var` on a computer).
  Machine memory 512 MB.
- **The model.** Used only to read a drawing or a photo, when Dan presses
  "Read it", through OpenRouter (`OPENROUTER_API_KEY`, set on Fly by the
  Deploy only when Fly does not hold it yet, as the Hebrew reader's Deploy
  does).
- **Owed.** The kit's `deny` entry for `sqlite3` in `.claude/settings.json`
  is not added: it changes Claude Code's own permission settings, which an
  Auto session may not do. `CLAUDE.md` says the rule in words.

## Decisions carried from the kit (starting-kit-one, 2 Oct 2026)

- **Stack.** One plain Node 22 server, plain HTML and CSS, no build step,
  no web framework, a `node:22-slim` Docker image, one Fly machine in Tokyo
  (`nrt`). Playwright only for screenshots.
- **The app's name** lives in `app.json` (`name`, `title`) and nowhere else.
  The cookie's name comes from it too.
- **Gate.** One passphrase (`APP_PASSWORD`), a signed 30-day cookie
  (`COOKIE_SECRET`), spaces and line breaks at either end ignored, five
  wrong tries lock that address for 15 minutes. Fail closed when either is
  unset. Never HTTP basic auth.
- **Deploy.** By hand only (Actions tab, "Deploy"). Creates the app and its
  volume if missing; sets `APP_PASSWORD` from the repository secret every
  run; makes `COOKIE_SECRET` once and keeps it; one machine,
  `shared-cpu-1x`, always on. Then proves itself: `/alive` answers, and
  signing in through the form reaches the home page.
- **Pull-only.** Nothing pushes at Dan: no notifications, reminders,
  streaks, badges, daily goals.

## Close-out notes

(Each session appends its own, in order.)

## Close-out: kanji-one (22 Oct 2026)

- **What stands.** Live at https://kanji-study-dan.fly.dev (Fly app
  `kanji-study-dan`, Tokyo, volume `kanji_data` 1 GB at `/data`), from
  pull request #1 (merge a1210d7) and Deploy run 39725811460. Dan used
  every screen on his phone: Type and Save, the 部首 group, Draw read by the
  real model, a note kept as a loose end, Yours.
- **The data and its licence.** `data/kanji.json` from KANJIDIC2
  (database version 2026-295): 13,108 characters, 常用 2,136, 人名用 863,
  978 variant references left out. CC BY-SA 4.0 from the Electronic
  Dictionary Research and Development Group; the licence line is in the
  file's header, on the status page and in `README.md`. The official
  人名用 count is 864 since 26 Jun 2026 (勒 added); KANJIDIC2 has not caught
  up.
- **The tables.** `catches` (kind, char, note, where_seen, image,
  created_at, resolved_at), `saved` (char, first_catch_id, saved_at),
  `opens` (char, from_kind, from_value, opened_at).
- **The pages.** Catch `/`, character `/k/<char>`, group
  `/g/<kind>/<value>`, Yours `/yours`, plus the kit's sign-in and status.
- **Owed.** The `sqlite3` `deny` entry in `.claude/settings.json`, for a
  session in Accept edits.
- **What the next session needs.** A sourced override marking 勒 as 人名用
  in `scripts/build-kanji.mjs`; "a next character with a reason" built on
  `catches`, `saved` and `opens` joined to the KANJIDIC2 groups; screenshots
  on the rented machine need `FONTCONFIG_FILE` pointing at a scratch Noto
  Sans JP until the machine has a Japanese font. Report:
  `docs/reports/kanji-one-report.md`.

## Close-out: kanji-two (22 Oct 2026)

- **What stands.** Live at https://kanji-study-dan.fly.dev from pull
  request #3 (merge fa0d7ed) and Deploy run 39796398216: meanings from
  KANJIDIC2 on the character page and under candidates (10,384 of 13,108
  characters); 勒 marked 人名用 by a sourced override (864); Remove with Undo
  on loose ends; the Explore page (Themes, Ask, Earlier).
- **The new column and table.** `catches.deleted_at` (a removed loose end
  is marked, never deleted); `opens.group_kind` and `opens.group_value`
  (a group opened from an exploration, with `char` ''); table
  `explorations` (id, question, model, reading, stops, dropped,
  created_at, took_ms, error). All by `CREATE TABLE IF NOT EXISTS` /
  `ALTER TABLE … ADD COLUMN` at start.
- **Explore and its model use.** Themes are computed by code in
  `lib/explore.js` (10 ids). Ask sends Dan's question to
  `anthropic/claude-sonnet-4.6` through OpenRouter (90 s, 1,500 tokens);
  the server keeps only groups and characters the data holds, labels them
  from the data, and shows the model's own sentences only under "In the
  model's words".
- **Owed.** The `sqlite3` `deny` entry in `.claude/settings.json`, for a
  session in Accept edits.
- **What the next session needs.** Dan's judgment of real Ask results
  (the model is one constant); themes beyond KANJIDIC2 still need a
  sourced dataset; "a next character with a reason" can now also read
  group opens. Report: `docs/reports/kanji-two-report.md`.
