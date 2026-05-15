# CLAUDE.md — Stream Pop-up Blocker

## What this is

A Chrome MV3 extension (plain JS/HTML, no build tool) that blocks JS-driven pop-ups and overlay ads on streaming sites. Single on/off toggle stored in `chrome.storage.local`.

## Key architectural constraint

Chrome MV3 content scripts run in an isolated JS world — patching `window.open` there has zero effect on page code. This extension uses **two content scripts** to work around this:

- `content-main.js` — `world: "MAIN"` — runs in the page's JS context, does all API patching. Cannot use `chrome.*` APIs.
- `content-isolated.js` — default isolated world — has `chrome.*` access, bridges state to the main world via `document.dispatchEvent(new CustomEvent('__blocker:setState', ...))`.

Never collapse these into a single file. The world boundary is real and the CustomEvent bridge is intentional.

## Blocking mechanisms (all in content-main.js)

- `window.open` → overridden to `() => null`
- `Location.prototype.assign` / `.replace` → overridden to no-ops
- `Location.prototype.href` setter → overridden to no-op (getter preserved)
- DOM overlays → `MutationObserver` on `document.documentElement`, removes elements where `z-index > 1000`, `position: fixed/absolute`, coverage > 30% viewport, and no `<video>` child
- `_blank` / `javascript:` links → click capture listener cancels default + stops propagation

## Message flow

```
popup.js  →  chrome.tabs.sendMessage({ type: 'SET_STATE', enabled })
          →  content-isolated.js onMessage  →  CustomEvent '__blocker:setState'
          →  content-main.js event listener  →  activate() / deactivate()
```

On page load, `content-isolated.js` reads `chrome.storage.local` and dispatches the same event to restore persisted state.

## No build tool

This is plain JS. No npm, no Webpack, no TypeScript. Do not introduce a build step. Edit files directly.

## Testing

No automated test suite. Manual testing via `test/test.html` — open in Chrome with the extension loaded unpacked. All 5 tests must PASS with extension ON.

## Permissions

- `storage` — toggle state persistence
- `tabs` — `chrome.tabs.query` in popup.js to get active tab ID for messaging
- `host_permissions: ["<all_urls>"]` — intentional; streaming URLs change constantly so no domain allowlist

## Chrome version requirement

Minimum Chrome 111 (declared in manifest). Required for `world: "MAIN"` in declarative content scripts.
