# Shared UI ownership

The website is intentionally plain HTML, CSS, and JavaScript. Avoid introducing a framework to change its visual components.

- **components.css** owns design tokens and view transitions.
- **ui/surfaces.css** owns shared card shells (`.ui-card`, `.ui-surface`, `.ui-view-card`) and inset panels (`.ui-inset-panel`, optional `--filled`). Page styles own dimensions and mobile overrides.
- **ui/typography.css** owns common headings, muted text and responsive heading sizes.
- **ui/buttons.css** owns the appearance of `.ui-button`, `.ui-list-row`, and compact `.icon-btn` controls, including dynamically generated Wiki and share actions.
- **ui/effects.css** owns the gold cursor-following glow, hover and focus treatment, and reduced-motion behaviour for website controls. The homepage project cards keep their existing SVG treatment in `hub.css`.
- **ui/interactions.js** registers the single delegated pointer/focus listener for dynamically created controls, including repository links and floating-window actions.
- **hub.css** owns the homepage; **ui/checker-responsive.css** and **ui/view-layout.css** preserve the original shared responsive and scroll-edge rules.
- **features/price-checker.css** owns search and item display, **features/floating-windows.css** owns floating cards and Updates panels, **features/price-history.css** owns charts, and **features/github.css** owns the GitHub profile and list.
- **style.css** owns global reset and homepage foundation, while **features/checker/legacy.css** contains the audited Price Checker base rules, with unused controls and overridden declarations removed. **repo-detail.css** and **sol-trainer.css** retain page-specific styles. The Price Checker JavaScript is split into classic-script fragments under **features/checker/**, with `script.js` remaining the final startup entrypoint. See `features/README.md`. Do not create another global glow handler.

## Loading contract

The stylesheet order in `index.html` is intentional: legacy feature CSS; tokens; surfaces; typography; button bases; homepage CSS; feature CSS in original cascade order; repository/trainer layouts; shared effects. The interaction script runs before `hub.js`. Each asset is versioned through the existing site bootstrapper.

## Validation

Run `node --test tests/ui-structure.test.cjs tests/feature-css.test.cjs tests/checker-modules.test.cjs tests/legacy-css.test.cjs` for dependency-free structural tests. GitHub Actions runs browser interaction tests after installing Puppeteer and also runs screenshot comparisons against `main` for pull requests. The visual test requires a `baseline-site` checkout of `main`, so `node --test tests/*.test.cjs` is not a standalone local test command.

The Sol Heredit Trainer is deployed from **x0XP/ColosseumTrainer** and remains an independent application. Do not couple its SDK/gameplay runtime to the main website's scripts.
