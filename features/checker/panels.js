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
  showSearchResults(false);
  selectedIndex = -1;
});

document.addEventListener("click", (e) => {
  if (
    e.target !== searchInput &&
    e.target !== resultsDiv &&
    !resultsDiv.contains(e.target)
  ) {
    showSearchResults(false);
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
  content.textContent = "Loading updates…";

  try {
    const response = await fetch("price-checker-changelog.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Changelog request failed (${response.status})`);
    const updates = await response.json();
    if (!Array.isArray(updates)) throw new Error("Changelog must be an array");

    content.replaceChildren();
    if (updates.length === 0) {
      content.textContent = "No updates yet.";
      return;
    }

    for (const update of updates) {
      if (!update || typeof update.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(update.date) ||
          Number.isNaN(Date.parse(`${update.date}T12:00:00Z`)) ||
          typeof update.title !== "string" ||
          !Array.isArray(update.changes) ||
          !update.changes.every(change => typeof change === "string")) {
        throw new Error("Invalid changelog entry");
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
    console.error("Failed to load updates changelog", error);
    content.textContent = "Unable to load updates.";
  }
}

// The changelog is local and should not wait for the live item/boss APIs.
void loadChangelog();

