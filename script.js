// ---------- Search suggestions ----------
// Suggestions are DOM nodes, not interpolated HTML: item names are always text.
function appendSearchHighlight(container, name, query) {
  if (!query) {
    container.textContent = name;
    return;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = new RegExp(escaped, "gi");
  let cursor = 0;
  for (const match of name.matchAll(matches)) {
    container.append(document.createTextNode(name.slice(cursor, match.index)));
    const highlight = document.createElement("strong");
    highlight.className = "search-match";
    highlight.textContent = match[0];
    container.append(highlight);
    cursor = match.index + match[0].length;
  }
  container.append(document.createTextNode(name.slice(cursor)));
}

function createSuggestionIcon(entry) {
  const img = document.createElement("img");
  img.className = "suggest-icon";
  img.alt = "";
  img.loading = "lazy";
  if (entry.isBoss) {
    img.src = "https://oldschool.runescape.wiki/images/Collection_log_icon.png";
    return img;
  }
  const filenames = [resolveWikiName(entry.name), `${entry.name} (item)`];
  const toWikiUrl = filename =>
    `https://oldschool.runescape.wiki/w/Special:Redirect/file/${encodeURIComponent(filename.replace(/ /g, "_"))}.png`;
  let fallbackIndex = 0;
  img.onerror = () => {
    if (++fallbackIndex < filenames.length) img.src = toWikiUrl(filenames[fallbackIndex]);
    else {
      img.onerror = null;
      img.src = "https://oldschool.runescape.wiki/images/Coins_10000.png";
    }
  };
  img.src = toWikiUrl(filenames[0]);
  return img;
}

function makeSuggestion(entry, index, query) {
  const row = document.createElement("div");
  row.className = "suggested-item";
  row.id = `suggest-${index}`;
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", "false");
  row.dataset.searchName = entry.name;
  row.append(createSuggestionIcon(entry));

  const name = document.createElement("span");
  name.className = "suggestion-name";
  name.title = entry.name;
  appendSearchHighlight(name, entry.name, query);
  row.append(name);
  if (entry.isBoss || entry.isBossDrop) {
    const detail = document.createElement("span");
    detail.className = "suggestion-type";
    detail.textContent = entry.isBoss ? "Collection Log" : `${entry.boss} drop`;
    row.append(detail);
  }
  row.addEventListener("click", () => getPrice(entry.name));
  return row;
}

function showSearchResults(visible) {
  searchInput.classList.toggle("has-suggestions", visible);
  resultsDiv.style.display = visible ? "block" : "none";
  searchInput.setAttribute("aria-expanded", String(visible));
  if (!visible) searchInput.removeAttribute("aria-activedescendant");
}

function renderSearchResults(entries, query) {
  resultsDiv.replaceChildren(...entries.map((entry, index) => makeSuggestion(entry, index, query)));
  showSearchResults(true);
}

searchInput.setAttribute("role", "combobox");
searchInput.setAttribute("aria-autocomplete", "list");
searchInput.setAttribute("aria-controls", "results");
searchInput.setAttribute("aria-expanded", "false");
resultsDiv.setAttribute("role", "listbox");
resultsDiv.setAttribute("aria-label", "Matching items and bosses");

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const val = searchInput.value.trim();
  const valLower = val.toLowerCase();
  selectedIndex = -1;
  searchInput.removeAttribute("aria-activedescendant");
  if (val.length < 3) {
    showSearchResults(false);
    return;
  }

  debounceTimer = setTimeout(() => {
    if (searchInput.value.trim() !== val) return;
    const results = buildSearchResults(valLower);
    if (results.length > 0) {
      renderSearchResults(results.slice(0, 15), val);
      return;
    }

    const closest = getClosestMatch(valLower);
    if (closest) {
      renderSearchResults([{ name: closest.name }], val);
      const name = resultsDiv.querySelector(".suggestion-name");
      name.prepend(document.createTextNode("Did you mean: "));
      name.append(document.createTextNode("?"));
    } else {
      const empty = document.createElement("div");
      empty.className = "suggested-item suggestion-empty";
      empty.textContent = "No results located";
      resultsDiv.replaceChildren(empty);
      showSearchResults(true);
    }
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
  if (e.key === "Escape") {
    clearTimeout(debounceTimer);
    showSearchResults(false);
    selectedIndex = -1;
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(debounceTimer);
    showSearchResults(false);

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
  if (resultsDiv.style.display === "none" ||
      !items.length || items[0].innerText === "No results located") return;

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
    const active = i === selectedIndex;
    elements[i].classList.toggle("is-selected", active);
    elements[i].setAttribute("aria-selected", String(active));
    if (active) {
      searchInput.setAttribute("aria-activedescendant", elements[i].id);
      elements[i].scrollIntoView({ block: "nearest" });
    }
  }
}

// ---------- Main getPrice ----------
async function getPrice(name, skipHistory = false) {
  showSearchResults(false);
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
      window.PriceHistory?.mount(priceBox, itemData.id);
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
