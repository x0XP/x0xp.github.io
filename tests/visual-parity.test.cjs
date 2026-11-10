const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {once}=require('node:events');
const {PNG}=require('pngjs');
const puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'..'),base=path.join(root,'baseline-site');
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
const prices={data:{'4151':{high:2500000,low:2450000,highTime:1600000000,lowTime:1600000000}}};
const mapping=[{id:4151,name:'Abyssal whip',icon:'Abyssal_whip.png'}];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml'};
let server,browser,origin;
async function screenshot(site,view,viewport){
  const page=await browser.newPage(); await page.setViewport(viewport);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{
    const u=r.url();
    if(u.startsWith(origin+'/'))return r.continue();
    if(u.startsWith('https://prices.runescape.wiki/api/v1/osrs/latest'))
      return r.respond({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(prices)});
    if(u.startsWith('https://prices.runescape.wiki/api/v1/osrs/mapping'))
      return r.respond({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(mapping)});
    if(u.startsWith('https://oldschool.runescape.wiki/api.php'))
      return r.respond({status:200,headers:cors,contentType:'application/json',body:JSON.stringify({parse:{text:{'*':'<h3>Abyssal Sire</h3><table class="wikitable"><tr><td><a>Abyssal whip</a></td></tr></table>'}}})});
    if(r.resourceType()==='stylesheet')return r.respond({status:200,contentType:'text/css',body:''});
    return r.abort();
  });
  try{
    await page.goto(origin+'/'+site+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.classList.contains('site-ready'),{timeout:25000});
    await page.waitForFunction(()=>!document.getElementById('itemSearch').disabled,{timeout:25000});
    if(view==='checker'){await page.click('#openChecker');await page.waitForFunction(()=>document.body.classList.contains('checker-open'));}
    if(view==='github'){await page.click('#openGithub');await page.waitForSelector('#githubRepos .github-repo',{timeout:15000});}
    await new Promise(resolve=>setTimeout(resolve,900));
    await page.evaluate(async()=>{await document.fonts.ready;});
    assert.deepEqual(errors,[],site+' JavaScript errors');
    return await page.screenshot({type:'png',animations:'disabled'});
  }finally{await page.close();}
}
function fractionDifferent(first,second){
  const a=PNG.sync.read(first),b=PNG.sync.read(second);
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  let changed=0;
  for(let i=0;i<a.data.length;i+=4){
    if(Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]))>12)changed++;
  }
  return changed/(a.width*a.height);
}
test.before(async()=>{
  assert.ok(fs.existsSync(path.join(base,'index.html')),'Checkout main to baseline-site before visual test');
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),m=/^\/(baseline|candidate)\/(.*)$/.exec(url.pathname);
    if(!m){res.writeHead(404);res.end();return;}
    const dir=m[1]==='baseline'?base:root;
    let relative;
    try{relative=decodeURIComponent(m[2]||'index.html');}catch(_){res.writeHead(400);res.end();return;}
    const file=path.resolve(dir,relative);
    if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  origin='http://127.0.0.1:'+server.address().port;
  browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
});
test.after(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  for(const view of ['home','checker','github']){
    test('visual parity '+view+' '+viewport.width+'px',async()=>{
      const baseline=await screenshot('baseline',view,viewport);
      const candidate=await screenshot('candidate',view,viewport);
      const ratio=fractionDifferent(baseline,candidate);
      assert.ok(ratio<0.01,view+' at '+viewport.width+'px: '+(ratio*100).toFixed(2)+'% pixels differ from main');
    });
  }
}
