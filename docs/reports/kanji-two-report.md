# FIELD REPORT — kanji-two — 2026-10-22

Session kanji-two, on the rented Linux machine agent-machine-dan, in auto mode (the mode the brief asked for). Brief: the newest "# START HERE — kanji-two" note on card `kanji-study-tool` (event 1886, brief check PASS, job 20261022-123650-be4a25). This session was the same Claude Code session as kanji-one, given the new brief through the project's coordinator.

## What stands

- **Live:** the new version is at https://kanji-study-dan.fly.dev. Deploy run https://github.com/isleofdan/kanji-study/actions/runs/39796398216 is green on `main` at fa0d7ed. The project thread started it after merging (see "Deliberate divergences", 1). It printed:
  - "The Fly app is kanji-study-dan."
  - "All three repository secrets are present: FLY_API_TOKEN, APP_PASSWORD, OPENROUTER_API_KEY."
  - "App kanji-study-dan exists."; "Volume kanji_data exists."
  - "APP_PASSWORD staged from the repository secret."; "OPENROUTER_API_KEY already set; leaving it."; "COOKIE_SECRET already set; leaving it."
  - "alive: status 200"; "alive: alive since 2026-10-22T14:32:46Z · fa0d7ed"
  - "status page without a cookie: 303 https://kanji-study-dan.fly.dev/login?next=%2Fstatus"
  - "sign-in form: HTTP 303"; "cookie: kanji_study_auth, expires 2026-11-21 14:32 UTC"; "signed in: yes (Catch page: HTTP 200)"
  - "Live at https://kanji-study-dan.fly.dev"
- **Signed-out check:** a `GET https://kanji-study-dan.fly.dev/explore` answered `303 https://kanji-study-dan.fly.dev/login?next=%2Fexplore`, the 303 to `/login` the code predicts.
- **The change:** pull request https://github.com/isleofdan/kanji-study/pull/3 is merged into `main` (merge commit fa0d7ed). It holds seven commits: the six steps plus one round of fixes from the checker. Its Checks runs passed (51 s and 50 s).
- **Built:**
  - Meanings come from KANJIDIC2's own English `<meaning>` elements, in `data/kanji.json` and on screen. Each character page has a "Meaning" line, and each candidate shows its first three meanings.
  - 勒 is marked 人名用 by a sourced override in `scripts/build-kanji.mjs`.
  - Remove on a loose end comes with Undo in place (`catches.deleted_at`, added by `ALTER TABLE`; no row is ever deleted).
  - The Explore page `/explore` has three parts: Themes (computed by code, `lib/explore.js`), Ask (`POST /explore`, the model through OpenRouter via `lib/upstream.js`, kept stops only), and Earlier. Theme pages are at `/explore/theme/<id>` and exploration pages at `/explore/<id>`.
  - There is a new table, `explorations`, and the columns `opens.group_kind` and `opens.group_value` were added (see "Deliberate divergences", 2).
  - "Explore" was added to the top line of every page.
  - There are 45 tests and 247 browser checks (58 images) against a stand-in model.
- **The team did the work.** The OpenRig team built and checked it: builder `dev-owner@kanji-two-mixed` (Claude Code) and checker `dev-check@kanji-two-mixed` (Codex), in rig `kanji-two-mixed` (id `01M5HT0KR29MPQE4N1KXT40RQC`).
  - Queue items: the job `qitem-20261022124245-0b704d7b` (closed done).
  - Check round 1: `qitem-20261022132505-7ba41141`, FINDINGS, returned as `qitem-20261022133512-620bd389`.
  - Round 2: `qitem-20261022134412-b406455a`, PASS, returned as `qitem-20261022135248-a0bd240d` (closed done).
  - The checker's recorded verdict line, verbatim: "PASS for main..ca242a007f53e0da97bebe5a99d606b9b0a76ba4 in /data/home/dan/work/kanji-two. Full independent check passed: syntax 1.24 s, tests 7.16 s, screenshots 56.96 s. Three regression fixes verified by signed-in browser checks at both sizes and schemes."
