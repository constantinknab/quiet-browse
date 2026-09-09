// TikTok-style fixture for a usable landing page with an independently hidden feed.
(async () => {
  const { assert, send, wait, policy } = window.lab;
  const getElement = (elementId) => document.getElementById(elementId);
  const isSurfaceHidden = (elementId) =>
    getElement(elementId).hasAttribute('data-qb-social-hidden');
  const isRendered = (elementId) => {
    let element = getElement(elementId);
    while (element) {
      if (getComputedStyle(element).display === 'none') return false;
      element = element.parentElement;
    }
    return true;
  };
  try {
    window.fixturePath = '/';
    policy.settings = {
      ...policy.settings,
      socialStories: false,
      socialShortVideo: false,
      socialExplore: false,
      socialHomeFeed: false,
      tiktokLandingFeed: true,
    };
    await send({ type: 'QB_REFRESH' });
    await wait();
    let status = await send({ type: 'QB_STATUS' });
    assert(
      status.platform === 'tiktok' && status.route === 'home',
      'TikTok root is classified as a usable landing page',
    );
    assert(
      isSurfaceHidden('column-list-container') && !isRendered('column-list-container'),
      'Only the landing short-video stream is hidden',
    );
    assert(
      !isSurfaceHidden('landing') &&
        !isSurfaceHidden('landing-tools') &&
        !isSurfaceHidden('landing-sidebar'),
      'TikTok landing-page structure, tools, and sidebar remain available',
    );
    assert(
      !isSurfaceHidden('home-nav') && !isSurfaceHidden('messages-nav'),
      'For You and Messages navigation remain available',
    );
    assert(
      !isSurfaceHidden('recommend-list-decoy') && isRendered('recommend-list-decoy'),
      'An earlier non-scrollable recommendation module is not mistaken for the landing feed',
    );
    assert(
      document
        .querySelector('[data-qb-social-notice]')
        ?.textContent.includes('TikTok landing feed'),
      'A short explanation replaces the hidden inner stream',
    );

    // At `/`, only the dedicated landing-feed switch owns the vertical stream.
    for (const socialShortVideo of [false, true]) {
      for (const tiktokLandingFeed of [false, true]) {
        policy.settings.socialShortVideo = socialShortVideo;
        policy.settings.tiktokLandingFeed = tiktokLandingFeed;
        await send({ type: 'QB_REFRESH' });
        await wait();
        assert(
          isSurfaceHidden('column-list-container') === tiktokLandingFeed &&
            isRendered('column-list-container') === !tiktokLandingFeed &&
            !isSurfaceHidden('home-nav'),
          `TikTok root ownership: landing ${tiktokLandingFeed ? 'on' : 'off'}, routed Shorts ${socialShortVideo ? 'on' : 'off'}`,
        );
      }
    }

    policy.settings.tiktokLandingFeed = false;
    policy.settings.socialShortVideo = true;
    await send({ type: 'QB_REFRESH' });
    const visibleReplacement = getElement('column-list-container').cloneNode(true);
    visibleReplacement.removeAttribute('data-qb-social-hidden');
    getElement('column-list-container').replaceWith(visibleReplacement);
    await wait();
    assert(
      !visibleReplacement.hasAttribute('data-qb-social-hidden') &&
        isRendered('column-list-container'),
      'A new landing stream stays visible and unmarked while its dedicated switch is off',
    );

    policy.settings.tiktokLandingFeed = true;
    await send({ type: 'QB_REFRESH' });
    await wait();
    const replacement = getElement('column-list-container').cloneNode(true);
    // A real framework render creates a fresh element without Quiet Browse's marker.
    replacement.removeAttribute('data-qb-social-hidden');
    getElement('column-list-container').replaceWith(replacement);
    await wait();
    assert(
      replacement.hasAttribute('data-qb-social-hidden') && !isSurfaceHidden('landing'),
      'A TikTok-rendered replacement feed is detected without hiding the landing page',
    );

    window.fixturePath = '/following/';
    // At `/following/`, only the routed short-video switch owns the same stream.
    for (const tiktokLandingFeed of [false, true]) {
      for (const socialShortVideo of [false, true]) {
        policy.settings.tiktokLandingFeed = tiktokLandingFeed;
        policy.settings.socialShortVideo = socialShortVideo;
        await send({ type: 'QB_REFRESH' });
        await wait();
        status = await send({ type: 'QB_STATUS' });
        assert(
          status.route === 'short' &&
            replacement.hasAttribute('data-qb-social-hidden') === socialShortVideo &&
            isRendered('column-list-container') === !socialShortVideo,
          `Following ownership: routed Shorts ${socialShortVideo ? 'on' : 'off'}, landing ${tiktokLandingFeed ? 'on' : 'off'}`,
        );
      }
    }

    window.fixturePath = '/@person/video/123';
    policy.settings.tiktokLandingFeed = true;
    policy.settings.socialShortVideo = true;
    await send({ type: 'QB_REFRESH' });
    await wait();
    status = await send({ type: 'QB_STATUS' });
    assert(
      status.route === 'direct' && !replacement.hasAttribute('data-qb-social-hidden'),
      'A direct TikTok video remains viewable',
    );
    assert(
      isSurfaceHidden('recommendations'),
      'Continuation recommendations are hidden beside a direct video',
    );

    policy.enabled = false;
    await send({ type: 'QB_REFRESH' });
    const disabledReplacement = getElement('column-list-container').cloneNode(true);
    disabledReplacement.removeAttribute('data-qb-social-hidden');
    getElement('column-list-container').replaceWith(disabledReplacement);
    await wait();
    assert(
      !document.querySelector('[data-qb-social-hidden],[data-qb-social-notice]') &&
        isRendered('column-list-container'),
      'Turning Quiet Browse off restores every change and leaves new feeds untouched',
    );
    getElement('test-status').textContent =
      `PASS — ${document.querySelectorAll('#results .pass').length} TikTok landing-page isolation checks. This fixture is not a live-platform compatibility claim.`;
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  }
})();
