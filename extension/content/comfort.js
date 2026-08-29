(() => {
  'use strict';
  const logic = globalThis.QuietBrowseComfort;
  const WHEEL_NATIVE = 'input,textarea,select,[contenteditable],video,audio,canvas,iframe,[data-qb-native-scroll]';
  const WHEEL_WIDGET = '[role="application"],[role="grid"],[role="slider"],[role="spinbutton"],[role="combobox"],[role="listbox"]';
  const KEY_NATIVE = `${WHEEL_NATIVE},${WHEEL_WIDGET},button,a,[role="button"],[role="menu"],[role="tablist"],[role="tree"],[role="radiogroup"]`;

  function create() {
    let settings = {};
    let running = false;
    let paging = false;
    let toolbar = null;
    let previousButton, nextButton, modeButton, targetLabel;
    let selected = null;
    let clock = null;
    let grayLevel = 0;
    let originalPagingAttribute = null;
    const originalTargets = new Map();
    const rootStyles = new Map();
    let baseFilter = '';
    const gate = logic.createWheelGate();
    const root = () => document.scrollingElement || document.documentElement;

    function restoreAttribute(element, name, value) {
      if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
    }
    function ownRootStyle(property, value) {
      const style = document.documentElement.style;
      if (!rootStyles.has(property)) rootStyles.set(property, { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) });
      style.setProperty(property, value, 'important');
      rootStyles.get(property).applied = style.getPropertyValue(property);
    }
    function clearGray() {
      const style = document.documentElement.style;
      // Restore the filter before transitions, so returning to color is immediate too.
      for (const property of ['filter', 'transition']) {
        const old = rootStyles.get(property);
        if (!old) continue;
        if (style.getPropertyValue(property) !== old.applied || style.getPropertyPriority(property) !== 'important') continue;
        if (old.value) style.setProperty(property, old.value, old.priority); else style.removeProperty(property);
        if (property === 'filter') getComputedStyle(document.documentElement).filter;
      }
      rootStyles.clear(); baseFilter = ''; grayLevel = 0;
    }
    function tick(now = new Date()) {
      clearTimeout(clock); clock = null;
      if (!running) return;
      const level = logic.grayscaleAt(settings.grayscale, now);
      if (level !== grayLevel) {
        if (level === 0) clearGray();
        else {
          if (!rootStyles.size) {
            const existing = getComputedStyle(document.documentElement).filter;
            baseFilter = existing === 'none' ? '' : `${existing} `;
          }
          // Filtering the document root avoids changing the containing block of fixed children.
          ownRootStyle('transition', 'none');
          ownRootStyle('filter', `${baseFilter}grayscale(${level}%)`);
          grayLevel = level;
        }
      }
      if (settings.grayscale?.enabled && settings.grayscale.scheduled) {
        clock = setTimeout(() => tick(), 60000 - Date.now() % 60000 + 25);
      }
    }
    function wake() { tick(); }

    function rootLocked() {
      return [document.documentElement, document.body].filter(Boolean)
        .some(element => /^(hidden|clip)$/.test(getComputedStyle(element).overflowY));
    }
    function scrollable(element) {
      if (!element?.isConnected || !element.getBoundingClientRect) return false;
      if (element === root()) return !rootLocked() && element.scrollHeight > element.clientHeight + 1;
      return element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1 && /^(auto|scroll|overlay)$/.test(getComputedStyle(element).overflowY);
    }
    function hasRoom(element, direction) {
      return scrollable(element) && (direction < 0 ? element.scrollTop > 1 : element.scrollTop < element.scrollHeight - element.clientHeight - 1);
    }
    function pathFrom(element) {
      const path = [];
      while (element instanceof Element) { path.push(element); element = element.parentElement || element.getRootNode()?.host; }
      return path;
    }
    function portFrom(path, direction = 0) {
      for (const element of path) {
        if (!(element instanceof Element) || !scrollable(element)) continue;
        if (!direction || hasRoom(element, direction)) return element;
        if (/^(contain|none)$/.test(getComputedStyle(element).overscrollBehaviorY)) return element;
      }
      return scrollable(root()) ? root() : null;
    }
    function currentPort() {
      if (selected?.isConnected && scrollable(selected)) {
        const rect = selected.getBoundingClientRect();
        if (selected === root() || (rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth)) return selected;
      }
      if (scrollable(root())) return root();
      const center = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return portFrom(pathFrom(center));
    }
    function markTarget(port) {
      if (!originalTargets.has(port)) originalTargets.set(port, port.getAttribute('data-qb-page-target'));
      port.setAttribute('data-qb-page-target', '');
    }
    function occlusion(bounds) {
      const { top: start, bottom: end, left, width } = bounds;
      const height = end - start;
      function edge(y, top) {
        const samples = [0.25, 0.5, 0.75].map(x => {
          let covered = 0;
          for (const element of document.elementsFromPoint(left + width * x, y)) {
            const ancestors = pathFrom(element);
            if (ancestors.some(ancestor => ancestor.hasAttribute('data-qb-comfort'))) continue;
            for (const ancestor of ancestors) {
              const style = getComputedStyle(ancestor), rect = ancestor.getBoundingClientRect();
              if (!['fixed', 'sticky'].includes(style.position) || rect.height > height * 0.45 || rect.width < width * 0.5) continue;
              if (top && rect.top <= start + 4) covered = Math.max(covered, rect.bottom - start);
              if (!top && rect.bottom >= end - 4) covered = Math.max(covered, end - rect.top);
            }
          }
          return covered;
        }).sort((a, b) => a - b);
        return samples[1];
      }
      return Math.min(96, height * 0.12, Math.max(edge(start + 3, true), edge(end - 3, false)));
    }
    function move(direction, port = currentPort()) {
      if (!paging || !port || !hasRoom(port, direction)) { updateToolbar(); return false; }
      selected = port; markTarget(port);
      const rect = port.getBoundingClientRect();
      const bounds = port === root() ? { top: 0, bottom: innerHeight, left: 0, width: innerWidth }
        : { top: Math.max(rect.top, 0), bottom: Math.min(rect.bottom, innerHeight), left: Math.max(rect.left, 0), width: Math.min(rect.right, innerWidth) - Math.max(rect.left, 0) };
      const step = logic.pageDistance(Math.max(1, bounds.bottom - bounds.top), occlusion(bounds));
      const top = Math.min(port.scrollHeight - port.clientHeight, Math.max(0, port.scrollTop + direction * step));
      port.scrollTo({ top, left: port.scrollLeft, behavior: 'instant' });
      updateToolbar();
      return true;
    }
    function inToolbar(path) { return path.some(element => element instanceof Element && element.hasAttribute('data-qb-comfort')); }
    function nativeTarget(path, selector) { return path.some(element => element instanceof Element && element.matches(selector)); }
    function nativeWheelTarget(path) {
      if (nativeTarget(path, WHEEL_NATIVE)) return true;
      // Broad ARIA application/grid wrappers are common around whole feeds. Preserve
      // their native wheel behavior only while the widget itself owns keyboard focus.
      const active = document.activeElement;
      return path.some(element => element instanceof Element && element.matches(WHEEL_WIDGET) &&
        (element === active || (active instanceof Element && element.contains(active))));
    }
    function onWheel(event) {
      if (!paging || !event.cancelable || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
      const path = event.composedPath();
      if (inToolbar(path) || nativeWheelTarget(path)) return;
      const direction = Math.sign(event.deltaY), port = portFrom(path, direction);
      if (!port) return;
      event.preventDefault(); event.stopPropagation();
      selected = port;
      if (gate.take(event.deltaY, performance.now(), event.deltaMode)) move(direction, port);
    }
    function onKey(event) {
      if (!paging || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const path = event.composedPath();
      if (inToolbar(path) || nativeTarget(path, KEY_NATIVE)) return;
      const direction = ['PageDown', 'ArrowDown'].includes(event.key) ? 1 : ['PageUp', 'ArrowUp'].includes(event.key) ? -1 : event.key === ' ' ? (event.shiftKey ? -1 : 1) : 0;
      if (!direction) return;
      const nested = path.find(element => element instanceof Element && element !== root() && scrollable(element));
      const port = nested ? portFrom(path, direction) : currentPort();
      if (!port) return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) move(direction, port);
    }
    function selectTarget(event) {
      if (!paging || inToolbar(event.composedPath())) return;
      selected = portFrom(event.composedPath()); updateToolbar();
    }
    function updateToolbar() {
      if (!toolbar) return;
      const port = currentPort();
      previousButton.disabled = !paging || !port || !hasRoom(port, -1);
      nextButton.disabled = !paging || !port || !hasRoom(port, 1);
      targetLabel.textContent = paging ? (port && port !== root() ? 'Panel' : 'Page') : 'Normal scroll';
      modeButton.textContent = paging ? 'Normal scroll' : 'Resume pages';
      modeButton.setAttribute('aria-label', paging ? 'Use normal scrolling for this page' : 'Resume instant page navigation');
    }
    function sync() {
      if (!running) return;
      for (const [port, original] of originalTargets) {
        if (!port.isConnected) { restoreAttribute(port, 'data-qb-page-target', original); originalTargets.delete(port); }
      }
      if (toolbar && !toolbar.isConnected) (document.body || document.documentElement).append(toolbar);
      updateToolbar();
    }
    function setPaging(value) {
      paging = value; gate.reset();
      if (paging) document.documentElement.setAttribute('data-qb-paging', 'on');
      else {
        restoreAttribute(document.documentElement, 'data-qb-paging', originalPagingAttribute);
        for (const [port, original] of originalTargets) restoreAttribute(port, 'data-qb-page-target', original);
        originalTargets.clear();
      }
      updateToolbar();
    }
    function buildToolbar() {
      toolbar = document.createElement('aside'); toolbar.setAttribute('data-qb-comfort', '');
      toolbar.setAttribute('aria-label', 'Quiet Browse page navigation');
      toolbar.style.cssText = 'all:initial;position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483646!important;max-width:calc(100vw - 24px);';
      // Style isolation, not a security boundary; keep ordinary DOM tooling usable.
      const shadow = toolbar.attachShadow({ mode: 'open' });
      const css = new CSSStyleSheet();
      css.replaceSync('.bar{font:13px/1.4 system-ui,sans-serif;color-scheme:light dark;display:flex;align-items:center;gap:5px;padding:6px;border:1px solid #6a8074;border-radius:10px;background:light-dark(#f4f7ef,#183027);color:light-dark(#243b30,#eaf3e7);box-shadow:0 2px 8px #0002}button{font:inherit;color:inherit;background:transparent;border:1px solid #7a9081;border-radius:6px;padding:7px;cursor:pointer;min-width:34px;min-height:34px}button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:3px solid #80bfa5;outline-offset:2px}.label{font-size:11px;padding:0 4px;max-width:75px}.arrow{font-size:18px}@media(pointer:coarse){button{min-height:44px;min-width:44px}}');
      shadow.adoptedStyleSheets = [css];
      const bar = document.createElement('div'); bar.className = 'bar';
      function button(label, text, click) {
        const element = document.createElement('button'); element.type = 'button'; element.setAttribute('aria-label', label); element.textContent = text; element.addEventListener('click', click); return element;
      }
      previousButton = button('Previous screen', '↑', () => move(-1)); previousButton.className = 'arrow';
      nextButton = button('Next screen', '↓', () => move(1)); nextButton.className = 'arrow';
      targetLabel = document.createElement('span'); targetLabel.className = 'label'; targetLabel.textContent = 'Page';
      modeButton = button('Use normal scrolling for this page', 'Normal scroll', () => setPaging(!paging));
      bar.append(previousButton, nextButton, targetLabel, modeButton); shadow.append(bar);
      (document.body || document.documentElement).append(toolbar);
    }
    function start(value) {
      stop(); running = true; settings = value || {};
      tick();
      document.addEventListener('visibilitychange', wake);
      window.addEventListener('focus', wake);
      if (!settings.pageMode) return;
      originalPagingAttribute = document.documentElement.getAttribute('data-qb-paging');
      selected = rootLocked() ? null : root(); buildToolbar(); setPaging(true);
      window.addEventListener('wheel', onWheel, { capture: true, passive: false });
      window.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', selectTarget, true);
      document.addEventListener('scroll', updateToolbar, true);
      window.addEventListener('resize', updateToolbar);
    }
    function stop() {
      running = false; clearTimeout(clock); clock = null;
      document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake);
      window.removeEventListener('wheel', onWheel, true); window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', selectTarget, true); document.removeEventListener('scroll', updateToolbar, true);
      window.removeEventListener('resize', updateToolbar);
      if (toolbar) setPaging(false);
      toolbar?.remove(); toolbar = null; selected = null; paging = false;
      clearGray(); gate.reset();
    }
    return { start, stop, tick, move, sync, status: () => ({ pageMode: paging, pagingPaused: !!toolbar && !paging, grayscale: grayLevel }) };
  }
  Object.defineProperty(globalThis, 'QuietBrowsePageComfort', { value: Object.freeze({ create }), configurable: true });
})();
