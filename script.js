const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
let selectedIndex = -1;
let debounceTimer;

const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

// --- Helper: Check if item is tradeable ---
function isTradeable(itemName) {
    return !!itemMap[itemName.toLowerCase()];
}

searchInput.addEventListener('click', () => {
    searchInput.value = '';
    resultsDiv.style.display = 'none';
    selectedIndex = -1;
});

document.addEventListener('click', (e) => {
    if (e.target !== searchInput && e.target !== resultsDiv && !resultsDiv.contains(e.target)) {
        resultsDiv.style.display = 'none';
        selectedIndex = -1;
    }
});

async function initTracker() {
    try {
        const [priceRes, mapRes] = await Promise.all([
            fetch('https://prices.runescape.wiki/api/v1/osrs/latest', { headers }),
            fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', { headers })
        ]);
        const prices = await priceRes.json();
        const mappings = await mapRes.json();
        
        mappings.forEach(item => { 
            if (prices.data[item.id]) {
                itemMap[item.name.toLowerCase()] = { id: item.id, name: item.name };
            }
        });
        loadHistory();
        
        const savedItem = sessionStorage.getItem('lastSearchedItem');
        if (savedItem) getPrice(savedItem, true);
    } catch (e) { console.error("Initialization failed", e); }
}

function saveHistory(name) {
    if (!itemMap[name.toLowerCase()]) return; 
    let hist = JSON.parse(localStorage.getItem('osrsHistory') || '[]');
    hist = [name, ...hist.filter(i => i !== name)].slice(0, 3);
    localStorage.setItem('osrsHistory', JSON.stringify(hist));
    loadHistory();
}

function loadHistory() {
    const hist = JSON.parse(localStorage.getItem('osrsHistory') || '[]');
    historyDiv.innerHTML = hist.map(n => `<span class="hist-btn" onclick="getPrice('${n.replace(/'/g, "\\'")}')">${n}</span>`).join('');
}

function formatGP(num) {
    return (num || num === 0) ? num.toLocaleString() : 'N/A';
}

// --- Unified Search Logic ---
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = searchInput.value.trim();
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    
    debounceTimer = setTimeout(async () => {
        let suggestions = [];
        const valLower = val.toLowerCase();

        // 1. Fetch Collection Log Drops (Bosses)
        try {
            const formatQuery = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
            const logUrl = `https://oldschool.runescape.wiki/api.php?action=cargoquery&tables=Collection_log_items&fields=Tab,Item&where=Tab%20LIKE%20%22%25${encodeURIComponent(formatQuery)}%25%22&limit=20&format=json&origin=*`;
            const logRes = await fetch(logUrl, { headers });
            const logData = await logRes.json();
            
            if (logData.cargoquery) {
                logData.cargoquery.forEach(row => {
                    const itemName = row.title.Item;
                    if (isTradeable(itemName)) {
                        suggestions.push({ name: itemName, isBossDrop: true, boss: row.title.Tab });
                    }
                });
            }
        } catch (e) { console.error("Log fetch error", e); }

        // 2. Add standard item matches
        Object.keys(itemMap).forEach(key => {
            if (key.includes(valLower)) {
                // Ensure we don't duplicate if already added as a boss drop
                if (!suggestions.find(s => s.name.toLowerCase() === key)) {
                    suggestions.push({ name: itemMap[key].name, isBossDrop: false });
                }
            }
        });

        // 3. Render
        if (suggestions.length > 0) {
            resultsDiv.innerHTML = suggestions.slice(0, 15).map((s, index) => {
                const safeName = s.name.replace(/'/g, "\\'");
                const tag = s.isBossDrop ? `<span style="color:#ffae00; font-size:10px;"> (${s.boss})</span>` : '';
                return `
                    <div class="suggested-item" id="suggest-${index}" onclick="getPrice('${safeName}')">
                        <span>${s.name}${tag}</span>
                    </div>
                `;
            }).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = `<div class="suggested-item">No results found</div>`;
            resultsDiv.style.display = 'block';
        }
    }, 300);
});

// --- Price/Display Logic ---
async function getPrice(name, skipHistory = false) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    if (!skipHistory) saveHistory(name);
    sessionStorage.setItem('lastSearchedItem', name);
    
    priceBox.style.display = 'block';
    priceBox.innerHTML = `<div style="padding:20px; text-align:center;">Loading...</div>`;

    const itemData = itemMap[name.toLowerCase()];
    
    try {
        if (itemData) {
            const [priceRes, wikiRes] = await Promise.all([
                fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemData.id}`, { headers }),
                fetch(`https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=100&redirects=1&origin=*`)
            ]);
            
            const priceData = await priceRes.json();
            const wikiData = await wikiRes.json();
            const p = priceData.data[itemData.id] || {};
            const iconUrl = Object.values(wikiData.query?.pages || {})[0]?.thumbnail?.source || "";
            
            priceBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:16px;">${name.toUpperCase()}</strong><br>
                        Buy: <span style="color:#00ff00">${formatGP(p.high)}</span> gp<br>
                        Sell: <span style="color:#ff0000">${formatGP(p.low)}</span> gp
                    </div>
                    ${iconUrl ? `<img src="${iconUrl}" style="width:48px; height:48px;">` : ''}
                </div>
            `;
        } else {
            priceBox.innerHTML = `<div style="padding:10px; text-align:center;">Item not found.</div>`;
        }
    } catch(err) {
        priceBox.innerHTML = `<div style="padding:10px; text-align:center; color:#ff5555;">Error fetching data.</div>`;
    }
}

initTracker();
