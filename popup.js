const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

function updateUI(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled ? 'Blocking active' : 'Blocking off';
  status.style.color = enabled ? '#16a34a' : '#555';
}

// Read persisted state and reflect in UI on popup open
chrome.storage.local.get('enabled', ({ enabled }) => {
  updateUI(!!enabled);
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;

  // Persist state
  chrome.storage.local.set({ enabled });
  updateUI(enabled);

  // Tell the active tab's content script to apply immediately (no reload needed)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id != null) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_STATE', enabled }).catch(() => {
        // Tab may not have content script (e.g., chrome:// pages) — safe to ignore
      });
    }
  });
});
