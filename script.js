const headers = { 'User-Agent': 'x0XP-Site-Tracker' };
let itemMap = {};
let selectedIndex = -1;
let debounceTimer;

const searchInput = document.getElementById('itemSearch'),
      resultsDiv = document.getElementById('results'),
      priceBox = document.getElementById('priceDisplay'),
      historyDiv = document.getElementById('history');

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

function formatGP(num) {
    if (!num && num !== 0) return 'N/A';
    return num.toLocaleString();
}

function levenshtein(a, b) {
    const tmp = [];
    let i, j, alen = a.length, blen = b.length;
    if (alen === 0) return blen;
    if (blen === 0) return alen;
    for (i = 0; i <= alen; i++) tmp[i] = i;
    for (i = 1; i <= blen; i++) {
        let prev = i;
        for (j = 1; j <= alen; j++) {
            let val;
            if (b[i - 1] === a[j - 1]) val = tmp[j - 1];
            else val = Math.min(tmp[j - 1] + 1, Math.min(tmp[j] + 1, prev + 1));
            tmp[j - 1] = prev;
            prev = val;
        }
        tmp[alen] = prev;
    }
    return tmp[alen];
}

function getClosestMatch(target) {
    const keys = Object.keys(itemMap);
    
    // Stricter checking: does target completely contain an item first word or vice-versa?
    for (let i = 0; i < keys.length; i++) {
        const itemName = keys[i];
        const firstWord = itemName.split(' ')[0];
        if (target.startsWith(firstWord) || firstWord.startsWith(target.split(' ')[0])) {
            return itemMap[itemName];
        }
    }
    
    let minDistance = Infinity;
    let closestItem = null;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (Math.abs(key.length - target.length) > 2) continue; // Tightened threshold
        if (key.substring(0, 2) !== target.substring(0, 2)) continue; // Keep letter prefix anchor
        
        const dist = levenshtein(target, key);
        if (dist < minDistance) {
            minDistance = dist;
            closestItem = itemMap[key];
        }
    }
    return (minDistance <= 2 && closestItem) ? closestItem : null;
}

function generateItemsHTML(itemsArray, query) {
    return itemsArray.map((item, index) => {
        const safeName = item.name.replace(/'/g, "\\'");
        const filename = item.name.charAt(0).toUpperCase() + item.name.slice(1).replace(/ /g, '_').replace(/'/g, "%27");
        const fastIconUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;
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

searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = searchInput.value.toLowerCase().trim();
    selectedIndex = -1;
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    
    debounceTimer = setTimeout(() => {
        const itemMatches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 10);
        if (itemMatches.length > 0) {
            resultsDiv.innerHTML = generateItemsHTML(itemMatches.map(m => itemMap[m]), val);
            resultsDiv.style.display = 'block';
        } else {
            const closest = getClosestMatch(val);
            if (closest) {
                const safeName = closest.name.replace(/'/g, "\\'");
                resultsDiv.innerHTML = `<div class="suggested-item" onclick="getPrice('${safeName}')" style="justify-content: center; cursor: pointer;"><span>Did you mean: <strong style="color: #00ff00;">${closest.name}</strong>?</span></div>`;
            } else {
                resultsDiv.innerHTML = `<div class="suggested-item" style="color: #666; cursor: default; justify-content: center;"><span>No items found</span></div>`;
            }
            resultsDiv.style.display = 'block';
        }
    }, 150);
});

searchInput.addEventListener('keydown', (e) => {
    const items = resultsDiv.getElementsByClassName('suggested-item');
    if (!items.length || items[0].innerText === "No items found") return;
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        selectedIndex = (selectedIndex < items.length - 1) ? selectedIndex + 1 : 0;
        updateVisualSelection(items);
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        selectedIndex = (selectedIndex > 0) ? selectedIndex - 1 : items.length - 1;
        updateVisualSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        (selectedIndex > -1 && items[selectedIndex]) ? items[selectedIndex].click() : items[0].click();
    }
});

function updateVisualSelection(elements) {
    for (let i = 0; i < elements.length; i++) {
        elements[i].style.background = (i === selectedIndex) ? '#2a2e3a' : '';
        if (i === selectedIndex) elements[i].scrollIntoView({ block: 'nearest' });
    }
}

function formatTimeAgo(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes < 0) return "Just now";
    if (totalMinutes < 60) return `${totalMinutes} mins ago`;
    const totalHours = Math.round(totalMinutes / 60);
    if (totalHours < 24) return `${totalHours} hours ago`;
    const totalDays = Math.round(totalHours / 24);
    if (totalDays < 30) return `${totalDays} days ago`;
    return `${Math.round(totalDays / 30.4)} months ago`;
}

async function getPrice(name, skipHistory = false) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    selectedIndex = -1;
    if (!skipHistory) saveHistory(name);
    sessionStorage.setItem('lastSearchedItem', name);
    
    // Reset animations state cleanly on price box trigger
    priceBox.classList.remove('fade-in');
    priceBox.style.display = 'block';
    
    // Inject the physical shimmering skeleton div loader (No text!)
    priceBox.innerHTML = `<div class="skeleton" style="height: 115px;"></div>`;
    
    const itemData = itemMap[name.toLowerCase()];
    if (!itemData) { 
        priceBox.innerHTML = `<div style="padding:10px; text-align:center;">Item mapping missing.</div>`; 
        return; 
    }
    
    try {
        const [priceRes, wikiRes] = await Promise.all([
            fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemData.id}`, { headers }),
            fetch(`https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=500&redirects=1`)
        ]);
        
        const priceData = await priceRes.json();
        const wikiData = await wikiRes.json();
        const p = priceData.data[itemData.id] || {};
        let iconUrl = "";
        if (wikiData.query?.pages) {
            const page = Object.values(wikiData.query.pages)[0];
            iconUrl = page.thumbnail?.source || "";
        }
        
        const relativeTime = formatTimeAgo(p.highTime ? Math.round((Date.now()/1000 - p.highTime) / 60) : NaN);
        
        // Render content and trigger animation frame repaint cleanly
        void priceBox.offsetWidth;
        priceBox.classList.add('fade-in');

        priceBox.innerHTML = `
            <div class="price-container" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div class="price-text" style="padding-right: 12px; max-width: 75%;">
                    <strong class="item-name" style="display: block; margin: 0 0 8px 0; font-size: 16px; line-height: 1.2;">${name.toUpperCase()}</strong>
                    Buy: <span style="color:#00ff00">${formatGP(p.high)}</span> gp<br>
                    Sell: <span style="color:#ff0000">${formatGP(p.low)}</span> gp
                </div>
                ${iconUrl ? `<img src="${iconUrl}" class="item-icon" style="max-width: 50px; max-height: 50px; object-fit: contain;">` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px;">
                <span class="timestamp" style="font-size: 11px; color: #7a8294;">Updated: ${relativeTime}</span>
                <a href="https://oldschool.runescape.wiki/w/${encodeURIComponent(name)}" target="_blank" class="wiki-btn">
                    <span>Wiki</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                </a>
            </div>
        `;
    } catch(err) {
        priceBox.innerHTML = `<div style="padding:10px; text-align:center; color:#ff5555;">Failed fetching live values.</div>`;
    }
}

initTracker();
