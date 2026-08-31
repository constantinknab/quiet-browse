(() => {
  'use strict';
  const ROOT = 'data-qb-social';
  const HIDDEN = 'data-qb-social-hidden';
  const ROUTE = 'data-qb-social-route';

  function platform(hostname) {
    const host = hostname.replace(/^www\./, '');
    if (host === 'instagram.com') return 'instagram';
    if (host === 'facebook.com') return 'facebook';
    if (host === 'tiktok.com') return 'tiktok';
    return null;
  }

  function normalizedPath(pathname) {
    return pathname.replace(/\/+$/, '') || '/';
  }

  function routeFor(name, pathname) {
    const path = normalizedPath(pathname);
    if (name === 'instagram') {
      if (/^\/direct(?:\/|$)/.test(path)) return 'messages';
      if (/^\/(?:p|reel|tv|stories)\//.test(path)) return 'direct';
      if (/^\/reels(?:\/|$)/.test(path)) return 'short';
      if (/^\/explore(?:\/|$)/.test(path)) return 'explore';
      return path === '/' ? 'home' : 'other';
    }
    if (name === 'facebook') {
      if (/^\/(?:messages|messenger)(?:\/|$)/.test(path)) return 'messages';
      if (/^\/reel\/[^/]+/.test(path) || /^\/(?:share|permalink)\//.test(path) || /\/posts\//.test(path)) return 'direct';
      if (/^\/(?:reels|watch)(?:\/|$)/.test(path)) return 'short';
      if (/^\/(?:explore|discover)(?:\/|$)/.test(path)) return 'explore';
      return path === '/' || path === '/home.php' ? 'home' : 'other';
    }
    if (name === 'tiktok') {
      if (/^\/messages(?:\/|$)/.test(path)) return 'messages';
      if (/^\/@[^/]+\/video\/[^/]+/.test(path)) return 'direct';
      if (/^\/(?:foryou|following|live)(?:\/|$)/.test(path)) return 'short';
      if (/^\/(?:explore|discover)(?:\/|$)/.test(path)) return 'explore';
      // TikTok serves its vertically scrollable For You stream at `/`.
      return path === '/' ? 'short' : 'other';
    }
    return 'other';
  }

  function routeCategories(name, pathname) {
    const route = routeFor(name, pathname);
    // The landing stream is both TikTok's home feed and a short-video feed.
    // Either independent control must be able to stop it.
    if (name === 'tiktok' && normalizedPath(pathname) === '/') return ['short', 'home'];
    return [route];
  }

  function categoryForLink(name, pathname) {
    const path = normalizedPath(pathname);
    if (/^\/stories(?:\/|$)/.test(path)) return 'stories';
    if (name === 'instagram' && /^\/reels(?:\/|$)/.test(path)) return 'short';
    if (name === 'facebook' && /^\/(?:reels|watch)(?:\/|$)/.test(path)) return 'short';
    if (name === 'tiktok' && (path === '/' || /^\/(?:foryou|following|live)(?:\/|$)/.test(path))) return 'short';
    if (/^\/(?:explore|discover)(?:\/|$)/.test(path)) return 'explore';
    return null;
  }

  function create() {
    const name = platform(location.hostname);
    const changed = new Map();
    let originalRoot = null;
    let originalRoute = null;
    let markedRoot = false;
    let notice = null;

    function navTarget(anchor) {
      return anchor.closest('li,[role="listitem"]') || anchor.closest('[role="tab"],[role="menuitem"]') || anchor;
    }
    function want(map, element, category) {
      if (element && element.isConnected && element !== document.body && element !== document.documentElement) map.set(element, category);
    }
    function reconcile(desired) {
      for (const [element, original] of changed) {
        if (desired.has(element) && element.isConnected) continue;
        if (original === null) element.removeAttribute(HIDDEN); else element.setAttribute(HIDDEN, original);
        changed.delete(element);
      }
      for (const [element, category] of desired) {
        if (!changed.has(element)) changed.set(element, element.getAttribute(HIDDEN));
        if (element.getAttribute(HIDDEN) !== category) element.setAttribute(HIDDEN, category);
      }
    }
    function surface(category) {
      const fixture = document.querySelector(`[data-qb-social-surface="${category}"]`);
      if (fixture) return fixture;
      if (category === 'stories') {
        return document.querySelector('[aria-label*="Stories" i],[data-e2e*="story" i]');
      }
      if (name === 'facebook') return document.querySelector('[role="feed"]');
      if (name === 'tiktok') return document.querySelector('[data-e2e="recommend-list"],[data-e2e="explore-item-list"],main');
      if (name === 'instagram') return document.querySelector('main');
      return null;
    }
    function safeSurface(element) {
      return element && element.isConnected && !element.matches('html,body,main,[role="main"]') ? element : null;
    }
    function storySurfaces() {
      const found = new Set();
      document.querySelectorAll('[aria-label*="Stories" i],[data-e2e*="story" i]').forEach(element => {
        const target = safeSurface(element.closest('[role="region"],[role="list"],section') || element);
        if (target) found.add(target);
      });
      Array.from(document.querySelectorAll('a[href]')).slice(0, 800).forEach(anchor => {
        try {
          const url = new URL(anchor.getAttribute('href'), location.href);
          if (url.hostname !== location.hostname || categoryForLink(name, url.pathname) !== 'stories') return;
          const item = safeSurface(navTarget(anchor));
          if (item) found.add(item);
          const list = safeSurface(anchor.closest('[role="list"],[aria-label*="Stories" i]'));
          if (list) found.add(list);
        } catch { /* Malformed page URL. */ }
      });
      return found;
    }
    function hasFollowAction(element) {
      return [...element.querySelectorAll('button,[role="button"]')].some(control => /^follow(?: back)?$/i.test(control.textContent.trim()));
    }
    function suggestionSurfaces() {
      const found = new Set();
      document.querySelectorAll('[aria-label*="suggest" i],[data-testid*="suggest" i]').forEach(element => {
        const target = safeSurface(element.closest('[role="region"],section,aside') || element);
        if (target) found.add(target);
      });
      for (const heading of Array.from(document.querySelectorAll('h1,h2,h3,h4,span,div')).slice(0, 1200)) {
        if (heading.childElementCount > 1 || !/^(?:suggested|suggestions) for you$/i.test(heading.textContent.trim())) continue;
        let candidate = heading.parentElement;
        for (let depth = 0; candidate && depth < 6; depth += 1, candidate = candidate.parentElement) {
          if (!safeSurface(candidate)) break;
          if (hasFollowAction(candidate)) { found.add(candidate); break; }
        }
      }
      return found;
    }
    function showNotice(target, route) {
      if (!target?.parentElement || !['home', 'short', 'explore'].includes(route)) { notice?.remove(); notice = null; return; }
      if (!notice) {
        notice = document.createElement('aside');
        notice.setAttribute('data-qb-social-notice', '');
        notice.setAttribute('role', 'status');
      }
      const labels = { home: 'Home feed', short: 'Short-video feed', explore: 'Explore feed' };
      const message = `${labels[route]} hidden by Quiet Browse. Messages, profiles, and direct links still work.`;
      if (notice.textContent !== message) notice.textContent = message;
      if (notice.parentElement !== target.parentElement || notice.nextSibling !== target) target.before(notice);
    }

    function sync(settings = {}, now = new Date()) {
      if (!name) return;
      const route = routeFor(name, location.pathname);
      const currentCategories = routeCategories(name, location.pathname);
      const desired = new Map();
      const at = key => globalThis.QuietBrowseComfort.settingAt(settings[key], settings.socialSchedules?.[key], now);
      const enabled = {
        stories: at('socialStories'),
        suggestions: at('socialSuggestions'),
        short: at('socialShortVideo'),
        explore: at('socialExplore'),
        home: at('socialHomeFeed'),
      };
      for (const anchor of Array.from(document.querySelectorAll('a[href]')).slice(0, 800)) {
        try {
          const url = new URL(anchor.getAttribute('href'), location.href);
          if (url.hostname !== location.hostname) continue;
          const categories = name === 'tiktok' && normalizedPath(url.pathname) === '/'
            ? routeCategories(name, url.pathname)
            : [categoryForLink(name, url.pathname)];
          const category = categories.find(item => item && enabled[item]);
          if (route === 'direct' && normalizedPath(url.pathname) === normalizedPath(location.pathname)) continue;
          if (category) want(desired, navTarget(anchor), category);
        } catch { /* Malformed page URL. */ }
      }
      for (const category of ['stories', 'suggestions', 'short', 'explore']) {
        if (enabled[category]) document.querySelectorAll(`[data-qb-social-surface="${category}"]`).forEach(element => want(desired, element, category));
      }
      if (enabled.stories && !['direct', 'messages'].includes(route)) storySurfaces().forEach(element => want(desired, element, 'stories'));
      if (enabled.suggestions && currentCategories.includes('home')) suggestionSurfaces().forEach(element => want(desired, element, 'suggestions'));
      let routedTarget = null;
      const blockedRoute = currentCategories.find(category => enabled[category] && ['home', 'short', 'explore'].includes(category));
      if (blockedRoute) {
        routedTarget = surface(blockedRoute);
        want(desired, routedTarget, blockedRoute);
      }
      // Direct items and conversations stay usable; only an explicitly marked continuation feed is removed.
      if (['direct', 'messages'].includes(route)) {
        document.querySelectorAll('[data-qb-social-surface="recommendations"]').forEach(element => want(desired, element, 'recommendations'));
      }
      reconcile(desired);
      showNotice(routedTarget, blockedRoute);
      if (!markedRoot) {
        originalRoot = document.documentElement.getAttribute(ROOT);
        originalRoute = document.documentElement.getAttribute(ROUTE);
        markedRoot = true;
      }
      document.documentElement.setAttribute(ROOT, name);
      document.documentElement.setAttribute(ROUTE, route);
    }

    function stop() {
      reconcile(new Map());
      notice?.remove(); notice = null;
      if (markedRoot) {
        if (originalRoot === null) document.documentElement.removeAttribute(ROOT); else document.documentElement.setAttribute(ROOT, originalRoot);
        if (originalRoute === null) document.documentElement.removeAttribute(ROUTE); else document.documentElement.setAttribute(ROUTE, originalRoute);
      }
      markedRoot = false;
    }
    return { sync, stop, status: () => ({ platform: name, hidden: changed.size, route: routeFor(name, location.pathname) }) };
  }

  globalThis.QuietBrowseSocial = { create, platform, routeFor, routeCategories, categoryForLink };
})();