- **Live records before the walkthrough:** Dan's saved characters are 雨 and 峠. His loose end is the note "plaque at the temple gate, something with 雨 on top", from the kanji-one walkthrough. I did not read these through a signed-in request, because I have no passphrase on the machine (see "Deliberate divergences", 3).
- **Live walkthrough with Dan:** the project thread walked it on his phone itself, on the coordinator's instruction, to avoid two voices. Its results are in the thread, not in this report.
- **The team:** stopped with a snapshot (see "Fly machine and OpenRig lessons", 4). `/data/home/dan/FACTS.md` was updated with it.

## UI review

The screens are the character page (with Meaning), the Type candidates (with meanings), Catch with a loose end before and after Remove, Explore (Themes, Ask, Earlier), a theme page and an exploration page. Screenshots are in `docs/reports/screenshots/`, at 412×915 and 1280×800, light and dark. They are `char-*`, `type-candidates-*`, `loose-before-remove-*`, `loose-removed-*`, `explore-themes-*`, `explore-earlier-*`, `theme-*` and `exploration-*`.

1. **Speed of the frequent action:**
   - Remove is one tap on the loose end itself.
   - A theme is one tap from Explore.
   - Ask is type, then one press.
   - A meaning is on the character page with no tap at all.
2. **Recovery:**
   - Undo sits where Remove was, until the page is next loaded.
   - A failed Ask keeps the question and offers "Explore" again on it.
   - Nothing is deleted from the records.
3. **Finding the tool:**
   - "Explore" is in the top line of every page.
   - Remove is at the right edge of each loose end, as tall as the row (102.5 px on the phone, 77 px on the computer).
4. **Orientation:**
   - Theme pages and exploration pages name what they show: the theme's title line, the question, and the group labels from the data.
   - The character a group or theme was opened from is outlined, as before.
5. **Feedback:**
   - "Thinking…" takes the Explore button's place, then becomes the result's link or failure line.
   - "Removed · Undo" is written only after the server confirms the row was marked.
6. **Interruption:** an exploration is saved as soon as it is asked and is listed under Earlier, so Dan can leave and come back to it.
7. **Thumb reach:** Remove and the candidates are large on the phone. The Ask box and button sit below Themes, so on the phone they need a scroll. Not changed: Themes is the part Dan asked for first.
8. **Defaults and prefill:**
   - The record-based themes appear only when his records give them something, with no empty messages.
   - The Ask box shows a counter only at 400 characters and over.

**What I did not add, and why:**
- Meanings in group grids: 300 cells is too many to label, and a later session decides on tap-to-peek (brief, section 8).
- Themes beyond KANJIDIC2: they need another sourced dataset (section 8).
- No counts of Dan's activity anywhere (rule 5).

**Which of the eight came from Dan's own requests:** 1 and 2 ("an easy way to delete from Loose ends"), 3 and 6 ("a menu of suggested themes and angles", "a way to input a question or theme … to start an exploration"), and the meanings line under 1 ("I also want meanings to appear on the kanji which I look up").

## What the brief got wrong

1. **The merge sat on a confirmation Dan could not see.** Step 7 assumed this session's `gh pr merge` would run on Dan's yes. On this machine, over Remote Control, it stopped on a permission confirmation that was never shown in the thread. It sat for 30 minutes until the project thread merged #3 itself (14:31 UTC) and dispatched the Deploy. The same command had run without a prompt in kanji-one. Fix for the template: on this machine, a brief has the session announce a merge, and if the merge does not return within two minutes, hand it to the thread with the pull request URL.
2. **"Read the live records through signed-in requests" needs the passphrase.** The machine does not hold it, and the brief gave no route to it. A future brief should either name the Spine secrets page route for the app's passphrase (FACTS.md, "Secrets page") or take the records from the last walkthrough, as this report did.
3. **The read helper matched nothing this time.** The builder's file-read prompts for the scratch folder came as Bash compound commands, not as Read tool prompts. The helper `/data/home/dan/work/scratch-kanji-two/answer-reads.sh` therefore answered none, and I answered them by hand. Its log file was never created.

## Deliberate divergences

