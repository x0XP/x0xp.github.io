const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

async function initTracker() {
    const [priceRes, mapRes] = await Promise.all([
        fetch('https://prices.runescape.wiki/api/v1/osrs/latest', { headers }),
        fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', { headers })
    ]);
    const prices = await priceRes.json();
    const mappings = await mapRes.json();
    mappings.forEach(item => { if (prices.data[item.id]) itemMap[item.name.toLowerCase()] = item.id; });
    loadHistory();
}

function saveHistory(name) {
    let hist = JSON.parse(localStorage.getItem('osrsHistory') || '[]');
    hist = [name, ...hist.filter(i => i !== name)].slice(0, 3);
    localStorage.setItem('osrsHistory', JSON.stringify(hist));
    loadHistory();
}

function loadHistory() {
    const hist = JSON.parse(localStorage.getItem('osrsHistory') || '[]');
    historyDiv.innerHTML = hist.map(n => `<span class="hist-btn" onclick="getPrice('${n}')">${n}</span>`).join('');
}

searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase();
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    const matches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    resultsDiv.innerHTML = matches.map(m => `<div onclick="getPrice('${m}')">${m}</div>`).join('');
    resultsDiv.style.display = matches.length ? 'block' : 'none';
});

async function getPrice(name) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    saveHistory(name);
    const res = await fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemMap[name]}`, { headers });
    const data = await res.json();
    const p = data.data[itemMap[name]];
    const iconUrl = `https://oldschool.runescape.wiki/images/${name.replace(/ /g, '_')}.png`;
    const timeAgo = Math.round((Date.now()/1000 - p.highTime) / 60);
    priceBox.style.display = 'block';
    priceBox.innerHTML = `
        <div class="icon-box"><img src="${iconUrl}" width="32" onerror="this.style.display='none'"> <strong>${name.toUpperCase()}</strong></div>
        Buy: ${p.high ? p.high.toLocaleString() : 'N/A'} gp<br>
        Sell: ${p.low ? p.low.toLocaleString() : 'N/A'} gp
        <span class="timestamp">Updated: ${timeAgo} mins ago</span>
    `;
}

initTracker();
