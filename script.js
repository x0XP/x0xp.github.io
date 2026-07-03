const headers = { "User-Agent": "x0XP-Item-Price-Checker - .x0xp on Discord" };

// Easter eggs
const easterEggs = {
  dance: true,
};

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
  helpBox = document.getElementById("helpBox"),
  updatesIcon = document.getElementById("updatesIcon"),
  changelogBox = document.getElementById("changelogBox"),
  floatingContainer = document.getElementById("floatingContainer"),
  clearAllBtn = document.getElementById("clearAllFloating");

let helpVisible = false;
let changelogVisible = false;

// ---------- Floating card storage ----------
let floatingCards = []; // { id, type, name, x, y, height (optional) }
let floatingCardCounter = 0;

// Save to localStorage
function saveFloatingCards() {
  const data = floatingCards.map((f) => ({
    type: f.type,
    name: f.name,
    x: f.x,
    y: f.y,
    height: f.height,
  }));
  localStorage.setItem("floatingCards", JSON.stringify(data));
  if (clearAllBtn)
    clearAllBtn.style.display = floatingCards.length ? "inline-block" : "none";
}

// Helper: keep a floating card entirely within the viewport
function clampToViewport(div) {
  const rect = div.getBoundingClientRect();
  let left = parseInt(div.style.left) || rect.left;
  let top = parseInt(div.style.top) || rect.top;
  let height = parseInt(div.style.height) || rect.height;
  const width = rect.width;

  // horizontal
  if (rect.left < 0) {
    left = 0;
  } else if (rect.right > window.innerWidth) {
    left = window.innerWidth - width;
  }

  // vertical
  if (rect.top < 0) {
    top = 0;
  }
  const maxBottom = window.innerHeight - 10;
  if (rect.bottom > maxBottom) {
    const minHeight = 120;
    const newHeight = Math.max(minHeight, maxBottom - rect.top);
    if (newHeight !== rect.height) {
      height = newHeight;
    } else {
      top = maxBottom - height;
    }
  }

  div.style.left = left + "px";
  div.style.top = top + "px";
  div.style.height = height + "px";
}

// Create a floating card DOM element
function buildFloatingCardElement(
  type,
  name,
  x,
  y,
  cardId,
  shareUrl = null,
  initialHeight = null,
) {
  const isBoss = type === "boss";
  const div = document.createElement("div");
  div.className = "floating-card";
  div.style.left = x + "px";
  div.style.top = y + "px";
  div.dataset.id = cardId;

  // Boss cards start at a compact height (or restored height)
  if (isBoss) {
    div.style.height = (initialHeight || 200) + "px";
    // Card overflow is never set – content handles scrolling
  }

  const header = document.createElement("div");
  header.className = "floating-header";
  header.innerHTML = `
    <span class="floating-title">${name}</span>
    ${shareUrl ? shareButtonHTML(shareUrl) : ""}
    <span class="floating-close" data-id="${cardId}">×</span>
  `;

  const content = document.createElement("div");
  content.className = "floating-content";
  content.innerHTML =
    '<div class="skeleton" style="height: 60px; width: 100%; border-radius: 4px;"></div>';

  div.appendChild(header);
  div.appendChild(content);

  // Resize handle – only for boss cards
  if (isBoss) {
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";
    div.appendChild(resizeHandle);

    let startY, startHeight, maxHeight;
    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startY = e.clientY;
      startHeight = div.offsetHeight;

      // Calculate the height that shows all content without scrolling
      const headerHeight = header.offsetHeight;
      const handleHeight = resizeHandle.offsetHeight;
      const contentNatural = content.scrollHeight;
      maxHeight = contentNatural + headerHeight + handleHeight + 20; // padding/borders

      document.body.style.userSelect = "none";
      div.style.transition = "none";

      const onMouseMove = (e) => {
        const delta = e.clientY - startY;
        let newHeight = startHeight + delta;

        // viewport limit
        const cardTop = div.getBoundingClientRect().top;
        const viewMax = window.innerHeight - cardTop - 10;

        newHeight = Math.max(120, Math.min(newHeight, maxHeight, viewMax));
        div.style.height = newHeight + "px";
      };

      const onMouseUp = () => {
        document.body.style.userSelect = "";
        div.style.transition = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        const currentHeight = parseInt(div.style.height);
        // Toggle scrollbar on CONTENT, not on the card
        content.style.overflowY =
          currentHeight >= maxHeight ? "hidden" : "auto";

        clampToViewport(div); // keep card inside screen
        const fc = floatingCards.find((f) => f.id == cardId);
        if (fc) {
          fc.height = parseInt(div.style.height);
          fc.x = parseInt(div.style.left);
          fc.y = parseInt(div.style.top);
          saveFloatingCards();
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  floatingContainer.appendChild(div);

  // Close button
  header.querySelector(".floating-close").addEventListener("click", (e) => {
    e.stopPropagation();
    removeFloatingCard(cardId);
  });

  // Dragging (header)
  let isDragging = false,
    dragStartX,
    dragStartY,
    origX,
    origY;
  header.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("floating-close")) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    origX = div.offsetLeft;
    origY = div.offsetTop;
    div.style.transition = "none";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    div.style.left = origX + dx + "px";
    div.style.top = origY + dy + "px";
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    div.style.transition = "";
    clampToViewport(div); // keep card inside screen
    const fc = floatingCards.find((f) => f.id == cardId);
    if (fc) {
      fc.x = parseInt(div.style.left);
      fc.y = parseInt(div.style.top);
      saveFloatingCards();
    }
  });

  if (shareUrl) {
    attachTooltips(header);
  }

  return { div, content };
}

