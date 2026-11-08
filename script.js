// ----- Auto‑reload on version change -----
const APP_VERSION = "1.0.5";
const storedVersion = localStorage.getItem("appVersion");

if (storedVersion && storedVersion !== APP_VERSION) {
  localStorage.setItem("appVersion", APP_VERSION);
  location.reload(true);
} else if (!storedVersion) {
  localStorage.setItem("appVersion", APP_VERSION);
}

console.log(`App version: ${APP_VERSION}`);

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
let floatingCards = [];
let floatingCardCounter = 0;
let highestZIndex = 100;
const floatingDisposers = new Map();

// Auto‑refresh state
let refreshInterval = null;
let isRefreshing = false;

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
function floatingContentHeight(div) {
  const content = div.querySelector('.floating-content');
  const list = content?.firstElementChild;
  if (!list || !div.dataset.contentReady) return Infinity;
  return Math.max(160, Math.ceil(list.getBoundingClientRect().height + div.offsetHeight - content.clientHeight));
}

function clampToViewport(div) {
  if (!div.getBoundingClientRect().width) return;
  const edge = 0;
  const bottom = innerHeight;
  if (div.dataset.type === "boss") {
    const requested = parseFloat(div.style.height) || 240;
    div.style.height = Math.min(Math.max(160, requested), floatingContentHeight(div), Math.max(160, bottom - edge)) + "px";
  }
  const rect = div.getBoundingClientRect();
  const left = Math.max(edge, Math.min(parseFloat(div.style.left) || edge, innerWidth - rect.width - edge));
  const top = Math.max(edge, Math.min(parseFloat(div.style.top) || edge, bottom - rect.height));
  div.style.left = left + "px";
  div.style.top = top + "px";
}

function rememberFloatingCard(div) {
  if (!div.getBoundingClientRect().width) return;
  const state = floatingCards.find(entry => entry.id === Number(div.dataset.id));
  if (!state) return;
  state.x = parseFloat(div.style.left);
  state.y = parseFloat(div.style.top);
  state.height = state.type === "boss" ? parseFloat(div.style.height) : null;
  const handle = div.querySelector('.resize-handle');
  if (handle) {
    const bottom = innerHeight;
    handle.setAttribute('aria-valuemin', '160');
    handle.setAttribute('aria-valuemax', String(Math.round(Math.min(floatingContentHeight(div), Math.max(160, bottom - div.offsetTop)))));
    handle.setAttribute('aria-valuenow', String(Math.round(div.offsetHeight)));
  }
  saveFloatingCards();
}

