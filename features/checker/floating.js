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
  if (clearAllBtn) {
    const hasWindows = floatingCards.length > 0;
    clearAllBtn.classList.toggle("has-floating-windows", hasWindows);
    clearAllBtn.style.display = hasWindows ? "inline-block" : "none";
  }
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
  div.className = "floating-card ui-surface";
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
    <span class="floating-symbol" aria-hidden="true">${isBoss ? '<i class="fas fa-dungeon"></i>' : ""}</span>
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


const bossTitleIconRequests = new Map();

function loadBossTitleIcon(card, name) {
  const symbol = card.querySelector(".floating-symbol");
  if (!symbol) return;
  // PageImages returns the article's representative image. If there isn't
  // one, retain the neutral dungeon icon rather than showing coins.
  if (!bossTitleIconRequests.has(name)) {
    const url = `https://oldschool.runescape.wiki/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(name)}&pithumbsize=96&redirects=1&origin=*`;
    const request = fetch(url)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const page = Object.values(data?.query?.pages || {})[0];
        const source = page?.thumbnail?.source;
        return typeof source === "string" && source.startsWith("https://oldschool.runescape.wiki/")
          ? source : null;
      })
      .catch(() => null);
    bossTitleIconRequests.set(name, request);
  }
  bossTitleIconRequests.get(name).then(src => {
    if (!src || !card.isConnected || card.dataset.name !== name) return;
    const img = document.createElement("img");
    img.alt = "";
    img.width = 24;
    img.height = 24;
    img.addEventListener("load", () => {
      if (symbol.isConnected) symbol.replaceChildren(img);
    }, {once:true});
    // Keep the neutral fallback if a remote image fails to load.
    img.src = src;
  });
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
  if (type === "boss") loadBossTitleIcon(div, name);

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
  dragPreview.className = 'floating-card ui-surface drag-preview';
  dragPreview.dataset.type = type;
  dragPreview.removeAttribute('id');
  dragPreview.setAttribute('aria-hidden', 'true');
  dragPreview.inert = true;
  if (!existing) {
    const header = document.createElement('div');
    header.className = 'floating-header';
    const symbol = document.createElement('span');
    symbol.className = 'floating-symbol';
    const icon = type === 'boss'
      ? Object.assign(document.createElement('i'), {className: 'fas fa-dungeon'})
      : priceBox.querySelector('.item-summary img')?.cloneNode(true);
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
      // Floating copies keep their compact price layout, without a duplicate chart.
      content.querySelector('.price-history')?.remove();
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

