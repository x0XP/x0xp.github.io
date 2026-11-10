const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const components = read('components.css');
const buttons = read('ui/buttons.css');
const surfaces = read('ui/surfaces.css');
const typography = read('ui/typography.css');
const repoCSS = read('repo-detail.css');
const repoJS = read('repo-details.js');
const trainerCSS = read('sol-trainer.css');
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

test('shared surfaces and typography load before page styles', () => {
  const styles = ["'components.css'", "'ui/surfaces.css'", "'ui/typography.css'", "'ui/buttons.css'", "'hub.css'", "'ui/effects.css'"];
  for (let i = 1; i < styles.length; i++) {
    assert.ok(html.indexOf(styles[i - 1]) < html.indexOf(styles[i]), styles[i] + ' order');
  }
  for (const selector of ['.ui-surface', '.ui-card', '.ui-card-heading', '.ui-view-card', '.ui-inset-panel']) {
    assert.ok(surfaces.includes(selector + ' {'), selector + ' missing from surfaces');
    assert.ok(!components.includes(selector + ' {'), selector + ' duplicated in tokens');
  }
  for (const selector of ['.ui-card-heading h2', '.ui-section-heading', '.ui-muted']) {
    assert.ok(typography.includes(selector + ' {'), selector + ' missing from typography');
  }
  assert.ok(typography.includes('@media (max-width: 600px)'));
});

test('all four cards share a shell, preserving page dimensions and mobile rules', () => {
  assert.equal((html.match(/ui-view-card/g) || []).length, 4);
  assert.ok(surfaces.includes('padding: var(--ui-card-padding);'));
  assert.ok(hub.includes('.checker-view .ui-card { width: 500px; }'));
  assert.ok(hub.includes('.github-view .ui-card { width: 820px; }'));
  assert.ok(repoCSS.includes('.repo-detail-card { width: 100%; padding: 20px; }'));
  assert.ok(trainerCSS.includes('.sol-trainer-card { width:100%; padding:20px; }'));
  assert.ok(hub.includes('.checker-view .card { width: 100%; padding: 20px; }'));
  assert.ok(trainerCSS.includes('width:min(1240px,100%); min-width:0; padding:25px;'));
});

test('profile and dynamic GitHub inset panels reuse shared border styles', () => {
  assert.ok(html.includes('class="github-profile ui-inset-panel"'));
  assert.ok(repoJS.includes('repo-detail-stat ui-inset-panel ui-inset-panel--filled'));
  assert.ok(repoJS.includes('repo-detail-readme ui-inset-panel ui-inset-panel--filled'));
  assert.ok(surfaces.includes('border: 1px solid var(--ui-inset-border);'));
  assert.ok(surfaces.includes('background: var(--ui-inset-bg);'));
  assert.ok(!repoCSS.includes('border: 1px solid #b7986440;'));
});