window.addEventListener("resize", () => {
  floatingContainer.querySelectorAll(".floating-card").forEach(div => {
    clampToViewport(div);
    rememberFloatingCard(div);
  });
});

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
  div.dataset.type = type;
  div.dataset.name = name;
  div.setAttribute("role", "region");
  div.setAttribute("aria-label", `${name} floating window`);

  if (isBoss) {
    div.style.height = (initialHeight || 200) + "px";
  }

  const header = document.createElement("div");
  header.className = "floating-header";
  header.innerHTML = `
    <span class="floating-symbol" aria-hidden="true">${isBoss ? '<img src="assets/coin-stack.png" alt="" />' : ""}</span>
    <span class="floating-title">${name}</span>
    ${shareUrl ? shareButtonHTML(shareUrl) : ""}
    <button class="floating-close" aria-label="Close floating card" data-id="${cardId}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
  `;

  const content = document.createElement("div");
  content.className = "floating-content";
  content.innerHTML =
    '<div class="skeleton" style="height: 60px; width: 100%; border-radius: 4px;"></div>';

  div.appendChild(header);
  div.appendChild(content);

  // Pointer capture keeps a drag alive outside its handle without global listeners.
  let move = null;
  header.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button, a")) return;
    bringToFront(div);
    move = {x: event.clientX, y: event.clientY, left: div.offsetLeft, top: div.offsetTop};
    header.setPointerCapture(event.pointerId);
    div.classList.add("is-dragging");
    event.preventDefault();
  });
  header.addEventListener("pointermove", event => {
    if (!move) return;
    div.style.left = move.left + event.clientX - move.x + "px";
    div.style.top = move.top + event.clientY - move.y + "px";
    clampToViewport(div);
  });
  const finishMove = () => {
    if (!move) return;
    move = null;
    div.classList.remove("is-dragging");
    clampToViewport(div);
    rememberFloatingCard(div);
  };
  header.addEventListener("pointerup", finishMove);
  header.addEventListener("pointercancel", finishMove);
  header.addEventListener("lostpointercapture", finishMove);
  header.addEventListener("keydown", event => {
    if (event.target !== header || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 30 : 10;
    div.style.left = div.offsetLeft + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0) + "px";
    div.style.top = div.offsetTop + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) + "px";
    clampToViewport(div);
    rememberFloatingCard(div);
  });
  header.tabIndex = 0;
  header.setAttribute("aria-label", `Move ${name} window`);
  div.addEventListener("pointerdown", () => bringToFront(div));

  if (isBoss) {
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    handle.tabIndex = 0;
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", `Resize ${name} window`);
    handle.setAttribute("aria-orientation", "vertical");
    div.appendChild(handle);
    let resize = null;
    const resizeTo = height => {
      const bottom = innerHeight;
      const max = Math.min(floatingContentHeight(div), Math.max(160, bottom - div.offsetTop));
      div.style.height = Math.max(160, Math.min(height, max)) + "px";
      handle.setAttribute("aria-valuemin", "160");
      handle.setAttribute("aria-valuemax", String(Math.round(max)));
      handle.setAttribute("aria-valuenow", String(Math.round(div.offsetHeight)));
    };
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      resize = {y: event.clientY, height: div.offsetHeight};
      handle.setPointerCapture(event.pointerId);
      div.classList.add("is-resizing");
    });
    handle.addEventListener("pointermove", event => {
      if (resize) resizeTo(resize.height + event.clientY - resize.y);
    });
    const finishResize = () => {
      if (!resize) return;
      resize = null;
      div.classList.remove("is-resizing");
      rememberFloatingCard(div);
    };
    handle.addEventListener("pointerup", finishResize);
    handle.addEventListener("pointercancel", finishResize);
    handle.addEventListener("lostpointercapture", finishResize);
    handle.addEventListener("keydown", event => {
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      resizeTo(div.offsetHeight + (event.key === "ArrowUp" ? -20 : 20));
      rememberFloatingCard(div);
    });
    resizeTo(initialHeight || 240);
  }

  floatingContainer.appendChild(div);
  clampToViewport(div);
  const observer = new ResizeObserver(() => {
    clampToViewport(div);
    rememberFloatingCard(div);
  });
  observer.observe(div);
  floatingDisposers.set(cardId, () => observer.disconnect());
  header.querySelector(".floating-close").addEventListener("click", event => {
    event.stopPropagation();
    removeFloatingCard(cardId);
  });

  if (shareUrl) {
    attachTooltips(header);
  }

  return { div, content };
}

