(async () => {
  const { assert, send, wait, policy } = window.lab;
  const $ = id => document.getElementById(id);
  try {
    await wait();
    assert((await send({ type: 'QB_STATUS' })).active, 'Content engine activates with a granted policy');
    assert($('promo').getAnimations()[0].playState === 'paused', 'Recognized decorative CSS loop pauses');
    assert($('spinner').getAnimations()[0].playState === 'running', 'Loading status animation remains running');
    assert($('finite').getAnimations()[0].playState === 'running', 'Finite entrance animation remains running');
    assert($('accept').getAttribute('data-qb-choice') === 'equal' && $('reject').getAttribute('data-qb-choice') === 'equal', 'Both real consent controls receive equal emphasis');
    assert(getComputedStyle($('accept')).fontSize === getComputedStyle($('reject')).fontSize, 'Consent visual emphasis is equal');
    assert($('clicks').textContent.endsWith('0'), 'No consent action is automatically clicked');
    assert(!$('security').querySelector('[data-qb-choice]'), 'Non-cookie security dialog is untouched');
    $('reject').click();
    assert($('clicks').textContent.endsWith('1'), 'Original consent event handler remains functional');
    $('start-video').click(); await wait();
    assert($('background').paused && $('background').controls, 'Muted background autoplay pauses and native controls appear');
    const extra = document.createElement('section'); extra.id = 'cookie-extra';
    const p = document.createElement('p'); p.textContent = 'Cookie options';
    const yes = document.createElement('button'); yes.textContent = 'Accept all';
    const no = document.createElement('button'); no.textContent = 'Reject all';
    extra.append(p, yes, no); document.querySelector('main').append(extra); await wait();
    assert(yes.getAttribute('data-qb-choice') === 'equal', 'Newly inserted prompts are handled');
    await send({ type: 'QB_PAUSE', paused: true });
    assert(!$('accept').hasAttribute('data-qb-choice') && !yes.hasAttribute('data-qb-choice'), 'Show original removes all consent modifications');
    assert($('promo').getAnimations()[0].playState === 'running', 'Show original resumes the original animation');
    assert(!$('background').controls && $('background').paused, 'Undo restores controls without restarting media');
    assert($('draft').value === 'Keep this unfinished note.', 'Undo does not reload or erase an unfinished form');
    await send({ type: 'QB_PAUSE', paused: false });
    assert((await send({ type: 'QB_STATUS' })).active, 'Session pause is reversible');
    policy.enabled = false; await send({ type: 'QB_REFRESH' });
    assert(!(await send({ type: 'QB_STATUS' })).active && !document.querySelector('[data-qb-choice],[data-qb-reveal],[data-qb-cover]'), 'Permission/policy removal fully restores page presentation');
    document.getElementById('test-status').textContent = 'PASS — 17 browser DOM checks. Chrome APIs simulated; not a live Chrome installation test.';
  } catch (error) { $('test-status').textContent = `FAIL — ${error.message}`; console.error(error); }
})();
