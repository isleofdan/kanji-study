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
| tests | `npm test`: the gate, the alive line, the status page and `lib/upstream.js`, against a real server (8 tests in the kit). |
| screenshots | `npm run screenshots`: every screen at phone (412×915) and computer (1280×800) size, signing in through the form, with no sideways scrolling (16 checks in the kit). Needs Playwright's browser. |

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
