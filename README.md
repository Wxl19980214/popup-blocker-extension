# Stream Pop-up Blocker

A Chrome extension that blocks JS-driven pop-ups, new tab hijacks, location redirects, and overlay ads on any website. Built for free streaming sites that aggressively open ads — just toggle it on when you're watching, off when you're done.

## What it blocks

| Threat | How |
|--------|-----|
| `window.open()` new tabs | Overrides `window.open` to return `null` |
| `location.href` / `location.assign` / `location.replace` redirects | Overrides `Location.prototype` setters to no-ops |
| Full-screen overlay ads | `MutationObserver` removes elements with `z-index > 1000` covering >30% of viewport |
| `target="_blank"` and `javascript:` link clicks | Captures and cancels click events before they propagate |

Video players are never removed — the overlay heuristic skips any element that contains a `<video>` tag.

## Install

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the repo folder
5. The extension icon appears in your toolbar

**Requires Chrome 111+** (uses `world: "MAIN"` content scripts)

## Usage

- Click the toolbar icon to open the popup
- Toggle **ON** (green) before visiting a streaming site
- Toggle **OFF** (gray) when you're done — the page returns to normal immediately, no reload needed
- State persists across browser restarts

## Architecture

The extension uses two content scripts to work around Chrome's JS world isolation:

```
popup.js
  └─ chrome.storage.local  (persists enabled state)
  └─ chrome.tabs.sendMessage  ──► content-isolated.js  (isolated world)
                                        └─ CustomEvent '__blocker:setState'  ──► content-main.js  (MAIN world)
                                                                                        └─ patches window.open, Location.prototype
                                                                                        └─ MutationObserver (overlay removal)
                                                                                        └─ click interceptor
```

**Why two scripts?** Chrome MV3 content scripts run in an isolated JavaScript environment — patching `window.open` there has no effect on the page's own code. `content-main.js` declares `world: "MAIN"` to inject into the page's JS context where patches actually work, but MAIN world scripts can't use `chrome.*` APIs. `content-isolated.js` handles the Chrome API side and bridges state via a DOM `CustomEvent`.

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3 config, permissions, content script declarations |
| `content-main.js` | MAIN world — patches browser APIs, runs MutationObserver |
| `content-isolated.js` | Isolated world — reads `chrome.storage`, relays state via CustomEvent |
| `popup.html` | Toggle switch UI |
| `popup.js` | Reads/writes storage, messages active tab on toggle |
| `icons/` | Extension icons (16×16, 48×48, 128×128) |
| `test/test.html` | Manual test page — open in Chrome with extension ON to verify each blocking mechanism |

## Testing

Open `test/test.html` in Chrome with the extension enabled. Each button tests one blocking mechanism and shows a PASS/FAIL result inline.

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Persists the on/off toggle state across sessions |
| `tabs` | Gets the active tab ID to send immediate toggle messages |
| `host_permissions: <all_urls>` | Allows content scripts to run on any site (streaming URLs change frequently) |
