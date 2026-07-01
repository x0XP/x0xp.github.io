// --- GE Tracker Logic ---

async function getPrice(name) {
    const priceBox = document.getElementById('priceDisplay'); // Update ID if yours is different
    const iconContainer = document.querySelector('.icon-box'); // Update class if yours is different
    
    // 1. Show loading state
    priceBox.style.display = 'block';
    iconContainer.innerHTML = '<span>Loading...</span>';

    try {
        // 2. Fetch Price & Image (in parallel for speed)
        // Ensure you have an 'itemMap' defined elsewhere that links name to ID
        const itemId = itemMap[name.toLowerCase()];
        
        const [priceRes, wikiRes] = await Promise.all([
            fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemId}`),
            fetch(`https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=500&redirects=1`)
        ]);

        const priceData = await priceRes.json();
        const wikiData = await wikiRes.json();

        // 3. Extract Price
        const priceInfo = priceData.data[itemId];
        const high = priceInfo ? priceInfo.high.toLocaleString() : "N/A";
        const low = priceInfo ? priceInfo.low.toLocaleString() : "N/A";

        // 4. Extract Icon safely
        let iconUrl = null;
        if (wikiData.query && wikiData.query.pages) {
            const pages = wikiData.query.pages;
            // Get the first valid page ID that isn't -1
            const pageId = Object.keys(pages).find(id => id !== "-1");
            if (pageId && pages[pageId].thumbnail) {
                iconUrl = pages[pageId].thumbnail.source;
            }
        }

        // 5. Render result
        iconContainer.innerHTML = `
            ${iconUrl ? `<img src="${iconUrl}" class="item-icon">` : ''}
            <div>
                <strong class="item-name">${name}</strong>
                <div>High: ${high} | Low: ${low}</div>
            </div>
        `;

    } catch (error) {
        console.error("Fetch Error:", error);
        iconContainer.innerHTML = '<span>Error loading data.</span>';
    }
}

// Ensure you have your event listeners set up to call getPrice(itemName)
// Example:
/*
document.getElementById('itemSearch').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        getPrice(this.value);
    }
});
*/