// Add a new floating card
function createFloatingCard(type, name, x, y, initialHeight = null) {
  const id = ++floatingCardCounter;
  const fc = { id, type, name, x, y, height: initialHeight };
  floatingCards.push(fc);
  saveFloatingCards();

  let shareUrl = null;
  if (type === "boss") {
    const bossKey = findBossKey(name) || name;
    shareUrl = `https://embed.x0xp.workers.dev?boss=${encodeURIComponent(bossKey).replace(/%20/g, "+")}`;
  }

  const { div, content } = buildFloatingCardElement(
    type,
    name,
    x,
    y,
    id,
    shareUrl,
    initialHeight,
  );

  if (type === "item") {
    const itemData = itemMap[name.toLowerCase()];
    if (itemData) {
      const itemShareUrl = `https://embed.x0xp.workers.dev?item=${encodeURIComponent(name).replace(/%20/g, "+")}&ts=${Date.now()}`;
      fetch(
        `https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemData.id}`,
        { headers },
      )
        .then((res) => res.json())
        .then((data) => {
          const p = data.data[itemData.id] || {};
          const iconHtml = fallbackItemIcon(
            resolveWikiName(name),
            name + " (item)",
            32,
          );
          content.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div style="font-size:11px; line-height:1.4; color:#ccc;">
                Buy: <span style="color:#00ff00">${formatGP(p.high)}</span> gp<br>
                Sell: <span style="color:#ff0000">${formatGP(p.low)}</span> gp
              </div>
              ${iconHtml}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:8px;">
              <span style="font-size:9px; color:#7a8294;">Updated: ${formatTimeAgo(p.highTime ? Math.round((Date.now() / 1000 - p.highTime) / 60) : NaN)}</span>
              <div style="display:flex; gap:6px;">
                ${shareButtonHTML(itemShareUrl)}
                ${wikiButtonHTML(name)}
              </div>
            </div>
          `;
          attachTooltips(div);
        })
        .catch(() => {
          content.innerHTML = "Failed to load price.";
        });
    }
  } else if (type === "boss") {
    const bossKey = findBossKey(name) || name;
    const items = bossCollectionCache[bossKey] || [];
    if (items.length > 0) {
      fetchPricesForItemNames(items)
        .then((priceData) => {
          let html = `<div>`;
          items.forEach((itemTitle) => {
            const id = itemMap[itemTitle.toLowerCase()]?.id;
            const p = id && priceData[id] ? priceData[id] : {};
            const avg =
              p.high != null && p.low != null ? (p.high + p.low) / 2 : null;
            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>${fallbackItemIcon(resolveWikiName(itemTitle), itemTitle + " (item)", 16)} ${itemTitle}</span>
            <span style="color:#00ff00;">${avg != null ? formatShortGP(avg) : "N/A"}</span>
          </div>`;
          });
          html += "</div>";
          content.innerHTML = html;
          attachTooltips(div);

          // After content loads, adjust overflow if the saved height already shows everything
          if (initialHeight) {
            requestAnimationFrame(() => {
              const currentHeight = parseInt(div.style.height);
              const headerHeight =
                div.querySelector(".floating-header").offsetHeight;
              const handleHeight =
                div.querySelector(".resize-handle")?.offsetHeight || 6;
              const contentNatural = content.scrollHeight;
              const totalNatural =
                contentNatural + headerHeight + handleHeight + 20;
              content.style.overflowY =
                currentHeight >= totalNatural ? "hidden" : "auto";
            });
          }

          // Clamp after content renders (prevents off‑screen restored cards)
          requestAnimationFrame(() => {
            clampToViewport(div);
            const fc = floatingCards.find((f) => f.id == id);
            if (fc) {
              fc.x = parseInt(div.style.left);
              fc.y = parseInt(div.style.top);
              fc.height = parseInt(div.style.height);
              saveFloatingCards();
            }
          });
        })
        .catch(() => {
          content.innerHTML = "Failed to load boss data.";
        });
    } else {
      content.innerHTML = `<div style="text-align:center; color:#7a8294; padding:10px;">No tradeable uniques found.</div>`;
    }
  }
}

