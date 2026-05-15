// Dispatches a CustomEvent to content-main.js across the world boundary
function dispatch(enabled) {
  document.dispatchEvent(
    new CustomEvent('__blocker:setState', { detail: { enabled } })
  );
}

// Apply persisted state on every page load
chrome.storage.local.get('enabled', ({ enabled }) => {
  dispatch(!!enabled);
});

// Apply state immediately when the popup toggles
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SET_STATE') {
    dispatch(msg.enabled);
  }
});
