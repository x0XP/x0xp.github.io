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
