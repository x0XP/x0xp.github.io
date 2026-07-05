# x0XP OSRS Price Checker

A lightweight, real-time Old School RuneScape Grand Exchange price checker and boss collection log explorer.  
Search any tradeable item or boss to instantly see live buy/sell prices and unique drops – all powered by the official OSRS Wiki APIs.

**Live site:** [x0xp.github.io](https://x0xp.github.io)

<p align="center">
  <img src="https://raw.githubusercontent.com/x0XP/x0xp.github.io/main/readme.jpg" alt="x0XP OSRS Price Checker Dashboard" width="100%">
</p>

---

## Features

- **Instant GE Prices** – Search any tradeable item, see current buy/sell prices and last update time.
- **Boss Collection Logs** – Type a boss name to view all its tradeable uniques, each with a live average price.
- **Auto‑Refresh** – All price cards (main + floating) update automatically every 60 seconds with a smooth fade animation.
- **Floating / Draggable Windows** – Drag the top edge of any price card to create a floating copy. Move, resize (boss cards only), and close them – positions are saved between sessions.
- **Smart Search** – Substring and fuzzy matching, with a "Did you mean?" fallback.
- **Pin Favourites** – Right‑click (or long‑press on mobile) a recent search to pin it above the history.
- **Shareable Embeds** – Copy a link with one click; pasting into Discord generates a rich embed with the item's icon and current prices.
- **Wiki Integration** – Every price card includes a direct link to the official OSRS Wiki page.
- **Dark‑Themed UI** – CRT‑inspired design with smooth animations, gold hover accents, and a responsive layout.
- **Mobile & Tablet Friendly** – Touch‑optimised long‑press pinning; drag‑to‑floating is enabled on tablets (pointer events) but disabled on phones for a cleaner mobile experience.

---

## How to Use

1. Open [x0xp.github.io](https://x0xp.github.io).
2. Type an item name (e.g. `Abyssal whip`) or a boss name (e.g. `Vorkath`).
3. Press **Enter** to see the current price, or click a suggestion from the dropdown.
4. Right‑click (or long‑press on mobile) a recent search to pin it permanently.
5. Click the **share** icon to copy a link that generates a Discord embed.
6. Click the **wiki** icon to open the item's or boss's official wiki page.
7. **Drag the top edge** of the price box (desktop/tablet) to create a floating window – move and resize (boss cards) to suit your workflow.

Need more details? Click the info icon inside the search bar for a quick guide.

---

## Technologies

- **Frontend:** HTML, CSS, vanilla JavaScript
- **APIs:**
  - [OSRS Wiki Prices API](https://oldschool.runescape.wiki/w/RuneLite:Real-time_Prices) – live GE prices
  - [OSRS Wiki Mapping API](https://oldschool.runescape.wiki/w/RuneLite:Real-time_Prices) – item ID to name mapping
  - [OSRS Wiki MediaWiki API](https://oldschool.runescape.wiki/api.php) – page icons, collection log parsing
- **Backend (Embeds):** [Cloudflare Workers](https://workers.cloudflare.com/) – generates dynamic Open Graph meta tags for Discord, Twitter, etc.
- **Hosting:** GitHub Pages (static site) + Cloudflare Workers (embed worker)
