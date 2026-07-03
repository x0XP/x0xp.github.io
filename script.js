const headers = { "User-Agent": "x0XP-Item-Price-Checker - .x0xp on Discord" };
let itemMap = {};
let bossCollectionCache = {};
let selectedIndex = -1;
let debounceTimer;
let suppressDropdown = false;

// DOM elements
const searchInput = document.getElementById("itemSearch"),
  resultsDiv = document.getElementById("results"),
  priceBox = document.getElementById("priceDisplay"),
  historyDiv = document.getElementById("history"),
  pinnedDiv = document.getElementById("pinned"),
  card = document.querySelector(".card"),
  infoIcon = document.getElementById("infoIcon"),
  helpBox = document.getElementById("helpBox");

let helpVisible = false;

// ---------- Right‑click (desktop) + long‑press (mobile) pin / unpin ----------
let longPressTimer = null;

function attachPinListeners() {
  function startLongPress(e, name, action) {
    e.preventDefault();
    longPressTimer = setTimeout(() => {
      togglePin(name, action);
      longPressTimer = null;
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // --- Attach to history items ---
  historyDiv.addEventListener("contextmenu", (e) => {
    const btn = e.target.closest(".hist-btn");
    if (!btn) return;
    e.preventDefault();
    const name = btn.textContent.trim();
    togglePin(name, "pin");
  });

  historyDiv.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest(".hist-btn");
    if (!btn) return;
    const name = btn.textContent.trim();
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      startLongPress(e, name, "pin");
    }
  });

  historyDiv.addEventListener("pointerup", cancelLongPress);
  historyDiv.addEventListener("pointerleave", cancelLongPress);
  historyDiv.addEventListener("pointercancel", cancelLongPress);

  // --- Attach to pinned items (for unpinning) ---
  if (pinnedDiv) {
    pinnedDiv.addEventListener("contextmenu", (e) => {
      const btn = e.target.closest(".hist-btn");
      if (!btn) return;
      e.preventDefault();
      const name = btn.textContent.trim();
      togglePin(name, "unpin");
    });

    pinnedDiv.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".hist-btn");
      if (!btn) return;
      const name = btn.textContent.trim();
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        startLongPress(e, name, "unpin");
      }
    });

    pinnedDiv.addEventListener("pointerup", cancelLongPress);
    pinnedDiv.addEventListener("pointerleave", cancelLongPress);
    pinnedDiv.addEventListener("pointercancel", cancelLongPress);
  }
}

// ------------------------------------------------------------
// Search input click – clear and close dropdown
// ------------------------------------------------------------
searchInput.addEventListener("click", () => {
  searchInput.value = "";
  resultsDiv.style.display = "none";
  selectedIndex = -1;
});

// Close dropdown on outside click / close help box
document.addEventListener("click", (e) => {
  if (
    e.target !== searchInput &&
    e.target !== resultsDiv &&
    !resultsDiv.contains(e.target)
  ) {
    resultsDiv.style.display = "none";
    selectedIndex = -1;
  }
  if (helpBox && !helpBox.contains(e.target) && e.target !== infoIcon) {
    helpVisible = false;
    helpBox.classList.remove("visible");
    if (infoIcon) infoIcon.style.color = "#7a8294";
  }
});

// ------------------------------------------------------------
// Info icon toggle
// ------------------------------------------------------------
if (infoIcon) {
  infoIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    helpVisible = !helpVisible;
    helpBox.classList.toggle("visible", helpVisible);
    infoIcon.style.color = helpVisible ? "#ffae00" : "#7a8294";
  });
}

// ------------------------------------------------------------
// Fetch with retry helper
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Initialisation
// ------------------------------------------------------------
async function initTracker() {
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
        itemMap[item.name.toLowerCase()] = { id: item.id, name: item.name };
      }
    });
    console.log(`Loaded ${Object.keys(itemMap).length} tradeable items`);
  } catch (e) {
    console.error(
      "Failed to load essential price data – the app may not work correctly.",
      e,
    );
  }

  try {
    await loadCollectionLogData();
  } catch (e) {
    console.error(
      "Collection log loading failed – boss searches won't work.",
      e,
    );
    bossCollectionCache = {};
  }

  attachPinListeners();
  loadPinned();
  loadHistory();

  const hash = window.location.hash;
  if (hash) {
    const hashParams = parseHash(hash);
    if (hashParams.item) {
      getPrice(hashParams.item, true);
      return;
    }
    if (hashParams.boss) {
      getPrice(hashParams.boss, true);
      return;
    }
  }

  const savedItem = sessionStorage.getItem("lastSearchedItem");
  if (savedItem) getPrice(savedItem, true);
}

