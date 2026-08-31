// YouTube-style fixture for recommendations, picture covering, and native controls.
(async () => {
  const { assert, send, wait } = window.lab;
  const getElement = (elementId) => document.getElementById(elementId);
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
    assert(
      !document.querySelector('[data-qb-reveal]') &&
        getComputedStyle(getElement('related')).display !== 'none',
      'Show original restores recommendation presentation',
    );
    assert(
      getComputedStyle(getElement('mouseover-overlay')).visibility === 'visible',
      'Show original restores previews',
    );
    getElement('test-status').textContent =
      'PASS — 22 YouTube adapter fixture checks. Live YouTube still needs manual verification.';
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  }
})();