// Remove a floating card
function removeFloatingCard(id) {
  const div = floatingContainer.querySelector(`[data-id="${id}"]`);
  if (div) {
    div.style.opacity = "0";
    div.style.transform = "scale(0.9)";
    setTimeout(() => div.remove(), 200);
  }
  floatingCards = floatingCards.filter((f) => f.id != id);
  saveFloatingCards();
}

// Clear all floating cards
function clearAllFloating() {
  floatingContainer.querySelectorAll(".floating-card").forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "scale(0.9)";
    setTimeout(() => card.remove(), 200);
  });
  floatingCards = [];
  saveFloatingCards();
}

// Restore floating cards from localStorage
function restoreFloatingCards() {
  try {
    const data = JSON.parse(localStorage.getItem("floatingCards") || "[]");
    data.forEach((fc) => {
      createFloatingCard(fc.type, fc.name, fc.x, fc.y, fc.height);
    });
  } catch (e) {
    console.error("Failed to restore floating cards", e);
  }
}

// ---------- Drag-to-duplicate from main price box ----------
let dragState = null;
let dragPreview = null;

function startDrag(e) {
  if (
    !e.target.classList.contains("drag-grip") &&
    !e.target.closest(".drag-grip")
  )
    return;

  const type = priceBox.dataset.type;
  const name = priceBox.dataset.name;
  if (!type || !name) return;

  e.preventDefault();
  document.body.style.userSelect = "none";

  const rect = priceBox.getBoundingClientRect();
  dragPreview = document.createElement("div");
  dragPreview.className = "drag-preview";
  dragPreview.style.display = "block";
  dragPreview.style.width = rect.width + "px";
  dragPreview.style.height = rect.height + "px";
  dragPreview.style.left = e.clientX - rect.width / 2 + "px";
  dragPreview.style.top = e.clientY - rect.height / 2 + "px";
  document.body.appendChild(dragPreview);

  dragState = {
    type,
    name,
    previewEl: dragPreview,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: rect.width / 2,
    offsetY: rect.height / 2,
    width: rect.width,
    height: rect.height,
  };

  priceBox.style.cursor = "grabbing";
}

function moveDrag(e) {
  if (!dragState) return;
  dragPreview.style.left = e.clientX - dragState.offsetX + "px";
  dragPreview.style.top = e.clientY - dragState.offsetY + "px";
}

function endDrag(e) {
  if (!dragState) return;

  document.body.style.userSelect = "";
  if (dragPreview) {
    dragPreview.remove();
    dragPreview = null;
  }
  priceBox.style.cursor = "";

  const cardRect = card.getBoundingClientRect();
  if (
    e.clientX < cardRect.left ||
    e.clientX > cardRect.right ||
    e.clientY < cardRect.top ||
    e.clientY > cardRect.bottom
  ) {
    createFloatingCard(
      dragState.type,
      dragState.name,
      e.clientX - dragState.offsetX,
      e.clientY - dragState.offsetY,
    );
  }

  dragState = null;
}

priceBox.addEventListener("mousedown", startDrag);
document.addEventListener("mousemove", moveDrag);
document.addEventListener("mouseup", endDrag);

