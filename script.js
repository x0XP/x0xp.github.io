const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

// Clear input on click for better UX
searchInput.addEventListener('click', () => {
    searchInput.value = '';
    resultsDiv.style.display = 'none';
});

async function initTracker() {
    try {
        const [priceRes, mapRes] = await Promise.all([
            fetch('https://prices.runescape.wiki/api/v1/osrs/latest', { headers }),
            fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', { headers })
        ]);
        const prices = await priceRes.json();
        const mappings = await mapRes.json();
        mappings.forEach(item => { if (prices.data[item.id]) itemMap[item.name.toLowerCase()] = item.id; });
        loadHistory();
    } catch (e) { console.error("Initialization failed", e); }
}

function saveHistory(name) {
    let hist = JSON.parse(localStorage.getItem('osrsHistory') || '[]');
    hist = [name, ...hist.filter(i => i !== name)].slice(0, 3);
    localStorage.setItem('osrsHistory', JSON.stringify(hist));
    loadHistory();
}

function loadHistory() {
    const hist = JSON.parse(localStorage.getItem('osrsHistory') || '[]');
    historyDiv.innerHTML = hist.map(n => `<span class="hist-btn" onclick="getPrice('${n.replace(/'/g, "\\'")}')">${n}</span>`).join('');
}

searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase();
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    
    const matches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    resultsDiv.innerHTML = matches.map(m => {
        const safeName = m.replace(/'/g, "\\'");
        return `<div onclick="getPrice('${safeName}')">${m}</div>`;
    }).join('');
    
    resultsDiv.style.display = matches.length ? 'block' : 'none';
});

async function getPrice(name) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    saveHistory(name);
    
    priceBox.style.display = 'block';
    priceBox.innerHTML = `<div style="padding:10px; text-align:center;">Loading...</div>`;
    
    const id = itemMap[name.toLowerCase()];
    const [priceRes, wikiRes] = await Promise.all([
        fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${id}`, { headers }),
        // Look up the exact image filename from the Wiki
        ffetch(`https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=500&redirects=true`)
    ]);
    
    const priceData = await priceRes.json();
    const p = priceData.data[id];
    
    const wikiData = await wikiRes.json();
    const pages = wikiData.query.pages;
    const pageId = Object.keys(pages)[0];
    // This gives us the direct, correct URL provided by the Wiki
    const iconUrl = pages[pageId].thumbnail ? pages[pageId].thumbnail.source : null;
    
    const timeAgo = Math.round((Date.now()/1000 - p.highTime) / 60);
    
    priceBox.classList.remove('fade-in');
    void priceBox.offsetWidth;
    priceBox.classList.add('fade-in');
    
    priceBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="text-align: left; flex-grow: 1;">
                <strong style="display:block; margin-bottom: 5px; color: #fff;">${name.toUpperCase()}</strong>
                Buy: <span style="color:#00ff00">${p.high ? p.high.toLocaleString() : 'N/A'}</span> gp<br>
                Sell: <span style="color:#ff0000">${p.low ? p.low.toLocaleString() : 'N/A'}</span> gp
            </div>
            ${iconUrl ? `<img src="${iconUrl}" width="48" height="48" style="margin-left: 15px; background: rgba(0,0,0,0.2); border-radius: 4px;">` : ''}
        </div>
        <span class="timestamp" style="margin-top: 10px; display: block; color: #666; text-align: left;">Updated: ${timeAgo} mins ago</span>
    `;
}

initTracker();
