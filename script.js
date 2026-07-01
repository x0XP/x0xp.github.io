const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

// Clear input on click
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
    } catch (e) { console.error("Init failed", e); }
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
    resultsDiv.innerHTML = matches.map(m => `<div onclick="getPrice('${m.replace(/'/g, "\\'")}')">${m}</div>`).join('');
    resultsDiv.style.display = matches.length ? 'block' : 'none';
});

async function getPrice(name) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    saveHistory(name);
    
    priceBox.style.display = 'block';
    priceBox.innerHTML = `<div style="padding:10px;">Loading...</div>`;
    
    const id = itemMap[name.toLowerCase()];
    const res = await fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${id}`, { headers });
    const data = await res.json();
    const p = data.data[id];
    
    // Using official Wiki endpoint for icons
    const iconUrl = `https://oldschool.runescape.wiki/images/${name.replace(/ /g, '_')}_detail.png`;
    const timeAgo = Math.round((Date.now()/1000 - p.highTime) / 60);
    
    priceBox.classList.remove('fade-in');
    void priceBox.offsetWidth;
    priceBox.classList.add('fade-in');
    
    priceBox.innerHTML = `
        <div class="icon-box" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="text-align: left;">
                <strong>${name.toUpperCase()}</strong><br>
                Buy: <span style="color:#00ff00">${p.high ? p.high.toLocaleString() : 'N/A'}</span> gp<br>
                Sell: <span style="color:#ff0000">${p.low ? p.low.toLocaleString() : 'N/A'}</span> gp
            </div>
            <img src="${iconUrl}" width="40" onerror="this.style.display='none'">
        </div>
        <span class="timestamp">Updated: ${timeAgo} mins ago</span>
    `;
}

initTracker();
