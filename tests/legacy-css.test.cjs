const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const baselineSha='eec15cf41bf1921a5c8387f9c236585febf3ae53';

test('legacy checker extraction preserves original CSS byte-for-byte', () => {
  const combined=read('style.css')+read('features/checker/legacy.css');
  const prelude='blob '+Buffer.byteLength(combined,'utf8')+'\0';
  assert.equal(createHash('sha1').update(prelude).update(combined).digest('hex'),baselineSha);
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