// Add a new floating card
function createFloatingCard(type, name, x, y, initialHeight = null, snapshot = null) {
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
  if (snapshot) {
    content.innerHTML = snapshot.content;
    div.querySelector('.floating-symbol').innerHTML = snapshot.icon;
    if (type === 'boss') div.dataset.contentReady = 'true';
    clampToViewport(div);
  }

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
          div.querySelector(".floating-symbol").innerHTML = iconHtml;
          content.innerHTML = buildItemCard(name, p.high, p.low, iconHtml,
            formatTimeAgo(p.highTime ? Math.round((Date.now() / 1000 - p.highTime) / 60) : NaN), itemShareUrl, name, false);
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
          let html = `<div style="width: 100%;">`;
          items.forEach((itemTitle) => {
            const wikiName = resolveWikiName(itemTitle);
            const fallbackName = itemTitle + " (item)";
            const id = itemMap[itemTitle.toLowerCase()]?.id;
            const p = id && priceData[id] ? priceData[id] : {};
            const avg =
              p.high != null && p.low != null ? (p.high + p.low) / 2 : null;
            const priceStr = avg != null ? formatShortGP(avg) : "N/A";

            html += `
                        <div class="suggested-item" style="display:flex; align-items:center; justify-content:space-between; padding: 7px 0; border-bottom:1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="getPrice('${itemTitle.replace(/'/g, "\\'")}')">
                            <div style="display:flex; align-items:center; gap:8px; min-width: 0; flex-grow:1;">
                                ${fallbackItemIcon(wikiName, fallbackName, 16)}
                                <span style="font-size:12px; color:#fff;">${itemTitle}</span>
                            </div>
                            <span style="font-size:11px; color:#dfc089; margin-left:8px; margin-right:4px; flex-shrink:0;">${priceStr}</span>
                        </div>`;
          });
          html += "</div>";
          content.innerHTML = html;
          div.dataset.contentReady = "true";
          attachTooltips(div);

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
  return div;
}

// Remove a floating card
function removeFloatingCard(id) {
  floatingDisposers.get(id)?.();
  floatingDisposers.delete(id);
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
  floatingDisposers.forEach(dispose => dispose());
  floatingDisposers.clear();
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

// ---------- Drag-to-duplicate ----------
let dragState = null;
let dragPreview = null;

function startDrag(e) {
  if (e.button !== 0) return;
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

  // Measure the floating layout itself, never the larger checker result.
  const existing = [...floatingContainer.querySelectorAll('.floating-card')].find(el => el.dataset.type === type && el.dataset.name === name);
  dragPreview = existing ? existing.cloneNode(true) : document.createElement('div');
  dragPreview.className = 'floating-card drag-preview';
  dragPreview.dataset.type = type;
  dragPreview.removeAttribute('id');
  dragPreview.setAttribute('aria-hidden', 'true');
  dragPreview.inert = true;
  if (!existing) {
    const header = document.createElement('div');
    header.className = 'floating-header';
    const symbol = document.createElement('span');
    symbol.className = 'floating-symbol';
    const icon = type === 'boss' ? Object.assign(new Image(), {src:'assets/coin-stack.png'}) : priceBox.querySelector('.item-summary img')?.cloneNode(true);
    if (icon) symbol.append(icon);
    const title = document.createElement('span');
    title.className = 'floating-title';
    title.textContent = name;
    const close = document.createElement('span');
    close.className = 'floating-close';
    header.append(symbol, title, close);
    const content = document.createElement('div');
    content.className = 'floating-content';
    if (type === 'boss') {
      const list = document.createElement('div');
      list.innerHTML = priceBox.querySelector('.scrollable-list')?.innerHTML || '';
      content.append(list);
    } else {
      content.innerHTML = priceBox.innerHTML;
      content.querySelector('.drag-grip')?.remove();
    }
    dragPreview.append(header, content);
    if (type === 'boss') {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      dragPreview.append(handle);
      dragPreview.style.height = '240px';
    }
  }
  dragPreview.style.display = 'flex';
  dragPreview.style.left = '0px';
  dragPreview.style.top = '0px';
  document.body.appendChild(dragPreview);
  if (type === 'boss') dragPreview.dataset.contentReady = 'true';
  clampToViewport(dragPreview);
  const rect = dragPreview.getBoundingClientRect();
  dragPreview.style.left = e.clientX - rect.width / 2 + 'px';
  dragPreview.style.top = e.clientY - rect.height / 2 + 'px';
  clampToViewport(dragPreview);
  dragState = {type, name, offsetX:rect.width / 2, offsetY:rect.height / 2, width:rect.width, height:rect.height};

  priceBox.style.cursor = "grabbing";
}

function moveDrag(e) {
  if (!dragState) return;
  dragPreview.style.left = e.clientX - dragState.offsetX + "px";
  dragPreview.style.top = e.clientY - dragState.offsetY + "px";
  clampToViewport(dragPreview);
}

function endDrag(e) {
  if (!dragState) return;

  document.body.style.userSelect = "";
  const dropLeft = parseFloat(dragPreview?.style.left);
  const dropTop = parseFloat(dragPreview?.style.top);
  const snapshot = dragPreview ? {
    content: dragPreview.querySelector('.floating-content').innerHTML,
    icon: dragPreview.querySelector('.floating-symbol').innerHTML,
  } : null;
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
    const placed = createFloatingCard(
      dragState.type,
      dragState.name,
      dropLeft,
      dropTop,
      dragState.type === "boss" ? dragState.height : null,
      snapshot,
    );
    placed.dataset.previewWidth = dragState.width;
    placed.dataset.previewHeight = dragState.height;
  }

  dragState = null;
}