1. **The merge and the Deploy were done by the project thread,** on Dan's yes ("Yes, merge and go live", 13:56 UTC, relayed by the coordinator), because my merge was stuck (see "What the brief got wrong", 1). I did not merge or dispatch again. The coordinator noted the merge at 14:31 UTC; GitHub shows it as fa0d7ed.
2. **Opening a group from an exploration records the group in two new columns.** `opens.char` is NOT NULL and holds a character page, so an open of a group writes `char` '' with `group_kind`/`group_value` (`lib/db.js:75`, `ALTER TABLE … ADD COLUMN`). This was the builder's choice, raised to the checker as point 3 of its request and accepted in the PASS.
3. **The live records were taken from the kanji-one walkthrough,** not from signed-in requests (see "What the brief got wrong", 2).
4. **The candidates answer carries `meaning` as an object keyed by character** (first three meanings), so `candidates` stays a list of characters. This was the builder's choice, raised to the checker as point 4 and accepted.
5. **The status page's top line stays the kit's** (Status, Sign out), without Explore. This was raised to the checker as point 5 and accepted.

## Verify results

1. **`data/kanji.json`:**
   - 2,670,741 bytes, 13,108 characters; 10,384 have meanings.
   - 常用 2,136; 人名用 864, with 勒 `{"list":"jinmeiyo","grade":9, … "meaning":["halter and bit"]}`.
   - 雨 and 峠 carry meanings (`test/kanji.test.js`).
   - The builder compared it with main's copy: only 勒's list and grade and the new `meaning` field changed (`/data/home/dan/work/scratch-kanji-two/compare-data.mjs`).
2. **Remove** (`test/catch.test.js`):
   - `POST /catch/:id/remove` sets `deleted_at`.
   - The loose end leaves `GET /data/home` and the character page's catches.
   - `restore` brings it back.
   - An unknown id is refused naming the valid ids.
3. **Themes** (`test/explore.test.js`):
   - There are 10 theme ids: `saved-radicals`, `saved-readings`, `last-catch`, `opened-unsaved`, `names-only`, `joyo-unranked`, `most-variants`, `rare-radicals`, `most-strokes` and `many-readings`.
   - Every theme id answers, and an unknown id is refused naming them.
   - Each records theme is absent on an empty database, and appears only with its own fixture's records.
4. **Ask against the stand-in** (`test/explore.test.js`):
   - Three of five stops are kept, with `dropped` 2 and labels from the data.
   - A model failure saves its line.
   - Opening a stop writes an `opens` row with `from_kind` `exploration` and the id.
5. **Screens:** all states at 412×915 and 1280×800, light and dark, signed in through the form (`scripts/screenshots.mjs`, 247 checks, 58 images). Keep-your-place:

| Control | At 412 px | At 1280 px |
| - | - | - |
| Loose end row, then "Removed · Undo" | 578 → 578 px (0 px; Undo puts the row back at 578 px) | 391.5 → 391.5 px |
| "Explore", then "Thinking…" | 853.5 → 853.5 px (0 px; the result's link then sits at 853.5 px) | 701.5 → 701.5 px |

6. **`npm run check`:** my run on ca242a0 ended "check: all passed: syntax, tests, screenshots" (syntax 1.22 s, tests 8.09 s, screenshots 59.74 s): 45 tests and 247 browser checks. The checker's run gave the same last line. The baseline on `main` before any change also passed (syntax 1.70 s, tests 4.98 s, screenshots 43.31 s).
7. **After the merge:**
   - The Deploy run was green, with the lines quoted in "What stands".
   - The live `/explore` answers 303 to `/login` when signed out.
   - The `deleted_at` column: the live app runs fa0d7ed ("alive since 2026-10-22T14:32:46Z · fa0d7ed"), whose `lib/db.js:74` adds `catches.deleted_at` at start. I did not see the column through a signed-in request (no passphrase; see "Deliberate divergences", 3). Dan's Remove on the live site, in the thread's walkthrough, exercises it.

## Asks

None.

## What the next session needs

- **Ask's model:** Dan judges the first real Ask results in use. The model is one constant (`lib/vision.js` `MODEL`, `anthropic/claude-sonnet-4.6`), and a change is one line.
- **Themes beyond KANJIDIC2** (呉音・漢音, 国字, 当て字, 熟字訓, the year's kanji, 難読地名) still need a sourced dataset or a model that cites its sources. Dan has not decided.
- **Group opens:** `opens` now carries group opens in `group_kind`/`group_value` with `char` ''. A "next character with a reason" can read those as well.
- **The owed settings entry:** the `sqlite3` `deny` entry in `.claude/settings.json` is still owed, to a session in Accept edits.
- **The work branch** `claude/kanji-two` remains on GitHub. Dan deletes branches.

## Checks

| Round | Id | Verdict | What changed |
| - | - | - | - |
| Brief check 1 | 20261022-123219-642513 | FINDINGS | Brief revised by the chat (event 1882 to 1886) |
| Brief check 2 | 20261022-123650-be4a25 | PASS | Event 1886 |
| Team check 1 | `qitem-20261022132505-7ba41141` | FINDINGS (3) | Fixed in ca242a0, see below |
| Team check 2 | `qitem-20261022134412-b406455a` | PASS on ca242a0 | — |

Team check 1's three findings:
1. Theme-page group links carried the array index, so they opened the wrong group (`public/js/theme.js:22`).
2. Typing during Ask detached the pending result (`public/js/explore.js:37`).
3. The model's sentences lost their "In the model's words" heading when the reading was absent (`public/js/exploration.js:30`).

The result check of this report's final version is run after filing and is not part of this section.

## Fly machine and OpenRig lessons

1. **A merge over Remote Control can sit on an unseen confirmation.**
   - What happened: `gh pr merge 3` from this session waited on a permission confirmation that never reached the thread.
   - Cost: 30 minutes, until the thread merged it.
   - Fix: announce a merge, and if it does not return in two minutes, hand it to the thread with the URL. Lasting fix: an allow entry for `gh pr merge` on a Dan-approved pull request, through the agent-machine repo.
2. **Confirming the job landed worked.** I sent the job only once the builder was idle, then read its screen. `rig send` answered "Delivery UNCONFIRMED", but the job was on screen within 8 seconds. No minutes were lost, unlike kanji-one.
3. **Daemon timeouts made both seats read each other's screens.** `rig queue show` and `rig capture` timed out repeatedly while two teams ran. Each fallback (`tmux capture-pane` of the other seat) cost a prompt.
   - Cost: about 8 extra prompts.
   - Fix: as kanji-one's lesson 2 (retry once, reconcile by the screen). The daemon's slowness under two teams is the lasting problem, for the agent-machine repo.
4. **The team name and snapshot.** The team ran as a spec copy, `kanji-two-mixed`, from the start (as the brief said). Snapshot `01M5J142KPGNJY7NV4J8H19QSM` for rig `kanji-two-mixed` (id `01M5HT0KR29MPQE4N1KXT40RQC`); restore line as OpenRig printed it: `rig up kanji-two-mixed`, only to continue this job. Recorded in `/data/home/dan/FACTS.md`.
5. **A stray keypress became a message.**
   - What happened: I answered a builder prompt after it had already closed, so "1" went to the builder as a message.
   - Cost: none visible.
   - Fix: check that the prompt is still on screen before sending keys (`grep -q 'Do you want' && send`).
6. **Seat prompts.** I answered about 20 builder prompts by hand (scratch reads, screenshot runs, the other seat's screen) and 10 checker prompts (`ss -ltn`, test runs outside its sandbox, its browser runs, recording its verdict, reading the other seat). All were one-time yeses inside the job, and none was a risk prompt.
7. **Japanese font:** reused kanji-one's scratch Noto Sans JP through `FONTCONFIG_FILE`. Nothing was installed. The lasting fix is still `fonts-noto-cjk` in the agent-machine image.

## Closing message to Dan

The second version of your kanji tool is live at https://kanji-study-dan.fly.dev:
- Meanings on every character page, and under each candidate when you choose.
- Remove (with Undo) on loose ends.
- An Explore page with a menu of themes and a box to ask your own question, with past questions kept under Earlier.
- 勒 now shows as 人名用.

Needed from you: nothing to decide.