// ---------- Attach clear all button ----------
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", clearAllFloating);
}

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

// Close dropdown / close help / close changelog
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
  if (
    changelogBox &&
    !changelogBox.contains(e.target) &&
    e.target !== updatesIcon
  ) {
    changelogVisible = false;
    changelogBox.classList.remove("visible");
    if (updatesIcon) updatesIcon.style.color = "#7a8294";
  }
});

// ------------------------------------------------------------
// Info icon toggle (with mutual exclusion)
// ------------------------------------------------------------
if (infoIcon) {
  infoIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    helpVisible = !helpVisible;
    helpBox.classList.toggle("visible", helpVisible);
    infoIcon.style.color = helpVisible ? "#ffae00" : "#7a8294";

    if (helpVisible) {
      const iconRect = infoIcon.getBoundingClientRect();
      helpBox.style.position = "fixed";
      helpBox.style.left = iconRect.right + 15 + "px";
      helpBox.style.top = iconRect.top + "px";
      helpBox.style.right = "auto";
      helpBox.style.bottom = "auto";
    }

    if (changelogVisible) {
      changelogVisible = false;
      changelogBox.classList.remove("visible");
      if (updatesIcon) updatesIcon.style.color = "#7a8294";
    }
  });
}

// ------------------------------------------------------------
// Updates icon toggle (changelog) with mutual exclusion
// ------------------------------------------------------------
if (updatesIcon) {
  updatesIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    changelogVisible = !changelogVisible;
    changelogBox.classList.toggle("visible", changelogVisible);
    updatesIcon.style.color = changelogVisible ? "#ffae00" : "#7a8294";

    if (changelogVisible) {
      const iconRect = updatesIcon.getBoundingClientRect();
      changelogBox.style.position = "fixed";
      changelogBox.style.left = iconRect.right + 15 + "px";
      changelogBox.style.top = iconRect.top + "px";
      changelogBox.style.right = "auto";
      changelogBox.style.bottom = "auto";
    }

    if (helpVisible) {
      helpVisible = false;
      helpBox.classList.remove("visible");
      infoIcon.style.color = "#7a8294";
    }
  });
}

// ------------------------------------------------------------
// Fetch changelog from GitHub commits
// ------------------------------------------------------------
async function loadChangelog() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/x0XP/x0xp.github.io/commits?per_page=10",
    );
    const commits = await res.json();

    const content = document.getElementById("changelogContent");
    if (!content) return;

    if (!Array.isArray(commits) || commits.length === 0) {
      content.innerHTML = "No updates yet.";
      return;
    }

    let html = "";
    commits.forEach((commit) => {
      const msg = commit.commit.message.split("\n")[0];
      const date = new Date(commit.commit.author.date).toLocaleDateString();
      html += `<div>${date} – ${msg}</div>`;
    });

    content.innerHTML = html;
  } catch (e) {
    console.error("Failed to load changelog", e);
    const content = document.getElementById("changelogContent");
    if (content) content.innerHTML = "Failed to load updates.";
  }
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
  loadChangelog();
  restoreFloatingCards();

  if (card) {
    card.addEventListener(
      "animationend",
      () => {
        card.classList.remove("fade-in");
      },
      { once: true },
    );
  }

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

  const pinned = JSON.parse(localStorage.getItem("osrsPinned") || "[]");
  if (pinned.includes(finalName)) {
    return;
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
      (n, i) => `
        <span class="hist-btn pinned-item" style="opacity:0; transform:translateY(6px); transition: all 0.3s ease ${i * 0.04}s; color:#ffae00;"
              onclick="getPrice('${n.replace(/'/g, "\\'")}')"
              onselectstart="return false;">
          ${n}
        </span>`,
    )
    .join("");
  requestAnimationFrame(() => {
    pinnedDiv.querySelectorAll(".hist-btn").forEach((btn) => {
      btn.style.opacity = "1";
      btn.style.transform = "none";
    });
  });
}