// ------------------------------------------------------------
// URL hash helpers
// ------------------------------------------------------------
function parseHash(hash) {
  const params = {};
  const parts = hash.substring(1).split("&");
  parts.forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      params[key] = decodeURIComponent(value.replace(/\+/g, " "));
    }
  });
  return params;
}

function updateUrlHash(type, name) {
  const encoded = encodeURIComponent(name).replace(/%20/g, "+");
  const hash = `#${type}=${encoded}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

// ------------------------------------------------------------
// Smooth card height animation
// ------------------------------------------------------------
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
    card.offsetHeight; // force reflow
    card.style.height = endHeight + "px";

    setTimeout(() => {
      card.style.height = "auto";
      card.style.transition = "";
      card.style.overflow = "";
    }, 400);
  });
}

// ------------------------------------------------------------
// Fetch the Collection Log page and extract every boss section
// ------------------------------------------------------------
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
  let bossesWithItems = 0;

  headings.forEach((heading) => {
    try {
      const headingText = cleanText(heading.textContent);
      if (!headingText) return;

      const table = findNextTable(heading, tables);
      if (!table) return;

      const items = extractTradeableItems(table);
      if (items.length > 0) {
        bossMap[headingText] = [...new Set(items)];
        bossesWithItems++;
        console.log(`✅ ${headingText}: [${bossMap[headingText].join(", ")}]`);
      }
    } catch (e) {
      console.warn("Skipping malformed boss section", e);
    }
  });

  console.log(`Bosses with tradeable uniques: ${bossesWithItems}`);
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

// ------------------------------------------------------------
// History & UI helpers
// ------------------------------------------------------------
function saveHistory(name) {
  let finalName = name;
  if (!itemMap[name.toLowerCase()]) {
    const bossKey = findBossKey(name);
    if (bossKey) {
      finalName = bossKey;
    } else {
      return;
    }
  } else {
    finalName = itemMap[name.toLowerCase()].name;
  }

  // *** NEW: Don't save pinned items to history ***
  const pinned = JSON.parse(localStorage.getItem("osrsPinned") || "[]");
  if (pinned.includes(finalName)) {
    return; // item is already pinned, skip history
  }

  const oldButtons = Array.from(historyDiv.children);
  const oldPositions = oldButtons.map((btn) => {
    const rect = btn.getBoundingClientRect();
    return { name: btn.textContent.trim(), left: rect.left, top: rect.top };
  });

  let hist = JSON.parse(localStorage.getItem("osrsHistory") || "[]");
  hist = [finalName, ...hist.filter((i) => i !== finalName)].slice(0, 5);
  localStorage.setItem("osrsHistory", JSON.stringify(hist));

  loadHistory();

  const newButtons = Array.from(historyDiv.children);
  newButtons.forEach((btn) => {
    const btnName = btn.textContent.trim();
    const oldPos = oldPositions.find((p) => p.name === btnName);

    if (oldPos) {
      const newRect = btn.getBoundingClientRect();
      const deltaX = oldPos.left - newRect.left;
      const deltaY = oldPos.top - newRect.top;

      if (deltaX !== 0 || deltaY !== 0) {
        btn.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        btn.style.transition = "none";
        requestAnimationFrame(() => {
          btn.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
          btn.style.transform = "none";
        });
      }
    } else {
      btn.style.opacity = "0";
      btn.style.transform = "scale(0.85)";
      requestAnimationFrame(() => {
        btn.style.transition = "all 0.4s ease";
        btn.style.opacity = "1";
        btn.style.transform = "none";
      });
    }
  });
}

// ------------- Animated pinning (FLIP movement) -------------
function loadPinned() {
  const pinned = JSON.parse(localStorage.getItem("osrsPinned") || "[]");
  if (!pinnedDiv) return;
  pinnedDiv.style.display = pinned.length ? "flex" : "none";
  pinnedDiv.innerHTML = pinned
    .map(
      (n) => `
        <span class="hist-btn pinned-item" style="color:#ffae00; cursor:pointer; transition: all 0.3s ease;"
              onclick="getPrice('${n.replace(/'/g, "\\'")}')"
              onselectstart="return false;">
          ${n}
        </span>`,
    )
    .join("");
}

function loadHistory() {
  const hist = JSON.parse(localStorage.getItem("osrsHistory") || "[]");
  const pinned = JSON.parse(localStorage.getItem("osrsPinned") || "[]");
  // *** NEW: filter out any pinned items that might still be in history ***
  const filtered = hist.filter((n) => !pinned.includes(n));
  historyDiv.innerHTML = filtered
    .map(
      (n) => `
        <span class="hist-btn" style="cursor:pointer; transition: all 0.3s ease;"
              onclick="getPrice('${n.replace(/'/g, "\\'")}')"
              onselectstart="return false;">
          ${n}
        </span>`,
    )
    .join("");
}

window.togglePin = function (name, action) {
  let pinned = JSON.parse(localStorage.getItem("osrsPinned") || "[]");
  let history = JSON.parse(localStorage.getItem("osrsHistory") || "[]");

  if (action === "pin") {
    history = history.filter((n) => n !== name);
    if (!pinned.includes(name)) pinned = [name, ...pinned].slice(0, 10);
  } else {
    pinned = pinned.filter((n) => n !== name);
    if (!history.includes(name)) history = [name, ...history].slice(0, 5);
  }
  localStorage.setItem("osrsPinned", JSON.stringify(pinned));
  localStorage.setItem("osrsHistory", JSON.stringify(history));

  const oldButtons = [
    ...pinnedDiv.querySelectorAll(".hist-btn"),
    ...historyDiv.querySelectorAll(".hist-btn"),
  ];
  const oldPositions = oldButtons.map((btn) => {
    const rect = btn.getBoundingClientRect();
    return { name: btn.textContent.trim(), left: rect.left, top: rect.top };
  });

  loadPinned();
  loadHistory();

  requestAnimationFrame(() => {
    const newButtons = [
      ...pinnedDiv.querySelectorAll(".hist-btn"),
      ...historyDiv.querySelectorAll(".hist-btn"),
    ];
    newButtons.forEach((newBtn) => {
      const btnName = newBtn.textContent.trim();
      const oldPos = oldPositions.find((p) => p.name === btnName);
      if (!oldPos) {
        newBtn.style.opacity = "0";
        newBtn.style.transform = "scale(0.9)";
        requestAnimationFrame(() => {
          newBtn.style.transition = "opacity 0.3s ease, transform 0.3s ease";
          newBtn.style.opacity = "1";
          newBtn.style.transform = "none";
        });
        return;
      }
      const newRect = newBtn.getBoundingClientRect();
      const deltaX = oldPos.left - newRect.left;
      const deltaY = oldPos.top - newRect.top;
      if (deltaX === 0 && deltaY === 0) return;

      newBtn.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      newBtn.style.transition = "none";
      requestAnimationFrame(() => {
        newBtn.style.transition =
          "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
        newBtn.style.transform = "none";
      });
    });
  });
};

// ------------------------------------------------------------
// Formatting helpers
// ------------------------------------------------------------
function formatGP(num) {
  if (!num && num !== 0) return "N/A";
  return num.toLocaleString();
}

function formatShortGP(num) {
  if (num == null) return "N/A";
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toLocaleString();
}

function formatTimeAgo(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "Just now";
  if (totalMinutes < 60) return `${totalMinutes} mins ago`;
  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours} hours ago`;
  return `${Math.round(totalHours / 24)} days ago`;
}

