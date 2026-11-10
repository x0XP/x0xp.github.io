const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const modules = [
  "hub.css",
  "features/price-checker.css",
  "features/floating-windows.css",
  "ui/checker-responsive.css",
  "features/github.css",
  "features/price-history.css",
  "ui/view-layout.css"
];
const baselineBlobSha = '0a6df57fdbab4d6aff4f53906df85f699cc99c37';

test('split preserves entire original CSS blob and cascade order', () => {
  let combined = modules.map(read).join('');
  const moved = "url('../assets/hub-background.png')";
  assert.equal(combined.split(moved).length - 1, 1);
  combined = combined.replace(moved, "url('assets/hub-background.png')");
  const header = 'blob ' + Buffer.byteLength(combined, 'utf8') + '\0';
  const sha = createHash('sha1').update(header).update(combined).digest('hex');
  assert.equal(sha, baselineBlobSha);
});

test('all feature styles load once in the exact original order', () => {
  const html = read('index.html');
  let previous = html.indexOf("'ui/buttons.css'");
  assert.ok(previous >= 0);
  for (const path of modules) {
    const label = "'" + path + "'";
    const next = html.indexOf(label);
    assert.ok(next > previous, path + ' missing or out of order');
    assert.equal(html.split(label).length - 1, 1, path + ' duplicated');
    previous = next;
  }
  assert.ok(html.indexOf("'ui/view-layout.css'") < html.indexOf("'repo-detail.css'"));
  assert.ok(html.indexOf("'sol-trainer.css'") < html.indexOf("'ui/effects.css'"));
});

test('price checker JavaScript dependencies and key behaviours remain present', () => {
  const html = read('index.html');
  const order = ["'ui/interactions.js'", "'price-history.js'", "'script.js'", "'github-data.js'", "'repo-details.js'", "'hub.js'"];
  let previous = -1;
  for (const label of order) {
    const next = html.indexOf(label);
    assert.ok(next > previous, label + ' missing or out of order');
    previous = next;
  }
  const source = read('script.js');
  for (const fn of ['createFloatingCard','renderSearchResults','restoreFloatingCards','loadChangelog']) {
    assert.match(source, new RegExp('function ' + fn + '\\('));
  }
});
