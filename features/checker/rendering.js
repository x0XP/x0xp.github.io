// ---------- Icon buttons ----------
function shareButtonHTML(url) {
  return `<button onclick="copyShareLink('${url.replace(/'/g, "\\'")}')"
                class="icon-btn" aria-label="Copy share link"
                data-tooltip="Copy share link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </button>`;
}

function wikiButtonHTML(pageName) {
  return `<a href="https://oldschool.runescape.wiki/w/${encodeURIComponent(pageName)}" target="_blank" rel="noopener noreferrer" aria-label="Open Wiki page"
                class="icon-btn"
                data-tooltip="Open Wiki page">
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
    ${includeWrapper && window.PriceHistory ? window.PriceHistory.markup(itemMap[name.toLowerCase()]?.id) : ''}
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
        if (!isFloating) window.PriceHistory?.mount(container, itemData.id);
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