function levenshtein(a, b) {
  const tmp = [];
  let i,
    j,
    alen = a.length,
    blen = b.length;
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
  const cleanTarget = target.replace(/er$/, "").replace(/s$/, "");
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].includes(cleanTarget)) return itemMap[keys[i]];
  }
  let minDistItem = Infinity,
    closestItem = null;
  for (let key of keys) {
    const dist = levenshtein(target, key);
    if (dist < minDistItem) {
      minDistItem = dist;
      closestItem = itemMap[key];
    }
  }
  if (closestItem && minDistItem <= 2) return closestItem;
  return null;
}

function findClosestItem(text) {
  const lower = text.toLowerCase();
  for (const key of Object.keys(itemMap)) {
    if (key.startsWith(lower)) return itemMap[key];
  }
  return null;
}

// ------------------------------------------------------------
// Resolve exact wiki page name (handles disambiguations)
// ------------------------------------------------------------
function resolveWikiName(itemName) {
  const lower = itemName.toLowerCase();
  if (itemMap[lower]) return itemMap[lower].name;
  const withItem = lower + " (item)";
  if (itemMap[withItem]) return itemMap[withItem].name;
  for (const key of Object.keys(itemMap)) {
    if (key.startsWith(lower + " (")) {
      return itemMap[key].name;
    }
  }
  return itemName;
}

