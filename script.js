// OSRS Wiki API User-Agent requirement
const headers = { 'User-Agent': 'x0XP-Site-Tracker' };

// 1. Load Item Mappings
let itemMap = {};
fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', { headers })
    .then(r => r.json())
    .then(data => {
        data.forEach(item => itemMap[item.name.toLowerCase()] = item.id);
    });

// 2. Search & Fetch logic
const searchInput = document.getElementById('itemSearch');
const resultsDiv = document.getElementById('results');
const priceBox = document.getElementById('priceDisplay');

searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase();
    if (val.length < 3) { resultsDiv.style.display = 'none'; return; }
    const matches = Object.keys(itemMap).filter(name => name.includes(val)).slice(0, 5);
    resultsDiv.innerHTML = matches.map(m => `<div onclick="getPrice('${m}')">${m}</div>`).join('');
    resultsDiv.style.display = 'block';
});

async function getPrice(name) {
    resultsDiv.style.display = 'none';
    searchInput.value = name;
    const data = await fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemMap[name]}`, { headers }).then(r => r.json());
    const p = data.data[itemMap[name]];
    priceBox.style.display = 'block';
    priceBox.innerHTML = `<strong>${name.toUpperCase()}</strong><br>Buy: ${p.high.toLocaleString()}gp<br>Sell: ${p.low.toLocaleString()}gp`;
}
