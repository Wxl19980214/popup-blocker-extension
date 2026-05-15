(function () {
  // Guard against double-injection (e.g. when popup injects into an already-loaded tab)
  if (window.__blockerInstalled) return;
  window.__blockerInstalled = true;

  const _open = window.open.bind(window);
  const _assign = Location.prototype.assign;
  const _replace = Location.prototype.replace;
  const _hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');

  let _observer = null;
  let _active = false;

  // Override window.open immediately at script load (before any page JS runs).
  // Checks _active so it passes through when blocking is off.
  window.open = function (...args) {
    if (_active) return null;
    return _open.apply(this, args);
  };

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
    if (el.querySelector('video')) return false;
    return true;
  }

  // Blocks _blank links, javascript: hrefs, and download-attribute links
  // (streaming sites use <a download> to force fake installer downloads)
  function shouldBlock(link) {
    if (!link) return false;
    const href = (link.getAttribute('href') || '').trim();
    const target = link.getAttribute('target') || '';
    return (
      target === '_blank' ||
      href.toLowerCase().startsWith('javascript:') ||
      link.hasAttribute('download')
    );
  }

  function blockClick(e) {
    const link = e.target.closest('a');
    if (shouldBlock(link)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  // Also block mousedown — streaming sites often trigger window.open on mousedown
  // (fires before click, so click-only blocking misses these)
  function blockMousedown(e) {
    const link = e.target.closest('a');
    if (shouldBlock(link)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function activate() {
    if (_active) return;
    _active = true;
    // window.open is already overridden above — _active=true is all it needs

    Location.prototype.assign = function () {};
    Location.prototype.replace = function () {};
    Object.defineProperty(Location.prototype, 'href', {
      get: _hrefDescriptor.get,
      set: function () {},
      configurable: true,
    });

    _observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (isOverlayAd(node) && node.parentNode) node.remove();
        }
      }
    });
    _observer.observe(document.documentElement, { childList: true, subtree: true });

    document.querySelectorAll('body > *').forEach((el) => {
      if (isOverlayAd(el)) el.remove();
    });

    document.addEventListener('click', blockClick, true);
    document.addEventListener('mousedown', blockMousedown, true);
  }

  function deactivate() {
    if (!_active) return;
    _active = false;
    // window.open override stays but _active=false makes it pass through to original

    Location.prototype.assign = _assign;
    Location.prototype.replace = _replace;
    try {
      Object.defineProperty(Location.prototype, 'href', _hrefDescriptor);
    } catch (e) {}

    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    document.removeEventListener('click', blockClick, true);
    document.removeEventListener('mousedown', blockMousedown, true);
  }

  document.addEventListener('__blocker:setState', (e) => {
    if (e.detail && e.detail.enabled) activate();
    else deactivate();
  });
})();
