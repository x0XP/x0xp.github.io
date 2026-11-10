// ---------- Fetch with retry ----------
async function fetchWithRetry(url, options, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i === retries) throw e;
      console.warn(`Retry ${i + 1} for ${url}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// ---------- Init ----------
async function initTracker() {
  searchInput.disabled = true;
  searchInput.placeholder = "Loading items…";
  try {
    const priceRes = await fetchWithRetry(
      "https://prices.runescape.wiki/api/v1/osrs/latest",
      { headers },
    );
    const mapRes = await fetchWithRetry(
      "https://prices.runescape.wiki/api/v1/osrs/mapping",
      { headers },
    );
    const prices = await priceRes.json();
    const mappings = await mapRes.json();
    mappings.forEach((item) => {
      if (prices.data[item.id]) {
        itemMap[item.name.toLowerCase()] = {
          id: item.id, name: item.name,
          icon: typeof item.icon === "string" ? item.icon : null,
        };
      }
    });
    console.log(`Loaded ${Object.keys(itemMap).length} tradeable items`);
  } catch (e) {
    console.error("Failed to load essential price data", e);
  }

  try {
    await loadCollectionLogData();
  } catch (e) {
    console.error("Collection log loading failed", e);
    bossCollectionCache = {};
  }

  searchInput.disabled = false;
  searchInput.placeholder = "Search an item or boss…";
  attachPinListeners();
  loadPinned();
  loadHistory();
  restoreFloatingCards();

  if (card) {
    card.addEventListener(
      "animationend",
      () => card.classList.remove("fade-in"),
      { once: true },
    );
  }

  const hash = window.location.hash;
  if (hash) {
    const hashParams = parseHash(hash);
    if (hashParams.item) await getPrice(hashParams.item, true);
    else if (hashParams.boss) await getPrice(hashParams.boss, true);
  }

  const savedItem = sessionStorage.getItem("lastSearchedItem");
  if (savedItem && !/^#(?:item|boss)=/.test(hash)) await getPrice(savedItem, true);

  // ---------- Start auto-refresh ----------
  startAutoRefresh();
}

// ---------- Hash helpers ----------
function parseHash(hash) {
  const params = {};
  const parts = hash.substring(1).split("&");
  parts.forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      try { params[key] = decodeURIComponent(value.replace(/\+/g, " ")); } catch { /* Ignore malformed external fragments. */ }
    }
  });
  return params;
}

function updateUrlHash(type, name) {
  // Restoring cached cards in the background must not change the hub route.
  if (!document.body.classList.contains("checker-open")) return;
  const encoded = encodeURIComponent(name).replace(/%20/g, "+");
  const hash = `#${type}=${encoded}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

// ---------- Animate card height ----------
function animateCardHeight(updateCallback) {
  if (!card) {
    updateCallback();
    return;
  }
  const startHeight = card.offsetHeight;
  card.style.height = startHeight + "px";
  card.style.transition = "height 0.4s ease";
  card.style.overflow = "hidden";

  updateCallback();

  requestAnimationFrame(() => {
    card.style.height = "auto";
    const endHeight = card.offsetHeight;
    card.style.height = startHeight + "px";
    card.offsetHeight;
    card.style.height = endHeight + "px";

    setTimeout(() => {
      card.style.height = "auto";
      card.style.transition = "";
      card.style.overflow = "";
    }, 400);
  });
}

// ---------- Collection log ----------
async function loadCollectionLogData() {
  console.log("Fetching Collection Log page HTML...");
  const html = await fetchHTML("Collection_log");
  if (!html) {
    console.error("Failed to load Collection Log HTML");
    return;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const cleanText = (str) =>
    str
      .replace(/\[edit\]/g, "")
      .replace(/’/g, "'")
      .replace(/‘/g, "'")
      .trim();
  const headings = doc.querySelectorAll("h3");
  const tables = Array.from(doc.querySelectorAll("table.wikitable"));

  const bossMap = {};
  headings.forEach((heading) => {
    try {
      const headingText = cleanText(heading.textContent);
      if (!headingText) return;
      const table = findNextTable(heading, tables);
      if (!table) return;
      const items = extractTradeableItems(table);
      if (items.length > 0) {
        bossMap[headingText] = [...new Set(items)];
      }
    } catch (e) {
      console.warn("Skipping malformed boss section", e);
    }
  });

  console.log(`Bosses with tradeable uniques: ${Object.keys(bossMap).length}`);
  bossCollectionCache = bossMap;
}

function findNextTable(heading, tables) {
  for (const table of tables) {
    if (
      heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      return table;
    }
  }
  return null;
}

function extractTradeableItems(table) {
  const items = [];
  table.querySelectorAll("tr").forEach((row) => {
    row.querySelectorAll("td").forEach((cell) => {
      cell.querySelectorAll("a").forEach((link) => {
        const name = link.textContent.trim();
        if (itemMap[name.toLowerCase()]) {
          items.push(name);
        }
      });
    });
  });
  return items;
}

async function fetchHTML(pageTitle) {
  try {
    const url = `https://oldschool.runescape.wiki/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    return data.parse?.text?.["*"] || null;
  } catch (e) {
    console.error(`Failed to fetch HTML for ${pageTitle}`, e);
    return null;
  }
}

function findBossKey(name) {
  const lower = name.toLowerCase();
  return (
    Object.keys(bossCollectionCache).find(
      (key) => key.toLowerCase() === lower,
    ) ||
    Object.keys(bossCollectionCache).find((key) =>
      key.toLowerCase().includes(lower),
    )
  );
}

