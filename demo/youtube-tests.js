(async () => {
  const { assert, send, wait } = window.lab;
  const $ = id => document.getElementById(id);
  const video = document.querySelector('#movie_player video');
  video.volume = 0.65; video.muted = false;
  $('mute').addEventListener('click', () => { video.muted = !video.muted; });
  try {
    await wait();
    assert(getComputedStyle($('related')).display === 'none', 'Recommendations collapse without removing their original nodes');
    document.querySelector('[data-qb-reveal]').click();
    assert(getComputedStyle($('related')).display !== 'none' && !!$('related').querySelector('a'), 'Reveal restores access to the original recommendation');
    assert(getComputedStyle($('mouseover-overlay')).visibility === 'hidden', 'Recognized thumbnail preview is visually quieted');
    assert(getComputedStyle($('cinematics')).visibility === 'hidden', 'Ambient background is visually quieted');
    await send({ type: 'QB_COVER', covered: true });
    assert(!!document.querySelector('[data-qb-cover]'), 'Manual cover appears over the video container');
    assert(Number(getComputedStyle(document.querySelector('.ytp-chrome-bottom')).zIndex) > 19 && Number(getComputedStyle(document.querySelector('.ytp-caption-window-container')).zIndex) > 19, 'Fixture player controls and captions remain above cover');
    const muteRect = $('mute').getBoundingClientRect();
    const hit = document.elementFromPoint(muteRect.left + muteRect.width / 2, muteRect.top + muteRect.height / 2);
    assert(hit === $('mute') || $('mute').contains(hit), 'The picture cover does not intercept the native mute control');
    $('mute').click();
    assert(video.muted && video.volume === 0.65, 'The native mute control still changes audio state without changing volume');
    assert(document.querySelector('[data-qb-cover]').style.pointerEvents === 'none', 'The picture cover passes pointer input through to player controls');
    $('movie_player').classList.add('ad-showing'); await wait();
    assert(document.querySelector('[data-qb-cover]').hidden, 'Recognized ad state uncovers playback');
    $('movie_player').classList.remove('ad-showing'); await wait();
    assert(!document.querySelector('[data-qb-cover]').hidden, 'Cover returns after the recognized ad state ends');
    await send({ type: 'QB_COVER', covered: false });
    assert(!document.querySelector('[data-qb-cover]'), 'Show picture removes the cover');
    await send({ type: 'QB_PAUSE', paused: true });
    assert(!document.querySelector('[data-qb-reveal]') && getComputedStyle($('related')).display !== 'none', 'Show original restores recommendation presentation');
    assert(getComputedStyle($('mouseover-overlay')).visibility === 'visible', 'Show original restores previews');
    $('test-status').textContent = 'PASS — 14 YouTube adapter fixture checks. Live YouTube still needs manual verification.';
  } catch (error) { $('test-status').textContent = `FAIL — ${error.message}`; console.error(error); }
})();
