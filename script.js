const headers = { "User-Agent": "x0XP-Item-Price-Checker - .x0xp on Discord" };
let itemMap = {};
let bossCollectionCache = {};
let selectedIndex = -1;
let debounceTimer;
let suppressDropdown = false;

const searchInput = document.getElementById("itemSearch"),
  resultsDiv = document.getElementById("results"),
  priceBox = document.getElementById("priceDisplay"),
  historyDiv = document.getElementById("history"),
  card = document.querySelector(".card"),
  infoIcon = document.getElementById("infoIcon"),
  helpBox = document.getElementById("helpBox");

let helpVisible = false;

searchInput.addEventListener("click", () => {
  searchInput.value = "";
  resultsDiv.style.display = "none";
  selectedIndex = -1;
});

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

async function initTracker() {
  try {
    const [priceRes, mapRes] = await Promise.all([
      fetch("https://prices.runescape.wiki/api/v1/osrs/latest", { headers }),
      fetch("https://prices.runescape.wiki/api/v1/osrs/mapping", { headers }),
    ]);
    const prices = await priceRes.json();
    const mappings = await mapRes.json();

    mappings.forEach((item) => {
      if (prices.data[item.id]) {
        itemMap[item.name.toLowerCase()] = { id: item.id, name: item.name };
      }
    });
    console.log(`Loaded ${Object.keys(itemMap).length} tradeable items`);

    await loadCollectionLogData();
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
  } catch (e) {
    console.error("Initialization failed", e);
  }
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
    card.offsetHeight;
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

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

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
    const headingText = cleanText(heading.textContent);
    if (!headingText) return;

    let targetTable = null;
    for (let table of tables) {
      const pos = heading.compareDocumentPosition(table);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        targetTable = table;
        break;
      }
    }
    if (!targetTable) return;

    const items = [];
    const rows = targetTable.querySelectorAll("tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length === 0) return;
      cells.forEach((cell) => {
        const links = cell.querySelectorAll("a");
        links.forEach((link) => {
          const itemName = link.textContent.trim();
          if (itemMap[itemName.toLowerCase()]) {
            items.push(itemName);
          }
        });
      });
    });

    if (items.length > 0) {
      bossMap[headingText] = [...new Set(items)];
      bossesWithItems++;
      console.log(`✅ ${headingText}: [${bossMap[headingText].join(", ")}]`);
    }
  });

  console.log(`Bosses with tradeable uniques: ${bossesWithItems}`);
  bossCollectionCache = bossMap;
}

async function fetchHTML(pageTitle) {
  try {
    const url = `https://oldschool.runescape.wiki/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (data.parse && data.parse.text) {
      return data.parse.text["*"];
    }
    return null;
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

function loadHistory() {
  const hist = JSON.parse(localStorage.getItem("osrsHistory") || "[]");
  historyDiv.innerHTML = hist
    .map(
      (n) => `
        <span class="hist-btn" onclick="getPrice('${n.replace(/'/g, "\\'")}')">${n}</span>
    `,
    )
    .join("");
}

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
// Inline buttons (icon only) + tooltip support
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
                style="${iconButtonStyle}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </button>`;
}

function wikiButtonHTML(pageName) {
  return `<a href="https://oldschool.runescape.wiki/w/${encodeURIComponent(pageName)}" target="_blank"
                class="icon-btn"
                data-tooltip="Open Wiki page"
                style="${iconButtonStyle} text-decoration: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
            </a>`;
}

