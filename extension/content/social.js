// Social-site surface controller.
// Route checks keep messages and direct links usable, while DOM classification hides
// only the independently selected Stories, recommendations, short-video, discovery,
// and home-feed surfaces. Every hidden element is restored when its setting turns off.
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
      if (
        /^\/reel\/[^/]+/.test(path) ||
        /^\/(?:share|permalink)\//.test(path) ||
        /\/posts\//.test(path)
      )
        return 'direct';
      if (/^\/(?:reels|watch)(?:\/|$)/.test(path)) return 'short';
      if (/^\/(?:explore|discover)(?:\/|$)/.test(path)) return 'explore';
      return path === '/' || path === '/home.php' ? 'home' : 'other';
    }
    if (name === 'tiktok') {
      if (/^\/messages(?:\/|$)/.test(path)) return 'messages';
      if (/^\/@[^/]+\/video\/[^/]+/.test(path)) return 'direct';
      if (/^\/(?:foryou|following|live)(?:\/|$)/.test(path)) return 'short';
      if (/^\/(?:explore|discover)(?:\/|$)/.test(path)) return 'explore';
      // The root stays a usable landing page. Its inner feed has a separate setting.
      return path === '/' ? 'home' : 'other';
    }
    return 'other';
  }

  function routeCategories(name, pathname) {
    return [routeFor(name, pathname)];
  }

  function categoryForLink(name, pathname) {
    const path = normalizedPath(pathname);
    if (/^\/stories(?:\/|$)/.test(path)) return 'stories';
    if (name === 'instagram' && /^\/reels(?:\/|$)/.test(path)) return 'short';
    if (name === 'facebook' && /^\/(?:reels|watch)(?:\/|$)/.test(path)) return 'short';
    if (name === 'tiktok' && /^\/(?:foryou|following|live)(?:\/|$)/.test(path)) return 'short';
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
      return (
        anchor.closest('li,[role="listitem"]') ||
        anchor.closest('[role="tab"],[role="menuitem"]') ||
        anchor
      );
    }
    function want(map, element, category) {
      if (
        element &&
        element.isConnected &&
        element !== document.body &&
        element !== document.documentElement
      )
        map.set(element, category);
    }
    function reconcile(desired) {
      for (const [element, original] of changed) {
        if (desired.has(element) && element.isConnected) continue;
        if (original === null) element.removeAttribute(HIDDEN);
        else element.setAttribute(HIDDEN, original);
        changed.delete(element);
      }
      for (const [element, category] of desired) {
        if (!changed.has(element)) changed.set(element, element.getAttribute(HIDDEN));
        if (element.getAttribute(HIDDEN) !== category) element.setAttribute(HIDDEN, category);
      }
    }
    function explicitSurfaces(category) {
      return new Set(document.querySelectorAll(`[data-qb-social-surface="${category}"]`));
    }
    function safeSurface(element) {
      return element && element.isConnected && !element.matches('html,body,main,[role="main"]')
        ? element
        : null;
    }
    function instagramStoryCarouselSurfaces() {
      const found = new Set();
      if (name !== 'instagram') return found;
      const main = document.querySelector('main,[role="main"]');
      if (!main) return found;
      const controls = Array.from(
        main.querySelectorAll('button,[role="button"],svg[aria-label]'),
      ).slice(0, 600);
      for (const control of controls) {
        if (control.closest('article,[role="article"]')) continue;
        const label = (
          control.getAttribute('aria-label') ||
          control.getAttribute('title') ||
          control.textContent ||
          ''
        ).trim();
        if (!/^(?:next|previous)$/i.test(label)) continue;
        let candidate = control.parentElement;
        for (
          let depth = 0;
          candidate && candidate !== main && depth < 8;
          depth += 1, candidate = candidate.parentElement
        ) {
          if (!safeSurface(candidate)) break;
          const images = Array.from(candidate.querySelectorAll('img')).filter(
            (image) => !image.closest('article,[role="article"]'),
          );
          const items = candidate.querySelectorAll(
            'button,[role="button"],a,[role="link"],[role="listitem"]',
          );
          if (images.length >= 3 && items.length >= 3) {
            found.add(candidate);
            break;
          }
        }
      }
      return found;
    }
    function storySurfaces() {
      const found = new Set();
      document
        .querySelectorAll('[aria-label*="Stories" i],[data-e2e*="story" i]')
        .forEach((element) => {
          const target = safeSurface(
            element.closest('[role="region"],[role="list"],section') || element,
          );
          if (target) found.add(target);
        });
      Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 800)
        .forEach((anchor) => {
          try {
            const url = new URL(anchor.getAttribute('href'), location.href);
            if (
              url.hostname !== location.hostname ||
              categoryForLink(name, url.pathname) !== 'stories'
            )
              return;
            const item = safeSurface(navTarget(anchor));
            if (item) found.add(item);
            const list = safeSurface(anchor.closest('[role="list"],[aria-label*="Stories" i]'));
            if (list) found.add(list);
          } catch {
            /* Malformed page URL. */
          }
        });
      instagramStoryCarouselSurfaces().forEach((element) => found.add(element));
      return found;
    }
    function hasFollowAction(element) {
      return [...element.querySelectorAll('button,[role="button"]')].some((control) =>
        /^follow(?: back)?$/i.test(control.textContent.trim()),
      );
    }
    function suggestionSurfaces() {
      const found = new Set();
      document
        .querySelectorAll('[aria-label*="suggest" i],[data-testid*="suggest" i]')
        .forEach((element) => {
          const target = safeSurface(element.closest('[role="region"],section,aside') || element);
          if (target) found.add(target);
        });
      for (const heading of Array.from(document.querySelectorAll('h1,h2,h3,h4,span,div')).slice(
        0,
        1200,
      )) {
        if (
          heading.childElementCount > 1 ||
          !/^(?:suggested|suggestions) for you$/i.test(heading.textContent.trim())
        )
          continue;
        let candidate = heading.parentElement;
        for (
          let depth = 0;
          candidate && depth < 6;
          depth += 1, candidate = candidate.parentElement
        ) {
          if (!safeSurface(candidate)) break;
          if (hasFollowAction(candidate)) {
            found.add(candidate);
            break;
          }
        }
      }
      return found;
    }
    function ownedByIndependentSurface(element, independentSurfaces) {
      return independentSurfaces.some(
        (surface) => surface === element || surface.contains(element),
      );
    }
    function hasPostEvidence(element) {
      if (!element) return false;
      const hasPostLink = [...element.querySelectorAll('a[href]')].some((anchor) => {
        try {
          return /^\/(?:p|reel|tv)\//.test(
            new URL(anchor.getAttribute('href'), location.href).pathname,
          );
        } catch {
          return false;
        }
      });
      if (hasPostLink || element.querySelector('video')) return true;
      return (
        !!element.querySelector('img') &&
        [...element.querySelectorAll('button,[role="button"]')].some((control) =>
          /^(?:like|comment|share|save)(?:\b|$)/i.test(
            (control.getAttribute('aria-label') || control.textContent || '').trim(),
          ),
        )
      );
    }
    function postSurfacesWithin(container, independentSurfaces = []) {
      const found = new Set();
      if (!container) return found;
      const articles = Array.from(container.querySelectorAll('article,[role="article"]')).slice(
        0,
        500,
      );
      articles.forEach((article) => {
        if (ownedByIndependentSurface(article, independentSurfaces) || !hasPostEvidence(article))
          return;
        const target = safeSurface(article);
        if (target) found.add(target);
      });
      return found;
    }
    function instagramPostSurfaces() {
      const found = new Set();
      const main = document.querySelector('main,[role="main"]');
      const independentSurfaces = [...storySurfaces(), ...suggestionSurfaces()];
      postSurfacesWithin(main, independentSurfaces).forEach((element) => found.add(element));
      if (!main) return found;
      for (const anchor of Array.from(main.querySelectorAll('a[href]')).slice(0, 1000)) {
        let path;
        try {
          path = new URL(anchor.getAttribute('href'), location.href).pathname;
        } catch {
          continue;
        }
        if (
          !/^\/(?:p|reel|tv)\//.test(path) ||
          independentSurfaces.some((surface) => surface.contains(anchor))
        )
          continue;
        let candidate = anchor.closest('article,[role="article"]');
        if (!candidate) {
          candidate = anchor.parentElement;
          for (let depth = 0; candidate && candidate !== main && depth < 7; depth += 1) {
            const postLinks = candidate.querySelectorAll(
              'a[href^="/p/"],a[href^="/reel/"],a[href^="/tv/"]',
            );
            if (postLinks.length === 1 && candidate.querySelector('img,video')) break;
            candidate = candidate.parentElement;
          }
        }
        const target = safeSurface(candidate);
        if (target) found.add(target);
      }
      return found;
    }
    function homeFeedSurfaces() {
      const found = explicitSurfaces('home');
      if (found.size) return found;
      const feed = document.querySelector('[role="feed"]');
      if (name === 'instagram') {
        instagramPostSurfaces().forEach((element) => found.add(element));
        return found;
      }
      if (name === 'facebook') {
        const posts = postSurfacesWithin(feed);
        if (posts.size) posts.forEach((element) => found.add(element));
        else if (safeSurface(feed)) found.add(feed);
      }
      return found;
    }
    function tiktokFeedContainer() {
      const explicit = document.querySelector('[data-qb-social-surface="tiktokLanding"]');
      if (explicit) return safeSurface(explicit);
      const isScrollableFeed = (candidate) => {
        if (!safeSurface(candidate)) return false;
        const itemCount = candidate.querySelectorAll(
          '[data-e2e="recommend-list-item-container"],article',
        ).length;
        const style = getComputedStyle(candidate);
        return (
          itemCount >= 2 &&
          (/^(?:auto|scroll)$/.test(style.overflowY) ||
            candidate.scrollHeight > candidate.clientHeight + 1)
        );
      };
      // TikTok currently gives its primary vertical stream this stable ID. Check it
      // before generic recommendation modules because document order can put a
      // smaller sidebar module first.
      const primary = document.querySelector('#column-list-container');
      if (isScrollableFeed(primary)) return primary;
      for (const candidate of document.querySelectorAll('[data-e2e="recommend-list"]')) {
        if (isScrollableFeed(candidate)) return candidate;
      }
      const item = document.querySelector('[data-e2e="recommend-list-item-container"]');
      let candidate = item?.parentElement;
      for (let depth = 0; candidate && depth < 6; depth += 1, candidate = candidate.parentElement) {
        if (!safeSurface(candidate)) break;
        const itemCount = candidate.querySelectorAll(
          '[data-e2e="recommend-list-item-container"]',
        ).length;
        const style = getComputedStyle(candidate);
        const scrollable =
          /^(?:auto|scroll)$/.test(style.overflowY) ||
          candidate.scrollHeight > candidate.clientHeight + 1;
        if (itemCount >= 2 && scrollable) return candidate;
      }
      return null;
    }
    function instagramRoutedFeedSurfaces(route) {
      const found = new Set();
      const feed = safeSurface(document.querySelector('[role="feed"]'));
      if (feed) found.add(feed);
      const main = document.querySelector('main,[role="main"]');
      if (!main) return found;
      for (const child of main.children) {
        const target = safeSurface(child);
        if (!target) continue;
        if (route === 'short') {
          const label = child.getAttribute('aria-label') || '';
          const hasShortVideo =
            !!child.querySelector('video') ||
            !!child.querySelector('[role="group"][aria-label*="video player" i]');
          if (hasShortVideo && !/navigation controls/i.test(label)) found.add(target);
          continue;
        }
        const discoveryLinks = child.querySelectorAll(
          'a[href^="/p/"],a[href^="/reel/"],a[href^="/reels/"],a[href^="/popular/"],a[href^="/explore/"]',
        ).length;
        if (discoveryLinks >= 3) found.add(target);
      }
      return found;
    }
    function routedFeedSurfaces(route) {
      const found = explicitSurfaces(route);
      if (found.size) return found;
      if (name === 'tiktok') {
        const target =
          route === 'explore'
            ? safeSurface(document.querySelector('[data-e2e="explore-item-list"]'))
            : tiktokFeedContainer();
        if (target) found.add(target);
        return found;
      }
      if (name === 'instagram') return instagramRoutedFeedSurfaces(route);
      const feed = safeSurface(document.querySelector('[role="feed"]'));
      if (feed) found.add(feed);
      return found;
    }
    function labeledContinuationSurfaces() {
      const found = explicitSurfaces('recommendations');
      const main = document.querySelector('main,[role="main"]');
      if (!main) return found;
      const labels = Array.from(main.querySelectorAll('h1,h2,h3,h4,span,div')).slice(0, 1600);
      for (const label of labels) {
        if (label.childElementCount > 2) continue;
        const text = label.textContent.replace(/\s+/g, ' ').trim();
        if (
          !/^(?:more posts from\b|see more posts$|suggested posts?$|you might also like$|related videos?$)/i.test(
            text,
          )
        )
          continue;
        let candidate = label.parentElement;
        for (
          let depth = 0;
          candidate && candidate !== main && depth < 6;
          depth += 1, candidate = candidate.parentElement
        ) {
          if (!safeSurface(candidate) || candidate.querySelector('video')) break;
          const continuationLinks = candidate.querySelectorAll(
            'a[href^="/p/"],a[href^="/reel/"],a[href^="/video/"],a[href*="/video/"]',
          ).length;
          if (continuationLinks >= 2) {
            found.add(candidate);
            break;
          }
        }
      }
      return found;
    }
    function showNotice(target, route) {
      if (
        !target?.parentElement ||
        !['home', 'short', 'explore', 'tiktokLanding'].includes(route)
      ) {
        notice?.remove();
        notice = null;
        return;
      }
      if (!notice) {
        notice = document.createElement('aside');
        notice.setAttribute('data-qb-social-notice', '');
        notice.setAttribute('role', 'status');
      }
      const labels = {
        home: 'Home feed',
        short: 'Short-video feed',
        explore: 'Explore feed',
        tiktokLanding: 'TikTok landing feed',
      };
      const message = `${labels[route]} hidden by Quiet Browse. Messages, profiles, and direct links still work.`;
      if (notice.textContent !== message) notice.textContent = message;
      if (notice.parentElement !== target.parentElement || notice.nextSibling !== target)
        target.before(notice);
    }

    function sync(settings = {}, now = new Date()) {
      if (!name) return;
      const route = routeFor(name, location.pathname);
      const desired = new Map();
      const at = (key) =>
        globalThis.QuietBrowseComfort.settingAt(
          settings[key],
          settings.socialSchedules?.[key],
          now,
        );
      const enabled = {
        stories: at('socialStories'),
        suggestions: at('socialSuggestions'),
        short: at('socialShortVideo'),
        explore: at('socialExplore'),
        home: at('socialHomeFeed'),
        tiktokLanding: at('tiktokLandingFeed'),
      };
      for (const anchor of Array.from(document.querySelectorAll('a[href]')).slice(0, 800)) {
        try {
          const url = new URL(anchor.getAttribute('href'), location.href);
          if (url.hostname !== location.hostname) continue;
          const category = categoryForLink(name, url.pathname);
          if (
            route === 'direct' &&
            normalizedPath(url.pathname) === normalizedPath(location.pathname)
          )
            continue;
          if (category && enabled[category]) want(desired, navTarget(anchor), category);
        } catch {
          /* Malformed page URL. */
        }
      }
      for (const category of ['stories', 'suggestions', 'short', 'explore']) {
        if (enabled[category])
          document
            .querySelectorAll(`[data-qb-social-surface="${category}"]`)
            .forEach((element) => want(desired, element, category));
      }
      if (enabled.stories && !['direct', 'messages'].includes(route))
        storySurfaces().forEach((element) => want(desired, element, 'stories'));
      if (enabled.suggestions && route === 'home')
        suggestionSurfaces().forEach((element) => want(desired, element, 'suggestions'));
      let blockedCategory = null;
      let noticeTarget = null;
      if (name === 'tiktok' && route === 'home' && enabled.tiktokLanding) {
        const target = tiktokFeedContainer();
        want(desired, target, 'tiktokLanding');
        blockedCategory = target ? 'tiktokLanding' : null;
        noticeTarget = target;
      } else if (route === 'home' && name !== 'tiktok' && enabled.home) {
        const surfaces = homeFeedSurfaces();
        surfaces.forEach((element) => want(desired, element, 'home'));
        noticeTarget = surfaces.values().next().value || null;
        blockedCategory = noticeTarget ? 'home' : null;
      } else if (['short', 'explore'].includes(route) && enabled[route]) {
        const surfaces = routedFeedSurfaces(route);
        surfaces.forEach((element) => want(desired, element, route));
        noticeTarget = surfaces.values().next().value || null;
        blockedCategory = noticeTarget ? route : null;
      }
      // Direct items and conversations stay usable; only a bounded, separately
      // labeled continuation section is removed.
      if (['direct', 'messages'].includes(route)) {
        labeledContinuationSurfaces().forEach((element) =>
          want(desired, element, 'recommendations'),
        );
      }
      reconcile(desired);
      showNotice(noticeTarget, blockedCategory);
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
      notice?.remove();
      notice = null;
      if (markedRoot) {
        if (originalRoot === null) document.documentElement.removeAttribute(ROOT);
        else document.documentElement.setAttribute(ROOT, originalRoot);
        if (originalRoute === null) document.documentElement.removeAttribute(ROUTE);
        else document.documentElement.setAttribute(ROUTE, originalRoute);
      }
      markedRoot = false;
    }
    return {
      sync,
      stop,
      status: () => ({
        platform: name,
        hidden: changed.size,
        route: routeFor(name, location.pathname),
      }),
    };
  }

  globalThis.QuietBrowseSocial = { create, platform, routeFor, routeCategories, categoryForLink };
})();
