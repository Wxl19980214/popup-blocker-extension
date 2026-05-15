// Service worker: closes any programmatically-created tab/window while blocking is enabled.
// openerTabId is set by Chrome when a tab is opened via window.open or target="_blank" —
// it is NOT set when the user opens a tab manually (Ctrl+T, address bar, etc.).
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId == null) return;

  const { enabled } = await chrome.storage.local.get('enabled');
  if (!enabled) return;

  chrome.tabs.remove(tab.id);
});