function loadHistory() {
  const hist = JSON.parse(localStorage.getItem("osrsHistory") || "[]");
  const pinned = JSON.parse(localStorage.getItem("osrsPinned") || "[]");
  const filtered = hist.filter((n) => !pinned.includes(n));
  historyDiv.innerHTML = filtered
    .map(
      (n, i) => `
        <span class="hist-btn" style="opacity:0; transform:translateY(6px); transition: all 0.3s ease ${i * 0.04}s;"
              onclick="getPrice('${n.replace(/'/g, "\\'")}')"
              onselectstart="return false;">
          ${n}
        </span>`,
    )
    .join("");
  requestAnimationFrame(() => {
    historyDiv.querySelectorAll(".hist-btn").forEach((btn) => {
      btn.style.opacity = "1";
      btn.style.transform = "none";
    });
  });
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

  let left = targetRect.left + targetRect.width / 2;
  let top = targetRect.top - 24;

  const tooltipWidth = tooltip.offsetWidth;
  if (left - tooltipWidth / 2 < 8) left = tooltipWidth / 2 + 8;
  if (left + tooltipWidth / 2 > window.innerWidth - 8)
    left = window.innerWidth - tooltipWidth / 2 - 8;

  if (top < 8) {
    top = targetRect.bottom + 8;
  }

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
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
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(debounceTimer);
    resultsDiv.style.display = "none";
    suppressDropdown = true;

    const val = searchInput.value.trim().toLowerCase();

    // Easter egg check – runs before any other resolution
    if (easterEggs[val]) {
      card.classList.add("dance-animation");
      setTimeout(() => {
        card.classList.remove("dance-animation");
      }, 500);
      return;
    }

    // Normal dropdown navigation / resolution
    const items = resultsDiv.getElementsByClassName("suggested-item");
    if (items.length && items[0].innerText !== "No results located") {
      if (selectedIndex > -1 && items[selectedIndex]) {
        items[selectedIndex].click();
        return;
      }
    }

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
    return;
  }

  // Arrow key navigation (only if dropdown is visible)
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
// Build a single item price card (matches floating card style)
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
    <div class="drag-grip"></div>
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      ${fallbackItemIcon(resolveWikiName(name), name + " (item)", 32)}
      <strong style="color:#ffae00; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</strong>
    </div>
    <div style="font-size: 12px; line-height: 1.5; color: #ccc;">
      Buy: <span style="color:#00ff00">${formatGP(buy)}</span> gp<br>
      Sell: <span style="color:#ff0000">${formatGP(sell)}</span> gp
    </div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12px;">
      <span style="font-size: 10px; color: #7a8294;">Updated: ${relativeTime}</span>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${shareButtonHTML(shareUrl)}
        ${wikiButtonHTML(wikiName)}
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Build the boss unique list card (matches floating card style)
// ------------------------------------------------------------
function buildBossCard(bossKey, uniquesHtml, shareUrl) {
  return `
    <div class="drag-grip"></div>
    <div style="text-align:left; width:100%;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom:8px;">
        <strong style="font-size:14px; color:#ffae00; padding-bottom:4px; flex:1;">${bossKey.toUpperCase()} UNIQUES</strong>
        <span style="position:relative; top:-2px; right:-4px;">${shareButtonHTML(shareUrl)}</span>
      </div>
      <div class="scrollable-list" style="max-height:250px; overflow-y:auto; padding-right:6px; font-size:11px; line-height:1.4;">
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

  priceBox.classList.remove("visible");
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
    // --- Boss view ---
    const bossKey = findBossKey(name);
    if (
      !bossKey ||
      !bossCollectionCache[bossKey] ||
      bossCollectionCache[bossKey].length === 0
    ) {
      priceBox.innerHTML = `<div style="padding:10px; text-align:center; color: #7a8294;">No tradeable uniques found for ${name}.</div>`;
      priceBox.classList.add("visible");
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
      priceBox.dataset.type = "boss";
      priceBox.dataset.name = bossKey;
      priceBox.classList.add("visible");
      attachTooltips(priceBox);
    });
    if (!skipHistory) saveHistory(bossKey);
    updateUrlHash("boss", bossKey);
    return;
  }

  // --- Single item view ---
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
      priceBox.dataset.type = "item";
      priceBox.dataset.name = name;
      priceBox.classList.add("visible");
      attachTooltips(priceBox);
    });
    updateUrlHash("item", name);
  } catch (err) {
    priceBox.innerHTML = `<div style="padding:10px; text-align:center; color:#ff5555;">Failed fetching live values.</div>`;
    priceBox.classList.add("visible");
  }
}

initTracker();
