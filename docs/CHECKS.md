# Checks

What checks the app has, when each runs, how long each takes, and how to
read a failure. Added to the kit by kit-checks-one (2 Oct 2026).
The Checks workflow finishes in about 25 seconds on main
([run 37118463557](https://github.com/isleofdan/starting-kit/actions/runs/37118463557),
3 Oct 2026).
OpenRig team runs on 3 Oct 2026 finished in 23 to 25 seconds (runs
[37121710156](https://github.com/isleofdan/starting-kit/actions/runs/37121710156),
[37121711964](https://github.com/isleofdan/starting-kit/actions/runs/37121711964),
[37123222228](https://github.com/isleofdan/starting-kit/actions/runs/37123222228)).
The 3 Oct 2026 afternoon run used a fresh builder on the faster CPU.

## The checks

| Check | What it proves |
| - | - |
| syntax | Every `.js`, `.mjs` and `.cjs` file outside `node_modules` parses (`node --check`, file by file). |
| tests | `npm test`: the gate, the alive line, the status page and `lib/upstream.js` (the kit's 8), plus this app's 37: the kanji data, meanings, the 864 人名用 with 勒, its groups and the refusals that name valid values (`test/kanji.test.js`, 6), catches, reading against the stand-in model, choosing, a repeated catch of a saved character, saving, the values lists, the opens record, meanings on the character page and in every candidates answer, Remove and restore (`deleted_at`, the home answer, the character page's catches, unknown ids) and the `deleted_at` column added to a table made before it (`test/catch.test.js`, 17), Explore: every theme id and the refusal naming them, each data theme's contents, each records theme absent on empty records and present only once its own fixture exists, Ask against the stand-in (three of five kept, `dropped` 2, labels from the data), a model failure and a missing key saved on the row, the question limits and unknown exploration ids, Earlier, and the opens rows from a theme and from an exploration (`test/explore.test.js`, 13), and the missing model key for "Read it" (`test/vision.test.js`, 1). 45 tests. |
| screenshots | `npm run screenshots`: every screen at phone (412×915) and computer (1280×800) size, in light and dark, signing in through the form, with no sideways scrolling; it walks Catch empty, Draw after "Read it", a character page with its Meaning line, a group page with the origin outlined, Catch with loose ends and latest, Yours, Type candidates with their meanings, a loose end before and after Remove, Explore with themes, a theme page, an exploration, Explore with "Earlier", and Status; it measures that "Save"→"Saved", choosing a candidate (the result's top against the pressed candidate's top), resolving a later loose end from a candidate on a later row, "Add this catch"→"Saved", Remove→"Removed · Undo"→Undo, and "Explore"→"Thinking…"→the result's link keep their place, and that Keep comes back for a second note, drawing and photo (231 checks, 58 images). Needs Playwright's browser. |

The model in every check is the stand-in, `scripts/mock-openrouter.mjs`
(after the Hebrew reader's), set by `OPENROUTER_URL`; no check calls the
real OpenRouter. For a picture it answers 雨 and 峠, which are in the data,
and 龘, which is not; the server keeps the first two. For an Explore
question it answers two groups (部首 173, 音読み ショウ) and one character
(峠) the data holds, a group of an unknown kind and a character not in the
data; the server keeps three and drops two. It can be told to wait before
answering, so the screenshots see "Thinking…". Tests and screenshots each
use an empty records folder of their own, never `./var`.

Counts as last run (kanji-two, 22 Oct 2026, the rented Linux machine,
Node 24.21.0): `npm test` 45 tests, 45 passed; `npm run screenshots`
231 checks, 231 passed, 58 images; `npm run check` ended
`check: all passed: syntax, tests, screenshots` in 77 s (syntax 1.10 s,
tests 10.11 s, screenshots 65.29 s).

Remove on a loose end at 412 px width (phone, light and dark): loose end
row top 578 px, "Removed · Undo" top 578 px, 0 px apart; Undo puts the row
back at 578 px. "Explore" to "Thinking…" at 412 px: "Explore" top
853.5 px, "Thinking…" top 853.5 px, 0 px apart; the result's link then
sits at 853.5 px. At 1280 px: 391.5 → 391.5 px, and 701.5 → 701.5 px.
The Remove control is 102.5 px tall at 412 px and 77 px at 1280 px (it
takes the row's height; at least 44 px).

Earlier counts (kanji-one, 22 Oct 2026): `npm test` 28 tests;
`npm run screenshots` 147 checks; `npm run check` 39 s.

"Save" to "Saved" at 412 px width (phone, light and dark; kanji-two, with
the Meaning line now above Save): "Save" top 349.19 px, "Saved" top
349.19 px, 0 px apart. Choosing a candidate at 412 px: pressed 雨 top
416 px, result top 416 px, 0 px apart. Resolving the third loose end by
typing twelve kanji and tapping the last, 鰆, on a later row, at 412 px:
first candidate top -100.5 px (scrolled above, since meanings make the
rows taller), pressed 鰆 top 400.81 px, result top 400.81 px, 0 px apart.
A repeated catch of a saved character: "Add this catch" top 349.19 px,
"Saved" top 349.19 px. At 1280 px: 336.69 → 336.69 px, 352.5 → 352.5 px,
and 鰆 (first row 143.5 px) 354.97 → 354.97 px.

**Japanese text in the screenshots.** A browser draws kanji only with a
Japanese font. The rented Linux machine has none, so the runs above set
`FONTCONFIG_FILE` to a scratch font folder holding Noto Sans JP; without
it the checks still pass (they read text and positions, not pixels) but
the images show boxes where the kanji are. Whether GitHub's runner has a
Japanese font is not known here.

`npm run check` runs all three in that order, stops at the first failure,
and ends with one line: `check: all passed: …`, or
`check: FAILED at <check> (<seconds> s): <what failed>`, naming the file
that does not parse, the test that failed, or the screenshot check that
failed. `npm run check -- --fast` runs syntax and tests only.

A check a session writes to prove something is committed, and the report
names its file next to the count it produced ("25 checks,
`scripts/review-check-test.mjs`"). A count from a check that was not
committed is not a result.

## What runs when

| When | What runs | Where it is set |
| - | - | - |
| After every edit or new file an agent makes in Claude Code | syntax, tests | `.claude/settings.json`: a `PostToolUse` hook on `Edit\|Write` running `node scripts/check.mjs --hook`, timeout 30 s |
| On every push and every pull request | syntax, tests, screenshots | `.github/workflows/checks.yml` ("Checks") |
| By hand | any of them | `npm run check`, `npm test`, `npm run screenshots` |

Only checks that finish in a few seconds run after every edit; the
screenshots start a browser and run on push and pull request only.

An app whose `npm test` takes more than 20 seconds puts a fast subset in
`npm run test:fast` and points the hook at it; the full set runs in the
Checks workflow. The hook's limit is 30 seconds.

## Measured times

On the rented Linux machine (`agent-machine-dan`, Node 24.21.0), 2 Oct
2026, with bash's `time`, three runs each:

| Run | Time here | Runs in |
| - | - | - |
| `npm test` alone | 0.87 s, 0.79 s, 0.72 s | hook and workflow |
| syntax, inside `npm run check` | 0.34 s, 0.38 s, 0.38 s | hook and workflow |
| tests, inside `npm run check` | 0.61 s, 0.67 s, 0.68 s | hook and workflow |
| the hook's command (`--hook`: syntax and tests) | 1.17 s, 1.19 s, 1.20 s | hook |
| `npm run check -- --fast` | 1.34 s, 1.39 s, 1.67 s | by hand |
| `npm run check` (screenshots skipped here) | 1.57 s, 1.67 s, 1.67 s | by hand |
| `npm run screenshots` | not measured here: this machine has no Playwright browser | workflow only |

## Reading a failure

- **In the session, after an edit:** the hook is silent when the checks
  pass. When one fails it prints the failing output and the
  `check: FAILED at …` line and exits 2, which Claude Code shows to the
  session next to the edit (the edit itself has already happened). Fix the
  cause; the next edit runs the checks again. Two edits at once never run
  the checks side by side: the second skips while the first runs.
- **On a pull request:** the "Checks" mark is green or red. Open it, then
  the step "Run every check"; its last line is the verdict.
- **Where screenshots cannot run:** on a machine without Playwright's
  browser, `npm run check` skips them and says so in its verdict; in
  GitHub Actions a missing browser is a failure.

A failing check is shown only on the pull request and in the agent's own
session. Nothing else: no notification, email, badge or summary.