// Use pointer events for drag-to-duplicate (tablet + desktop)
priceBox.addEventListener("pointerdown", startDrag);
document.addEventListener("pointermove", moveDrag);
document.addEventListener("pointerup", endDrag);
function cancelDuplicateDrag() {
  if (!dragState) return;
  dragPreview?.remove();
  dragPreview = null;
  dragState = null;
  document.body.style.userSelect = "";
  priceBox.style.cursor = "";
}
document.addEventListener("pointercancel", cancelDuplicateDrag);
window.addEventListener("blur", cancelDuplicateDrag);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") cancelDuplicateDrag();
});

if (clearAllBtn) {
  clearAllBtn.addEventListener("click", clearAllFloating);
}

// ---------- Pin listeners ----------
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

// ---------- Search input ----------
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

// ---------- Position panel helper ----------
function positionPanel(box, icon) {
  const rect = icon.getBoundingClientRect();
  const width = box.offsetWidth;
  const height = box.offsetHeight;
  const gap = 12;
  let left = rect.right + gap;
  if (left + width > innerWidth - 16) left = rect.left - width - gap;
  left = Math.max(16, Math.min(left, innerWidth - width - 16));
  const top = Math.max(16, Math.min(rect.bottom + gap, innerHeight - height - 16));
  Object.assign(box.style, {position: 'fixed', left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto', transform: 'none', zIndex: '101'});
}

// Info icon toggle – always use positionPanel
if (infoIcon) {
  infoIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    helpVisible = !helpVisible;
    helpBox.classList.toggle("visible", helpVisible);
    infoIcon.style.color = helpVisible ? "#ffae00" : "#7a8294";

    if (helpVisible) {
      requestAnimationFrame(() => {
        positionPanel(helpBox, infoIcon);
      });
    }

    if (changelogVisible) {
      changelogVisible = false;
      changelogBox.classList.remove("visible");
      if (updatesIcon) updatesIcon.style.color = "#7a8294";
    }
  });
}

// Updates icon toggle – always use positionPanel
if (updatesIcon) {
  updatesIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    changelogVisible = !changelogVisible;
    changelogBox.classList.toggle("visible", changelogVisible);
    updatesIcon.style.color = changelogVisible ? "#ffae00" : "#7a8294";

    if (changelogVisible) {
      requestAnimationFrame(() => {
        positionPanel(changelogBox, updatesIcon);
      });
    }

    if (helpVisible) {
      helpVisible = false;
      helpBox.classList.remove("visible");
      infoIcon.style.color = "#7a8294";
    }
  });
}

