// OSRS Wiki API User-Agent requirement
const headers = { 'User-Agent': 'x0XP-Site-Tracker' };

// 1. Load Item Mappings and Filter for GE items
let itemMap = {};

async function initTracker() {
    try {
        // Fetch live prices first to get only items currently on the GE
        const response = await fetch('https://prices.runescape.wiki/api/v1/osrs/latest', { headers });
        const data = await response.json();
        const latestPrices = data.data; // This object contains IDs of only GE-tradable items

        // Fetch the master item mapping
        const mappingRes = await fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', { headers });
        const mappings = await mappingRes.json();

        // Populate itemMap only with items found in the live prices object
        mappings.forEach(item => {
            if (latestPrices[item.id]) {
                itemMap[item.name.toLowerCase()] = item.id;
            }
        });
        console.log("Tracker Initialized: Tradable items loaded.");
    } catch (error) {
        console.error("Error loading GE data:", error);
    }
}

// Initialize on page load
initTracker();

// 2. Search & Fetch logic
const searchInput = document.getElementById('itemSearch');
const resultsDiv = document.getElementById('results');
const priceBox = document.getElementById('priceDisplay');

searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase();
    
    // Minimum 3 characters to start searching
    if (val.length < 3) { 
        resultsDiv.style.display = 'none'; 
        return; 
    }
    
    // Filter matching names from the filtered map
    const matches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    
    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(m => `<div onclick="getPrice('${m}')">${m}</div>`).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'none';
    }
});

// 3. Fetch Price
async function getPrice(name) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    
    try {
        const res = await fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemMap[name]}`, { headers });
        const data = await res.json();
        const p = data.data[itemMap[name]];
        
        priceBox.style.display = 'block';
        priceBox.innerHTML = `
            <strong>${name.toUpperCase()}</strong><br>
            Buy: ${p.high.toLocaleString()} gp<br>
            Sell: ${p.low.toLocaleString()} gp
        `;
    } catch (error) {
        priceBox.innerHTML = "Error fetching price.";
        priceBox.style.display = 'block';
    }
}
