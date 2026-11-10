const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const components = read('components.css');
const buttons = read('ui/buttons.css');
const effects = read('ui/effects.css');
const interactions = read('ui/interactions.js');
const hub = read('hub.js');
const legacy = read('style.css');

test('shared button bases are loaded after tokens and before view CSS', () => {
  assert.ok(html.indexOf("'components.css'") < html.indexOf("'ui/buttons.css'"));
  assert.ok(html.indexOf("'ui/buttons.css'") < html.indexOf("'hub.css'"));
  assert.ok(html.indexOf("'hub.css'") < html.indexOf("'ui/effects.css'"));
  assert.match(buttons, /\.ui-button\s*\{/);
  assert.match(buttons, /\.ui-list-row\s*\{/);
  assert.doesNotMatch(components, /\.ui-button\s*\{/);
  assert.doesNotMatch(components, /\.ui-list-row\s*\{/);
});

test('one shared listener handles pointer and keyboard focus', () => {
  assert.ok(html.indexOf("'ui/interactions.js'") < html.indexOf("'hub.js'"));
  for (const event of ['pointermove', 'pointerout', 'focusin']) {
    assert.match(interactions, new RegExp('addEventListener\\(.*' + event));
  }
  assert.doesNotMatch(hub, /const glowTargets/);
  assert.match(interactions, /classList\.add\('pointer-lit'\)/);
});

test('glow fade, accessibility, and Close All styling are shared', () => {
  assert.match(effects, /transition:\s*opacity \.25s ease/);
  assert.match(effects, /prefers-reduced-motion/);
  assert.match(effects, /:focus-visible/);
  assert.match(effects, /#clearAllFloating:hover/);
  assert.doesNotMatch(legacy, /\.clear-all-float-btn:hover/);
  assert.doesNotMatch(html, /button-glow\.css/);
});
