(async () => {
  const { assert, send, wait, policy } = window.lab;
  const $ = id => document.getElementById(id);
  const hidden = id => $(id).hasAttribute('data-qb-social-hidden');
  try {
    window.fixturePath = '/';
    policy.settings = { ...policy.settings, socialStories: true, socialSuggestions: true, socialShortVideo: true, socialExplore: true, socialHomeFeed: true };
    await send({ type: 'QB_REFRESH' }); await wait();
    let status = await send({ type: 'QB_STATUS' });
    assert(status.platform === 'instagram' && status.route === 'home', 'Instagram home route is classified locally');
    assert(hidden('stories') && hidden('stories-nav'), 'Stories tray and entry point are hidden');
    assert(hidden('suggestions'), 'Follow recommendations are hidden separately from the home feed');
    assert(hidden('reels-nav'), 'Reels entry point is hidden');
    assert(hidden('explore-nav'), 'Explore entry point is hidden');
    assert(hidden('home'), 'Home feed is hidden');
    assert(!hidden('messages-nav') && !hidden('profile-nav'), 'Messages and profiles stay available');
    assert(document.querySelector('[data-qb-social-notice]'), 'A visible explanation replaces a hidden route feed');

    policy.settings.socialHomeFeed = false;
    await send({ type: 'QB_REFRESH' }); await wait();
    assert(!hidden('home') && !document.querySelector('[data-qb-social-notice]'), 'Restoring followed posts removes the home-feed notice');
    assert(hidden('stories') && hidden('stories-nav'), 'Restoring followed posts does not restore Stories');
    assert(hidden('suggestions'), 'Restoring followed posts does not restore follow recommendations');
    assert(!hidden('post-carousel'), 'A post image carousel remains visible when Stories are hidden');
    policy.settings.socialHomeFeed = true;

    const today = new Date().getDay();
    policy.settings.socialSchedules = { socialStories: { scheduled: true, windows: [{ days: [(today + 1) % 7], start: '00:00', end: '00:00' }] } };
    await send({ type: 'QB_REFRESH' }); await wait();
    assert(!hidden('stories') && hidden('home'), 'A Stories schedule restores Stories outside its selected local-time window');
    policy.settings.socialSchedules.socialStories.windows[0].days = [today];
    await send({ type: 'QB_REFRESH' }); await wait();
    assert(hidden('stories') && hidden('home'), 'An all-day Stories window activates on its selected local day');

    policy.settings.socialStories = false;
    await send({ type: 'QB_REFRESH' }); await wait();
    assert(!hidden('stories') && !hidden('stories-nav'), 'Stories can be restored independently');
    assert(hidden('suggestions') && hidden('reels-nav') && hidden('explore-nav') && hidden('home'), 'Other social controls remain active');

    policy.settings.socialSuggestions = false;
    await send({ type: 'QB_REFRESH' }); await wait();
    assert(!hidden('suggestions') && hidden('home'), 'Follow recommendations can be restored without restoring the home feed');

    policy.settings.socialStories = true;
    window.fixturePath = '/stories/quiet-user/123/';
    await send({ type: 'QB_REFRESH' }); await wait();
    assert(!hidden('stories') && hidden('stories-nav'), 'A directly opened Story stays viewable while the Stories entry point remains hidden');

    window.fixturePath = '/direct/t/123/';
    await send({ type: 'QB_REFRESH' }); await wait(); status = await send({ type: 'QB_STATUS' });
    assert(status.route === 'messages' && !hidden('direct-item'), 'Message route and opened content remain viewable');
    assert(hidden('recommendations'), 'Continuation recommendations are removed from received content');
    assert(!hidden('home') && !document.querySelector('[data-qb-social-notice]'), 'A message route is not mistaken for the home feed');

    window.fixturePath = '/reel/abc123/';
    await send({ type: 'QB_REFRESH' }); await wait();
    assert(!hidden('direct-item') && hidden('recommendations'), 'A direct Reel URL stays viewable without an adjacent continuation feed');

    policy.enabled = false; await send({ type: 'QB_REFRESH' });
    assert(!document.querySelector('[data-qb-social-hidden],[data-qb-social-notice]'), 'Turning Quiet Browse off restores every social surface');
    $('test-status').textContent = 'PASS — 23 social route checks. This fixture is not a live-platform compatibility claim.';
  } catch (error) { $('test-status').textContent = `FAIL — ${error.message}`; console.error(error); }
})();