// ---------- Price checker changelog (independent of repository commits) ----------
async function loadChangelog() {
  const content = document.getElementById("changelogContent");
  if (!content) return;
  content.textContent = "Loading price checker updates…";

  try {
    const response = await fetch("price-checker-changelog.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Changelog request failed (${response.status})`);
    const updates = await response.json();
    if (!Array.isArray(updates)) throw new Error("Changelog must be an array");

    content.replaceChildren();
    if (updates.length === 0) {
      content.textContent = "No price checker updates yet.";
      return;
    }

    for (const update of updates) {
      if (!update || typeof update.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(update.date) ||
          Number.isNaN(Date.parse(`${update.date}T12:00:00Z`)) ||
          typeof update.title !== "string" ||
          !Array.isArray(update.changes) ||
          !update.changes.every(change => typeof change === "string")) {
        throw new Error("Invalid price checker changelog entry");
      }

      const entry = document.createElement("article");
      entry.className = "update-entry";
      const date = document.createElement("time");
      date.dateTime = update.date;
      date.textContent = new Date(`${update.date}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
      });
      const title = document.createElement("h3");
      title.textContent = update.title;
      const changes = document.createElement("ul");
      for (const change of update.changes) {
        const item = document.createElement("li");
        item.textContent = change;
        changes.appendChild(item);
      }
      entry.append(date, title, changes);
      content.appendChild(entry);
    }
  } catch (error) {
    console.error("Failed to load price checker changelog", error);
    content.textContent = "Unable to load price checker updates.";
  }
}

// The changelog is local and should not wait for the live item/boss APIs.
void loadChangelog();

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
        itemMap[item.name.toLowerCase()] = { id: item.id, name: item.name };
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

// ---------- History & pinning ----------
function saveHistory(name) {
  let finalName = name;
  if (!itemMap[name.toLowerCase()]) {
    const bossKey = findBossKey(name);
    if (bossKey) finalName = bossKey;
    else return;
  } else {
    finalName = itemMap[name.toLowerCase()].name;
  }

  const pinned = JSON.parse(localStorage.getItem("osrsPinned") || "[]");
  if (pinned.includes(finalName)) return;

  let hist = JSON.parse(localStorage.getItem("osrsHistory") || "[]");
  hist = [finalName, ...hist.filter((i) => i !== finalName)].slice(0, 5);
  localStorage.setItem("osrsHistory", JSON.stringify(hist));
  loadHistory();
}

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

// ---------- Formatting ----------
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
  if (totalMinutes === 0) return "Just now";
  if (totalMinutes === 1) return "1 min ago";
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

async function fetchPricesForItemNames(itemNames) {
  const ids = itemNames
    .map((n) => itemMap[n.toLowerCase()]?.id)
    .filter((id) => id != null);
  if (ids.length === 0) return {};

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
  return priceMap;
}

// ---------- Icon buttons ----------
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
                class="icon-btn" aria-label="Copy share link"
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
  return `<a href="https://oldschool.runescape.wiki/w/${encodeURIComponent(pageName)}" target="_blank" rel="noopener noreferrer" aria-label="Open Wiki page"
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

// ---------- Tooltips ----------
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
  if (top < 8) top = targetRect.bottom + 8;
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

// ---------- Fade price animation ----------
function fadePrice(element, newValue) {
  if (element.dataset.fadeTimeout) {
    clearTimeout(element.dataset.fadeTimeout);
    element.dataset.fadeTimeout = null;
  }

  element.dataset.value = newValue;
  element.style.transition = "opacity 0.15s ease";
  element.style.opacity = "0";

  const timeout = setTimeout(() => {
    element.textContent = newValue;
    element.style.opacity = "1";
    element.dataset.fadeTimeout = null;
  }, 150);

  element.dataset.fadeTimeout = timeout;
}

// ---------- Builders ----------
function buildItemCard(
  name,
  buy,
  sell,
  iconHtml,
  relativeTime,
  shareUrl,
  wikiName,
  includeWrapper = true,
) {
  const buyStr = formatGP(buy);
  const sellStr = formatGP(sell);
  const content = `
    <div class="item-summary">${iconHtml}<strong>${name}</strong></div>
    <div class="price-grid">
      <div><span class="price-label">BUY</span><span class="price-buy" data-value="${buyStr}">${buyStr}</span><small>gp</small></div>
      <div><span class="price-label">SELL</span><span class="price-sell" data-value="${sellStr}">${sellStr}</span><small>gp</small></div>
    </div>
    <div class="price-footer"><span class="price-time">Updated: ${relativeTime}</span><div class="price-actions">${shareButtonHTML(shareUrl)}${wikiButtonHTML(wikiName)}</div></div>`;
  if (includeWrapper) {
    return `<div class="drag-grip"></div>${content}`;
  }
  return content;
}

function buildBossCard(bossKey, uniquesHtml, shareUrl, includeWrapper = true) {
  const content = `
    <div style="text-align:left; width:100%;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom:8px;">
        <strong style="font-size:16px; color:#f2e7d1; padding-bottom:4px; flex:1;">${bossKey.toUpperCase()} UNIQUES</strong>
        <span style="position:relative; top:-2px; right:-4px;">${shareButtonHTML(shareUrl)}</span>
      </div>
      <div class="scrollable-list" style="max-height:250px; overflow-y:auto; padding-right:6px; font-size:11px; line-height:1.4;">
        ${uniquesHtml}
      </div>
    </div>`;
  if (includeWrapper) {
    return `<div class="drag-grip"></div>${content}`;
  }
  return content;
}

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

// ---------- Resolve item icon ----------
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
    /* fall through */
  }

  const wikiName = resolveWikiName(itemData.name);
  const fallbackName = itemData.name + " (item)";
  return fallbackItemIcon(wikiName, fallbackName, 48);
}

// ---------- Refresh a single card ----------
async function refreshCard(container, type, name, isFloating = false) {
  try {
    if (type === "item") {
      const itemData = itemMap[name.toLowerCase()];
      if (!itemData) {
        container.innerHTML = `<div style="padding:10px; text-align:center; color:#7a8294;">Item not found.</div>`;
        return;
      }
      const res = await fetch(
        `https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemData.id}`,
        { headers },
      );
      const data = await res.json();
      const p = data.data[itemData.id] || {};
      const relativeTime = formatTimeAgo(
        p.highTime ? Math.round((Date.now() / 1000 - p.highTime) / 60) : NaN,
      );
      const shareUrl = `https://embed.x0xp.workers.dev?item=${encodeURIComponent(name).replace(/%20/g, "+")}&ts=${Date.now()}`;

      if (
        !container.querySelector(".price-buy") ||
        !container.querySelector(".price-sell")
      ) {
        const iconHtml = await resolveItemIcon(itemData);
        const html = buildItemCard(
          name,
          p.high,
          p.low,
          iconHtml,
          relativeTime,
          shareUrl,
          name,
          !isFloating,
        );
        container.innerHTML = html;
        attachTooltips(container);
        return;
      }

      const buyElement = container.querySelector(".price-buy");
      const sellElement = container.querySelector(".price-sell");
      if (buyElement) fadePrice(buyElement, formatGP(p.high));
      if (sellElement) fadePrice(sellElement, formatGP(p.low));

      const timeElement = container.querySelector(".price-time");
      if (timeElement) {
        timeElement.style.transition = "opacity 0.15s ease";
        timeElement.style.opacity = "0";
        setTimeout(() => {
          timeElement.textContent = `Updated: ${relativeTime}`;
          timeElement.style.opacity = "1";
        }, 150);
      }
    } else if (type === "boss") {
      const bossKey = findBossKey(name) || name;
      const items = bossCollectionCache[bossKey] || [];
      if (items.length === 0) {
        container.innerHTML = `<div style="padding:10px; text-align:center; color:#7a8294;">No tradeable uniques found.</div>`;
        return;
      }
      const priceData = await fetchPricesForItemNames(items);
      let uniquesHtml = "";
      items.forEach((itemTitle) => {
        const wikiName = resolveWikiName(itemTitle);
        const fallbackName = itemTitle + " (item)";
        const id = itemMap[itemTitle.toLowerCase()]?.id;
        const p = id && priceData[id] ? priceData[id] : {};
        const avg =
          p.high != null && p.low != null ? (p.high + p.low) / 2 : null;
        const priceStr = avg != null ? formatShortGP(avg) : "N/A";
        uniquesHtml += `
                <div class="suggested-item" style="display:flex; align-items:center; justify-content:space-between; padding: 7px 0; border-bottom:1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="getPrice('${itemTitle.replace(/'/g, "\\'")}')">
                    <div style="display:flex; align-items:center; gap:8px; min-width: 0; flex-grow:1;">
                        ${fallbackItemIcon(wikiName, fallbackName, 16)}
                        <span style="font-size:12px; color:#fff;">${itemTitle}</span>
                    </div>
                    <span style="font-size:11px; color:#dfc089; margin-left:8px; margin-right:4px; flex-shrink:0;">${priceStr}</span>
                </div>`;
      });
      const shareUrl = `https://embed.x0xp.workers.dev?boss=${encodeURIComponent(bossKey).replace(/%20/g, "+")}`;
      if (isFloating) {
        container.innerHTML = `<div style="width: 100%;">${uniquesHtml}</div>`;
      } else {
        const html = buildBossCard(bossKey, uniquesHtml, shareUrl, true);
        container.innerHTML = html;
      }

      if (isFloating) {
        const cardDiv = container.closest(".floating-card");
        if (cardDiv) {
          cardDiv.dataset.contentReady = "true";
          clampToViewport(cardDiv);
          rememberFloatingCard(cardDiv);
        }
      }
    }
  } catch (err) {
    console.error("Refresh error:", err);
    container.innerHTML =
      '<div style="padding:10px; text-align:center; color:#ff5555;">Failed to refresh.</div>';
  }
}

// ---------- Refresh all cards ----------
function refreshAllCards() {
  if (isRefreshing) return;
  isRefreshing = true;

  console.log("🔄 Refreshing all cards...");

  const refreshPromises = [];

  if (priceBox.classList.contains("visible")) {
    const type = priceBox.dataset.type;
    const name = priceBox.dataset.name;
    if (type && name) {
      refreshPromises.push(refreshCard(priceBox, type, name, false));
    }
  }

  floatingCards.forEach((fc) => {
    const cardEl = floatingContainer.querySelector(`[data-id="${fc.id}"]`);
    if (cardEl) {
      const contentEl = cardEl.querySelector(".floating-content");
      if (contentEl) {
        refreshPromises.push(refreshCard(contentEl, fc.type, fc.name, true));
      }
    }
  });

  Promise.allSettled(refreshPromises).finally(() => {
    isRefreshing = false;
  });
}

// ---------- Start auto-refresh ----------
function startAutoRefresh() {
  console.log("⏰ Auto-refresh started");
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(refreshAllCards, 60000);
}

// ---------- Dropdown ----------
function generateDropdownHTML(entries, query) {
  return entries
    .map((entry, index) => {
      const safeName = entry.name.replace(/'/g, "\\'");
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "gi");
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

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(debounceTimer);
    resultsDiv.style.display = "none";
    suppressDropdown = true;

    const val = searchInput.value.trim().toLowerCase();

    if (easterEggs[val]) {
      card.classList.add("dance-animation");
      setTimeout(() => card.classList.remove("dance-animation"), 500);
      return;
    }

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

// ---------- Main getPrice ----------
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

  // Resolve named bosses before fuzzy item matching (e.g. Zulrah vs Zulrah drops).
  if (!itemData && !findBossKey(name)) {
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
                      ${fallbackItemIcon(wikiName, fallbackName, 16)}
                      <span style="font-size:12px; color:#fff;">${itemTitle}</span>
                  </div>
                  <span style="font-size:11px; color:#dfc089; margin-left:8px; margin-right:4px; flex-shrink:0;">${priceStr}</span>
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

  // Single item
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

function bringToFront(element) {
  highestZIndex++;
  element.style.zIndex = highestZIndex;
}

// Kick off
const trackerReady = initTracker();
