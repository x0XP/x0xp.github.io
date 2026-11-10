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
  // The OSRS prices mapping provides the actual inventory icon filename.
  // A coin stack is not a valid fallback for unrelated item thumbnails.
  const mapped = itemMap[primaryName.toLowerCase()] || itemMap[fallbackName.toLowerCase()];
  const file = mapped?.icon;
  const safeName = str => encodeURIComponent(str.replace(/ /g, "_"));
  const primarySrc = typeof file === "string" && /\.(png|gif|webp)$/i.test(file)
    ? `https://oldschool.runescape.wiki/images/${safeName(file)}`
    : `https://oldschool.runescape.wiki/w/Special:Redirect/file/${safeName(primaryName + ".png")}`;
  const fallbackSrc = `https://oldschool.runescape.wiki/w/Special:Redirect/file/${safeName(fallbackName + ".png")}`;
  return `<img src="${primarySrc}" alt="" loading="lazy"
       style="width:${size}px; height:${size}px; object-fit:contain; flex-shrink:0;"
       onerror="this.onerror=function(){this.onerror=null;this.style.visibility='hidden';};this.src='${fallbackSrc}';">`;
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

