const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
let selectedIndex = -1; // Tracks current keyboard item selection index

const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

// Clear input field on click
searchInput.addEventListener('click', () => {
    searchInput.value = '';
    resultsDiv.style.display = 'none';
    selectedIndex = -1;
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
    historyDiv.innerHTML = hist.map(n => `
        <span class="hist-btn" onclick="getPrice('${n.replace(/'/g, "\\'")}')">${n}</span>
    `).join('');
}

// 1. IMPROVEMENT: Smart Formatting for Millions (e.g., 10.5M, 250K)
function formatGP(num) {
    if (!num && num !== 0) return 'N/A';
    if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

// 2. IMPROVEMENT: Search Highlight Matching
function generateItemsHTML(itemsArray, query) {
    return itemsArray.map((item, index) => {
        const safeName = item.name.replace(/'/g, "\\'");
        const formattedName = item.name.charAt(0).toUpperCase() + item.name.slice(1);
        const filename = formattedName.replace(/ /g, '_').replace(/'/g, "%27");
        const fastIconUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;
        
        // Highlight matching text characters using a neon green color accent
        const regex = new RegExp(`(${query})`, 'gi');
        const highlightedName = item.name.replace(regex, `<strong style="color: #00ff00;">$1</strong>`);
        
        return `
            <div class="suggested-item" id="suggest-${index}" onclick="getPrice('${safeName}')">
                <img src="${fastIconUrl}" class="suggest-icon" onerror="this.src='https://oldschool.runescape.wiki/images/Coins_10000.png'; this.onerror=null;">
                <span>${highlightedName}</span>
            </div>
        `;
    }).join('');
}

// Instant local item lookup handler
searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase().trim();
    selectedIndex = -1;
    
    if (val.length < 3) { 
        resultsDiv.style.display = 'none'; 
        return; 
    }
    
    const itemMatches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    
    if (itemMatches.length > 0) {
        const localItemsArray = itemMatches.map(m => itemMap[m]);
        resultsDiv.innerHTML = generateItemsHTML(localItemsArray, val);
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'none';
    }
});

// 3. IMPROVEMENT: Keyboard Arrow Key & Enter Navigation
searchInput.addEventListener('keydown', (e) => {
    const items = resultsDiv.getElementsByClassName('suggested-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIndex < items.length - 1) selectedIndex++;
        updateVisualSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex > 0) selectedIndex--;
        updateVisualSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex > -1 && items[selectedIndex]) {
            items[selectedIndex].click();
        } else if (items[0]) {
            items[0].click(); // Default select first suggestion option
        }
    }
});

function updateVisualSelection(elements) {
    for (let i = 0; i < elements.length; i++) {
        if (i === selectedIndex) {
            elements[i].style.background = '#2a2e3a';
            elements[i].scrollIntoView({ block: 'nearest' });
        } else {
            elements[i].style.background = '';
        }
    }
}

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
    selectedIndex = -1;
    
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
    
    // Renders matching exact card template structure from screenshot bounds
    priceBox.innerHTML = `
        <div class="price-container">
            <div class="price-text">
                <strong class="item-name">${name.toUpperCase()}</strong>
                Buy: <span style="color:#00ff00" title="${p.high ? p.high.toLocaleString() : '0'} gp">${formatGP(p.high)}</span> gp<br>
                Sell: <span style="color:#ff0000" title="${p.low ? p.low.toLocaleString() : '0'} gp">${formatGP(p.low)}</span> gp
            </div>
            ${iconUrl ? `<img src="${iconUrl}" class="item-icon">` : ''}
        </div>
        <span class="timestamp">Updated: ${relativeTime}</span>
    `;
}

initTracker();
