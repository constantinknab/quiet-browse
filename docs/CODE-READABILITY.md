# Code readability policy

Quiet Browse ships its original source. The release ZIP does not contain a minified,
obfuscated, transpiled, or generated JavaScript bundle.

## File responsibilities

- `background.js` is the trusted service worker. It owns storage, permissions,
  registered content scripts, alarms, remote domain-data updates, and blocking rules.
- `shared/settings.js` defines the saved settings schema and site defaults.
- `shared/comfort.js` contains pure schedule and scrolling calculations.
- `shared/adult-domains.js` contains adult-list metadata and packaged starter domains.
- `content/comfort.js` controls grayscale and page-by-page navigation.
- `content/social.js` classifies social routes and hides selected social surfaces.
- `content/engine.js` coordinates reversible general page and YouTube treatments.
- `ui/popup.js` controls the active-tab popup.
- `ui/options.js` controls saved-site, schedule, and Adult Guard settings.

The split is intentional: a reviewer can inspect one responsibility without tracing an
unrelated bundled file. HTML contains structure, CSS contains presentation, and UI
behavior remains in external JavaScript files. `manifest.json` cannot contain comments
because JSON syntax does not permit them, so its keys are expanded and kept readable.

## Automated safeguards

Run `npm run verify` before packaging. It fails when:

- Prettier would change a checked-in JavaScript, JSON, HTML, or CSS file;
- a packaged source line looks compressed;
- a JavaScript module uses a one-character declaration, parameter, or `$` DOM alias;
- a JavaScript, CSS, or HTML file loses its purpose comment;
- a JavaScript file grows large enough that it should be split by responsibility;
- encoded payloads or executable-code loading patterns appear; or
- the release ZIP differs from the reviewed `extension/` directory.

Python release utilities are not processed by Prettier. Tests separately require
readable line lengths and an opening module docstring, and Python compilation is part
of the manual development check when those utilities change.

Comments explain intent and security boundaries. They are not added to restate obvious
syntax, because excessive mechanical comments can make a review harder rather than easier.
