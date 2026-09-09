// Cross-reload fixture for every feature on every built-in site profile.
(async () => {
  const { assert, send, wait, policy, policyKey } = window.lab;
  const profile = document.body.dataset.profile;
  const group = document.body.dataset.group;
  const phaseKey = `qb-lifecycle-phase:${location.pathname}`;
  const countKey = `qb-lifecycle-count:${location.pathname}`;
  const keys = [
    'pageMode',
    'motion',
    'consentChoices',
    'backgroundVideo',
    'youtubeQuiet',
    'youtubeRecommendations',
    'youtubeShortsRecommendations',
    'youtubePictureCover',
    'socialStories',
    'socialSuggestions',
    'socialShortVideo',
    'socialExplore',
    'socialHomeFeed',
    'tiktokLandingFeed',
    'grayscale',
  ];
  const socialCategory = {
    socialStories: 'stories',
    socialSuggestions: 'suggestions',
    socialShortVideo: 'short',
    socialExplore: 'explore',
    socialHomeFeed: 'home',
    tiktokLandingFeed: 'tiktokLanding',
  };
  const applicable = (key) =>
    ['pageMode', 'motion', 'consentChoices', 'grayscale'].includes(key) ||
    (key === 'backgroundVideo' && group !== 'youtube') ||
    (key.startsWith('youtube') && group === 'youtube') ||
    (key === 'tiktokLandingFeed' && profile === 'tiktok') ||
    (key === 'socialHomeFeed' && group === 'social' && profile !== 'tiktok') ||
    (key.startsWith('social') && key !== 'socialHomeFeed' && group === 'social');
  const schedule = () => ({ scheduled: false, windows: [] });
  function settings(selected = []) {
    const on = new Set(selected);
    const today = new Date().getDay();
    const socialSchedules = Object.fromEntries(
      [
        'socialStories',
        'socialSuggestions',
        'socialShortVideo',
        'socialExplore',
        'socialHomeFeed',
        'tiktokLandingFeed',
      ].map((key) => [
        key,
        on.has(key)
          ? { scheduled: true, windows: [{ days: [today], start: '00:00', end: '00:00' }] }
          : schedule(),
      ]),
    );
    return {
      pageMode: on.has('pageMode'),
      motion: on.has('motion'),
      consentChoices: on.has('consentChoices'),
      backgroundVideo: on.has('backgroundVideo'),
      youtubeQuiet: on.has('youtubeQuiet'),
      youtubeRecommendations: on.has('youtubeRecommendations'),
      youtubeShortsRecommendations: on.has('youtubeShortsRecommendations'),
      youtubePictureCover: on.has('youtubePictureCover'),
      socialStories: on.has('socialStories'),
      socialSuggestions: on.has('socialSuggestions'),
      socialShortVideo: on.has('socialShortVideo'),
      socialExplore: on.has('socialExplore'),
      socialHomeFeed: on.has('socialHomeFeed'),
      tiktokLandingFeed: on.has('tiktokLandingFeed'),
      socialSchedules,
      grayscale: on.has('grayscale')
        ? {
            enabled: true,
            level: 65,
            scheduled: true,
            windows: [{ days: [today], start: '00:00', end: '00:00', level: 65 }],
          }
        : { enabled: false, level: 11, scheduled: false, windows: [] },
    };
  }
  async function apply(enabled, value) {
    policy.enabled = enabled;
    policy.settings = structuredClone(value);
    await send({ type: 'QB_REFRESH' });
    await wait(180);
    return send({ type: 'QB_STATUS' });
  }
  async function effects() {
    const status = await send({ type: 'QB_STATUS' });
    const output = {
      pageMode: status.pageMode === true,
      motion: status.loops > 0,
      consentChoices: status.choices > 0,
      backgroundVideo: status.videos > 0,
      youtubeQuiet: document.documentElement.getAttribute('data-qb-youtube') === 'quiet',
      youtubeRecommendations: status.recommendations > 0,
      youtubeShortsRecommendations:
        status.shortsRecommendations > 0 &&
        document
          .getElementById('youtube-shorts-section')
          .hasAttribute('data-qb-youtube-shorts-hidden') &&
        getComputedStyle(document.getElementById('youtube-shorts-section')).display === 'none',
      youtubePictureCover: status.covered === true && !!document.querySelector('[data-qb-cover]'),
      grayscale: status.grayscale === 65,
    };
    for (const [key, category] of Object.entries(socialCategory)) {
      const hiddenSurface = document.querySelector(`[data-qb-social-hidden="${category}"]`);
      output[key] = !!hiddenSurface && getComputedStyle(hiddenSurface).display === 'none';
    }
    return { status, output };
  }
  async function expectOnly(selected, label, active = true) {
    const { status, output } = await effects();
    assert(
      status.active === active,
      `${profile} · ${label} · engine ${active ? 'active' : 'inactive'}`,
    );
    for (const key of keys) {
      const expected = active && applicable(key) && selected.includes(key);
      assert(
        output[key] === expected,
        `${profile} · ${label} · ${key} ${expected ? 'applies' : 'is absent'}`,
      );
    }
    assert(
      document.querySelector('.loading-loop').getAnimations()[0].playState === 'running',
      `${profile} · ${label} · functional loading animation remains running`,
    );
  }
  function persist(nextPhase, enabled, value) {
    const completed =
      Number(sessionStorage.getItem(countKey) || 0) +
      document.querySelectorAll('#results .pass').length;
    sessionStorage.setItem(countKey, String(completed));
    sessionStorage.setItem(phaseKey, nextPhase);
    sessionStorage.setItem(policyKey, JSON.stringify({ enabled, settings: value }));
    location.reload();
  }
  function clearLifecycle() {
    sessionStorage.removeItem(phaseKey);
    sessionStorage.removeItem(policyKey);
    sessionStorage.removeItem(countKey);
  }

  try {
    await wait(220);
    const phase = sessionStorage.getItem(phaseKey) || 'initial';
    if (phase === 'initial') {
      const off = settings();
      await apply(true, off);
      await expectOnly([], 'active baseline');
      for (const key of keys) {
        await apply(true, settings([key]));
        await expectOnly([key], `${key} alone`);
      }
      const all = settings(keys);
      await apply(true, all);
      await expectOnly(keys, 'all features together');
      await apply(false, all);
      await expectOnly([], 'master switch off', false);
      // Retain every saved feature while disabled. The reload below proves the
      // master switch, rather than cleared preferences, is what removes effects.
      persist('disabled-reload', false, all);
      return;
    }
    if (phase === 'disabled-reload') {
      await expectOnly([], 'disabled page reload', false);
      const dynamicSurface = document.createElement('section');
      dynamicSurface.id = 'disabled-dynamic-surface';
      dynamicSurface.setAttribute(
        'data-qb-social-surface',
        profile === 'tiktok' ? 'tiktokLanding' : 'home',
      );
      dynamicSurface.textContent = 'Content loaded while the extension is disabled';
      document.querySelector('.content').append(dynamicSurface);
      await wait(260);
      assert(
        !dynamicSurface.hasAttribute('data-qb-social-hidden') &&
          getComputedStyle(dynamicSurface).display !== 'none',
        `${profile} · disabled observer leaves newly loaded content untouched`,
      );

      // Re-enable without replacing the retained settings from the prior reload.
      policy.enabled = true;
      await send({ type: 'QB_REFRESH' });
      await wait(180);
      await expectOnly(keys, 're-enabled with retained all-on choices');
      const all = settings(keys);
      persist('enabled-reload', true, all);
      return;
    }
    await expectOnly(keys, 'enabled page reload');
    await apply(false, settings(keys));
    await expectOnly([], 'final deactivation restores page', false);
    const count =
      Number(sessionStorage.getItem(countKey) || 0) +
      document.querySelectorAll('#results .pass').length;
    clearLifecycle();
    document.getElementById('test-status').textContent =
      `PASS — ${profile}: ${count} lifecycle assertions across two reloads.`;
  } catch (error) {
    clearLifecycle();
    document.getElementById('test-status').textContent = `FAIL — ${profile}: ${error.message}`;
    console.error(error);
  }
})();