// Global copy function
window.copyShareLink = function (url) {
  navigator.clipboard
    .writeText(url)
    .then(() => {
      // Briefly change icon (optional visual feedback)
    })
    .catch(console.error);
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

  // Center the tooltip horizontally above the target, relative to .ge-tracker
  const tooltipX = targetRect.left - trackerRect.left + targetRect.width / 2;
  const tooltipY = targetRect.top - trackerRect.top - 32; // 32px above the button

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
                </div>
            `;
      }

      if (entry.isBossDrop) {
        const filename =
          entry.name.charAt(0).toUpperCase() +
          entry.name.slice(1).replace(/ /g, "_").replace(/'/g, "%27");
        const imgUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;
        return `
                <div class="suggested-item" id="suggest-${index}" onclick="getPrice('${safeName}')" style="border-left: 3px solid #ffae00;">
                    <img src="${imgUrl}" class="suggest-icon" onerror="this.src='https://oldschool.runescape.wiki/images/Coins_10000.png'; this.onerror=null;">
                    <span>${highlightedName} <span style="color: #ffae00; font-size: 11px; margin-left: 5px;">(${entry.boss} drop)</span></span>
                </div>
            `;
      }

      const filename =
        entry.name.charAt(0).toUpperCase() +
        entry.name.slice(1).replace(/ /g, "_").replace(/'/g, "%27");
      const fastIconUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;
      return `
            <div class="suggested-item" id="suggest-${index}" onclick="getPrice('${safeName}')">
                <img src="${fastIconUrl}" class="suggest-icon" onerror="this.src='https://oldschool.runescape.wiki/images/Coins_10000.png'; this.onerror=null;">
                <span>${highlightedName}</span>
            </div>
        `;
    })
    .join("");
}

// ------------------------------------------------------------
// Search input handler
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
    let combinedResults = [];

    const allBossNames = Object.keys(bossCollectionCache);
    const matchedBosses = allBossNames.filter((boss) =>
      boss.toLowerCase().includes(valLower),
    );

    if (matchedBosses.length === 1) {
      const boss = matchedBosses[0];
      const items = bossCollectionCache[boss] || [];
      if (items.length > 0) {
        combinedResults = items.map((item) => ({
          name: item,
          isBossDrop: true,
          boss: boss,
        }));
      } else {
        combinedResults.push({ name: boss, isBoss: true });
      }
    } else if (matchedBosses.length > 1) {
      combinedResults = matchedBosses.map((boss) => ({
        name: boss,
        isBoss: true,
      }));
    }

    if (combinedResults.length === 0) {
      Object.keys(itemMap).forEach((name) => {
        if (name.includes(valLower)) {
          combinedResults.push({ name: itemMap[name].name, isBoss: false });
        }
      });
    }

    if (combinedResults.length > 0) {
      resultsDiv.innerHTML = generateDropdownHTML(
        combinedResults.slice(0, 15),
        val,
      );
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

  priceBox.innerHTML = `
        <div style="display: flex; justify-content: center; padding: 20px;">
            <div class="skeleton" style="height: 80px; width: 90%; border-radius: 8px;"></div>
        </div>
    `;

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
    // Boss view
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
      const filename =
        itemTitle.charAt(0).toUpperCase() +
        itemTitle.slice(1).replace(/ /g, "_").replace(/'/g, "%27");
      const imgUrl = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${filename}.png`;

      const id = itemMap[itemTitle.toLowerCase()]?.id;
      const p = id && priceData[id] ? priceData[id] : {};
      const avg = p.high != null && p.low != null ? (p.high + p.low) / 2 : null;
      const priceStr = avg != null ? formatShortGP(avg) : "N/A";

      uniquesHtml += `
                <div class="suggested-item" style="display:flex; align-items:center; justify-content:space-between; padding: 7px 0; border-bottom:1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="getPrice('${itemTitle.replace(/'/g, "\\'")}')">
                    <div style="display:flex; align-items:center; gap:8px; min-width: 0; flex-grow:1;">
                        <img src="${imgUrl}" style="width:20px; height:20px; object-fit:contain; flex-shrink:0;" onerror="this.src='https://oldschool.runescape.wiki/images/Coins_10000.png';">
                        <span style="font-size:12px; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${itemTitle}</span>
                    </div>
                    <span style="font-size:11px; color:#00ff00; margin-left:10px; flex-shrink:0;">${priceStr}</span>
                </div>
            `;
    });

    const shareUrl =
      window.location.origin +
      window.location.pathname +
      "#boss=" +
      encodeURIComponent(bossKey).replace(/%20/g, "+");

    animateCardHeight(() => {
      priceBox.innerHTML = `
                <div style="text-align:left; width:100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom:8px;">
                        <strong style="font-size:14px; color:#ffae00; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:4px; flex:1;">${bossKey.toUpperCase()} UNIQUES</strong>
                        ${shareButtonHTML(shareUrl)}
                    </div>
                    <div class="scrollable-list" style="max-height:250px; overflow-y:auto; padding-right:12px;">
                        ${uniquesHtml}
                    </div>
                </div>
            `;
      // Attach tooltips to the newly inserted share button
      attachTooltips(priceBox);
    });
    if (!skipHistory) saveHistory(bossKey);
    updateUrlHash("boss", bossKey);
    return;
  }

  // Normal item price display
  try {
    const [priceRes, wikiRes] = await Promise.all([
      fetch(
        `https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemData.id}`,
        { headers },
      ),
      fetch(
        `https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=100&redirects=1&origin=*`,
      ),
    ]);

    const priceData = await priceRes.json();
    const wikiData = await wikiRes.json();
    const p = priceData.data[itemData.id] || {};
    let iconUrl = "";
    if (wikiData.query?.pages) {
      const page = Object.values(wikiData.query.pages)[0];
      iconUrl = page.thumbnail?.source || "";
    }

    const relativeTime = formatTimeAgo(
      p.highTime ? Math.round((Date.now() / 1000 - p.highTime) / 60) : NaN,
    );
    const shareUrl =
      window.location.origin +
      window.location.pathname +
      "#item=" +
      encodeURIComponent(name).replace(/%20/g, "+");

    animateCardHeight(() => {
      priceBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex-grow: 1; padding-right: 12px; max-width: 75%;">
                        <strong style="display: block; margin: 0 0 8px 0; font-size: 16px; line-height: 1.2;">${name.toUpperCase()}</strong>
                        Buy: <span style="color:#00ff00">${formatGP(p.high)}</span> gp<br>
                        Sell: <span style="color:#ff0000">${formatGP(p.low)}</span> gp
                    </div>
                    ${iconUrl ? `<img src="${iconUrl}" style="max-width: 48px; max-height: 48px; object-fit: contain;">` : ""}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px;">
                    <span style="font-size: 11px; color: #7a8294;">Updated: ${relativeTime}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${shareButtonHTML(shareUrl)}
                        ${wikiButtonHTML(name)}
                    </div>
                </div>
            `;
      // Attach tooltips to both buttons
      attachTooltips(priceBox);
    });
    updateUrlHash("item", name);
  } catch (err) {
    priceBox.innerHTML = `<div style="padding:10px; text-align:center; color:#ff5555;">Failed fetching live values.</div>`;
  }
}

initTracker();
