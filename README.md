# Kanji

A personal kanji tool for one reader of Japanese, used mostly on a phone,
behind a passphrase. It opens on catching a character met away from a desk
(typed, drawn, photographed, or just a note), keeps what was caught, and
gives each character one page where every fact links to the group of
characters that share it.

Made from `isleofdan/starting-kit`; the kit's sign-in page, status page,
checks and Deploy workflow come with it.

## Running it on a computer

    npm install
    APP_PASSWORD=try-me COOKIE_SECRET=any-long-text npm run dev

Then open http://localhost:8080 and sign in with `try-me`.
`npm run check` runs every check (`npm test`, then `npm run screenshots`,
which saves the screens at both sizes into `docs/reports/`). They also run
by themselves after every edit an agent makes and on every push and pull
request: `docs/CHECKS.md`. What an agent may and may not touch:
`CLAUDE.md`.
