# Shared UI ownership

The website is intentionally plain HTML, CSS, and JavaScript. Avoid introducing a framework to change its visual components.

- **components.css** owns design tokens, reusable surfaces, headings, and view transitions.
- **ui/buttons.css** owns the base appearance of `.ui-button` and interactive `.ui-list-row` links.
- **ui/effects.css** owns the gold cursor-following glow, hover and focus treatment, and reduced-motion behaviour for website controls. The homepage project cards keep their existing SVG treatment in `hub.css`.
- **ui/interactions.js** registers the single delegated pointer/focus listener for dynamically created controls, including repository links and floating-window actions.
- **style.css**, **hub.css**, **repo-detail.css**, and **sol-trainer.css** should own only their feature-specific layout or variants. Do not add a second global button glow handler there.

## Loading contract

The stylesheet order in `index.html` is intentional: legacy feature CSS; shared tokens/surfaces; shared button bases; view-specific layouts; and finally shared effects. The interaction script runs before `hub.js`. Each asset is versioned through the existing site bootstrapper.

## Validation

Run `node --test tests/ui-structure.test.cjs`. These are structural regression checks, not a substitute for checking the Price Checker, GitHub panel, homepage, and embedded trainer in a browser.

The Sol Heredit Trainer is deployed from **x0XP/ColosseumTrainer** and remains an independent application. Do not couple its SDK/gameplay runtime to the main website's scripts.
