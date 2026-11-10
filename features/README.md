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

`style.css` now contains the global reset and original homepage styles. Earlier Price Checker styling has been moved without changes to `features/checker/legacy.css`. Its selectors and their later overrides remain in original order. Do not remove or reorder those rules without visual regression coverage.

## Price Checker JavaScript (Phase 4)

The former 1,951-line `script.js` is split at existing top-level section headings into classic-script modules, loaded in this exact order:

1. `features/checker/state.js` — shared data and DOM references
2. `features/checker/floating.js` — floating-window storage, creation and drag/resize
3. `features/checker/panels.js` — pin gestures, help and Updates controls
4. `features/checker/data.js` — API loading, collection log and initialization
5. `features/checker/history.js` — history/pins, formatting and price helper functions
6. `features/checker/rendering.js` — cards, icon markup, tooltips, refreshing and animations. Its compact icon buttons now use shared CSS instead of inline mouseover styles.
7. `script.js` — search interaction, prices and final tracker initialization

These remain classic scripts, **not** ES modules. Their shared global lexical and function bindings, initialization order, request handling, storage keys, and application logic remain unchanged. Do not wrap them in IIFEs or change `type="module"` without a separate architectural review.

The browser boot loader treats each fragment as a critical asset. `tests/checker-modules.test.cjs` reconstructs and hashes the original source before the split; `tests/browser-smoke.test.cjs` verifies navigation, item search, Updates and floating-window persistence using deterministic network fixtures.

Run `node --test tests/ui-structure.test.cjs tests/feature-css.test.cjs tests/checker-modules.test.cjs` for structural checks; browser smoke tests run separately through the GitHub Actions workflow.
