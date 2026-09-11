// YouTube-style fixture for recommendations, picture covering, and native controls.
(async () => {
  const { assert, send, wait } = window.lab;
  const getElement = (elementId) => document.getElementById(elementId);
  const isRendered = (elementId) => getComputedStyle(getElement(elementId)).display !== 'none';
  const video = document.querySelector('#movie_player video');
  video.volume = 0.65;
  video.muted = false;
  getElement('mute').addEventListener('click', () => {
    video.muted = !video.muted;
  });
  try {
    await wait();
    assert(
      getComputedStyle(getElement('related')).display === 'none',
      'Recommendations collapse without removing their original nodes',
    );
    document.querySelector('[data-qb-reveal]').click();
    assert(
      getComputedStyle(getElement('related')).display !== 'none' &&
        !!getElement('related').querySelector('a'),
      'Reveal restores access to the original recommendation',
    );
    assert(
      getComputedStyle(getElement('mouseover-overlay')).visibility === 'hidden',
      'Recognized thumbnail preview is visually quieted',
    );
    assert(
      getComputedStyle(getElement('cinematics')).visibility === 'hidden',
      'Ambient background is visually quieted',
    );
    assert(
      getElement('shorts-section').hasAttribute('data-qb-youtube-shorts-hidden') &&
        getElement('reel-shelf').hasAttribute('data-qb-youtube-shorts-hidden') &&
        getElement('grid-shorts-shelf').hasAttribute('data-qb-youtube-shorts-hidden') &&
        getElement('generic-shorts-section').hasAttribute('data-qb-youtube-shorts-hidden') &&
        !isRendered('shorts-section') &&
        !isRendered('reel-shelf') &&
        !isRendered('grid-shorts-shelf') &&
        !isRendered('generic-shorts-section'),
      'Supported YouTube Shorts shelves and carousels are hidden by default',
    );
    assert(
      !getElement('ordinary-section').hasAttribute('data-qb-youtube-shorts-hidden') &&
        !getElement('direct-short').hasAttribute('data-qb-youtube-shorts-hidden') &&
        isRendered('ordinary-section') &&
        isRendered('direct-short'),
      'Ordinary recommendations and direct Shorts links remain available',
    );
    assert(
      getElement('shorts-nav-entry').hasAttribute('data-qb-youtube-shorts-navigation-hidden') &&
        getElement('shorts-text-only-nav-entry').hasAttribute(
          'data-qb-youtube-shorts-navigation-hidden',
        ) &&
        !isRendered('shorts-nav-entry') &&
        !isRendered('shorts-text-only-nav-entry') &&
        isRendered('direct-short'),
      'Href-based and text-only Shorts sidebar entries hide without hiding a direct Shorts link',
    );
    assert(
      getElement('playables-nav-entry').hasAttribute('data-qb-youtube-playables-hidden') &&
        getElement('playables-section').hasAttribute('data-qb-youtube-playables-hidden') &&
        getElement('playable-card').hasAttribute('data-qb-youtube-playables-hidden') &&
        getElement('playables-route').hasAttribute('data-qb-youtube-playables-hidden') &&
        getElement('playable-game-route').hasAttribute('data-qb-youtube-playables-hidden') &&
        !isRendered('playables-nav-entry') &&
        !isRendered('playables-section') &&
        !isRendered('playable-card') &&
        !isRendered('playables-route') &&
        !isRendered('playable-game-route') &&
        isRendered('ordinary-beside-playable'),
      'Playables navigation, shelves, cards, and route content hide without swallowing ordinary videos',
    );
    assert(
      !getElement('mixed-section').hasAttribute('data-qb-youtube-shorts-hidden') &&
        getElement('mixed-shorts-shelf').hasAttribute('data-qb-youtube-shorts-hidden') &&
        !isRendered('mixed-shorts-shelf') &&
        isRendered('mixed-ordinary-shelf'),
      'A Shorts shelf hides alone when its enclosing section also contains ordinary videos',
    );
    assert(
      !getElement('mixed-link-section').hasAttribute('data-qb-youtube-shorts-hidden') &&
        !getElement('mixed-link-shelf').hasAttribute('data-qb-youtube-shorts-hidden') &&
        isRendered('mixed-link-shelf'),
      'A mixed shelf with both Shorts and ordinary videos remains available',
    );

    window.lab.policy.settings.youtubeShortsRecommendations = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !document.querySelector('[data-qb-youtube-shorts-hidden]') &&
        getComputedStyle(getElement('related')).display === 'none' &&
        isRendered('generic-shorts-section') &&
        isRendered('mixed-shorts-shelf') &&
        !isRendered('shorts-nav-entry') &&
        !isRendered('shorts-text-only-nav-entry') &&
        !isRendered('playables-section'),
      'The Shorts-shelf switch restores shelves without changing navigation, Playables, or watch-page recommendations',
    );

    const offDynamicShelf = document.createElement('ytd-reel-shelf-renderer');
    offDynamicShelf.id = 'off-dynamic-shorts-shelf';
    const offDynamicLink = document.createElement('a');
    offDynamicLink.href = '/shorts/off-dynamic';
    offDynamicLink.textContent = 'Short loaded while setting is off';
    offDynamicShelf.append(offDynamicLink);
    document.body.append(offDynamicShelf);
    await wait();
    assert(
      !offDynamicShelf.hasAttribute('data-qb-youtube-shorts-hidden') &&
        isRendered('off-dynamic-shorts-shelf'),
      'A Shorts shelf loaded while the switch is off remains rendered and unmarked',
    );

    window.lab.policy.settings.youtubeShortsNavigation = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !document.querySelector('[data-qb-youtube-shorts-navigation-hidden]') &&
        isRendered('shorts-nav-entry') &&
        isRendered('shorts-text-only-nav-entry') &&
        !isRendered('playables-nav-entry') &&
        isRendered('generic-shorts-section'),
      'The Shorts-tab switch restores only Shorts navigation',
    );
    const offDynamicShortsEntry = document.createElement('ytd-guide-entry-renderer');
    offDynamicShortsEntry.id = 'off-dynamic-shorts-entry';
    const offDynamicShortsHub = document.createElement('a');
    offDynamicShortsHub.href = '/shorts/';
    offDynamicShortsHub.textContent = 'Shorts hub loaded while setting is off';
    offDynamicShortsEntry.append(offDynamicShortsHub);
    document.body.append(offDynamicShortsEntry);
    await wait();
    assert(
      !offDynamicShortsEntry.hasAttribute('data-qb-youtube-shorts-navigation-hidden') &&
        isRendered('off-dynamic-shorts-entry'),
      'A Shorts navigation entry loaded while its switch is off remains available and unmarked',
    );

    window.lab.policy.settings.youtubeShortsNavigation = true;
    window.lab.policy.settings.youtubePlayables = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isRendered('shorts-nav-entry') &&
        !isRendered('shorts-text-only-nav-entry') &&
        isRendered('playables-nav-entry') &&
        isRendered('playables-section') &&
        isRendered('playable-card') &&
        isRendered('playables-route') &&
        isRendered('playable-game-route'),
      'The Playables switch restores Playables without restoring the Shorts tab',
    );
    const offDynamicPlayable = document.createElement('ytd-browse');
    offDynamicPlayable.id = 'off-dynamic-playable';
    offDynamicPlayable.setAttribute('page-subtype', 'playables');
    offDynamicPlayable.textContent = 'Playables loaded while setting is off';
    document.body.append(offDynamicPlayable);
    await wait();
    assert(
      !offDynamicPlayable.hasAttribute('data-qb-youtube-playables-hidden') &&
        isRendered('off-dynamic-playable'),
      'Playables loaded while their switch is off remain rendered and unmarked',
    );

    window.lab.policy.settings.youtubeShortsRecommendations = true;
    window.lab.policy.settings.youtubePlayables = true;
    window.lab.policy.settings.youtubeRecommendations = false;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      getElement('shorts-section').hasAttribute('data-qb-youtube-shorts-hidden') &&
        getComputedStyle(getElement('related')).display !== 'none' &&
        !document.querySelector('[data-qb-reveal]'),
      'Watch-page recommendations can be restored while Shorts shelves remain hidden',
    );

    const dynamicSection = document.createElement('ytd-rich-section-renderer');
    dynamicSection.id = 'dynamic-shorts-section';
    const dynamicShelf = document.createElement('ytd-rich-shelf-renderer');
    dynamicShelf.setAttribute('is-shorts', '');
    const dynamicLink = document.createElement('a');
    dynamicLink.href = '/shorts/dynamic';
    dynamicLink.textContent = 'Dynamically loaded Short';
    dynamicShelf.append(dynamicLink);
    dynamicSection.append(dynamicShelf);
    document.body.append(dynamicSection);
    await wait();
    assert(
      dynamicSection.hasAttribute('data-qb-youtube-shorts-hidden') &&
        !isRendered('dynamic-shorts-section'),
      'A lazily loaded Shorts shelf is hidden by the existing page observer',
    );
    const dynamicShortsEntry = document.createElement('ytd-mini-guide-entry-renderer');
    dynamicShortsEntry.id = 'dynamic-shorts-entry';
    const dynamicShortsHub = document.createElement('a');
    dynamicShortsHub.href = '/shorts/';
    dynamicShortsHub.textContent = 'Dynamically loaded Shorts hub';
    dynamicShortsEntry.append(dynamicShortsHub);
    const dynamicPlayable = document.createElement('ytd-browse');
    dynamicPlayable.id = 'dynamic-playable';
    dynamicPlayable.setAttribute('page-subtype', 'mini_app');
    dynamicPlayable.textContent = 'Dynamically loaded Playable';
    document.body.append(dynamicShortsEntry, dynamicPlayable);
    await wait();
    assert(
      dynamicShortsEntry.hasAttribute('data-qb-youtube-shorts-navigation-hidden') &&
        dynamicPlayable.hasAttribute('data-qb-youtube-playables-hidden') &&
        !isRendered('dynamic-shorts-entry') &&
        !isRendered('dynamic-playable'),
      'Lazily loaded Shorts navigation and Playables are hidden by the page observer',
    );

    window.lab.policy.settings.youtubeRecommendations = true;
    await send({ type: 'QB_REFRESH' });
    await wait();
    window.lab.policy.settings.youtubePictureCover = true;
    let coverStatus = await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      coverStatus.coverPersistent &&
        coverStatus.covered &&
        !!document.querySelector('[data-qb-cover]'),
      'Saved picture cover applies without a page-only button press',
    );
    assert(
      Number(getComputedStyle(document.querySelector('.ytp-chrome-bottom')).zIndex) > 19 &&
        Number(getComputedStyle(document.querySelector('.ytp-caption-window-container')).zIndex) >
          19,
      'Fixture player controls and captions remain above cover',
    );
    // Keep the real control inside the viewport before hit-testing. Headless
    // Chrome uses a smaller default viewport than the interactive fixture tab.
    getElement('mute').scrollIntoView({ block: 'center' });
    const muteRect = getElement('mute').getBoundingClientRect();
    const hit = document.elementFromPoint(
      muteRect.left + muteRect.width / 2,
      muteRect.top + muteRect.height / 2,
    );
    assert(
      hit === getElement('mute') || getElement('mute').contains(hit),
      'The picture cover does not intercept the native mute control',
    );
    getElement('mute').click();
    assert(
      video.muted && video.volume === 0.65,
      'The native mute control still changes audio state without changing volume',
    );
    assert(
      document.querySelector('[data-qb-cover]').style.pointerEvents === 'none',
      'The picture cover passes pointer input through to player controls',
    );
    coverStatus = await send({ type: 'QB_COVER', covered: false });
    assert(
      !coverStatus.covered &&
        coverStatus.coverPersistent &&
        coverStatus.coverTemporary &&
        !document.querySelector('[data-qb-cover]'),
      'Show picture creates a temporary override without changing the saved cover preference',
    );
    coverStatus = await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !coverStatus.covered && !document.querySelector('[data-qb-cover]'),
      'An unrelated settings refresh preserves the current-page Show picture override',
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
    await wait();
    coverStatus = await send({ type: 'QB_STATUS' });
    assert(
      coverStatus.covered &&
        !coverStatus.coverTemporary &&
        !!document.querySelector('[data-qb-cover]'),
      'Browser back or forward navigation reapplies the saved cover',
    );
    await send({ type: 'QB_COVER', covered: false });
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await wait();
    coverStatus = await send({ type: 'QB_STATUS' });
    assert(
      coverStatus.covered &&
        !coverStatus.coverTemporary &&
        !!document.querySelector('[data-qb-cover]'),
      'YouTube video navigation reapplies the saved cover',
    );
    coverStatus = await send({ type: 'QB_PAUSE', paused: true });
    assert(
      !coverStatus.active && !coverStatus.covered && !document.querySelector('[data-qb-cover]'),
      'Show original temporarily removes a saved cover',
    );
    coverStatus = await send({ type: 'QB_PAUSE', paused: false });
    await wait();
    assert(
      coverStatus.active && coverStatus.covered && !!document.querySelector('[data-qb-cover]'),
      'Restoring Quiet Browse returns the saved cover',
    );
    getElement('movie_player').classList.add('ad-showing');
    await wait();
    assert(
      document.querySelector('[data-qb-cover]').hidden,
      'Recognized ad state uncovers playback',
    );
    getElement('movie_player').classList.remove('ad-showing');
    await wait();
    assert(
      !document.querySelector('[data-qb-cover]').hidden,
      'Cover returns after the recognized ad state ends',
    );
    window.lab.policy.settings.youtubePictureCover = false;
    coverStatus = await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !coverStatus.coverPersistent &&
        !coverStatus.covered &&
        !document.querySelector('[data-qb-cover]'),
      'Turning off the saved preference restores the picture immediately',
    );
    coverStatus = await send({ type: 'QB_COVER', covered: true });
    assert(
      coverStatus.covered &&
        coverStatus.coverTemporary &&
        !!document.querySelector('[data-qb-cover]'),
      'The original page-only cover remains available when persistence is off',
    );
    await send({ type: 'QB_COVER', covered: false });
    assert(
      !document.querySelector('[data-qb-cover]'),
      'The page-only Show picture action removes its cover',
    );
    await send({ type: 'QB_PAUSE', paused: true });
    const disabledShelf = document.createElement('ytd-reel-shelf-renderer');
    disabledShelf.id = 'disabled-shorts-shelf';
    const disabledShelfLink = document.createElement('a');
    disabledShelfLink.href = '/shorts/disabled-dynamic';
    disabledShelfLink.textContent = 'Short loaded while Quiet Browse is disabled';
    disabledShelf.append(disabledShelfLink);
    document.body.append(disabledShelf);
    await wait();
    assert(
      !document.querySelector('[data-qb-reveal]') &&
        getComputedStyle(getElement('related')).display !== 'none' &&
        !document.querySelector('[data-qb-youtube-shorts-hidden]') &&
        !document.querySelector('[data-qb-youtube-shorts-navigation-hidden]') &&
        !document.querySelector('[data-qb-youtube-playables-hidden]') &&
        isRendered('disabled-shorts-shelf'),
      'Show original restores YouTube surfaces and leaves newly loaded Shorts untouched',
    );
    assert(
      getComputedStyle(getElement('mouseover-overlay')).visibility === 'visible',
      'Show original restores previews',
    );
    getElement('test-status').textContent =
      `PASS — ${document.querySelectorAll('#results .pass').length} YouTube adapter fixture checks. Live YouTube still needs manual verification.`;
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  }
})();
