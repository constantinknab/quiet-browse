// Browser fixture for general content-engine behavior. This file is never packaged.
(async () => {
  const { assert, send, wait, policy } = window.lab;
  const getElement = (elementId) => document.getElementById(elementId);
  try {
    await wait();
    assert(
      (await send({ type: 'QB_STATUS' })).active,
      'Content engine activates with a granted policy',
    );
    assert(
      getElement('promo').getAnimations()[0].playState === 'paused',
      'Recognized decorative CSS loop pauses',
    );
    assert(
      getElement('spinner').getAnimations()[0].playState === 'running',
      'Loading status animation remains running',
    );
    assert(
      getElement('finite').getAnimations()[0].playState === 'running',
      'Finite entrance animation remains running',
    );
    assert(
      getElement('accept').getAttribute('data-qb-choice') === 'equal' &&
        getElement('reject').getAttribute('data-qb-choice') === 'equal',
      'Both real consent controls receive equal emphasis',
    );
    assert(
      getComputedStyle(getElement('accept')).fontSize ===
        getComputedStyle(getElement('reject')).fontSize,
      'Consent visual emphasis is equal',
    );
    assert(
      getElement('clicks').textContent.endsWith('0'),
      'No consent action is automatically clicked',
    );
    assert(
      !getElement('security').querySelector('[data-qb-choice]'),
      'Non-cookie security dialog is untouched',
    );
    getElement('reject').click();
    assert(
      getElement('clicks').textContent.endsWith('1'),
      'Original consent event handler remains functional',
    );
    getElement('start-video').click();
    await wait();
    assert(
      getElement('background').paused && getElement('background').controls,
      'Muted background autoplay pauses and native controls appear',
    );
    const insertedDialog = document.createElement('section');
    insertedDialog.id = 'cookie-extra';
    const promptText = document.createElement('p');
    promptText.textContent = 'Cookie options';
    const acceptButton = document.createElement('button');
    acceptButton.textContent = 'Accept all';
    const rejectButton = document.createElement('button');
    rejectButton.textContent = 'Reject all';
    insertedDialog.append(promptText, acceptButton, rejectButton);
    document.querySelector('main').append(insertedDialog);
    await wait();
    assert(
      acceptButton.getAttribute('data-qb-choice') === 'equal',
      'Newly inserted prompts are handled',
    );
    await send({ type: 'QB_PAUSE', paused: true });
    assert(
      !getElement('accept').hasAttribute('data-qb-choice') &&
        !acceptButton.hasAttribute('data-qb-choice'),
      'Show original removes all consent modifications',
    );
    assert(
      getElement('promo').getAnimations()[0].playState === 'running',
      'Show original resumes the original animation',
    );
    assert(
      !getElement('background').controls && getElement('background').paused,
      'Undo restores controls without restarting media',
    );
    assert(
      getElement('draft').value === 'Keep this unfinished note.',
      'Undo does not reload or erase an unfinished form',
    );
    await send({ type: 'QB_PAUSE', paused: false });
    assert((await send({ type: 'QB_STATUS' })).active, 'Session pause is reversible');
    policy.enabled = false;
    await send({ type: 'QB_REFRESH' });
    assert(
      !(await send({ type: 'QB_STATUS' })).active &&
        !document.querySelector('[data-qb-choice],[data-qb-reveal],[data-qb-cover]'),
      'Permission/policy removal fully restores page presentation',
    );
    document.getElementById('test-status').textContent =
      'PASS — 17 browser DOM checks. Chrome APIs simulated; not a live Chrome installation test.';
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  }
})();
