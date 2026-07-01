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
        
        // Save both ID and formatting data to itemMap for fast icon rendering
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

// Search autocomplete listener with fast redirect-lookup previews
searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase();
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    
    const matches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    
    resultsDiv.innerHTML = matches.map(m => {
        const itemObj = itemMap[m];
        const safeName = m.replace(/'/g, "\\'");
        
        // Capitalize the first letter to match the Wiki's filename requirements
        const formattedName = itemObj.name.charAt(0).toUpperCase() + itemObj.name.slice(1);
        const filename = formattedName.replace(/ /g, '_').replace(/'/g, "%27");
        
        // FIX: Using MediaWiki's Special:Redirect tool to pull the real asset bypassing hashes
        const fastIconUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;
        
        return `
            <div class="suggested-item" onclick="getPrice('${safeName}')">
                <img src="${fastIconUrl}" class="suggest-icon" onerror="this.src='https://oldschool.runescape.wiki/images/Coins_10000.png'; this.onerror=null;">
                <span>${itemObj.name}</span>
            </div>
        `;
    }).join('');
    
    resultsDiv.style.display = matches.length ? 'block' : 'none';
});

// Helper function to format large chunks of minutes cleanly
function formatTimeAgo(totalMinutes) {
    if (totalMinutes < 60) {
        return `${totalMinutes} mins ago`;
    }
    
    const totalHours = Math.round(totalMinutes / 60);
    if (totalHours < 24) {
        return `${totalHours} hours ago`;
    }
    
    const totalDays = Math.round(totalHours / 24);
    if (totalDays < 30) {
        return `${totalDays} days ago`;
    }
    
    const totalMonths = Math.round(totalDays / 30.4); 
    return `${totalMonths} months ago`;
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
    
    // Fetch price and high-res image simultaneously
    const [priceRes, wikiRes] = await Promise.all([
        fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${id}`, { headers }),
        fetch(`https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=500&redirects=1`)
    ]);
    
    const priceData = await priceRes.json();
    const wikiData = await wikiRes.json();
    const p = priceData.data[id];

    // Safe extraction logic tracking non -1 pages
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
