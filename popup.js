const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

function updateUI(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled ? 'Blocking active' : 'Blocking off';
  status.style.color = enabled ? '#16a34a' : '#555';
}

chrome.storage.local.get('enabled', ({ enabled }) => {
  updateUI(!!enabled);
});

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });
  updateUI(enabled);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SET_STATE', enabled });
  } catch {
    // Content script not present — tab was open before extension was installed/enabled.
    // Inject scripts directly so blocking takes effect without requiring a page reload.
    if (enabled) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content-main.js'],
          world: 'MAIN',
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content-isolated.js'],
        });
      } catch {
        // Restricted page (chrome://, file://, etc.) — nothing to do
      }
    }
  }
});
