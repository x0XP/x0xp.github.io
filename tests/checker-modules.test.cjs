const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
const read = pathName => fs.readFileSync(path.join(root, pathName), 'utf8');
const parts = [
  'features/checker/state.js',
  'features/checker/floating.js',
  'features/checker/panels.js',
  'features/checker/data.js',
  'features/checker/history.js',
  'features/checker/rendering.js',
  'script.js'
];
const originalBlobSha = '61e3d8267302de7ca1f55cead404ca8ebf3101b8';

test('splitting the Price Checker does not change its source or execution order', () => {
  const combined = parts.map(read).join('');
  const prefix = 'blob ' + Buffer.byteLength(combined, 'utf8') + '\0';
  const sha = createHash('sha1').update(prefix).update(combined).digest('hex');
  assert.equal(sha, originalBlobSha, 'original Price Checker source has changed');
});

test('critical classic scripts load in dependency order without duplicates', () => {
  const html = read('index.html');
  let last = html.indexOf("'price-history.js'");
  assert.ok(last >= 0);
  for (const part of parts) {
    const quoted = "'" + part + "'";
    const current = html.indexOf(quoted);
    assert.ok(current > last, part + ' is missing or out of order');
    assert.equal(html.split(quoted).length - 1, 2,
      part + ' must appear once in the list and once in critical-asset handling');
    last = current;
  }
  assert.ok(last < html.indexOf("'github-data.js'"));
  assert.ok(html.includes('script.async = false;'));
  assert.ok(html.includes('script.addEventListener(\'error\''));
});

test('initial state and tracker initialization remain at the first and last sections', () => {
  const state = read(parts[0]);
  const entry = read(parts[parts.length - 1]);
  assert.match(state, /const headers = /);
  assert.match(state, /let itemMap = \{\}/);
  assert.match(state, /const searchInput = document.getElementById/);
  assert.ok(entry.trimEnd().endsWith('const trackerReady = initTracker();'));
  assert.match(read('features/checker/floating.js'), /function restoreFloatingCards\(/);
  assert.match(read('features/checker/panels.js'), /async function loadChangelog\(/);
  assert.match(read('features/checker/history.js'), /window.togglePin = function/);
  assert.match(read('features/checker/rendering.js'), /function refreshAllCards\(/);
  assert.match(entry, /async function getPrice\(/);
});
