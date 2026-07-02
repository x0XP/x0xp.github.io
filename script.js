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
    // Only save to history if it's a real tradeable Grand Exchange item
    if (!itemMap[name.toLowerCase()]) {
        return; 
    }

    const oldButtons = Array.from(historyDiv.children);
    const oldPositions = oldButtons.map(btn => {
        const rect = btn.getBoundingClientRect();
        return { name: btn.textContent.trim(), left: rect.left, top: rect.top };
    });

    let hist = JSON.parse(localStorage.getItem('osrsHistory') || '[]');
    hist = [name, ...hist.filter(i => i !== name)].slice(0, 3);
    localStorage.setItem('osrsHistory', JSON.stringify(hist));
    
    loadHistory();

    const newButtons = Array.from(historyDiv.children);
    newButtons.forEach(btn => {
        const btnName = btn.textContent.trim();
        const oldPos = oldPositions.find(p => p.name === btnName);
        
        if (oldPos) {
            const newRect = btn.getBoundingClientRect();
            const deltaX = oldPos.left - newRect.left;
            const deltaY = oldPos.top - newRect.top;
            
            if (deltaX !== 0 || deltaY !== 0) {
                btn.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                btn.style.transition = 'none';
                
                requestAnimationFrame(() => {
                    btn.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
                    btn.style.transform = 'none';
                });
            }
        } else {
            btn.style.opacity = '0';
            btn.style.transform = 'scale(0.85)';
            requestAnimationFrame(() => {
                btn.style.transition = 'all 0.4s ease';
                btn.style.opacity = '1';
                btn.style.transform = 'none';
            });
        }
    });
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
    const cleanTarget = target.replace(/er$/, '').replace(/s$/, ''); 
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].includes(cleanTarget)) {
            return itemMap[keys[i]];
        }
    }
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].startsWith(target.substring(0, 4))) {
            return itemMap[keys[i]];
        }
    }
    let minDistance = Infinity;
    let closestItem = null;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const dist = levenshtein(target, key);
        if (dist < minDistance) {
            minDistance = dist;
            closestItem = itemMap[key];
        }
    }
    return closestItem;
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
    
    debounceTimer = setTimeout(async () => {
        let combinedResults = [];

        // 1. Gather tradeable items containing the text string
        const itemMatches = Object.keys(itemMap)
            .filter(name => name.includes(val))
            .map(m => itemMap[m]);
        
        // 2. Fallback query structure to reliably fetch drops if string hints at a boss profile
        try {
            const titleCaseQuery = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const cargoUrl = `https://oldschool.runescape.wiki/api.php?action=cargoquery&tables=Drops&fields=Item&where=Monster%20LIKE%20%22%25${encodeURIComponent(titleCaseQuery)}%25%22%20AND%20Rarity%20LIKE%20%22%25Unique%25%22&format=json&origin=*`;
            
            const cargoRes = await fetch(cargoUrl, { headers });
            const cargoData = await cargoRes.json();
            const results = cargoData.cargoquery || [];
            
            results.forEach(row => {
                const match = itemMap[row.title.Item.toLowerCase()];
                if (match && !combinedResults.some(d => d.id === match.id)) {
                    combinedResults.push(match);
                }
            });
        } catch (err) {
            console.error("Boss drop mapping check failed", err);
        }

        // 3. Merge regular items into list configuration
        itemMatches.forEach(item => {
            if (!combinedResults.some(d => d.id === item.id)) {
                combinedResults.push(item);
            }
        });

        // 4. Render results if matches found
        if (combinedResults.length > 0) {
            resultsDiv.innerHTML = generateItemsHTML(combinedResults.slice(0, 15), val);
            resultsDiv.style.display = 'block';
            return;
        }

        // 5. Fallback spellchecker
        const closest = getClosestMatch(val);
        if (closest) {
            const safeName = closest.name.replace(/'/g, "\\'");
            resultsDiv.innerHTML = `<div class="suggested-item" onclick="getPrice('${safeName}')" style="justify-content: center; cursor: pointer;"><span>Did you mean: <strong style="color: #00ff00;">${closest.name}</strong>?</span></div>`;
        } else {
            resultsDiv.innerHTML = `<div class="suggested-item" style="color: #666; cursor: default; justify-content: center;"><span>No items found</span></div>`;
        }
        resultsDiv.style.display = 'block';
    }, 250);
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
        if (selectedIndex > -1 && items[selectedIndex]) {
            items[selectedIndex].click();
        } else {
            getPrice(searchInput.value.trim());
        }
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
    
    priceBox.classList.remove('fade-in');
    priceBox.style.display = 'block';
    
    priceBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
            <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px; max-width: 70%;">
                <div class="skeleton" style="height: 16px; width: 95%; border-radius: 4px;"></div>
                <div class="skeleton" style="height: 13px; width: 65%; border-radius: 4px;"></div>
                <div class="skeleton" style="height: 13px; width: 55%; border-radius: 4px;"></div>
            </div>
            <div class="skeleton" style="width: 48px; height: 48px; border-radius: 6px; flex-shrink: 0; margin-left: 15px;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; width: 100%;">
            <div class="skeleton" style="height: 11px; width: 90px; border-radius: 3px;"></div>
            <div class="skeleton" style="height: 22px; width: 54px; border-radius: 4px;"></div>
        </div>
    `;

    const itemData = itemMap[name.toLowerCase()];
    
    if (!itemData) {
        try {
            const titleCaseBoss = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const cargoUrl = `https://oldschool.runescape.wiki/api.php?action=cargoquery&tables=Drops&fields=Item,Rarity&where=Monster%20LIKE%20%22%25${encodeURIComponent(titleCaseBoss)}%25%22%20AND%20Rarity%20LIKE%20%22%25Unique%25%22&group_by=Item&format=json&origin=*`;
            
            const cargoRes = await fetch(cargoUrl, { headers });
            const cargoData = await cargoRes.json();
            const results = cargoData.cargoquery || [];
            
            if (results.length === 0) {
                priceBox.innerHTML = `<div style="padding:10px; text-align:center; color: #7a8294;">No item or boss entry found.</div>`;
                return;
            }

            let uniquesHtml = '';
            results.forEach(row => {
                const drop = row.title;
                const match = itemMap[drop.Item.toLowerCase()];
                if (match) { 
                    const filename = drop.Item.charAt(0).toUpperCase() + drop.Item.slice(1).replace(/ /g, '_').replace(/'/g, "%27");
                    const imgUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;
                    
                    uniquesHtml += `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding: 7px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; align-items:center; gap:8px; min-width: 0;">
                                <img src="${imgUrl}" style="width:20px; height:20px; object-fit:contain; flex-shrink:0;" onerror="this.src='https://oldschool.runescape.wiki/images/Coins_10000.png';">
                                <span style="font-size:12px; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor:pointer;" onclick="getPrice('${drop.Item.replace(/'/g, "\\'")}')">${drop.Item}</span>
                            </div>
                            <span style="color:#00ff00; font-size:11px; flex-shrink:0; margin-left:10px;">${drop.Rarity.replace('Unique, ', '')}</span>
                        </div>
                    `;
                }
            });

            if (!uniquesHtml) {
                priceBox.innerHTML = `<div style="padding:10px; text-align:center; color:#7a8294;">Boss found, but contains no tradeable unique items.</div>`;
                return;
            }

            void priceBox.offsetWidth;
            priceBox.classList.add('fade-in');
            priceBox.innerHTML = `
                <div style="text-align:left; width:100%;">
                    <strong style="display:block; margin-bottom:8px; font-size:14px; color:#ffae00; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:4px;">${name.toUpperCase()} DROP LOG</strong>
                    <div style="max-height:160px; overflow-y:auto; padding-right:2px;">
                        ${uniquesHtml}
                    </div>
                </div>
            `;
            return;
        } catch (err) {
            priceBox.innerHTML = `<div style="padding:10px; text-align:center; color:#ff5555;">Database tracking error.</div>`;
            return;
        }
    }

    try {
        const [priceRes, wikiRes] = await Promise.all([
            fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemData.id}`, { headers }),
            fetch(`https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=500&redirects=1&origin=*`)
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