// ------------------------------------------------------------
// Build an <img> tag with automatic fallback to NAME_(item).png
// ------------------------------------------------------------
function fallbackItemIcon(primaryName, fallbackName, size = 20) {
  const coinIcon = "https://oldschool.runescape.wiki/images/Coins_10000.png";

  function safeFilename(str) {
    return str.replace(/ /g, "_").replace(/'/g, "%27");
  }

  const primarySrc = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${safeFilename(primaryName)}.png`;
  const fallbackSrc = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${safeFilename(fallbackName)}.png`;

  return `<img src="${primarySrc}"
       style="width:${size}px; height:${size}px; object-fit:contain; flex-shrink:0;"
       onerror="this.onerror=null; this.src='${fallbackSrc}'; this.onerror=()=>this.src='${coinIcon}';">`;
}

// ------------------------------------------------------------
// Fetch prices individually for each item (fully parallel)
// ------------------------------------------------------------
async function fetchPricesForItemNames(itemNames) {
  const ids = itemNames
    .map((n) => itemMap[n.toLowerCase()]?.id)
    .filter((id) => id != null);
  if (ids.length === 0) return {};

  console.log(`Fetching prices individually for ${ids.length} items...`);

  const promises = ids.map((id) =>
    fetch(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${id}`, {
      headers,
    })
      .then((res) => res.json())
      .then((data) => ({ id, data: data.data?.[id] || null }))
      .catch((err) => {
        console.error(`Failed to fetch price for id ${id}`, err);
        return { id, data: null };
      }),
  );

  const results = await Promise.all(promises);
  const priceMap = {};
  results.forEach(({ id, data }) => {
    if (data) priceMap[id] = data;
  });

  console.log(`Received prices for ${Object.keys(priceMap).length} items`);
  return priceMap;
}

// ------------------------------------------------------------
// Common icon button style
// ------------------------------------------------------------
const iconButtonStyle = `
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    color: #a8c7fa;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    transition: color 0.2s ease;
`;

function shareButtonHTML(url) {
  return `<button onclick="copyShareLink('${url.replace(/'/g, "\\'")}')"
                class="icon-btn"
                data-tooltip="Copy share link"
                style="${iconButtonStyle}"
                onmouseover="this.style.color='#ffae00'"
                onmouseout="this.style.color='#a8c7fa'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </button>`;
}

function wikiButtonHTML(pageName) {
  return `<a href="https://oldschool.runescape.wiki/w/${encodeURIComponent(pageName)}" target="_blank"
                class="icon-btn"
                data-tooltip="Open Wiki page"
                style="${iconButtonStyle} text-decoration: none;"
                onmouseover="this.style.color='#ffae00'"
                onmouseout="this.style.color='#a8c7fa'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
            </a>`;
}

window.copyShareLink = function (url) {
  navigator.clipboard.writeText(url).catch(console.error);
};

// ------------------------------------------------------------
// Tooltip logic
// ------------------------------------------------------------
let tooltipEl = null;
function getTooltip() {
  if (!tooltipEl) tooltipEl = document.getElementById("tooltip");
  return tooltipEl;
}

function showTooltip(event, text) {
  const tooltip = getTooltip();
  if (!tooltip) return;
  tooltip.textContent = text;
  tooltip.classList.add("visible");

  const target = event.currentTarget;
  const targetRect = target.getBoundingClientRect();
  const trackerRect = document
    .querySelector(".ge-tracker")
    .getBoundingClientRect();
  const tooltipX = targetRect.left - trackerRect.left + targetRect.width / 2;
  const tooltipY = targetRect.top - trackerRect.top - 32;

  tooltip.style.left = tooltipX + "px";
  tooltip.style.top = tooltipY + "px";
}

function hideTooltip() {
  const tooltip = getTooltip();
  if (tooltip) tooltip.classList.remove("visible");
}

function attachTooltips(container) {
  container.querySelectorAll(".icon-btn").forEach((btn) => {
    const text = btn.getAttribute("data-tooltip");
    if (!text) return;
    btn.addEventListener("mouseenter", (e) => showTooltip(e, text));
    btn.addEventListener("mouseleave", hideTooltip);
  });
}

// ------------------------------------------------------------
// Dropdown HTML
// ------------------------------------------------------------
function generateDropdownHTML(entries, query) {
  return entries
    .map((entry, index) => {
      const safeName = entry.name.replace(/'/g, "\\'");
      const regex = new RegExp(`(${query})`, "gi");
      const highlightedName = entry.name.replace(
        regex,
        `<strong style="color: #00ff00;">$1</strong>`,
      );

      if (entry.isBoss) {
        return `
          <div class="suggested-item" id="suggest-${index}" onclick="getPrice('${safeName}')" style="border-left: 3px solid #ffae00;">
              <img src="https://oldschool.runescape.wiki/images/Collection_log_icon.png" class="suggest-icon" style="width:16px; height:16px;">
              <span>${highlightedName} <span style="color: #ffae00; font-size: 11px; margin-left: 5px;">(Collection Log)</span></span>
          </div>`;
      }

      if (entry.isBossDrop) {
        const wikiName = resolveWikiName(entry.name);
        const fallbackName = entry.name + " (item)";
        return `
          <div class="suggested-item" id="suggest-${index}" onclick="getPrice('${safeName}')" style="border-left: 3px solid #ffae00;">
              ${fallbackItemIcon(wikiName, fallbackName)}
              <span>${highlightedName} <span style="color: #ffae00; font-size: 11px; margin-left: 5px;">(${entry.boss} drop)</span></span>
          </div>`;
      }

      const wikiName = resolveWikiName(entry.name);
      const fallbackName = entry.name + " (item)";
      return `
        <div class="suggested-item" id="suggest-${index}" onclick="getPrice('${safeName}')">
            ${fallbackItemIcon(wikiName, fallbackName)}
            <span>${highlightedName}</span>
        </div>`;
    })
    .join("");
}

// ------------------------------------------------------------
// Search input handler (debounced suggestions)
// ------------------------------------------------------------
searchInput.addEventListener("input", () => {
  if (suppressDropdown) {
    suppressDropdown = false;
    return;
  }
  clearTimeout(debounceTimer);
  const val = searchInput.value.trim();
  const valLower = val.toLowerCase();
  selectedIndex = -1;
  if (val.length < 3) {
    resultsDiv.style.display = "none";
    return;
  }

  debounceTimer = setTimeout(() => {
    const results = buildSearchResults(valLower);
    if (results.length > 0) {
      resultsDiv.innerHTML = generateDropdownHTML(results.slice(0, 15), val);
      resultsDiv.style.display = "block";
      return;
    }

    const closest = getClosestMatch(valLower);
    if (closest) {
      const safeName = closest.name.replace(/'/g, "\\'");
      resultsDiv.innerHTML = `<div class="suggested-item" onclick="getPrice('${safeName}')" style="justify-content: center; cursor: pointer;"><span>Did you mean: <strong style="color: #00ff00;">${closest.name}</strong>?</span></div>`;
    } else {
      resultsDiv.innerHTML = `<div class="suggested-item" style="color: #666; cursor: default; justify-content: center;"><span>No results located</span></div>`;
    }
    resultsDiv.style.display = "block";
  }, 250);
});

function buildSearchResults(valLower) {
  let results = [];
  const allBossNames = Object.keys(bossCollectionCache);
  const matchedBosses = allBossNames.filter((boss) =>
    boss.toLowerCase().includes(valLower),
  );

  if (matchedBosses.length === 1) {
    const boss = matchedBosses[0];
    const items = bossCollectionCache[boss] || [];
    if (items.length > 0) {
      results = items.map((item) => ({
        name: itemMap[item.toLowerCase()]?.name || item,
        isBossDrop: true,
        boss: boss,
      }));
    } else {
      results.push({ name: boss, isBoss: true });
    }
  } else if (matchedBosses.length > 1) {
    results = matchedBosses.map((boss) => ({ name: boss, isBoss: true }));
  }

  Object.keys(itemMap).forEach((name) => {
    if (name.includes(valLower)) {
      results.push({ name: itemMap[name].name, isBoss: false });
    }
  });

  return results;
}

// ------------------------------------------------------------
// Keyboard navigation + Enter to search
// ------------------------------------------------------------
searchInput.addEventListener("keydown", (e) => {
  const items = resultsDiv.getElementsByClassName("suggested-item");
  if (!items.length || items[0].innerText === "No results located") return;

  if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
    e.preventDefault();
    selectedIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
    updateVisualSelection(items);
  } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
    e.preventDefault();
    selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
    updateVisualSelection(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(debounceTimer);
    resultsDiv.style.display = "none";
    suppressDropdown = true;

    if (selectedIndex > -1 && items[selectedIndex]) {
      items[selectedIndex].click();
    } else {
      const val = searchInput.value.trim().toLowerCase();
      const bossKey = findBossKey(val);
      if (bossKey) {
        getPrice(bossKey);
        return;
      }
      if (itemMap[val]) {
        getPrice(itemMap[val].name);
        return;
      }
      const closest = getClosestMatch(val);
      if (closest) {
        getPrice(closest.name);
        return;
      }
      const prefixMatch = findClosestItem(val);
      if (prefixMatch) {
        getPrice(prefixMatch.name);
        return;
      }
      getPrice(val);
    }
  }
});

function updateVisualSelection(elements) {
  for (let i = 0; i < elements.length; i++) {
    elements[i].style.background = i === selectedIndex ? "#2a2e3a" : "";
    if (i === selectedIndex) elements[i].scrollIntoView({ block: "nearest" });
  }
}

// ------------------------------------------------------------
// Skeleton loader
// ------------------------------------------------------------
function skeletonLoader() {
  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px; max-width: 70%;">
            <div class="skeleton" style="height: 16px; width: 95%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 13px; width: 65%; border-radius: 4px;"></div>
            <div class="skeleton" style="height: 13px; width: 55%; border-radius: 4px;"></div>
        </div>
        <div class="skeleton" style="width: 48px; height: 48px; border-radius: 6px; flex-shrink: 0; margin-left: 15px;"></div>
    </div>`;
}

// ------------------------------------------------------------
// Icon resolver for the single item card (with thumbnail fallback)
// ------------------------------------------------------------
async function resolveItemIcon(itemData) {
  const fetchThumbnail = async (pageName) => {
    try {
      const res = await fetch(
        `https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(pageName)}&pithumbsize=200&redirects=1&origin=*`,
      );
      const data = await res.json();
      const page = Object.values(data.query?.pages || {})[0];
      return page?.thumbnail?.source || null;
    } catch (e) {
      return null;
    }
  };

  try {
    let thumb = await fetchThumbnail(itemData.name);
    if (!thumb) thumb = await fetchThumbnail(itemData.name + " (item)");

    if (thumb) {
      return `<img src="${thumb}" style="width:48px; height:48px; object-fit:contain; flex-shrink:0;">`;
    }
  } catch (e) {
    /* fall through to fallback */
  }

  const wikiName = resolveWikiName(itemData.name);
  const fallbackName = itemData.name + " (item)";
  return fallbackItemIcon(wikiName, fallbackName, 48);
}

// ------------------------------------------------------------
// Build a single item price card
// ------------------------------------------------------------
function buildItemCard(
  name,
  buy,
  sell,
  iconHtml,
  relativeTime,
  shareUrl,
  wikiName,
) {
  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex-grow: 1; padding-right: 12px; max-width: 75%;">
            <strong style="display: block; margin: 0 0 8px 0; font-size: 16px; line-height: 1.2;">${name.toUpperCase()}</strong>
            Buy: <span style="color:#00ff00">${formatGP(buy)}</span> gp<br>
            Sell: <span style="color:#ff0000">${formatGP(sell)}</span> gp
        </div>
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          ${iconHtml}
        </div>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px;">
        <span style="font-size: 11px; color: #7a8294;">Updated: ${relativeTime}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
            ${shareButtonHTML(shareUrl)}
            ${wikiButtonHTML(wikiName)}
        </div>
    </div>`;
}

// ------------------------------------------------------------
// Build the boss unique list card
// ------------------------------------------------------------
function buildBossCard(bossKey, uniquesHtml, shareUrl) {
  return `
    <div style="text-align:left; width:100%;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom:8px;">
            <strong style="font-size:14px; color:#ffae00; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:4px; flex:1;">${bossKey.toUpperCase()} UNIQUES</strong>
            <span style="position:relative; top:-2px; right:-4px;">${shareButtonHTML(shareUrl)}</span>
        </div>
        <div class="scrollable-list" style="max-height:250px; overflow-y:auto; padding-right:10px;">
            ${uniquesHtml}
        </div>
    </div>`;
}

// ------------------------------------------------------------
// Price display (single item or boss list with live prices)
// ------------------------------------------------------------
async function getPrice(name, skipHistory = false) {
  resultsDiv.style.display = "none";
  searchInput.value = name;
  selectedIndex = -1;
  if (!skipHistory) saveHistory(name);
  sessionStorage.setItem("lastSearchedItem", name);

  priceBox.classList.remove("fade-in");
  priceBox.style.display = "block";
  priceBox.innerHTML = skeletonLoader();

  let itemData = itemMap[name.toLowerCase()];

  if (!itemData) {
    const val = name.toLowerCase();
    const closest = getClosestMatch(val);
    if (closest) {
      itemData = closest;
      searchInput.value = closest.name;
      name = closest.name;
    } else {
      const prefixMatch = findClosestItem(val);
      if (prefixMatch) {
        itemData = prefixMatch;
        searchInput.value = prefixMatch.name;
        name = prefixMatch.name;
      }
    }
  }

  if (!itemData) {
    const bossKey = findBossKey(name);
    if (
      !bossKey ||
      !bossCollectionCache[bossKey] ||
      bossCollectionCache[bossKey].length === 0
    ) {
      priceBox.innerHTML = `<div style="padding:10px; text-align:center; color: #7a8294;">No tradeable uniques found for ${name}.</div>`;
      return;
    }

    const items = bossCollectionCache[bossKey];
    const priceData = await fetchPricesForItemNames(items);

    let uniquesHtml = "";
    items.forEach((itemTitle) => {
      const wikiName = resolveWikiName(itemTitle);
      const fallbackName = itemTitle + " (item)";
      const id = itemMap[itemTitle.toLowerCase()]?.id;
      const p = id && priceData[id] ? priceData[id] : {};
      const avg = p.high != null && p.low != null ? (p.high + p.low) / 2 : null;
      const priceStr = avg != null ? formatShortGP(avg) : "N/A";

      uniquesHtml += `
        <div class="suggested-item" style="display:flex; align-items:center; justify-content:space-between; padding: 7px 0; border-bottom:1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="getPrice('${itemTitle.replace(/'/g, "\\'")}')">
            <div style="display:flex; align-items:center; gap:8px; min-width: 0; flex-grow:1;">
                ${fallbackItemIcon(wikiName, fallbackName)}
                <span style="font-size:12px; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${itemTitle}</span>
            </div>
            <span style="font-size:11px; color:#00ff00; margin-left:8px; margin-right:4px; flex-shrink:0;">${priceStr}</span>
        </div>`;
    });

    const shareUrl = `https://embed.x0xp.workers.dev?boss=${encodeURIComponent(bossKey).replace(/%20/g, "+")}`;

    animateCardHeight(() => {
      priceBox.innerHTML = buildBossCard(bossKey, uniquesHtml, shareUrl);
      attachTooltips(priceBox);
    });
    if (!skipHistory) saveHistory(bossKey);
    updateUrlHash("boss", bossKey);
    return;
  }

  // Single item view
  try {
    const [priceRes] = await Promise.all([
      fetch(
        `https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemData.id}`,
        { headers },
      ),
    ]);

    const priceData = await priceRes.json();
    const p = priceData.data[itemData.id] || {};
    const relativeTime = formatTimeAgo(
      p.highTime ? Math.round((Date.now() / 1000 - p.highTime) / 60) : NaN,
    );
    const shareUrl = `https://embed.x0xp.workers.dev?item=${encodeURIComponent(name).replace(/%20/g, "+")}&ts=${Date.now()}`;

    const iconHtml = await resolveItemIcon(itemData);
    const cardHtml = buildItemCard(
      name,
      p.high,
      p.low,
      iconHtml,
      relativeTime,
      shareUrl,
      name,
    );

    animateCardHeight(() => {
      priceBox.innerHTML = cardHtml;
      attachTooltips(priceBox);
    });
    updateUrlHash("item", name);
  } catch (err) {
    priceBox.innerHTML = `<div style="padding:10px; text-align:center; color:#ff5555;">Failed fetching live values.</div>`;
  }
}

initTracker();
