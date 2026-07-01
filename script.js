const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};

// Hardcoded popular boss drop tables so suggestions show up instantly while typing!
const bossMap = {
    "zulrah": [12924, 12934, 12922, 12932, 6571, 12919], // Blowpipe, Scales, Magic Fang, Serpentine, Onyx, Onyx muta
    "vorkath": [22002, 22106, 21992, 11286, 11283, 19529], // Skeletal visage, Necklace, Dragonbone necklace, Draconic visage, D shield
    "abyssal sire": [13265, 13274, 13275, 13276, 13263, 4151], // Dagger, Bludgeon claw, Spine, Axon, Head, Whip
    "nex": [26382, 26384, 26374, 26372, 26233, 11785], // Torva full, Plate, Legs, Vambraces, Zaryte crossbow, Armadyl crossbow
    "the whisperer": [28238, 28258, 28240, 28256, 28314], // Bellator vestige, Siren's vitriol, Quartz, Awakener's orb, Virtus mask
    "duke sucellus": [28236, 28258, 28240, 28256, 28316], // Magus vestige, etc.
    "vardorvis": [28232, 28258, 28240, 28256, 28318], // Ultor vestige, etc.
    "the leviathan": [28234, 28258, 28240, 28256, 28320] // Venator vestige, etc.
};

const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

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

// Intercepts input: checks if it matches a boss name first, then falls back to regular items
searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase().trim();
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    
    // Check if what they typed matches a known Boss key
    const matchedBossKey = Object.keys(bossMap).find(boss => boss.includes(val));
    
    if (matchedBossKey) {
        const dropIds = bossMap[matchedBossKey];
        // Map the hardcoded IDs to actual item objects in our loaded itemMap
        const dropItems = Object.values(itemMap).filter(item => dropIds.includes(item.id));
        
        resultsDiv.innerHTML = `
            <div style="padding:5px 8px; font-size:10px; color:#666; text-transform:uppercase; font-weight:bold; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.05)">Drops from ${matchedBossKey.toUpperCase()}</div>
        ` + dropItems.map(item => {
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
        
        resultsDiv.style.display = 'block';
        return;
    }
    
    // Regular Item Fallback Search
    const matches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    resultsDiv.innerHTML = matches.map(m => {
        const itemObj = itemMap[m];
        const safeName = m.replace(/'/g, "\\'");
        const formattedName = itemObj.name.charAt(0).toUpperCase() + itemObj.name.slice(1);
        const filename = formattedName.replace(/ /g, '_').replace(/'/g, "%27");
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
