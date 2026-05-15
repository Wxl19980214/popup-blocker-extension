(function () {
  // Capture originals before any page script can overwrite them
  const _open = window.open.bind(window);
  const _assign = Location.prototype.assign;
  const _replace = Location.prototype.replace;
  const _hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');

  let _observer = null;
  let _active = false;

  // Returns true if el looks like a full-screen ad overlay
  function isOverlayAd(el) {
    if (el.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(el);
    const z = parseInt(style.zIndex, 10);
    if (isNaN(z) || z <= 1000) return false;
    const pos = style.position;
    if (pos !== 'fixed' && pos !== 'absolute') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const coverage = (rect.width * rect.height) / (window.innerWidth * window.innerHeight);
    if (coverage <= 0.3) return false;
    // Never remove elements that contain the video player
    if (el.querySelector('video')) return false;
    return true;
  }

  // Prevents _blank links and javascript: hrefs from opening new tabs/running JS
  function blockClick(e) {
    const link = e.target.closest('a');
    if (!link) return;
    const href = (link.getAttribute('href') || '').trim();
    const target = link.getAttribute('target') || '';
    if (target === '_blank' || href.toLowerCase().startsWith('javascript:')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function activate() {
    if (_active) return;
    _active = true;

    // Block window.open() — returns null so callers don't crash
    window.open = () => null;

    // Block location navigation
    Location.prototype.assign = function () {};
    Location.prototype.replace = function () {};
    Object.defineProperty(Location.prototype, 'href', {
      get: _hrefDescriptor.get,
      set: function () {},
      configurable: true,
    });

    // Watch for dynamically injected overlay elements
    _observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (isOverlayAd(node)) node.remove();
        }
      }
    });
    _observer.observe(document.documentElement, { childList: true, subtree: true });

    // Block click-triggered new tabs
    document.addEventListener('click', blockClick, true);
  }

  function deactivate() {
    if (!_active) return;
    _active = false;

    window.open = _open;
    Location.prototype.assign = _assign;
    Location.prototype.replace = _replace;
    Object.defineProperty(Location.prototype, 'href', _hrefDescriptor);

    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    document.removeEventListener('click', blockClick, true);
  }

  // content-isolated.js dispatches this CustomEvent to cross the world boundary
  document.addEventListener('__blocker:setState', (e) => {
    if (e.detail && e.detail.enabled) activate();
    else deactivate();
  });
})();
