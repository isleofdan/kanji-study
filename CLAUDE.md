# Rules for every Claude Code session on this app

Read `SIGN.md` (what Dan's software shop is for) before changing anything.
Read `README.md` and `PLAN.md` before changing anything. This app was made
from `isleofdan/starting-kit`; these rules came with it and bind every
session here.

## Replies to Dan

- Every reply ends with a block headed **Needed from you**: numbered items,
  each an action on something Dan can open, or one yes/no on a decision.
  Nothing above the block asks him for anything. When nothing is needed it
  is one line saying so and what he will see next.
- Dan is not a developer: plain words, no repo or tooling nouns unless he
  used them first.
- A wait you can see through (a deploy, a CI run, a build that ends within
  ten minutes) is waited out inside the turn, not narrated.

## A close-out shows Dan something, or says plainly there is nothing to see

- **Nothing on his screen changed** (records, routes, a deploy step; no
  page): the close-out's first line says, in those words, that there is
  nothing for him to see yet, and names what will show it. No walkthrough,
  no request for a reaction. What was built goes in the report.
- **Something on his screen changed:** walk him through that screen, one
  step per round, each step naming where it is (the app, the page, the
  link) and what he will see there.
- **Never ask Dan whether a description matches what he pictures.** Never
  "read item N" or "tell me if this matches".

## Field reports

Every session writes `docs/reports/<session>-report.md` and appends a
close-out note to `PLAN.md` (what stands, what was decided, what the next
session needs), committed before the pull request. The report's sections:
what stands; what the brief got wrong; deliberate divergences; verify
results; numbered asks, each with a recommended answer; what the next
session needs. It never asks when, or whether, the next session runs: Dan
schedules sessions by opening them.

When the session merges and deploys, the order is fixed: the change's pull
request first (the report links it); after the deploy result, a notes-only
close-out pull request carrying the field report and the `PLAN.md` note.
That order is the rule, not a divergence. A brief's "nothing else changes"
never covers the report and the `PLAN.md` note, and a count of changed
files in a brief includes them.

## Building

- **Gate.** The app's own sign-in page (`public/login.html`, `lib/auth.js`),
  never the browser's username-and-password box: phone in-app browsers
  never show it. Every route except `/login`, `/logout`, `/app.css` and
  `/alive` stays behind the cookie.
- **Proofs sign in through the form.** Any claim that a screen works is
  proven by a browser that types the passphrase into the sign-in page.
  Never pre-supply credentials (Playwright `httpCredentials`, injected
  cookies, `user:pass@` addresses): that skips the step being proven.
- **Both sizes.** Every screen is proven at 412×915 and 1280×800, with
  screenshots in the report (`npm run screenshots`).
- **Pull-only.** Nothing pushes at Dan: no notifications, reminders,
  streaks, badges, daily goals. "No data" is a state a screen shows.
- **Outside calls go through `lib/upstream.js`,** so the status page shows
  the last failure with that service's own status and message.
- **Sentences about effects.** Any sentence the app shows asserting an
  effect outside the screen (saved, sent, filed) is spelled by code from
  the record of that effect, never by a model.

## Deploying and money

- Deploying, and anything that spends money, runs only through the
  workflows in `.github/workflows/`, never from a session's shell. No
  `fly` commands by hand.
- "Remove the Fly app" is for a trial copy only. Never run it on an app
  that holds Dan's records unless Dan has asked for exactly that.

## What an agent may and may not touch

Claude Code enforces these from `.claude/settings.json` (`permissions`);
this section says the same in words, with why. The line between them is
the cost of a wrong move: who sees it, and what it costs to undo.

- **May, without asking:** edit files in the app, run the checks (`npm
  test`, `npm run …`, `node …`), commit, push its own branch, open a pull
  request, read pull requests and workflow runs. A wrong move here is seen
  by nobody until a pull request, and is undone by another commit.
- **Asks Dan one yes/no first:** merging a pull request (`gh pr merge`),
  starting a workflow (`gh workflow run`, which includes Deploy and Remove),
  and any direct GitHub request (`gh api`). These reach what Dan sees, or
  can change things a commit cannot undo. For reading runs and pull
  requests, use `gh run view` and `gh pr view`, which need no asking.
- **Never, from its own shell:**
  - `fly` / `flyctl`: deploying and anything that costs money run only
    through the Deploy workflow, after Dan's yes. This also keeps the app's
    records on Fly out of a session's reach: a table holding Dan's data is
    never dropped or rebuilt (see "Do not reverse").
  - `npm publish`: nothing of Dan's is published; the app ships only
    through Deploy.
  - Pushing to `main`: push your own branch and open a pull request.
  - Deleting a branch, here or on GitHub: leave it; Dan deletes branches.
  - `gh secret`, `gh variable`, `gh repo edit`/`delete`/`rename`/`archive`:
    repository secrets and settings are Dan's; ask him under **Needed from
    you**, naming the setting and the value.
- **This rule file itself** is a protected path in Claude Code: an agent
  cannot change `.claude/settings.json` without a prompt, and any change
  reaches `main` only through a pull request Dan says yes to.

These rules stop the commands an agent normally types, not every way of
spelling them (Claude Code's own permissions page says so). They bound
mistakes; they are not a lock against someone determined.

## Cloud session limits

Build on your own branch, open a pull request, ask Dan one yes/no to merge,
and merge it yourself on yes. Do not push to `main` directly, delete any
branch, or write `.claude/settings.json`.

## The rented Linux machine and its OpenRig team

On the rented Linux machine (`agent-machine-dan`) the OpenRig team (builder
`dev-owner`, checker `dev-check`, rig `first-project-mixed`) is the default.
Every brief either hands its change to the team or states in its first
paragraph the reason it runs as plain Claude Code. The two reasons: (i) the
job only reads or writes records (notes, cards, reports), with no code change
for a checker to check; (ii) the job must survive the deploy-restart of that
machine. For the procedure, follow the section "OpenRig team is the default"
of `/data/home/dan/FACTS.md`.

## Do not reverse

- **Records.** To add a field to a table that already holds the user's
  data, use `ALTER TABLE … ADD COLUMN` and back-fill. Never drop and
  recreate a table, and never move rows to a new one.
- **The volume's mount path** (`/data`, once an app has one) never changes:
  changing it silently abandons the old disk and every record on it.
- **The passphrase is set on every deploy** from the repository secret.
  Do not go back to setting it only when missing: then changing the secret
  in GitHub would never reach the app.

# This app's own rules (kanji-study, from kanji-one)

1. **The kit's rules above bind.** Dan's own sign-in page; every claim that
   a screen works proven by a browser that signs in through that page;
   every screen at 412×915 and 1280×800; outside calls through
   `lib/upstream.js`; deploying only through the Deploy workflow after
   Dan's yes; no `fly` commands, no `gh secret`; records by
   `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN`, never drop
   or rebuild a table. A session never runs `sqlite3` by hand (the
   matching `deny` entry in `.claude/settings.json` is owed to a session
   that runs in Accept edits).
2. **A model never names a character the dataset does not hold, and never
   writes a fact.** Every fact and every group on screen comes from the
   KANJIDIC2 file (`data/kanji.json`). A model is used only to read a
   drawing or a photo, and only when Dan presses a button; the server drops
   any character it answers that is not in the dataset, and keeps the
   answer only as candidates Dan taps to choose.
3. **A control keeps Dan's place.** Any button that changes something on
   the current page leaves him where he was: the element he acted on, or
   what took its place, sits at the same height on the screen. Saving a
   character, resolving a loose end and choosing a candidate are covered.
4. **Plain words on screen.** English for the app's own words ("Catch",
   "Type", "Draw", "Photo", "Note", "Loose ends", "Yours", "Save",
   "Read it", "Keep as a loose end"); the kanji facts under the Japanese
   names Dan knows them by (常用漢字, 人名用漢字, 学年, 部首, 画数, 音読み,
   訓読み, 名乗り, 異体字). Never "desk", "hub", "slice", "road" or "door"
   on screen.
5. **Pull-only.** Nothing notifies, reminds, keeps streaks, tallies Dan's
   activity, or shows badges. A plain fact about the data, such as how many
   characters a group holds, is allowed.
6. **Refusals name the valid values.** An unknown character, fact kind,
   group or catch id answers 400 or 404 with a message that names what is
   valid (for example "kind must be one of list, grade, radical, strokes,
   on, kun, nanori, variant").
