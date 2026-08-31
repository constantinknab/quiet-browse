// Instagram-style fixture for independent social-surface controls and restoration.
(async () => {
  const { assert, send, wait, policy } = window.lab;
  const getElement = (elementId) => document.getElementById(elementId);
  const isSurfaceHidden = (elementId) =>
    getElement(elementId).hasAttribute('data-qb-social-hidden');
  try {
    window.fixturePath = '/';
    policy.settings = {
      ...policy.settings,
      socialStories: true,
      socialSuggestions: true,
      socialShortVideo: true,
      socialExplore: true,
      socialHomeFeed: true,
    };
    await send({ type: 'QB_REFRESH' });
    await wait();
    let status = await send({ type: 'QB_STATUS' });
    assert(
      status.platform === 'instagram' && status.route === 'home',
      'Instagram home route is classified locally',
    );
    assert(
      isSurfaceHidden('stories') && isSurfaceHidden('stories-nav'),
      'Stories tray and entry point are hidden',
    );
    assert(
      isSurfaceHidden('suggestions'),
      'Follow recommendations are hidden separately from the home feed',
    );
    assert(isSurfaceHidden('reels-nav'), 'Reels entry point is hidden');
    assert(isSurfaceHidden('explore-nav'), 'Explore entry point is hidden');
    assert(isSurfaceHidden('home'), 'Home feed is hidden');
    assert(
      !isSurfaceHidden('messages-nav') && !isSurfaceHidden('profile-nav'),
      'Messages and profiles stay available',
    );
    assert(
      document.querySelector('[data-qb-social-notice]'),
      'A visible explanation replaces a hidden route feed',
    );

    policy.settings.socialHomeFeed = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('home') && !document.querySelector('[data-qb-social-notice]'),
      'Restoring followed posts removes the home-feed notice',
    );
    assert(
      isSurfaceHidden('stories') && isSurfaceHidden('stories-nav'),
      'Restoring followed posts does not restore Stories',
    );
    assert(
      isSurfaceHidden('suggestions'),
      'Restoring followed posts does not restore follow recommendations',
    );
    assert(
      !isSurfaceHidden('post-carousel'),
      'A post image carousel remains visible when Stories are hidden',
    );
    policy.settings.socialHomeFeed = true;

    const today = new Date().getDay();
    policy.settings.socialSchedules = {
      socialStories: {
        scheduled: true,
        windows: [{ days: [(today + 1) % 7], start: '00:00', end: '00:00' }],
      },
    };
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('stories') && isSurfaceHidden('home'),
      'A Stories schedule restores Stories outside its selected local-time window',
    );
    policy.settings.socialSchedules.socialStories.windows[0].days = [today];
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      isSurfaceHidden('stories') && isSurfaceHidden('home'),
      'An all-day Stories window activates on its selected local day',
    );

    policy.settings.socialStories = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('stories') && !isSurfaceHidden('stories-nav'),
      'Stories can be restored independently',
    );
    assert(
      isSurfaceHidden('suggestions') &&
        isSurfaceHidden('reels-nav') &&
        isSurfaceHidden('explore-nav') &&
        isSurfaceHidden('home'),
      'Other social controls remain active',
    );

    policy.settings.socialSuggestions = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('suggestions') && isSurfaceHidden('home'),
      'Follow recommendations can be restored without restoring the home feed',
    );

    policy.settings.socialStories = true;
    window.fixturePath = '/stories/quiet-user/123/';
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('stories') && isSurfaceHidden('stories-nav'),
      'A directly opened Story stays viewable while the Stories entry point remains hidden',
    );

    window.fixturePath = '/direct/t/123/';
    await send({ type: 'QB_REFRESH' });
    await wait();
    status = await send({ type: 'QB_STATUS' });
    assert(
      status.route === 'messages' && !isSurfaceHidden('direct-item'),
      'Message route and opened content remain viewable',
    );
    assert(
      isSurfaceHidden('recommendations'),
      'Continuation recommendations are removed from received content',
    );
    assert(
      !isSurfaceHidden('home') && !document.querySelector('[data-qb-social-notice]'),
      'A message route is not mistaken for the home feed',
    );

    window.fixturePath = '/reel/abc123/';
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('direct-item') && isSurfaceHidden('recommendations'),
      'A direct Reel URL stays viewable without an adjacent continuation feed',
    );

    policy.enabled = false;
    await send({ type: 'QB_REFRESH' });
    assert(
      !document.querySelector('[data-qb-social-hidden],[data-qb-social-notice]'),
      'Turning Quiet Browse off restores every social surface',
    );
    getElement('test-status').textContent =
      'PASS — 23 social route checks. This fixture is not a live-platform compatibility claim.';
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  }
})();
