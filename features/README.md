# Feature styling and JavaScript

The original 602-line `hub.css` was split into feature stylesheets in the exact original CSS order.

- `hub.css`: homepage and global foundation
- `features/price-checker.css`: search, results, prices, history and pinned controls
- `features/floating-windows.css`: floating cards, drag handles, Close All, help and Updates
- `ui/checker-responsive.css`: original focus, home and checker responsive rules
- `features/github.css`: GitHub profile and repository list
- `features/price-history.css`: chart and time-range controls
- `ui/view-layout.css`: shared mobile header layout and scrolling edge
- `repo-detail.css` and `sol-trainer.css`: separate repository detail and trainer container layouts

The wallpaper reference in `ui/view-layout.css` deliberately uses `../assets/hub-background.png` because CSS URLs resolve relative to the stylesheet location.

`style.css` still contains older Price Checker styling. Its selectors and their later overrides were deliberately kept. Do not remove or reorder those rules without visual regression coverage.

The Price Checker's `script.js` remains unchanged. It owns floating-window persistence and dragging, search, pins and history, pricing, rendering, and Updates. `price-history.js` owns chart rendering. Before separating these interdependent JavaScript functions, add browser tests covering search, pinning, restoring/resizing floating cards, Updates, and chart interactions.

Run `node --test tests/*.test.cjs`. These tests verify the precise CSS rule/order baseline, not browser functionality.
