(async () => {
  const { assert, send, wait, policy, policyKey } = window.lab;
  const profile = document.body.dataset.profile;
  const group = document.body.dataset.group;
  const phaseKey = `qb-lifecycle-phase:${location.pathname}`;
  const countKey = `qb-lifecycle-count:${location.pathname}`;
  const keys = ['pageMode', 'motion', 'consentChoices', 'backgroundVideo', 'youtubeQuiet', 'youtubeRecommendations', 'youtubePictureCover', 'socialStories', 'socialSuggestions', 'socialShortVideo', 'socialExplore', 'socialHomeFeed', 'grayscale'];
  const socialCategory = { socialStories: 'stories', socialSuggestions: 'suggestions', socialShortVideo: 'short', socialExplore: 'explore', socialHomeFeed: 'home' };
  const applicable = key => ['pageMode', 'motion', 'consentChoices', 'grayscale'].includes(key) ||
    (key === 'backgroundVideo' && group !== 'youtube') ||
    (key.startsWith('youtube') && group === 'youtube') ||
    (key.startsWith('social') && group === 'social');
  const schedule = () => ({ scheduled: false, windows: [] });
  function settings(selected = []) {
    const on = new Set(selected);
    const today = new Date().getDay();
    const socialSchedules = Object.fromEntries(['socialStories', 'socialSuggestions', 'socialShortVideo', 'socialExplore', 'socialHomeFeed'].map(key =>
      [key, on.has(key) ? { scheduled: true, windows: [{ days: [today], start: '00:00', end: '00:00' }] } : schedule()]));
    return {
      pageMode: on.has('pageMode'), motion: on.has('motion'), consentChoices: on.has('consentChoices'), backgroundVideo: on.has('backgroundVideo'),
      youtubeQuiet: on.has('youtubeQuiet'), youtubeRecommendations: on.has('youtubeRecommendations'), youtubePictureCover: on.has('youtubePictureCover'), socialStories: on.has('socialStories'), socialSuggestions: on.has('socialSuggestions'),
      socialShortVideo: on.has('socialShortVideo'), socialExplore: on.has('socialExplore'), socialHomeFeed: on.has('socialHomeFeed'), socialSchedules,
      grayscale: on.has('grayscale')
        ? { enabled: true, level: 65, scheduled: true, windows: [{ days: [today], start: '00:00', end: '00:00', level: 65 }] }
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
      youtubePictureCover: status.covered === true && !!document.querySelector('[data-qb-cover]'),
      grayscale: status.grayscale === 65,
    };
    for (const [key, category] of Object.entries(socialCategory)) output[key] = key === 'socialHomeFeed'
      ? document.getElementById('home').hasAttribute('data-qb-social-hidden')
      : !!document.querySelector(`[data-qb-social-hidden="${category}"]`);
    return { status, output };
  }
  async function expectOnly(selected, label, active = true) {
    const { status, output } = await effects();
    assert(status.active === active, `${profile} · ${label} · engine ${active ? 'active' : 'inactive'}`);
    for (const key of keys) {
      const expected = active && applicable(key) && (selected.includes(key) ||
        (profile === 'tiktok' && key === 'socialHomeFeed' && selected.includes('socialShortVideo')));
      assert(output[key] === expected, `${profile} · ${label} · ${key} ${expected ? 'applies' : 'is absent'}`);
    }
    assert(document.querySelector('.loading-loop').getAnimations()[0].playState === 'running', `${profile} · ${label} · functional loading animation remains running`);
  }
  function persist(nextPhase, enabled, value) {
    const completed = Number(sessionStorage.getItem(countKey) || 0) + document.querySelectorAll('#results .pass').length;
    sessionStorage.setItem(countKey, String(completed));
    sessionStorage.setItem(phaseKey, nextPhase);
    sessionStorage.setItem(policyKey, JSON.stringify({ enabled, settings: value }));
    location.reload();
  }
  function clearLifecycle() { sessionStorage.removeItem(phaseKey); sessionStorage.removeItem(policyKey); sessionStorage.removeItem(countKey); }

  try {
    await wait(220);
    const phase = sessionStorage.getItem(phaseKey) || 'initial';
    if (phase === 'initial') {
      const off = settings();
      await apply(true, off); await expectOnly([], 'active baseline');
      for (const key of keys) {
        await apply(true, settings([key]));
        await expectOnly([key], `${key} alone`);
      }
      const all = settings(keys);
      await apply(true, all); await expectOnly(keys, 'all features together');
      await apply(false, all); await expectOnly([], 'master switch off', false);
      persist('disabled-reload', false, off);
      return;
    }
    if (phase === 'disabled-reload') {
      const off = settings();
      await expectOnly([], 'disabled page reload', false);
      await apply(true, off); await expectOnly([], 're-enabled with saved off choices');
      const all = settings(keys);
      await apply(true, all); await expectOnly(keys, 'features restored after re-enable');
      persist('enabled-reload', true, all);
      return;
    }
    await expectOnly(keys, 'enabled page reload');
    await apply(false, settings(keys)); await expectOnly([], 'final deactivation restores page', false);
    const count = Number(sessionStorage.getItem(countKey) || 0) + document.querySelectorAll('#results .pass').length;
    clearLifecycle();
    document.getElementById('test-status').textContent = `PASS — ${profile}: ${count} lifecycle assertions across two reloads.`;
  } catch (error) {
    clearLifecycle();
    document.getElementById('test-status').textContent = `FAIL — ${profile}: ${error.message}`;
    console.error(error);
  }
})();
