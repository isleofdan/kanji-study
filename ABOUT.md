# About Kanji
Written 22 Oct 2026 by a Claude Code session from the files in this folder; "Unknown" means the files did not say.

## What it is
A personal kanji tool for Dan, who reads Japanese at the top level, for the rare character he meets away from a desk. It is a web page behind his passphrase, made for his phone: it opens on "Catch" (type, draw, photograph, or note a character), keeps what he caught, and gives each character a page where every fact (official list, school grade, radical, stroke count, readings, name readings, other forms) links to the group of characters that share it. His saved characters are under "Yours".

## What it plugs into (in and out)
In: the kanji facts, from KANJIDIC2, the Electronic Dictionary Research and Development Group's kanji dictionary file, copied into the app as a compact file when the app is built (data/kanji.json); a vision model that reads a drawing or a photo, only when Dan presses "Read it" (OpenRouter, model anthropic/claude-sonnet-4.6, key OPENROUTER_API_KEY).
Out: nothing; the app sends nothing anywhere except the picture to the model when Dan asks for it to be read.

## How it is built
Written in JavaScript: one plain Node server with plain HTML, CSS and small browser scripts, no build step, copied from Dan's starting kit. The kanji facts are a file in the repository, built from KANJIDIC2 by a script. Dan's records (what he caught, what he saved, which character pages he opened from which group) live in one SQLite database on a 1 GB Fly volume, with his caught pictures beside it. A change goes live only when the Deploy workflow is run by hand on GitHub after Dan's yes; it builds the app on Fly.io in Tokyo and proves it by signing in through the sign-in page.

## Where it runs and how to tell it is alive
It will run at https://kanji-study-dan.fly.dev once the first deploy has been run. To check it is alive, open https://kanji-study-dan.fly.dev/alive: it answers "alive since <time> · <version>"; the Status page shows the same line after signing in. Not yet checked live: as of 22 Oct 2026 the app has not been deployed.

## Which hand-off route it is on
Not yet set. (This line is filled in by a later step of Dan's build plan.)

## Which assistants can reach it
None found in the files: no connector or outside door reaches the app; it is only behind Dan's passphrase in a browser. A Claude Code session can work on its code (the repository isleofdan/kanji-study).
An OpenRig team (Claude Code and Codex seats) on Dan's rented Linux machine can also work on a kit app under the kit's own rules (CLAUDE.md and .claude/settings.json), handed a job with one line such as: rig send "dev-owner@first-project-mixed" '<job>'.
