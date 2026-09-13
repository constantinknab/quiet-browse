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
  // A tiny silent WAV exercises real HTML media playback without making noise
  // on the developer's computer or relying on a remote video/audio download.
  const sampleCount = 8000;
  const wav = new DataView(new ArrayBuffer(44 + sampleCount * 2));
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1)
      wav.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  wav.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, 'WAVEfmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true); // PCM format.
  wav.setUint16(22, 1, true); // One audio channel.
  wav.setUint32(24, 8000, true);
  wav.setUint32(28, 16000, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  writeText(36, 'data');
  wav.setUint32(40, sampleCount * 2, true);
  const mediaUrl = URL.createObjectURL(new Blob([wav.buffer], { type: 'audio/wav' }));
  const feedMedia = () => [getElement('landing-video'), getElement('landing-audio')];
  feedMedia().forEach((media) => {
    media.src = mediaUrl;
  });
  getElement('outside-audio').src = mediaUrl;
  try {
    // Reproduce the reported Chrome failure, rather than testing only `/`.
    window.fixturePath = '/en/';
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
      'TikTok /en/ is classified as a usable landing page',
    );
    assert(
      isSurfaceHidden('column-list-container') && !isRendered('column-list-container'),
      'Only the landing short-video stream is hidden',
    );
    // Repeat scans without refreshing the controller: a hidden stream has no
    // measurable height, but must not become visible on the following scan.
    for (let scan = 0; scan < 3; scan += 1) await send({ type: 'QB_CLOCK' });
    assert(
      isSurfaceHidden('column-list-container') && !isRendered('column-list-container'),
      'A hidden landing stream stays hidden when its layout measurements become zero',
    );
    assert(
      feedMedia().every((media) => media.muted && media.paused) &&
        !getElement('outside-audio').muted,
      'Both video and separate audio inside the hidden feed are silenced; outside audio is untouched',
    );
    for (const media of feedMedia()) {
      media.muted = false;
      await wait();
      await media.play().catch(() => {}); // Pausing may reject the pending play promise.
    }
    assert(
      feedMedia().every((media) => media.muted && media.paused),
      'TikTok attempts to unmute or restart hidden-feed media are stopped',
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

    // Rescan the same controller as TikTok navigates between locale variants.
    // Each check verifies actual visibility and audio, not just a route label.
    policy.settings.socialShortVideo = true;
    for (const path of [
      '/',
      '/en',
      '/en-US/',
      '/ja-JP/',
      '/zh-Hant-TW/',
      '/pt-br/',
      '/%65%6e/',
      '/eng/',
      '/foryou/',
      '/en/foryou/',
      '/en-US/for-you/',
      '/en/home/',
    ]) {
      window.fixturePath = path;
      getElement('home-nav').setAttribute('href', path);
      await send({ type: 'QB_CLOCK' });
      status = await send({ type: 'QB_STATUS' });
      assert(
        status.route === 'home' &&
          !isRendered('column-list-container') &&
          feedMedia().every((media) => media.muted && media.paused) &&
          isRendered('landing-tools') &&
          isRendered('messages-nav') &&
          isRendered('home-nav'),
        `${path}: localized landing stream is hidden and silent, while navigation stays usable`,
      );
    }
    getElement('home-nav').setAttribute('href', '/');

    // A future landing alias can be recognized by TikTok's homepage shell.
    // Deliberately retain that shell on utility URLs to test stale SPA markup.
    const main = getElement('landing');
    const homepageShell = document.createElement('div');
    homepageShell.id = 'main-content-homepage_hot';
    main.before(homepageShell);
    homepageShell.append(main);
    window.fixturePath = '/landing-experiment/';
    await send({ type: 'QB_CLOCK' });
    status = await send({ type: 'QB_STATUS' });
    assert(
      status.route === 'home' &&
        !isRendered('column-list-container') &&
        feedMedia().every((media) => media.muted && media.paused),
      'An unfamiliar landing alias with homepage evidence is hidden and silent',
    );
    for (const [path, route] of [
      ['/en/@person/video/123', 'direct'],
      ['/en/messages/', 'messages'],
      ['/en/@person', 'other'],
      ['/en/search', 'other'],
      ['/en/shop', 'other'],
      ['/en/tag/example', 'other'],
      ['/en/music/example', 'other'],
      ['/en/login', 'other'],
      ['/unknown-locale/messages/', 'other'],
      ['/unknown-locale/@person', 'other'],
      ['/%65%6e/%40person/video/123', 'direct'],
    ]) {
      window.fixturePath = path;
      await send({ type: 'QB_CLOCK' });
      status = await send({ type: 'QB_STATUS' });
      assert(
        status.route === route &&
          isRendered('column-list-container') &&
          feedMedia().every((media) => !media.muted),
        `${path}: a retained homepage shell does not hide or mute a non-landing page`,
      );
    }
    homepageShell.replaceWith(main);
    window.fixturePath = '/landing-experiment/';
    getElement('home-nav').setAttribute('aria-current', 'page');
    await send({ type: 'QB_CLOCK' });
    status = await send({ type: 'QB_STATUS' });
    assert(
      status.route === 'home' &&
        !isRendered('column-list-container') &&
        feedMedia().every((media) => media.muted),
      'Selected home navigation plus a recognized stream identifies an alternate landing shell',
    );
    getElement('home-nav').removeAttribute('aria-current');
    await send({ type: 'QB_CLOCK' });
    status = await send({ type: 'QB_STATUS' });
    assert(
      status.route === 'other' &&
        isRendered('column-list-container') &&
        feedMedia().every((media) => !media.muted),
      'An unknown URL without homepage evidence is left untouched',
    );
    window.fixturePath = '/en/';
    await send({ type: 'QB_CLOCK' });

    // Exercise wrapper changes without restarting the controller. Detection
    // must not depend on one ID, or hide the shared main/navigation by fallback.
    const alternateFeed = getElement('column-list-container');
    alternateFeed.id = 'alternate-feed';
    alternateFeed.setAttribute('data-e2e', 'recommend-list');
    await send({ type: 'QB_CLOCK' });
    assert(
      !isRendered('alternate-feed') && feedMedia().every((media) => media.muted),
      'The recommendation-list adapter works when the primary feed ID changes',
    );
    alternateFeed.removeAttribute('data-e2e');
    await send({ type: 'QB_CLOCK' });
    assert(
      !isRendered('alternate-feed') &&
        isRendered('landing-tools') &&
        feedMedia().every((media) => media.muted),
      'A wrapper containing only recognized stream items is hidden without touching neighboring tools',
    );
    const independentItems = [...alternateFeed.children];
    main.before(homepageShell);
    homepageShell.append(main);
    alternateFeed.setAttribute('role', 'feed');
    independentItems.forEach((item) => item.removeAttribute('data-e2e'));
    await send({ type: 'QB_CLOCK' });
    assert(
      !isRendered('alternate-feed') &&
        feedMedia().every((media) => media.muted && media.paused) &&
        isRendered('landing-tools'),
      'A semantic feed inside the homepage shell works without the old ID or item attributes',
    );
    alternateFeed.removeAttribute('role');
    homepageShell.replaceWith(main);
    independentItems.forEach((item, index) => {
      item.id = `one-column-item-${index}`;
    });
    await send({ type: 'QB_CLOCK' });
    assert(
      !isRendered('alternate-feed') && feedMedia().every((media) => media.muted && media.paused),
      'Virtualized item IDs provide a fallback when data-e2e attributes change',
    );
    independentItems.forEach((item) => {
      item.removeAttribute('id');
      item.setAttribute('data-e2e', 'recommend-list-item-container');
    });
    const secondAudio = document.createElement('audio');
    secondAudio.src = mediaUrl;
    independentItems[1].append(secondAudio);
    independentItems.forEach((item) => main.append(item));
    await send({ type: 'QB_CLOCK' });
    assert(
      independentItems.every((item) => item.hasAttribute('data-qb-social-hidden')) &&
        feedMedia().every((media) => media.muted && media.paused) &&
        secondAudio.muted &&
        secondAudio.paused &&
        isRendered('landing-tools') &&
        isRendered('landing-sidebar') &&
        !isSurfaceHidden('landing'),
      'Independent stream items are all hidden and silenced without hiding their shared main page',
    );
    secondAudio.remove();
    independentItems.forEach((item) => alternateFeed.append(item));
    alternateFeed.id = 'column-list-container';
    await send({ type: 'QB_CLOCK' });

    // At `/en/`, only the dedicated landing-feed switch owns the vertical stream.
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
          `TikTok /en/ ownership: landing ${tiktokLandingFeed ? 'on' : 'off'}, routed Shorts ${socialShortVideo ? 'on' : 'off'}`,
        );
      }
    }

    policy.settings.tiktokLandingFeed = false;
    await send({ type: 'QB_REFRESH' });
    assert(
      feedMedia().every((media) => !media.muted && media.paused),
      'Turning the landing switch off restores the original mute state without starting playback',
    );
    const audibleFeed = getElement('landing-video');
    audibleFeed.muted = true; // Chrome permits muted video playback without a click.
    await audibleFeed.play();
    assert(!audibleFeed.paused, 'Feed playback works normally once its control is off');
    audibleFeed.pause();
    audibleFeed.muted = false;
    policy.settings.tiktokLandingFeed = true;
    policy.settings.socialSchedules = {
      ...policy.settings.socialSchedules,
      tiktokLandingFeed: { scheduled: true, windows: [] },
    };
    await send({ type: 'QB_REFRESH' });
    assert(
      isRendered('column-list-container') && feedMedia().every((media) => !media.muted),
      'Outside a landing-filter schedule, both feed visibility and normal audio controls return',
    );
    policy.settings.socialSchedules.tiktokLandingFeed = { scheduled: false, windows: [] };
    await send({ type: 'QB_REFRESH' });

    const secondItem = getElement('column-list-container').children[1];
    secondItem.remove();
    await wait();
    await send({ type: 'QB_CLOCK' });
    assert(
      isSurfaceHidden('column-list-container') && feedMedia().every((media) => media.muted),
      'A single virtualized landing item is enough to recognize and silence the stream',
    );
    getElement('column-list-container').append(secondItem);

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
    const newAudio = document.createElement('audio');
    newAudio.src = mediaUrl;
    replacement.append(newAudio);
    await newAudio.play().catch(() => {});
    await wait();
    assert(
      newAudio.muted && newAudio.paused && feedMedia().every((media) => media.muted),
      'Replacement and newly inserted landing-feed media are muted and paused',
    );

    // The Following adapter is outside this patch. Keep its original fixture
    // overflow model while checking that landing audio guards do not leak there.
    document.body.classList.add('routed-feed-fixture');
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
      feedMedia().every((media) => !media.muted),
      'Opening a direct video removes the landing-only media guard and restores mute choices',
    );
    assert(
      isSurfaceHidden('recommendations'),
      'Continuation recommendations are hidden beside a direct video',
    );

    window.fixturePath = '/en/';
    await send({ type: 'QB_REFRESH' });
    policy.enabled = false;
    await send({ type: 'QB_REFRESH' });
    const releasedAudio = getElement('landing-audio');
    assert(!releasedAudio.muted, 'Turning the extension off restores the landing audio mute state');
    const releasedVideo = getElement('landing-video');
    releasedVideo.muted = true;
    await releasedVideo.play();
    assert(!releasedVideo.paused, 'Turning the extension off removes the landing playback guard');
    releasedVideo.pause();
    const disabledReplacement = getElement('column-list-container').cloneNode(true);
    disabledReplacement.removeAttribute('data-qb-social-hidden');
    getElement('column-list-container').replaceWith(disabledReplacement);
    await wait();
    assert(
      !document.querySelector('[data-qb-social-hidden],[data-qb-social-notice]') &&
        isRendered('column-list-container'),
      'Turning Quiet Browse off restores every change and leaves new feeds untouched',
    );
    policy.enabled = true;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      isSurfaceHidden('column-list-container') && feedMedia().every((media) => media.muted),
      'Re-enabling Quiet Browse reapplies landing-feed hiding and audio protection',
    );
    getElement('test-status').textContent =
      `PASS — ${document.querySelectorAll('#results .pass').length} TikTok landing-page isolation checks. This fixture is not a live-platform compatibility claim.`;
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  } finally {
    document.querySelectorAll('video,audio').forEach((media) => media.pause());
    URL.revokeObjectURL(mediaUrl);
  }
})();
