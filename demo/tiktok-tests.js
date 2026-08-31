// TikTok-style fixture for landing-feed, short-video, and message-route behavior.
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
      socialShortVideo: true,
      socialExplore: true,
      socialHomeFeed: true,
    };
    await send({ type: 'QB_REFRESH' });
    await wait();
    let status = await send({ type: 'QB_STATUS' });
    assert(
      status.platform === 'tiktok' && status.route === 'short',
      'TikTok root is classified as short-video content',
    );
    assert(isSurfaceHidden('landing'), 'TikTok landing stream is hidden');
    assert(
      isSurfaceHidden('home-nav') && isSurfaceHidden('following-nav'),
      'TikTok landing and Following entry points are hidden',
    );
    assert(!isSurfaceHidden('messages-nav'), 'Messages remain available');
    assert(
      document.querySelector('[data-qb-social-notice]')?.textContent.includes('Short-video'),
      'A short-video explanation replaces the landing stream',
    );

    policy.settings.socialShortVideo = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(isSurfaceHidden('landing'), 'The independent home-feed control also stops TikTok root');

    policy.settings.socialHomeFeed = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('landing') && !isSurfaceHidden('home-nav'),
      'TikTok root returns only when both applicable controls allow it',
    );

    policy.settings.socialShortVideo = true;
    window.fixturePath = '/@person/video/123';
    await send({ type: 'QB_REFRESH' });
    await wait();
    status = await send({ type: 'QB_STATUS' });
    assert(
      status.route === 'direct' && !isSurfaceHidden('landing'),
      'A direct TikTok video remains viewable',
    );
    assert(
      isSurfaceHidden('recommendations'),
      'Continuation recommendations are hidden beside a direct video',
    );

    policy.enabled = false;
    await send({ type: 'QB_REFRESH' });
    assert(
      !document.querySelector('[data-qb-social-hidden],[data-qb-social-notice]'),
      'Turning Quiet Browse off restores the fixture',
    );
    getElement('test-status').textContent =
      'PASS — 10 TikTok landing-feed checks. This fixture is not a live-platform compatibility claim.';
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  }
})();
