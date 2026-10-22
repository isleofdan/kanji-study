'use strict';
// Dan's records: one SQLite file under DATA_DIR (/data on Fly, on the
// volume kanji_data; ./var on a computer), and the images he caught beside
// it in images/. Tables are made with CREATE TABLE IF NOT EXISTS; a new
// field on a table that holds his data is added with ALTER TABLE … ADD
// COLUMN, never by dropping or rebuilding a table (CLAUDE.md).
//   catches  one row per catch; a catch with no char is a loose end; a
//            removed catch has deleted_at set and is never deleted
//   saved    his saved characters
//   opens    one row each time a character page is opened, with where he
//            came from: a group (its kind and value), a theme (`theme`, its
//            id) or an exploration (`exploration`, its id); a group page
//            opened from an exploration is a row with char '' and the
//            group in group_kind and group_value (for a later session's
//            "next character with a reason")
//   explorations  one row per question asked on Explore: the question
//            (saved before the model is called), the model's reading
//            sentence, the stops kept (JSON, each labelled from the data),
//            how many were dropped, how long it took, and the failure line
//            when the model failed

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'var');
const IMAGES = path.join(DATA_DIR, 'images');
fs.mkdirSync(IMAGES, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'kanji.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS catches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('typed', 'drawn', 'photo', 'note')),
    char TEXT,
    note TEXT,
    where_seen TEXT,
    image TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS saved (
    char TEXT PRIMARY KEY,
    first_catch_id INTEGER,
    saved_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS opens (
    char TEXT NOT NULL,
    from_kind TEXT,
    from_value TEXT,
    opened_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS explorations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    model TEXT NOT NULL,
    reading TEXT,
    stops TEXT,
    dropped INTEGER,
    created_at TEXT NOT NULL,
    took_ms INTEGER,
    error TEXT
  );
`);

// Fields added after the table first held Dan's records: ALTER TABLE … ADD
// COLUMN, on start, only when the column is missing (existing rows get NULL).
function addColumn(table, column, type) {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
addColumn('catches', 'deleted_at', 'TEXT');
addColumn('opens', 'group_kind', 'TEXT');
addColumn('opens', 'group_value', 'TEXT');

const now = () => new Date().toISOString();
const CATCH_KINDS = ['typed', 'drawn', 'photo', 'note'];

function notFound(id) {
  const max = db.prepare('SELECT MAX(id) AS m FROM catches').get().m;
  const valid = max ? `catch ids are whole numbers from 1 to ${max}` : 'there are no catches yet';
  return Object.assign(new Error(`no catch with id ${JSON.stringify(String(id))}; ${valid}`), { status: 404 });
}

function addCatch({ kind, char = null, note = null, where = null, image = null }) {
  const info = db.prepare('INSERT INTO catches (kind, char, note, where_seen, image, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(kind, char, note, where, image, now(), char ? now() : null);
  return getCatch(info.lastInsertRowid);
}

function getCatch(id) {
  const row = /^\d+$/.test(String(id)) ? db.prepare('SELECT * FROM catches WHERE id = ?').get(Number(id)) : null;
  if (!row) throw notFound(id);
  return row;
}

// A drawing made later for a loose end that had no image (a note).
function setImage(id, image) {
  db.prepare('UPDATE catches SET image = ? WHERE id = ? AND image IS NULL').run(image, Number(id));
  return getCatch(id);
}

function isSaved(char) {
  return Boolean(db.prepare('SELECT 1 FROM saved WHERE char = ?').get(char));
}

// Saving twice keeps the first save (and its first catch).
function save(char, firstCatchId = null) {
  db.prepare('INSERT OR IGNORE INTO saved (char, first_catch_id, saved_at) VALUES (?, ?, ?)').run(char, firstCatchId, now());
}

function unsave(char) {
  db.prepare('DELETE FROM saved WHERE char = ?').run(char);
}

// Resolves a catch to a character and saves the character, in one step.
const choose = db.transaction((id, char) => {
  getCatch(id);
  db.prepare('UPDATE catches SET char = ?, resolved_at = ? WHERE id = ?').run(char, now(), Number(id));
  save(char, Number(id));
  return getCatch(id);
});

// Remove marks the catch; restore clears the mark. The row stays.
function remove(id) {
  getCatch(id);
  db.prepare('UPDATE catches SET deleted_at = ? WHERE id = ?').run(now(), Number(id));
  return getCatch(id);
}

function restore(id) {
  getCatch(id);
  db.prepare('UPDATE catches SET deleted_at = NULL WHERE id = ?').run(Number(id));
  return getCatch(id);
}

function recordOpen(char, fromKind = null, fromValue = null) {
  db.prepare('INSERT INTO opens (char, from_kind, from_value, opened_at) VALUES (?, ?, ?, ?)').run(char, fromKind, fromValue, now());
}

function recordGroupOpen(kind, value, fromKind, fromValue) {
  db.prepare("INSERT INTO opens (char, from_kind, from_value, opened_at, group_kind, group_value) VALUES ('', ?, ?, ?, ?, ?)")
    .run(fromKind, fromValue, now(), kind, String(value));
}

// --- explorations --------------------------------------------------------------

const readExploration = (row) => ({ ...row, stops: row.stops ? JSON.parse(row.stops) : [] });

function explorationNotFound(id) {
  const ids = db.prepare('SELECT id FROM explorations ORDER BY id').pluck().all();
  const valid = ids.length ? `exploration ids are ${ids.length <= 20 ? ids.join(', ') : `whole numbers from 1 to ${ids.at(-1)}`}` : 'there are no explorations yet';
  return Object.assign(new Error(`no exploration with id ${JSON.stringify(String(id))}; ${valid}`), { status: 404 });
}

function getExploration(id) {
  const row = /^\d+$/.test(String(id)) ? db.prepare('SELECT * FROM explorations WHERE id = ?').get(Number(id)) : null;
  if (!row) throw explorationNotFound(id);
  return readExploration(row);
}

// The question is saved before the model is called; the answer, or the
// failure, is written onto the same row afterwards.
function addExploration(question, model) {
  const info = db.prepare('INSERT INTO explorations (question, model, created_at) VALUES (?, ?, ?)').run(question, model, now());
  return getExploration(info.lastInsertRowid);
}

function finishExploration(id, { reading = null, stops = [], dropped = 0, tookMs, error = null }) {
  db.prepare('UPDATE explorations SET reading = ?, stops = ?, dropped = ?, took_ms = ?, error = ? WHERE id = ?')
    .run(reading, JSON.stringify(stops), dropped, tookMs, error, Number(id));
  return getExploration(id);
}

const explorations = () => db.prepare('SELECT id, question, created_at, error FROM explorations ORDER BY id DESC').all();

const looseEnds = () => db.prepare('SELECT * FROM catches WHERE char IS NULL AND deleted_at IS NULL ORDER BY id').all();
const latest = (n = 10) => db.prepare('SELECT * FROM catches WHERE char IS NOT NULL AND deleted_at IS NULL ORDER BY id DESC LIMIT ?').all(n);
const catchesFor = (char) => db.prepare('SELECT * FROM catches WHERE char = ? AND deleted_at IS NULL ORDER BY id DESC').all(char);
const savedList = () => db.prepare('SELECT char, first_catch_id, saved_at FROM saved ORDER BY saved_at DESC, rowid DESC').all();
const savedSet = () => new Set(db.prepare('SELECT char FROM saved').pluck().all());
const opens = () => db.prepare('SELECT * FROM opens ORDER BY rowid').all();

module.exports = {
  db, DATA_DIR, IMAGES, CATCH_KINDS,
  addCatch, getCatch, setImage, isSaved, save, unsave, choose, remove, restore, recordOpen, recordGroupOpen,
  getExploration, addExploration, finishExploration, explorations,
  looseEnds, latest, catchesFor, savedList, savedSet, opens,
};
