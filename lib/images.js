'use strict';
// A drawing or a photo Dan caught, as the page sends it: a data URL
// (PNG or JPEG) that the page has already reduced to at most 1600 px on the
// long side. The server reads the size from the file's own header, refuses
// anything larger or of another type, and keeps it under DATA_DIR/images.

const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { IMAGES } = require('./db');

const MAX_SIDE = 1600;
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg' };

function refuse(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// Width and height from a PNG's IHDR or a JPEG's first SOF marker.
function size(buf, ext) {
  if (ext === 'png') {
    if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

// Checks the data URL and writes the file; answers its file name.
function store(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw refuse('image must be a PNG or JPEG data URL (data:image/png;base64,… or data:image/jpeg;base64,…)');
  const ext = TYPES[m[1]];
  const buf = Buffer.from(m[2], 'base64');
  const dims = size(buf, ext);
  if (!dims) throw refuse(`image is not a readable ${ext === 'png' ? 'PNG' : 'JPEG'} file`);
  if (Math.max(dims.width, dims.height) > MAX_SIDE) {
    throw refuse(`image must be at most ${MAX_SIDE} px on its long side; this one is ${dims.width}×${dims.height}`);
  }
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(IMAGES, name), buf);
  return name;
}

// The stored file as a data URL again, for the model.
function dataUrl(name) {
  const ext = path.extname(name).slice(1);
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${type};base64,${fs.readFileSync(path.join(IMAGES, name)).toString('base64')}`;
}

// Only names this module made: digits, a dash, hex, an extension.
const validName = (name) => /^\d+-[0-9a-f]{8}\.(png|jpg)$/.test(name);

module.exports = { MAX_SIDE, store, dataUrl, validName, size };
