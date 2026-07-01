const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
let searchDebounceTimer; // Keeps typing perfectly smooth

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

// Formats item object arrays cleanly into your UI suggestions list layout
function renderSuggestionsHTML(itemsArray, headerLabel = "") {
    let html = "";
    if (headerLabel) {
        html += `<div style="padding:5px 8px; font-size:10px; color:#666; text-transform:uppercase; font-weight:bold; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.05)">${headerLabel}</div>`;
    }
    
    html += itemsArray.map(item => {
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
    
    return html;
}

// Live lookup handler: searches normal items first, checks Wiki for Boss Drops second
searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    const val = searchInput.value.toLowerCase().trim();
    
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    
    // 1. Regular Item Search
    const itemMatches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    
    if (itemMatches.length > 0) {
        const itemsDataArray = itemMatches.map(m => itemMap[m]);
        resultsDiv.innerHTML = renderSuggestionsHTML(itemsDataArray);
        resultsDiv.style.display = 'block';
        return;
    }
    
    // 2. Fallback: Wait until typing pauses for 250ms, then see if it's a Boss name on the Wiki
    searchDebounceTimer = setTimeout(async () => {
        // Format string to approximate standard Wiki title matching (e.g. "zulrah" -> "Zulrah")
        const formattedBossQuery = val.charAt(0).toUpperCase() + val.slice(1);
        
        // Semantic MediaWiki Ask Query looking for items dropped by this monster name
        const query = `[[Drops from::${formattedBossQuery}]]|?Drop id|limit=10`;
        const url = `https://oldschool.runescape.wiki/api.php?action=ask&query=${encodeURIComponent(query)}&format=json&origin=*`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.query && data.query.results && Object.keys(data.query.results).length > 0) {
                let bossDrops = [];
                
                for (const [key, value] of Object.entries(data.query.results)) {
                    const dropIds = value.printouts['Drop id'];
                    if (dropIds && dropIds.length > 0) {
                        const itemId = dropIds[0];
                        // Match against our local item map to ensure it's a valid, tradeable GE item
                        const foundItem = Object.values(itemMap).find(item => item.id === itemId);
                        if (foundItem) bossDrops.push(foundItem);
                    }
                }
                
                if (bossDrops.length > 0) {
                    resultsDiv.innerHTML = renderSuggestionsHTML(bossDrops, `Drops from ${formattedBossQuery}`);
                    resultsDiv.style.display = 'block';
                    return;
                }
            }
        } catch (err) {
            console.error("Wiki Monster Ask query failed", err);
        }
        
        resultsDiv.style.display = 'none';
    }, 250);
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
