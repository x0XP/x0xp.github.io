const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
let searchDebounceTimer; // Controls typing smoothness

const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

// Clear input field on click
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
        
        mappings.forEach(item => { 
            if (prices.data[item.id]) {
                itemMap[item.name.toLowerCase()] = {
                    id: item.id,
                    name: item.name
                };
            }
        });
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

// Formats item lists cleanly into structured HTML block sections
function generateItemsHTML(itemsArray) {
    return itemsArray.map(item => {
        const safeName = item.name.replace(/'/g, "\\'");
        const formattedName = item.name.charAt(0).toUpperCase() + item.name.slice(1);
        const filename = formattedName.replace(/ /g, '_').replace(/'/g, "%27");
        const fastIconUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;
        
        return `
            <div class="suggested-item" onclick="getPrice('${safeName}')">
                <img src="${fastIconUrl}" class="suggest-icon" onerror="this.src='https://oldschool.runescape.wiki/images/Coins_10000.png'; this.onerror=null;">
                <span>${item.name}</span>
            </div>
        `;
    }).join('');
}

// Live lookup handler combining direct local items + live Wiki Boss tables
searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    const val = searchInput.value.toLowerCase().trim();
    
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    
    // 1. Render instant matching local items first (No delay)
    const itemMatches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    const localItemsArray = itemMatches.map(m => itemMap[m]);
    
    let baseHtml = localItemsArray.length > 0 ? generateItemsHTML(localItemsArray) : "";
    resultsDiv.innerHTML = baseHtml;
    if (baseHtml) resultsDiv.style.display = 'block';

    // 2. Safely look up matching Boss Drops in the background after typing stops
    searchDebounceTimer = setTimeout(async () => {
        const formattedBossQuery = val.charAt(0).toUpperCase() + val.slice(1);
        
        // Corrected property syntax using OSRS Wiki's standard "Dropped by" template relation
        const query = `[[Dropped by::${formattedBossQuery}]]|?ID|limit=12`;
        const url = `https://oldschool.runescape.wiki/api.php?action=ask&query=${encodeURIComponent(query)}&format=json&origin=*`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.query && data.query.results && Object.keys(data.query.results).length > 0) {
                let bossDrops = [];
                
                for (const [key, value] of Object.entries(data.query.results)) {
                    // Pull item mappings using either structural wiki page names or item ID data blocks
                    const wikiItemName = key.toLowerCase();
                    const foundItem = itemMap[wikiItemName] || Object.values(itemMap).find(item => item.name.toLowerCase() === wikiItemName);
                    
                    if (foundItem && !bossDrops.some(d => d.id === foundItem.id)) {
                        bossDrops.push(foundItem);
                    }
                }
                
                if (bossDrops.length > 0) {
                    const labelHtml = `<div style="padding:6px 8px; font-size:10px; color:#999; text-transform:uppercase; font-weight:bold; letter-spacing:1px; background: rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05); border-top:1px solid rgba(255,255,255,0.05)">Drops from ${formattedBossQuery}</div>`;
                    const dropsHtml = generateItemsHTML(bossDrops);
                    
                    // Append the boss table results underneath any direct item matches
                    resultsDiv.innerHTML = baseHtml + labelHtml + dropsHtml;
                    resultsDiv.style.display = 'block';
                }
            }
        } catch (err) {
            console.error("OSRS Wiki Boss lookup failed", err);
        }
    }, 300);
});

function formatTimeAgo(totalMinutes) {
    if (totalMinutes < 60) return `${totalMinutes} mins ago`;
    const totalHours = Math.round(totalMinutes / 60);
    if (totalHours < 24) return `${totalHours} hours ago`;
    const totalDays = Math.round(totalHours / 24);
    if (totalDays < 30) return `${totalDays} days ago`;
    return `${Math.round(totalDays / 30.4)} months ago`;
}

async function getPrice(name) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    saveHistory(name);
    
    priceBox.style.display = 'block';
    priceBox.innerHTML = `<div style="padding:10px; text-align:center;">Loading...</div>`;
    
    const itemData = itemMap[name.toLowerCase()];
    const id = itemData ? itemData.id : null;
    
    if (!id) {
        priceBox.innerHTML = `<div style="padding:10px; text-align:center;">Item mapping missing.</div>`;
        return;
    }
    
    const [priceRes, wikiRes] = await Promise.all([
        fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${id}`, { headers }),
        fetch(`https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=500&redirects=1`)
    ]);
    
    const priceData = await priceRes.json();
    const wikiData = await wikiRes.json();
    const p = priceData.data[id];

    let iconUrl = "";
    if (wikiData.query && wikiData.query.pages) {
        const pages = wikiData.query.pages;
        const pageId = Object.keys(pages).find(id => id !== "-1");
        if (pageId && pages[pageId].thumbnail) {
            iconUrl = pages[pageId].thumbnail.source;
        }
    }
    
    const rawMinutes = Math.round((Date.now()/1000 - p.highTime) / 60);
    const relativeTime = formatTimeAgo(rawMinutes);
    
    priceBox.classList.remove('fade-in');
    void priceBox.offsetWidth;
    priceBox.classList.add('fade-in');
    
    priceBox.innerHTML = `
        <div class="price-container">
            <div class="price-text">
                <strong class="item-name">${name.toUpperCase()}</strong>
                Buy: <span style="color:#00ff00">${p.high ? p.high.toLocaleString() : 'N/A'}</span> gp<br>
                Sell: <span style="color:#ff0000">${p.low ? p.low.toLocaleString() : 'N/A'}</span> gp
            </div>
            ${iconUrl ? `<img src="${iconUrl}" class="item-icon">` : ''}
        </div>
        <span class="timestamp">Updated: ${relativeTime}</span>
    `;
}

initTracker();
