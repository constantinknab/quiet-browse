(() => {
  'use strict';
  const INSTANCE = '__quietBrowseV8';
  const ENGINE_VERSION = 8;
  if (globalThis[INSTANCE]) { globalThis[INSTANCE].refresh(); return; }
  const comfort = globalThis.QuietBrowsePageComfort.create();
  const social = globalThis.QuietBrowseSocial.create();

  let settings = {};
  let policyEnabled = false;
  let paused = false;
  let active = false;
  let covered = false;
  let coverOverride = null;
  let settingsInitialized = false;
  let refreshVersion = 0;
  let timer = null;
  let observer = null;
  let playerObserver = null;
  let observedPlayer = null;
  let appliedMarker = false;
  let cover = null;
  const animations = new Map();
  const choices = new Map();
  const videos = new Map();
  const recommendations = new Map();
  const allowedVideos = new WeakSet();
  const youtube = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(location.hostname);
  const SAFE_PROPERTIES = new Set(['offset', 'computedOffset', 'easing', 'composite', 'transform', 'translate', 'rotate', 'scale', 'opacity', 'filter', 'color', 'backgroundColor', 'backgroundPosition', 'backgroundPositionX', 'backgroundPositionY', 'boxShadow', 'textShadow']);
  const FUNCTIONAL = '[role="progressbar"],[role="status"],[role="alert"],[role="application"],[aria-live]:not([aria-live="off"]),[aria-busy="true"],input,textarea,select,[contenteditable],video,audio,canvas,[data-qb-allow-motion]';
  let originalYouTubeAttribute = null;

  function remember(map, element, attr, value) {
    if (!map.has(element)) map.set(element, element.getAttribute(attr));
    element.setAttribute(attr, value);
  }
  function restoreAttribute(element, name, value) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  function decorative(animation) {
    const effect = animation.effect;
    const target = effect?.target;
    if (!target?.isConnected || !target.closest || target.closest(FUNCTIONAL) || target.matches('html,body')) return false;
    if (typeof CSSAnimation !== 'undefined' && !(animation instanceof CSSAnimation)) return false;
    if (effect.getComputedTiming().iterations !== Infinity) return false;
    if (target === document.activeElement || target.contains(document.activeElement)) return false;
    const descriptor = `${target.id} ${target.getAttribute('class') || ''} ${target.getAttribute('aria-label') || ''}`;
    if (/load|spin|progress|skeleton|shimmer|busy|typing/i.test(descriptor)) return false;
    const recognizable = target.matches('button,a,[role="button"],[aria-hidden="true"]') ||
      /pulse|bounce|blink|flash|confetti|marquee|ticker|float|wiggle|shake|sparkle|attention|promo|badge|background|decor/i.test(descriptor);
    return recognizable && effect.getKeyframes().every(frame => Object.keys(frame).every(key => SAFE_PROPERTIES.has(key)));
  }

  function restoreAnimation(animation, previous) {
    try {
      // A cancelled or replaced animation belongs to the page again: do not resurrect it.
      if (animation.playState !== 'paused' || !animation.effect?.target?.isConnected) return;
      animation.currentTime = previous.time;
      if (previous.state === 'running') animation.play();
    } catch { /* Detached animation or disposed document. */ }
  }

  function scanMotion() {
    if (!settings.motion || !document.getAnimations) return;
    for (const [animation, previous] of animations) {
      if (!decorative(animation) || animation.playState === 'idle' || animation.playState === 'finished') {
        restoreAnimation(animation, previous);
        animations.delete(animation);
      }
    }
    for (const animation of document.getAnimations()) {
      if (animations.has(animation) || animation.playState !== 'running' || !decorative(animation)) continue;
      const previous = { state: animation.playState, time: animation.currentTime };
      try {
        animation.pause();
        // A blinking element must remain legible rather than freeze at opacity zero.
        const frames = animation.effect.getKeyframes();
        const visible = frames.filter(frame => typeof frame.opacity !== 'undefined')
          .sort((a, b) => Number(b.opacity) - Number(a.opacity))[0];
        const timing = animation.effect.getTiming();
        if (visible && Number.isFinite(timing.duration)) {
          animation.currentTime = Number(timing.delay || 0) + timing.duration * Math.min(0.999, visible.computedOffset ?? visible.offset ?? 0);
        }
        animations.set(animation, previous);
      } catch { /* Unsupported timelines remain unchanged. */ }
    }
  }

  function staticText(element, limit = 10000) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest('input,textarea,select,[contenteditable],script,style')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let text = '';
    let visited = 0;
    while (text.length < limit && visited++ < 600) {
      const node = walker.nextNode();
      if (!node) break;
      text += ` ${node.textContent}`;
    }
    return text.slice(0, limit);
  }
  function choiceLabel(element) {
    // Never read input values, editable content, credentials, or a form submission.
    return (element.getAttribute('aria-label') || staticText(element, 160)).replace(/\s+/g, ' ').trim();
  }
  function scanChoices() {
    if (!settings.consentChoices) return;
    const found = new Set();
    const candidates = document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"],[id*="cookie" i],[class*="cookie-banner" i],[id*="consent" i]');
    const accept = /^(accept(?: all)?(?: cookies)?|allow all(?: cookies)?|agree)$/i;
    const reject = /^(reject(?: all)?(?: cookies)?|decline(?: all)?(?: cookies)?|deny all|(?:only )necessary(?: cookies)?(?: only)?|essential cookies only|continue without accepting)$/i;
    for (const dialog of Array.from(candidates).slice(0, 100)) {
      if (dialog.closest('[contenteditable]')) continue;
      // Treat security and payment contexts conservatively, even if they mention cookies.
      if (dialog.querySelector('input[type="password"],input[autocomplete="one-time-code"],input[autocomplete^="cc-"]')) continue;
      const text = staticText(dialog);
      if (!/\bcookies?\b/i.test(text) || /\b(security (?:notice|alert)|password|verification code|two.factor|one.time (?:code|password)|payment confirmation|confirm (?:your )?purchase)\b/i.test(text)) continue;
      const buttons = Array.from(dialog.querySelectorAll('button,a,[role="button"]')).filter(button => !button.closest('[contenteditable]'));
      const yes = buttons.filter(button => accept.test(choiceLabel(button)));
      const no = buttons.filter(button => reject.test(choiceLabel(button)));
      if (!yes.length || !no.length) continue;
      for (const button of [...yes, ...no]) {
        found.add(button);
        remember(choices, button, 'data-qb-choice', 'equal');
      }
    }
    for (const [button, original] of choices) {
      if (!found.has(button)) {
        restoreAttribute(button, 'data-qb-choice', original);
        choices.delete(button);
      }
    }
  }

  function eligibleVideo(video) {
    return !youtube && settings.backgroundVideo && video.autoplay &&
      (video.muted || video.defaultMuted) && (!video.controls || videos.has(video)) &&
      !allowedVideos.has(video) && !video.closest('[role="application"],[data-qb-allow-motion]');
  }
  function pauseVideo(video) {
    if (!active || !eligibleVideo(video)) return;
    if (!videos.has(video)) videos.set(video, video.getAttribute('controls'));
    video.controls = true;
    if (!video.paused) video.pause();
  }
  function onPlay(event) {
    if (event.target instanceof HTMLVideoElement) pauseVideo(event.target);
  }
  function allowVideo(event) {
    if (!event.isTrusted || !(event.target instanceof HTMLVideoElement)) return;
    if (event.type === 'keydown' && ![' ', 'Enter', 'k', 'K', 'MediaPlayPause'].includes(event.key)) return;
    allowedVideos.add(event.target);
  }

  function scanYouTube() {
    if (!youtube) return;
    if (settings.youtubeQuiet) document.documentElement.setAttribute('data-qb-youtube', 'quiet');
    if (settings.youtubeRecommendations) {
      for (const target of document.querySelectorAll('ytd-watch-flexy #related')) {
        if (recommendations.has(target) || target.querySelector('ytd-live-chat-frame')) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-qb-reveal', '');
        button.textContent = 'Show recommendations';
        button.setAttribute('aria-expanded', 'false');
        const original = target.getAttribute('data-qb-collapsed');
        target.setAttribute('data-qb-collapsed', 'true');
        button.addEventListener('click', () => {
          const hidden = target.getAttribute('data-qb-collapsed') === 'true';
          target.setAttribute('data-qb-collapsed', String(!hidden));
          button.textContent = hidden ? 'Hide recommendations' : 'Show recommendations';
          button.setAttribute('aria-expanded', String(hidden));
        });
        target.before(button);
        recommendations.set(target, { button, original });
      }
    }
    for (const [target, entry] of recommendations) {
      if (!target.isConnected) { entry.button.remove(); recommendations.delete(target); }
    }
    updateCover();
  }

  function updateCover() {
    const player = youtube && document.querySelector('#movie_player');
    if (!covered || !active || !player || !player.querySelector('video') || getComputedStyle(player).position === 'static') {
      cover?.remove(); cover = null;
      playerObserver?.disconnect(); playerObserver = null; observedPlayer = null;
      return;
    }
    if (cover?.parentElement !== player) {
      cover?.remove();
      cover = document.createElement('div');
      cover.setAttribute('data-qb-cover', '');
      cover.style.cssText = 'position:absolute;inset:0;z-index:19;pointer-events:none!important;';
      const shadow = cover.attachShadow({ mode: 'closed' });
      const style = new CSSStyleSheet();
      style.replaceSync(':host([hidden]){display:none!important}.surface{pointer-events:none;position:absolute;inset:0;background:#172c28;color:#eef6f2;display:flex;align-items:center;justify-content:center;text-align:center;font:15px/1.6 system-ui,sans-serif}.content{margin:48px 24px 90px}p{margin:0 0 12px}button{pointer-events:auto;cursor:pointer;font:inherit;border:1px solid #a8c7ba;color:#173b36;background:#f4fbf8;border-radius:8px;padding:9px 16px}button:focus-visible{outline:3px solid white;outline-offset:4px}');
      const surface = document.createElement('div');
      surface.className = 'surface';
      const content = document.createElement('div');
      content.className = 'content';
      const text = document.createElement('p');
      text.textContent = 'Picture covered. Playback is unchanged.';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Show picture';
      button.addEventListener('click', () => { coverOverride = false; covered = false; updateCover(); });
      content.append(text, button); surface.append(content); shadow.adoptedStyleSheets = [style]; shadow.append(surface);
      player.append(cover);
    }
    // This is a presentation cover, not an ad blocker. Leave ad playback visible.
    cover.hidden = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    if (observedPlayer !== player) {
      playerObserver?.disconnect();
      playerObserver = new MutationObserver(updateCover);
      playerObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
      observedPlayer = player;
    }
  }

  function scan() {
    timer = null;
    if (!active) return;
    scanMotion(); scanChoices();
    if (settings.backgroundVideo && !youtube) document.querySelectorAll('video').forEach(pauseVideo);
    for (const [video, original] of videos) {
      if (!video.isConnected) { restoreAttribute(video, 'controls', original); videos.delete(video); }
    }
    scanYouTube();
    social.sync(settings);
    comfort.sync();
  }
  function schedule() {
    if (active && timer === null) timer = setTimeout(scan, 120);
  }
  function youtubeRouteChanged() {
    if (youtube) {
      coverOverride = null;
      covered = settings.youtubePictureCover === true;
    }
    schedule();
  }

  function restore() {
    comfort.stop();
    social.stop();
    active = false;
    clearTimeout(timer); timer = null;
    observer?.disconnect(); observer = null;
    playerObserver?.disconnect(); playerObserver = null; observedPlayer = null;
    document.removeEventListener('animationstart', schedule, true);
    document.removeEventListener('focusin', schedule, true);
    document.removeEventListener('play', onPlay, true);
    document.removeEventListener('pointerdown', allowVideo, true);
    document.removeEventListener('keydown', allowVideo, true);
    document.removeEventListener('yt-navigate-finish', youtubeRouteChanged);
    window.removeEventListener('popstate', youtubeRouteChanged);
    window.removeEventListener('hashchange', youtubeRouteChanged);
    for (const [animation, previous] of animations) restoreAnimation(animation, previous);
    animations.clear();
    for (const [element, original] of choices) restoreAttribute(element, 'data-qb-choice', original);
    choices.clear();
    for (const [video, original] of videos) restoreAttribute(video, 'controls', original);
    videos.clear(); // Do not resume media: that would create unwanted playback.
    for (const [target, { button, original }] of recommendations) {
      restoreAttribute(target, 'data-qb-collapsed', original); button.remove();
    }
    recommendations.clear();
    if (appliedMarker) restoreAttribute(document.documentElement, 'data-qb-youtube', originalYouTubeAttribute);
    appliedMarker = false;
    cover?.remove(); cover = null;
  }

  function apply() {
    restore();
    if (!policyEnabled || paused) return;
    active = true;
    originalYouTubeAttribute = document.documentElement.getAttribute('data-qb-youtube');
    appliedMarker = true;
    comfort.start(settings);
    document.addEventListener('animationstart', schedule, true);
    document.addEventListener('focusin', schedule, true);
    document.addEventListener('play', onPlay, true);
    document.addEventListener('pointerdown', allowVideo, true);
    document.addEventListener('keydown', allowVideo, true);
    document.addEventListener('yt-navigate-finish', youtubeRouteChanged);
    window.addEventListener('popstate', youtubeRouteChanged);
    window.addEventListener('hashchange', youtubeRouteChanged);
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scan();
  }

  async function refresh() {
    const version = ++refreshVersion;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'QB_POLICY' });
      if (version !== refreshVersion) return;
      policyEnabled = response?.ok === true && response.data?.enabled === true;
      const nextSettings = response?.data?.settings || {};
      const previousPreference = settings.youtubePictureCover === true;
      const nextPreference = nextSettings.youtubePictureCover === true;
      settings = nextSettings;
      if (!policyEnabled) { covered = false; coverOverride = null; }
      else if (!settingsInitialized || previousPreference !== nextPreference) {
        coverOverride = null;
        covered = nextPreference;
      } else covered = coverOverride ?? nextPreference;
      settingsInitialized = true;
      apply();
    } catch { if (version === refreshVersion) { policyEnabled = false; covered = false; coverOverride = null; restore(); } }
  }

  function status() {
    return { ...comfort.status(), ...social.status(), engineVersion: ENGINE_VERSION, active, paused, covered,
      coverPersistent: youtube && settings.youtubePictureCover === true, coverTemporary: youtube && coverOverride !== null,
      coverAvailable: youtube && !!document.querySelector('#movie_player video'),
      loops: animations.size, choices: choices.size, videos: [...videos.keys()].filter(video => video.paused).length, recommendations: recommendations.size };
  }

  function onMessage(message, sender, respond) {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'QB_CLOCK') { comfort.tick(); scan(); respond(status()); return; }
    if (message.type === 'QB_REFRESH') { refresh().then(() => respond(status())); return true; }
    if (message.type === 'QB_STATUS') { respond(status()); return; }
    if (message.type === 'QB_PAUSE') {
      paused = message.paused === true;
      covered = paused ? false : (coverOverride ?? settings.youtubePictureCover === true);
      apply(); respond(status()); return;
    }
    if (message.type === 'QB_COVER') {
      if (!active || !youtube || !document.querySelector('#movie_player video')) { respond({ error: 'Open an enabled YouTube watch page first.' }); return; }
      coverOverride = message.covered === true;
      covered = coverOverride; updateCover(); respond(status());
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);
  function dispose() {
    refreshVersion += 1;
    policyEnabled = false; paused = false; covered = false; coverOverride = null;
    restore();
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch { /* Invalidated extension context. */ }
  }
  globalThis[INSTANCE] = { refresh, dispose, engineVersion: ENGINE_VERSION };
  refresh();
})();
