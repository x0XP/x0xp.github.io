const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
// The original pre-audit blob was eec15cf41bf1921a5c8387f9c236585febf3ae53.
// Reviewed snapshot excludes only unused and overridden selectors/declarations.
const reviewedSha='7c6f498658424765058dfc43e498021cfb0c03b0';

test('audited legacy checker CSS matches reviewed stylesheet snapshot', () => {
  const combined=read('style.css')+read('features/checker/legacy.css');
  const prelude='blob '+Buffer.byteLength(combined,'utf8')+'\0';
  assert.equal(createHash('sha1').update(prelude).update(combined).digest('hex'),reviewedSha);
});

test('legacy rules load after global CSS but before shared components and features', () => {
  const html=read('index.html');
  const order=["'style.css'","'features/checker/legacy.css'","'components.css'",
    "'ui/buttons.css'","'features/price-checker.css'","'features/floating-windows.css'"];
  const offsets=order.map(item=>html.indexOf(item));
  for(let i=0;i<offsets.length;i++){
    assert.ok(offsets[i]>=0,order[i]+' missing');
    if(i>0)assert.ok(offsets[i]>offsets[i-1],order[i]+' out of order');
    assert.equal(html.split(order[i]).length-1,1,order[i]+' duplicate');
  }
});


test('removed legacy selectors are not referenced by the site runtime', () => {
  const js=[
    'hub.js','github-data.js','repo-details.js','price-history.js','site-refresh.js',
    'features/checker/state.js','features/checker/floating.js','features/checker/panels.js',
    'features/checker/data.js','features/checker/history.js','features/checker/rendering.js',
    'script.js'
  ].map(read).join('\n') + read('index.html');
  const css=read('style.css')+read('features/checker/legacy.css');
  for(const obsolete of ['waveCanvas','button-container','button-row',
    'btn-github','btn-youtube','btn-wom','wiki-btn','share-btn','floating-drag-handle']){
    assert.ok(!js.includes(obsolete),obsolete+' is still referenced by the app');
    assert.ok(!css.includes(obsolete),obsolete+' should be removed from legacy CSS');
  }
  assert.ok(!css.includes('color: #ff5555;'),'legacy red close hover remains');
  assert.ok(css.includes('.hist-btn {'),'history styles must be preserved');
  assert.ok(css.includes('.floating-close {'),'floating controls must be preserved');
  assert.ok(css.includes('.clear-all-float-btn {'),'Close All layout must be preserved');
});
