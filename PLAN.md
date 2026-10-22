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
