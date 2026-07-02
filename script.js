async function loadCollectionLogData() {
    console.log('Fetching Collection Log page HTML...');
    const html = await fetchHTML('Collection_log');
    if (!html) {
        console.error('Failed to load Collection Log HTML');
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // All headings that could be boss names (h2 for main sections)
    const headings = doc.querySelectorAll('h2');
    const bossNamesLower = new Set(bossNames.map(b => b.toLowerCase()));
    const bossMap = {};
    let matchedBosses = 0;
    let totalBossHeadings = 0;

    console.log(`Found ${headings.length} h2 headings on the page`);

    headings.forEach(heading => {
        const headingText = heading.textContent.replace(/\[edit\]/g, '').trim();
        // Check if this heading is exactly a known boss name (case-insensitive)
        if (!bossNamesLower.has(headingText.toLowerCase())) return;
        totalBossHeadings++;

        console.log(`Matched boss heading: "${headingText}"`);

        // Find the following table (might be separated by divs, but usually direct sibling)
        let nextElem = heading.nextElementSibling;
        while (nextElem && nextElem.tagName !== 'TABLE') {
            nextElem = nextElem.nextElementSibling;
        }
        if (!nextElem || !nextElem.classList.contains('wikitable')) {
            console.warn(`  No wikitable found after heading for ${headingText}`);
            return;
        }

        const items = [];
        const rows = nextElem.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) return; // skip header row
            const itemLink = cells[0].querySelector('a');
            if (!itemLink) return;
            const itemName = itemLink.textContent.trim();
            // Only keep tradeable items (exist in itemMap)
            if (itemMap[itemName.toLowerCase()]) {
                items.push(itemName);
            }
        });

        if (items.length > 0) {
            bossMap[headingText] = items;
            matchedBosses++;
            console.log(`  Items for ${headingText}: [${items.join(', ')}]`);
        } else {
            console.log(`  No tradeable items found for ${headingText}`);
        }
    });

    console.log(`Boss headings matched: ${totalBossHeadings}, bosses with items: ${matchedBosses}`);
    if (Object.keys(bossMap).length > 0) {
        console.log('Sample:', Object.entries(bossMap).slice(0, 3).map(([k,v]) => `${k}: [${v.join(', ')}]`));
        if (bossMap['Vorkath']) {
            console.log('✅ Vorkath items:', bossMap['Vorkath']);
        } else {
            console.warn('⚠️ Vorkath not found in parsed data!');
        }
    } else {
        console.warn('No bosses matched. Check heading names.');
        // Print first few headings for comparison
        const sampleHeadings = [];
        headings.forEach(h => {
            const text = h.textContent.replace(/\[edit\]/g, '').trim();
            if (text) sampleHeadings.push(text);
        });
        console.log('First 20 headings:', sampleHeadings.slice(0, 20));
    }

    bossCollectionCache = bossMap;
}
