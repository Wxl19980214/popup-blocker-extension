(function () {
  if (window.__blockerInstalled) return;
  window.__blockerInstalled = true;

  const _open = window.open.bind(window);
  const _assign = Location.prototype.assign;
  const _replace = Location.prototype.replace;
  // Some frames (about:blank, sandboxed iframes) don't expose this descriptor
  const _hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');

  let _observer = null;
  let _active = false;

  // Override window.open immediately so it respects _active before any page JS runs
  window.open = function (...args) {
    if (_active) return null;
    return _open.apply(this, args);
  };

  function isOverlayAd(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
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

  function shouldBlock(link) {
    if (!link || typeof link.getAttribute !== 'function') return false;
    const href = (link.getAttribute('href') || '').trim();
    const target = link.getAttribute('target') || '';
    return (
      target === '_blank' ||
      href.toLowerCase().startsWith('javascript:') ||
      link.hasAttribute('download')
    );
  }

  function blockClick(e) {
    // e.target can be null or a non-Element node (text node, SVG) in some frames
    if (!e.target || typeof e.target.closest !== 'function') return;
    const link = e.target.closest('a');
    if (shouldBlock(link)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function blockMousedown(e) {
    if (!e.target || typeof e.target.closest !== 'function') return;
    const link = e.target.closest('a');
    if (shouldBlock(link)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function activate() {
    if (_active) return;
    _active = true;

    Location.prototype.assign = function () {};
    Location.prototype.replace = function () {};
    // Only redefine href if we have a valid descriptor (not available in all frames)
    if (_hrefDescriptor) {
      Object.defineProperty(Location.prototype, 'href', {
        get: _hrefDescriptor.get,
        set: function () {},
        configurable: true,
      });
    }

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

    Location.prototype.assign = _assign;
    Location.prototype.replace = _replace;
    if (_hrefDescriptor) {
      try {
        Object.defineProperty(Location.prototype, 'href', _hrefDescriptor);
      } catch (e) {}
    }

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
