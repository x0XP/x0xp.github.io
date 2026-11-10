// Browser-level smoke tests for the real HTML/CSS/JavaScript app.
// External OSRS API responses are deterministic; no live network is needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const puppeteer = require('puppeteer-core');

const root = path.join(__dirname, '..');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml',
  '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon'};
const fixedTime = Math.floor(Date.now() / 1000) - 120;
const samplePrices = {data: {'4151': {high: 2500000, low: 2450000,
  highTime: fixedTime, lowTime: fixedTime}}};
const sampleMapping = [
  {id:4151, name:'Abyssal whip', icon:'Abyssal_whip.png'}
];
let server, browser, origin;

async function openPage() {
  const page = await browser.newPage();
  await page.setViewport({width:1280, height:900});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    const cors = {'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Headers':'*', 'Access-Control-Allow-Methods':'GET, OPTIONS'};
    if (url.startsWith(origin + '/')) {
      request.continue();
      return;
    }
    if (url.startsWith('https://prices.runescape.wiki/api/v1/osrs/latest')) {
      request.respond({status:200, contentType:'application/json', headers:cors,
        body:JSON.stringify(samplePrices)});
    } else if (url.startsWith('https://prices.runescape.wiki/api/v1/osrs/mapping')) {
      request.respond({status:200, contentType:'application/json', headers:cors,
        body:JSON.stringify(sampleMapping)});
    } else if (url.startsWith('https://oldschool.runescape.wiki/api.php')) {
      request.respond({status:200, contentType:'application/json', headers:cors,
        body:JSON.stringify({parse:{text:{'*':
          '<h3>Abyssal Sire</h3><table class="wikitable"><tr><td><a>Abyssal whip</a></td></tr></table>'}}})});
    } else if (request.resourceType() === 'stylesheet') {
      request.respond({status:200, contentType:'text/css', body:''});
    } else {
      request.abort();
    }
  });
  await page.goto(origin + '/', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.documentElement.classList.contains('site-ready'),
    {timeout:25000});
  await page.waitForFunction(() =>
    !document.getElementById('itemSearch').disabled, {timeout:25000});
  await page.waitForFunction(() => Object.keys(itemMap).length > 0, {timeout:25000});
  return {page, errors};
}

