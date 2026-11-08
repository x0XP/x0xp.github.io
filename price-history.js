(function historyRuntime() {
  'use strict';
  const API = 'https://prices.runescape.wiki/api/v2/osrs/timeseries';
  const PERIODS = [
    {key:'24h', label:'24H', lookback:'24h'},
    {key:'7d', label:'7D', lookback:'7d'},
    {key:'30d', label:'30D', lookback:'30d'},
    {key:'90d', label:'90D', lookback:'6m', days:90},
    {key:'1y', label:'1Y', lookback:'1y'},
    {key:'all', label:'All', lookback:'1y'}
  ];
  const cache = new Map();
  const connections = new WeakMap();
  const numberFormat = new Intl.NumberFormat('en-GB', {maximumFractionDigits:0});
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function number(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  }
  function normalizeRows(payload) {
    if (!payload || !Array.isArray(payload.data)) throw new Error('Unexpected price history format');
    const unique = new Map();
    for (const row of payload.data) {
      if (!row || !Number.isFinite(row.timestamp) || row.timestamp <= 0) continue;
      const high = number(row.avgHighPrice), low = number(row.avgLowPrice);
      const price = high !== null && low !== null ? (high + low) / 2 : high ?? low;
      if (price === null) continue;
      const highVolume = typeof row.highPriceVolume === 'number' && Number.isFinite(row.highPriceVolume) ? Math.max(0, row.highPriceVolume) : null;
      const lowVolume = typeof row.lowPriceVolume === 'number' && Number.isFinite(row.lowPriceVolume) ? Math.max(0, row.lowPriceVolume) : null;
      unique.set(row.timestamp, {
        timestamp: row.timestamp,
        price,
        volume: highVolume === null && lowVolume === null ? null : (highVolume ?? 0) + (lowVolume ?? 0)
      });
    }
    return [...unique.values()].sort((a,b)=>a.timestamp-b.timestamp);
  }
  function gp(value) { return numberFormat.format(Math.round(value)); }
  function shorthand(value) {
    const abs=Math.abs(value);
    if (abs>=1e9) return `${(value/1e9).toFixed(2)}B`;
    if (abs>=1e6) return `${(value/1e6).toFixed(2)}M`;
    if (abs>=1e3) return `${(value/1e3).toFixed(1)}K`;
    return String(Math.round(value));
  }
  function markup(itemId) {
    const id=Number(itemId);
    if (!Number.isSafeInteger(id) || id<=0) return '';
    const buttons=PERIODS.map(p=>`<button type="button" class="price-history-period${p.key==='30d'?' is-active':''}" data-history-period="${p.key}" aria-pressed="${p.key==='30d'}" ${p.key==='all'?'title="All available history (up to one year)"':''}>${p.label}</button>`).join('');
    return `<section class="price-history" data-item-id="${id}" aria-label="Historical Grand Exchange prices">
      <div class="price-history-heading">
        <h3><i class="fas fa-chart-bar" aria-hidden="true"></i> Price history</h3>
        <div class="price-history-periods" role="group" aria-label="Chart time range">${buttons}</div>
      </div>
      <div class="price-history-panel">
        <div class="price-history-chart" role="group" aria-label="Price chart">
          <p class="price-history-status" role="status" aria-live="polite">Loading price history…</p>
          <div class="price-history-tooltip" hidden></div>
        </div>
        <div class="price-history-stats" aria-label="Price history statistics">
          <div><span>High</span><strong data-history-stat="high">—</strong></div>
          <div><span>Low</span><strong data-history-stat="low">—</strong></div>
          <div><span data-history-change-label>Change (30D)</span><strong data-history-stat="change">—</strong></div>
          <div><span data-history-volume-label>Volume (30D)</span><strong data-history-stat="volume">—</strong></div>
        </div>
      </div>
    </section>`;
  }
  async function fetchSeries(itemId,lookback) {
    const key=itemId+':'+lookback;
    const old=cache.get(key);
    if(old&&Date.now()-old.at<120000) return old.promise;
    const url = `${API}?id=${encodeURIComponent(itemId)}&lookback=${lookback}`;
    const promise=fetch(url,{cache:'no-store',headers:{Accept:'application/json'}})
      .then(response=>{if(!response.ok)throw new Error(`History HTTP ${response.status}`);return response.json();})
      .then(normalizeRows);
    cache.set(key,{at:Date.now(),promise});
    promise.catch(()=>{if(cache.get(key)?.promise===promise)cache.delete(key);});
    return promise;
  }
  function node(tag, attributes={}, content) {
    const el=document.createElementNS(SVG_NS,tag);
    for(const [key,value] of Object.entries(attributes)) el.setAttribute(key,String(value));
    if(content !== undefined)el.textContent=String(content);
    return el;
  }
  function pointLabel(timestamp,period) {
    const date=new Date(timestamp*1000);
    if(period==='24h')return date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    if(period==='1y'||period==='all')return date.toLocaleDateString('en-GB',{month:'short',year:'2-digit'});
    return date.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  }
  function drawChart(section,rows,period) {
    const chart=section.querySelector('.price-history-chart');
    const status=chart.querySelector('.price-history-status');
    const tooltip=chart.querySelector('.price-history-tooltip');
    chart.querySelector('svg')?.remove();
    tooltip.hidden=true;
    status.hidden=false;
    if(!rows.length){status.textContent='No historical prices available for this period.';return;}
    status.hidden=true;
    const width=Math.max(280,Math.round(chart.clientWidth||740));
    const small=width<470;
    const height=small?160:178;
    const margin={top:10,left:small?51:58,right:10,bottom:26};
    const w=width-margin.left-margin.right;
    const h=height-margin.top-margin.bottom;
    const values=rows.map(r=>r.price);
    const min=Math.min(...values),max=Math.max(...values);
    const padding=Math.max((max-min)*.13,max*.008,1);
    const yMin=Math.max(0,min-padding),yMax=max+padding;
    const xMin=rows[0].timestamp,xMax=rows[rows.length-1].timestamp;
    const xx=ts=>margin.left+(xMax===xMin?.5:(ts-xMin)/(xMax-xMin))*w;
    const yy=price=>margin.top+(1-(price-yMin)/(yMax-yMin))*h;
    const chartPoints=rows.map(row=>({x:xx(row.timestamp),y:yy(row.price),row}));
    const svg=node('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${period.toUpperCase()} historical price chart with ${rows.length} price observations`});
    const defs=node('defs');
    const gradientId='price-history-fill-'+section.dataset.itemId;
    const grad=node('linearGradient',{id:gradientId,x1:'0',y1:'0',x2:'0',y2:'1'});
    grad.append(node('stop',{offset:'0%','stop-color':'#e4ab46','stop-opacity':'.34'}),node('stop',{offset:'100%','stop-color':'#e4ab46','stop-opacity':'.025'}));
    defs.append(grad);svg.append(defs);
    for(let i=0;i<=4;i++){
      const y=margin.top+(h*i/4);
      svg.append(node('line',{x1:margin.left,y1:y,x2:width-margin.right,y2:y,stroke:'#b79864','stroke-opacity':'.2'}));
      svg.append(node('text',{x:margin.left-10,y:y+4,'text-anchor':'end',fill:'#b7b4ae','font-size':small?'10':'11'},shorthand(yMax-(yMax-yMin)*i/4)));
    }
    const tickCount=small?3:5;
    for(let i=0;i<tickCount;i++){
      const t=xMin+(xMax-xMin)*i/(tickCount-1);
      const x=xx(t);
      svg.append(node('line',{x1:x,y1:margin.top,x2:x,y2:margin.top+h,stroke:'#b79864','stroke-opacity':'.12'}));
      svg.append(node('text',{x,y:height-8,'text-anchor':i===0?'start':i===tickCount-1?'end':'middle',fill:'#b7b4ae','font-size':small?'10':'11'},pointLabel(t,period)));
    }
    const line=chartPoints.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const fill=`${line} L ${chartPoints[chartPoints.length-1].x.toFixed(2)} ${(margin.top+h).toFixed(2)} L ${chartPoints[0].x.toFixed(2)} ${(margin.top+h).toFixed(2)} Z`;
    svg.append(node('path',{d:fill,fill:`url(#${gradientId})`}));
    svg.append(node('path',{d:line,fill:'none',stroke:'#eab143','stroke-width':2.35,'stroke-linecap':'round','stroke-linejoin':'round'}));
    const guide=node('line',{stroke:'#e5ba72','stroke-opacity':'.55','stroke-dasharray':'4 4',y1:margin.top,y2:margin.top+h,visibility:'hidden'});
    const dot=node('circle',{r:4.5,stroke:'#111821','stroke-width':2,fill:'#ffd079',visibility:'hidden'});
    svg.append(guide,dot);
    function hover(event){
      const rect=svg.getBoundingClientRect();
      if(!rect.width)return;
      const fraction=Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width));
      const targetTs=xMin+fraction*(xMax-xMin);
      let lo=0,hi=chartPoints.length-1;
      while(lo<hi){const mid=Math.floor((lo+hi)/2);if(chartPoints[mid].row.timestamp<targetTs)lo=mid+1;else hi=mid;}
      const candidates=[chartPoints[lo],chartPoints[Math.max(0,lo-1)]];
      const point=candidates.reduce((best,p)=>Math.abs(p.row.timestamp-targetTs)<Math.abs(best.row.timestamp-targetTs)?p:best);
      guide.setAttribute('x1',point.x);guide.setAttribute('x2',point.x);guide.setAttribute('visibility','visible');
      dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);dot.setAttribute('visibility','visible');
      const date=new Date(point.row.timestamp*1000);
      tooltip.textContent=`${date.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})} · ${gp(point.row.price)} gp`;
      tooltip.hidden=false;
      const tipX=Math.max(66,Math.min(rect.width-66,point.x/width*rect.width));
      tooltip.style.left=tipX+'px';
    }
    svg.addEventListener('pointermove',hover);
    svg.addEventListener('pointerleave',()=>{guide.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');tooltip.hidden=true;});
    svg.addEventListener('pointercancel',()=>{tooltip.hidden=true;});
    chart.append(svg);
  }
  function writeStats(section,rows,period) {
    const field=name=>section.querySelector(`[data-history-stat="${name}"]`);
    const option=PERIODS.find(p=>p.key===period);
    section.querySelector('[data-history-change-label]').textContent=`Change (${option.label})`;
    section.querySelector('[data-history-volume-label]').textContent=`Volume (${option.label})`;
    for(const stat of ['high','low','change','volume']){const el=field(stat);el.textContent='—';el.classList.remove('is-up','is-down');}
    if(!rows.length)return;
    const values=rows.map(r=>r.price);
    const high=Math.max(...values),low=Math.min(...values);
    field('high').textContent=shorthand(high)+' gp';
    field('low').textContent=shorthand(low)+' gp';
    field('high').title=gp(high)+' gp';
    field('low').title=gp(low)+' gp';
    if(rows.length>1&&rows[0].price>0){
      const change=(rows[rows.length-1].price/rows[0].price-1)*100;
      const el=field('change');
      el.textContent=(change>0?'+':'')+change.toFixed(2)+'%';
      if(change>0)el.classList.add('is-up');
      else if(change<0)el.classList.add('is-down');
    }
    const volumes=rows.map(r=>r.volume).filter(v=>v!==null);
    if(volumes.length) field('volume').textContent=gp(volumes.reduce((a,b)=>a+b,0));
  }
  function mount(container,itemId){
    const section=container.querySelector('.price-history');
    if(!section||String(itemId)!==section.dataset.itemId)return;
    connections.get(container)?.disconnect();
    let period='30d',serial=0,rows=[];
    const controls=[...section.querySelectorAll('[data-history-period]')];
    function updateControls(){
      for(const button of controls){const isActive=button.dataset.historyPeriod===period;button.classList.toggle('is-active',isActive);button.setAttribute('aria-pressed',String(isActive));}
    }
    async function load() {
      const current=++serial;
      const chart=section.querySelector('.price-history-chart');
      const status=chart.querySelector('.price-history-status');
      status.hidden=false;status.textContent='Loading price history…';
      chart.querySelector('svg')?.remove();
      const option=PERIODS.find(p=>p.key===period);
      writeStats(section,[],period);
      try{
        const found=await fetchSeries(itemId,option.lookback);
        if(current!==serial||!section.isConnected||container.querySelector('.price-history')!==section)return;
        const cutoff=option.days?Date.now()/1000-option.days*86400:0;
        rows=found.filter(row=>row.timestamp>=cutoff);
        writeStats(section,rows,period);
        drawChart(section,rows,period);
      }catch(error){
        if(current!==serial||!section.isConnected||container.querySelector('.price-history')!==section)return;
        rows=[];
        status.hidden=false;status.textContent='Price history is unavailable right now.';
      }
    }
    for(const button of controls) button.addEventListener('click',()=>{
      if(button.dataset.historyPeriod===period)return;
      period=button.dataset.historyPeriod;
      updateControls();
      void load();
    });
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{
      if(rows.length&&section.isConnected)drawChart(section,rows,period);
    }):null;
    resize?.observe(section.querySelector('.price-history-chart'));
    connections.set(container,{disconnect(){resize?.disconnect();serial++;}});
    void load();
  }
  window.PriceHistory=Object.freeze({markup,mount});
  return {normalizeRows,shorthand,markup};
})();
