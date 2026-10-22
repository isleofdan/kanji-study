'use strict';
// The app's name, read from app.json: the one place a new app changes it.
//   name  — lowercase, hyphenated; the Fly app is <name>-dan
//   title — what the screens show

const { name, title } = require('../app.json');

if (!/^[a-z][a-z0-9-]*$/.test(name || '')) {
  throw new Error(`app.json: "name" must be lowercase letters, digits and hyphens, got ${JSON.stringify(name)}`);
}

module.exports = { name, title: title || name };