test.before(async () => {
  server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const name = url.pathname === '/' ? '/index.html' : url.pathname;
      const file = path.resolve(root, '.' + decodeURIComponent(name));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) ||
          !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('Not found'); return;
      }
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
      fs.createReadStream(file).pipe(res);
    } catch (_) { res.writeHead(400); res.end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

test('homepage and navigation reveal the checker and GitHub views', async () => {
  const {page,errors} = await openPage();
  try {
    await page.click('#openChecker');
    await page.waitForFunction(() => document.body.classList.contains('checker-open'));
    assert.equal(await page.$eval('#checkerView', e => e.inert), false);
    await page.click('#backHome');
    await page.waitForFunction(() => !document.body.classList.contains('checker-open'));
    // Wait for the 650ms slide transition before clicking the moving homepage card.
    await new Promise(resolve => setTimeout(resolve,800));
    await page.click('#openGithub');
    await page.waitForFunction(() => document.body.classList.contains('github-open'));
    await page.waitForSelector('.github-repo', {timeout:10000});
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('search, item prices and the Updates panel work together', async () => {
  const {page,errors} = await openPage();
  try {
    await page.click('#openChecker');
    await page.type('#itemSearch', 'aby');
    await page.waitForSelector('#results .suggested-item', {visible:true,timeout:10000});
    const match = await page.$eval('#results .suggested-item', el => el.textContent);
    assert.match(match, /Abyssal whip/i);
    await page.click('#results .suggested-item');
    await page.waitForFunction(() =>
      document.querySelector('#priceDisplay')?.textContent.includes('Abyssal whip'),
      {timeout:10000});
    assert.equal(await page.$eval('#priceDisplay', el => el.dataset.name), 'Abyssal whip');
    await page.click('#updatesIcon');
    await page.waitForSelector('#changelogBox.visible', {timeout:5000});
    assert.ok((await page.$eval('#changelogContent', e => e.textContent)).trim().length > 0);
    await page.click('#updatesIcon');
    assert.equal(await page.$eval('#changelogBox', e => e.classList.contains('visible')), false);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('floating windows persist on reload and Close All clears them', async () => {
  const {page,errors} = await openPage();
  try {
    await page.click('#openChecker');
    await page.evaluate(() => createFloatingCard('item', 'Abyssal whip', 40, 50));
    await page.waitForSelector('#floatingContainer .floating-card', {timeout:10000});
    assert.equal(await page.$eval('#clearAllFloating', e => e.style.display), 'inline-block');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('floatingCards')).length), 1);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.documentElement.classList.contains('site-ready'), {timeout:25000});
    await page.waitForFunction(() => document.querySelectorAll('#floatingContainer .floating-card').length === 1,
      {timeout:25000});
    await page.evaluate(() => clearAllFloating());
    await page.waitForFunction(() => document.querySelectorAll('#floatingContainer .floating-card').length === 0,
      {timeout:10000});
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('floatingCards')).length), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('generated share and Wiki actions use central styles and fade-in glow', async () => {
  const {page,errors} = await openPage();
  try {
    await page.click('#openChecker');
    await page.waitForFunction(() => document.body.classList.contains('checker-open'));
    // Hover geometry must settle after the 650ms page-slide animation.
    await new Promise(resolve=>setTimeout(resolve,800));
    await page.evaluate(() => getPrice('Abyssal whip'));
    await page.waitForSelector('#priceDisplay .price-actions a.icon-btn',
      {visible:true,timeout:10000});
    // getPrice animates card height for 400ms after rendering the actions.
    // A moving hit target cannot be tested with a stationary mouse cursor.
    await new Promise(resolve=>setTimeout(resolve,700));
    const controls = await page.$$eval('#priceDisplay .price-actions .icon-btn', elements =>
      elements.map(element => ({
        tag:element.tagName,
        style:element.getAttribute('style'),
        over:element.getAttribute('onmouseover'),
        out:element.getAttribute('onmouseout'),
        display:getComputedStyle(element).display,
        link:element.getAttribute('href')
      }))
    );
    assert.equal(controls.length,2);
    for(const item of controls) {
      assert.equal(item.style,null);
      assert.equal(item.over,null);
      assert.equal(item.out,null);
      // Flex items are blockified (inline-flex computes to flex).
      assert.ok(['flex','inline-flex'].includes(item.display));
    }
    assert.match(controls.find(x=>x.tag==='A').link,/^https:\/\/oldschool\.runescape\.wiki\/w\//);
    await page.evaluate(() => {
      window.__copiedShareURL = null;
      window.copyShareLink = value => { window.__copiedShareURL = value; };
    });
    await page.click('#priceDisplay .price-actions button.icon-btn');
    assert.match(await page.evaluate(() => window.__copiedShareURL),
      /^https:\/\/embed\.x0xp\.workers\.dev/);
    await page.evaluate(() => {
      window.__pointerLog = [];
      document.addEventListener('pointermove', e => {
        window.__pointerLog.push({tag:e.target.tagName, type:e.pointerType,
          x:e.clientX, y:e.clientY, match:!!e.target.closest('a.icon-btn')});
      }, {passive:true});
    });
    const coords = await page.$eval('#priceDisplay .price-actions a.icon-btn', e => {
      const r=e.getBoundingClientRect();
      return {x:r.left+r.width/2, y:r.top+r.height/2, width:r.width, height:r.height};
    });
    await page.mouse.move(1,1);
    await page.mouse.move(coords.x,coords.y,{steps:5});
    const hit = await page.$eval('#priceDisplay .price-actions a.icon-btn', e => {
      const box = e.getBoundingClientRect();
      const target = document.elementFromPoint(box.left + box.width/2,box.top+box.height/2);
      return {hovered:e.matches(':hover'), hitsLink:!!target?.closest('a.icon-btn'),
        lit:e.classList.contains('pointer-lit')};
    });
    assert.ok(hit.hitsLink, 'Wiki icon is obstructed by another element: '+JSON.stringify(hit));
    assert.ok(hit.lit,'Wiki icon did not receive delegated pointer glow: '+JSON.stringify({
      hit,coords,events:await page.evaluate(() => window.__pointerLog.slice(-12))
    }));
    await new Promise(resolve=>setTimeout(resolve,320));
    const glow = await page.$eval('#priceDisplay .price-actions a.icon-btn', e => ({
      before:Number(getComputedStyle(e,'::before').opacity),
      variable:e.style.getPropertyValue('--glow-x')
    }));
    assert.ok(glow.before>=0.95,'Wiki glow must fade in');
    assert.ok(glow.variable.endsWith('px'),'Wiki link should track pointer position');
    await page.mouse.move(1,1);
    await new Promise(resolve=>setTimeout(resolve,320));
    const after = await page.$eval('#priceDisplay .price-actions a.icon-btn',
      e => Number(getComputedStyle(e,'::before').opacity));
    assert.ok(after<=0.05,'Wiki glow must fade out');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});


test('right-click pinning, reload persistence and unpinning retain search history', async () => {
  const {page,errors}=await openPage();
  try {
    await page.click('#openChecker');
    await page.evaluate(()=>getPrice('Abyssal whip'));
    await page.waitForSelector('#history .hist-btn',{visible:true,timeout:10000});
    await page.click('#history .hist-btn',{button:'right'});
    await page.waitForFunction(()=>document.querySelectorAll('#pinned .hist-btn').length===1,
      {timeout:5000});
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('osrsPinned'))),
      ['Abyssal whip']);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.classList.contains('site-ready'),{timeout:25000});
    await page.waitForSelector('#pinned .hist-btn',{visible:true,timeout:10000});
    await page.click('#pinned .hist-btn',{button:'right'});
    await page.waitForFunction(()=>document.querySelectorAll('#history .hist-btn').length>0,
      {timeout:5000});
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('osrsPinned'))),[]);
    assert.equal(await page.$eval('#history .hist-btn',el=>el.textContent.trim()),'Abyssal whip');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('repository details, README action and back navigation stay functional', async () => {
  const {page,errors}=await openPage();
  try {
    await page.click('#openGithub');
    await page.waitForSelector('#githubRepos .github-repo',{visible:true,timeout:15000});
    const repository=await page.$eval('#githubRepos .github-repo',e=>({
      name:e.querySelector('.github-repo-name')?.textContent,
      href:e.getAttribute('href')
    }));
    await page.click('#githubRepos .github-repo');
    await page.waitForFunction(()=>document.body.classList.contains('repo-detail-open'),{timeout:5000});
    await page.waitForFunction(()=>document.querySelector('#repoDetailBody .repo-detail-actions a'),
      {timeout:12000});
    const details=await page.evaluate(()=>({
      title:document.getElementById('repoDetailTitle').textContent,
      actions:[...document.querySelectorAll('#repoDetailBody a.ui-button')].map(e=>({
        text:e.textContent.trim(),href:e.href
      })),
      githubInert:document.getElementById('githubView').inert,
      detailInert:document.getElementById('repoDetailView').inert
    }));
    assert.equal(details.title,repository.name);
    assert.equal(details.githubInert,true);
    assert.equal(details.detailInert,false);
    assert.ok(details.actions.some(x=>x.text.includes('View repository')&&x.href.includes(repository.name)));
    assert.ok(details.actions.some(x=>x.text.includes('Read on GitHub')&&x.href.includes('#readme')));
    await page.click('#backHome');
    await page.waitForFunction(()=>document.body.classList.contains('github-open'),{timeout:5000});
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('embedded trainer loads from its standalone URL and resets on leaving', async () => {
  const {page,errors}=await openPage();
  try {
    await page.click('#openSolTrainer');
    await page.waitForFunction(()=>document.body.classList.contains('sol-trainer-open'),{timeout:5000});
    const trainer=await page.evaluate(()=>({
      source:document.getElementById('solTrainerFrame').getAttribute('src'),
      external:document.getElementById('solTrainerFullscreen').href,
      viewInert:document.getElementById('solTrainerView').inert
    }));
    assert.equal(trainer.source,'https://x0xp.github.io/ColosseumTrainer/');
    assert.equal(trainer.external,trainer.source);
    assert.equal(trainer.viewInert,false);
    await page.click('#backHome');
    await page.waitForFunction(()=>!document.body.classList.contains('sol-trainer-open'),{timeout:5000});
    assert.equal(await page.$eval('#solTrainerFrame',frame=>frame.getAttribute('src')),'about:blank');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
