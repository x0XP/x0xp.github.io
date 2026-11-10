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
// Deliberate Phase 5 change: two icon controls now use shared CSS.
// All remaining Price Checker source must match this reviewed snapshot.
const reviewedBlobSha = 'd4f3959b0efb5e946f61c5eb9b6960e4a8d6697b';

test('modular Price Checker source matches the reviewed Phase 5 baseline', () => {
  const combined = parts.map(read).join('');
  const prefix = 'blob ' + Buffer.byteLength(combined, 'utf8') + '\0';
  const sha = createHash('sha1').update(prefix).update(combined).digest('hex');
  assert.equal(sha, reviewedBlobSha, 'reviewed Price Checker source has changed');
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

test('Wiki and share icons use the shared CSS and delegated glow', () => {
  const module = read('features/checker/rendering.js');
  const controls = module.split('// ---------- Tooltips ----------')[0];
  assert.doesNotMatch(controls, /iconButtonStyle|onmouseover=|onmouseout=|style=/);
  assert.match(controls, /class="icon-btn"/);
  assert.match(controls, /onclick="copyShareLink/);
  assert.match(controls, /https:\/\/oldschool\.runescape\.wiki\/w\//);
  const buttons = read('ui/buttons.css');
  assert.match(buttons, /\.icon-btn\s*\{/);
  assert.match(buttons, /\.icon-btn:focus-visible/);
  assert.match(read('ui/effects.css'), /a\.icon-btn/);
  assert.match(read('ui/interactions.js'), /a\.icon-btn/);
});
