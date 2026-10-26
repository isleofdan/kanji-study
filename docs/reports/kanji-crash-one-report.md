# FIELD REPORT — kanji-crash-one — 2026-10-26

Nothing has changed on Dan's screen yet: the crash card for the kanji app
appears on the Wall only after this pull request is merged and deployed,
and the deploy's own crash check runs.

Session `kanji-crash-one`, on the rented Linux machine (agent-machine-dan),
26 Oct 2026. Brief: the newest `# START HERE — kanji-crash-one` note on the
Wall card `crash-reporting`, plus three later facts from the origin thread:
the kit's crash code is on starting-kit `main` (pull request #15) and is the
model; the machine was redeployed, so the team starts fresh; the session
keeps a queue watch and sends a progress line every 10 minutes.

## What stands

- **Built, on branch `claude/kanji-crash-one` (commits 4d487ab, 2259cd5,
  and this report).** The kanji study app reports its crashes to the Sentry
  project `kanji-study`, copied from the starting kit's crash reporting
  (starting-kit `main`, pull request #15):
  - Server: `lib/crash.js` (no-op without `SENTRY_DSN`; with it,
    `Sentry.init` with the kit's settings and `beforeSend: scrub`), loaded
    as the first line of `server.js`; the bottom catch calls
    `crash.captureException(e)` beside its `console.error` for 500s; on
    SIGTERM/SIGINT the server flushes for 2 s, then closes.
  - Pages: `public/crash.js` (the kit's shared scrub and settings; reads
    `<meta name="sentry-dsn">`, does nothing without it) and the committed
    `public/sentry.min.js` (built by `npm run build`, byte-identical to the
    kit's). `lib/http.js` writes the meta tag after `<head>` when the DSN is
    set. All 11 pages load `/sentry.min.js` then `/crash.js` before their own
    scripts, the sign-in page included; both files are served without the
    cookie.
  - Privacy: the kit's keep-list. What leaves is the error type, message,
    mechanism and stack frames (file, module, function, line, column,
    in_app), plus the event's id, time, level, platform, environment,
    release and SDK name. Request, user, contexts, modules, tags, extra and
    the http/fetch/xhr/console/navigation/ui breadcrumbs are dropped; query
    and fragment are stripped from frame paths; ContextLines,
    LocalVariables, LocalVariablesAsync, Context, CultureContext and
    Modules do not run; Sentry 11 `dataCollection` has every switch off,
    `sendDefaultPii: false`, `includeServerName: false`,
    `tracesSampleRate: 0`, no replay.
  - `POST /crash-test`, behind the sign-in cookie, throws
    `crash-test: kanji study reports crashes` and answers 500.
  - Deploy workflow: a step "Check a crash reaches Sentry" after "Sign in
    through the sign-in form" signs in the same way, posts to
    `/crash-test`, prints `crash-test: <code>`, and only warns when the
    code is not 500.
  - `fly.toml` `[env]`: `SENTRY_DSN` with a comment that it is public by
    Sentry's design (https://docs.sentry.io/concepts/key-terms/dsn-explainer/).
  - README "Crash reports" paragraph; `docs/CHECKS.md` counts.
  - `public/sw.js` caches a share while it is in flight and lists no app
    files, so it needed no change (dev-check's reading, round 1).
- **Who did the work.** The OpenRig team, rig `kanji-crash-one-mixed` (id
  `01M5VXXPJ3N58VNEJ0WJMHB1KQ`), started fresh on this clone: builder
  `dev-owner@kanji-crash-one-mixed` (Claude Code, auto mode) made both
  commits; checker `dev-check@kanji-crash-one-mixed` (Codex) checked each
  candidate. Queue items: round 1 job `qitem-20261026110253-1b25973d`,
  check `qitem-20261026111056-9f249ee7`, verdict
  `qitem-20261026111524-b7202faf`; round 2 job
  `qitem-20261026111654-83f2c6aa`, check
  `qitem-20261026111906-1bebd441`, verdict
  `qitem-20261026112122-c9c97f93`.
- **dev-check's verdict lines, verbatim.** Round 1: "PASS: independent
  review of candidate 4d487ab; local tests and browser event proof
  passed". Round 2 (final candidate): "PASS: 2259cd5 restores screenshots
  exactly to main; 76 tests pass".
- **Tests.** `npm test`: 65 of 65 on `main` before, 76 of 76 on the branch
  after (11 new in `test/crash.test.js`), run by this session. `npm run
  check`: all passed (syntax, tests, screenshots), run by this session; its
  screenshot output is not used (see divergences) and was put back.
- **The Sentry project.** `kanji-study` answered 200 to this session's
  read; its active key's public DSN is the one in `fly.toml`. Nothing was
  created or changed in Sentry.
- **The chain (app → Sentry → Spine → Wall card).** Not yet proven:
  waiting for the merge. The origin thread merges on Dan's typed line;
  merging deploys the live app, and the deploy's crash check produces the
  first issue.
- **The team is stopped.** `rig down kanji-crash-one-mixed --snapshot`
  gave snapshot `01M5VZAAK0ZRS3QSHJ0V37J7SE`; OpenRig printed the restore
  line `rig up kanji-crash-one-mixed` (only to continue this job).
  Recorded in `/data/home/dan/FACTS.md`, section "OpenRig".

## What the brief got wrong

1. It names the Hebrew reader as the model and lists a privacy drop-list
   (request, user, transaction, extra, server_name and some breadcrumbs).
   The origin thread's later note made starting-kit `main` the model, with
   a keep-list; the job followed the kit. The kit has no
   `scripts/crash-smoke.mjs`; the deploy step is self-contained.
2. "66 tests on `main`": `main` has 65 (the 66 in `docs/CHECKS.md` was
   counted before a later change). `docs/CHECKS.md` now says so.
3. The brief's Sentry check sets the token into a command line
   (`SENTRY_AUTH_TOKEN=$(cat …)`), which the machine's rules forbid. This
   session read the token file inside a short Python script and sent it
   only as the header to `https://sentry.io/api/0/`; it was never printed
   or put on a command line.
4. The brief does not warn that `npm run check` re-takes all 56
   screenshots, and that this machine has no Japanese font. The first
   candidate committed screenshots with every kanji blank.

## Deliberate divergences

1. **Screenshots kept as on `main`.** Round 1 committed 56 re-taken
   screenshots; this session saw every kanji blank (`theme-computer-light.png`
   compared before and after; `fc-list :lang=ja` prints nothing on the
   machine) and sent round 2, which restored them byte for byte. The change
   moves no layout, and the brief does not require screenshots.
2. **The deploy step's sign-in.** It is copied from the kit and adjusted to
   this workflow's names. The step itself is checked only by the tests,
   because a real run happens only on merge.

## Verify results

| Item | Result |
| - | - |
| Sentry project `kanji-study` read | 200; keys 200; one active key, DSN read |
| `npm test` on main before | 65 tests, 65 pass |
| `npm test` on the branch after | 76 tests, 76 pass, 0 fail, 0 skipped |
| `npm run check` on the branch | syntax ok, tests ok, screenshots ok (output discarded) |
| Screenshots vs main | byte-identical (dev-check, `git diff --exit-code`, exit 0) |
| dev-check round 1 (4d487ab) | PASS; also a browser proof against a local stand-in Sentry: exactly one event, no private text, query, fragment or auth markers |
| dev-check round 2 (2259cd5) | PASS |
| Chain: deploy step prints `crash-test: 500` | not yet run (needs the merge) |
| Chain: Sentry issue titled with `crash-test` | not yet (needs the merge) |
| Chain: Wall card `crash-kanji-study-*` | not yet (needs the merge) |

## Checks

- Brief check: PASS, job `20261026-023422-bf6622` (on the card, before
  this session).
- Team check round 1: dev-check, `qitem-20261026111524-b7202faf`, PASS.
- Team check round 2: dev-check, `qitem-20261026112122-c9c97f93`, PASS.
- Result check 1: job `20261026-112806-a6be33`, FINDINGS (6): the report
  sent to the checker was shortened (missing sections, heading) and the
  next-session item deferred proof work. Changed: the first line, the
  next-session item, and the full report sent.
- Result check 2: on the card and in the pull request comment.

## Asks for the origin chat

1. **Merge the pull request** (Dan's typed line in the origin thread;
   the thread merges, never this session). Recommended: yes. Merging
   deploys the live app, and the deploy's crash check makes the first
   Sentry issue.
2. **A Japanese font on the machine.** Recommended: yes, add
   `fonts-noto-cjk` to the agent-machine image through that repository's
   deploy. The image grows; the machine and volume prices do not change.
   Until then, every kanji screenshot taken on the machine
   is blank.
3. **The OpenRig daemon starves.** Recommended: yes, a session on the
   agent-machine repository prunes `usage_samples` in
   `~/.openrig/openrig.sqlite` (508 MB now, 386 MB on 23 Oct) and adds a
   prune at boot. In this job it stopped answering six times in 20 minutes,
   and one job send was lost and had to be sent again.

## What the next session needs

- Merge status: NOT MERGED. The origin thread merges on Dan's typed line;
  merging runs the Deploy workflow.
- Proof checks outstanding, owned by this session (kanji-crash-one), which
  is watching the pull request: the deploy's "Check a crash reaches
  Sentry" line (500 expected), Sentry's `kanji-study` issues (one titled
  with `crash-test`), and the Wall for a card whose id begins
  `crash-kanji-study-`. If this session closes first, the origin thread
  owns them and hands them to a session from the card note.
- The two follow-on sessions already decided on the card: the Hebrew
  reader and the Spine copy the kit's keep-list scrub.

## Fly machine and OpenRig lessons

1. **Daemon starvation.** What happened: `rig ps`, `rig send` and
   `rig queue list` timed out over and over (`rig daemon status` still said
   running). Cost: one job send lost and sent again; queue reads failed.
   What fixed it: a keeper that restarts the daemon after three failed
   `rig ps` checks a minute apart (six restarts in 20 minutes), and reading
   the queue's rows read-only from `~/.openrig/openrig.sqlite` when the
   daemon would not answer. Lasting fix: Ask 3.
2. **No Japanese font.** What happened: `npm run check` re-took every
   screenshot with blank kanji, and its own checks still passed. Cost: one
   extra team round (about 6 minutes). What fixed it: comparing one
   screenshot before and after, then a restore round. Lasting fix: Ask 2.
3. **Checker prompts.** dev-check (Codex) stopped five times on its
   sandbox prompts (tests needing local sockets, a local-only browser
   proof, the queue handoff). This session answered each with a one-time
   yes, after reading the proof script to confirm it reached only
   127.0.0.1.
