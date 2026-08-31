// Browser fixture for popup and options-page rendering and save interactions.
const waitFor = async (predicate) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for the interface.');
};
const results = document.createElement('ol');
results.id = 'ui-results';
const status = document.createElement('p');
status.id = 'ui-test-status';
status.setAttribute('role', 'status');
status.textContent = 'Running UI checks…';
const anchor = document.querySelector('main');
anchor.prepend(status, results);
let count = 0;
function assert(condition, label) {
  const item = document.createElement('li');
  item.className = condition ? 'pass' : 'fail';
  item.textContent = `${condition ? 'PASS' : 'FAIL'} — ${label}`;
  results.append(item);
  if (!condition) throw new Error(label);
  count += 1;
}
try {
  if (location.pathname.includes('/popup')) {
    const parameters = new URLSearchParams(location.search);
    const testSite = parameters.has('social')
      ? 'https://www.instagram.com'
      : parameters.has('shopping')
        ? 'https://www.amazon.com'
        : 'https://www.youtube.com';
    await waitFor(() => !document.getElementById('enable').disabled);
    const enable = document.getElementById('enable');
    enable.click();
    await waitFor(() => enable.textContent === 'Turn off for this site');
    assert(
      document.getElementById('navigation').disabled === false,
      'Granting one simulated site enables its controls',
    );
    const paging = document.getElementById('pageMode');
    paging.click();
    await waitFor(() => paging.checked);
    const toggle = document.getElementById('gray-toggle');
    if (parameters.has('shopping')) {
      assert(
        toggle.getAttribute('aria-pressed') === 'true' &&
          document.getElementById('gray-value').textContent === '20%',
        'Built-in shopping profiles begin at 20% grayscale',
      );
    } else {
      toggle.click();
      await waitFor(() => toggle.getAttribute('aria-pressed') === 'true');
    }
    const level = document.getElementById('gray-level');
    level.value = '42';
    level.dispatchEvent(new Event('input', { bubbles: true }));
    level.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => document.getElementById('gray-value').textContent === '42%');
    const config = (await chrome.runtime.sendMessage({ type: 'QB_LIST' })).data.sites[testSite];
    assert(config.settings.pageMode === true, 'Paging preference is saved for this host');
    assert(
      config.settings.grayscale.enabled && config.settings.grayscale.level === 42,
      'Manual grayscale strength is saved for this host',
    );
    assert(
      new URLSearchParams(location.search).has('offline')
        ? document.getElementById('gray-status').textContent ===
            'Saved at 42%. Reload this page to apply it.'
        : document.getElementById('gray-status').textContent.startsWith('42% now'),
      'Popup reports the applicable grayscale state',
    );
    if (
      testSite === 'https://www.youtube.com' &&
      !parameters.has('offline') &&
      !parameters.has('repair')
    ) {
      const persistentCover = document.getElementById('youtubePictureCover');
      assert(
        !document.getElementById('youtube-controls').hidden && !persistentCover.checked,
        'YouTube exposes a separate saved picture-cover preference',
      );
      persistentCover.click();
      await waitFor(
        () =>
          persistentCover.checked &&
          document.getElementById('cover').textContent === 'Show YouTube video picture',
      );
      let youtubeConfig = (await chrome.runtime.sendMessage({ type: 'QB_LIST' })).data.sites[
        testSite
      ];
      assert(
        youtubeConfig.settings.youtubePictureCover === true,
        'Persistent picture covering is saved for the YouTube host',
      );
      document.getElementById('cover').click();
      await waitFor(
        () => document.getElementById('cover').textContent === 'Hide YouTube video picture',
      );
      youtubeConfig = (await chrome.runtime.sendMessage({ type: 'QB_LIST' })).data.sites[testSite];
      assert(
        youtubeConfig.settings.youtubePictureCover === true &&
          document.getElementById('message').textContent.includes('returns after reload'),
        'Page-only Show picture leaves the saved preference intact',
      );
    }
    if (new URLSearchParams(location.search).has('social')) {
      assert(
        !document.getElementById('social-controls').hidden &&
          document.querySelectorAll('#social-controls input').length === 5,
        'A supported social site shows five independent controls',
      );
      const stories = document.getElementById('socialStories');
      stories.click();
      await waitFor(() => !stories.checked);
      const socialConfig = (await chrome.runtime.sendMessage({ type: 'QB_LIST' })).data.sites[
        'https://www.instagram.com'
      ];
      assert(
        socialConfig.settings.socialStories === false &&
          socialConfig.settings.socialHomeFeed === true,
        'One social surface can be restored without changing the others',
      );
      assert(
        socialConfig.settings.socialSuggestions === true,
        'Restoring Stories does not restore follow recommendations',
      );
    }
    if (new URLSearchParams(location.search).has('offline')) {
      assert(
        document.getElementById('message').textContent === 'Saved. Reload this page to apply it.',
        'A missing page receiver becomes a reload instruction, not a connection error',
      );
      assert(
        !document.getElementById('cover').hidden && document.getElementById('cover').disabled,
        'Hide video picture stays visible while awaiting a page reload',
      );
      assert(
        document.getElementById('cover-note').textContent.startsWith('Reload this YouTube page'),
        'The unavailable hide-video control explains how to restore it',
      );
    }
    if (new URLSearchParams(location.search).has('repair')) {
      assert(
        document.getElementById('message').textContent !==
          'Could not establish connection. Receiving end does not exist.',
        'Direct page repair prevents a connection error',
      );
      assert(
        !document.getElementById('cover').disabled,
        'Direct page repair restores the hide-video control without a tab reload',
      );
      assert(
        document.getElementById('cover-note').textContent.includes('including mute'),
        'The repaired page exposes the mute-safe cover explanation',
      );
    }
    if (new URLSearchParams(location.search).has('stale')) {
      assert(
        document.getElementById('message').textContent !==
          'Could not establish connection. Receiving end does not exist.' &&
          !document.getElementById('cover').disabled,
        'Opening the popup replaces an older live content engine without requiring a page reload',
      );
    }
  } else {
    await waitFor(() => document.querySelectorAll('.site-category').length === 3);
    const categories = [...document.querySelectorAll('.site-category')];
    assert(
      categories.map((group) => group.querySelector('summary strong').textContent).join('|') ===
        'Social|Ecommerce|Other websites',
      'Saved sites are grouped into Social, Ecommerce, and Other dropdowns',
    );
    const ecommerce = categories[1];
    assert(
      !ecommerce.open && !ecommerce.querySelector('.site-card').open,
      'The ecommerce list stays compact until its category and a site are opened',
    );
    const social = categories[0];
    social.open = true;
    const instagram = social.querySelector('.site-card');
    instagram.open = true;
    const form = instagram.querySelector('form');
    const grayControl = form.querySelector('.control-block');
    grayControl.open = true;
    grayControl.querySelector('input[type="checkbox"]').click();
    const grayMode = grayControl.querySelector('select');
    grayMode.value = 'scheduled';
    grayMode.dispatchEvent(new Event('change', { bubbles: true }));
    grayControl.querySelector('.windows-editor > button').click();
    const [start, end] = grayControl.querySelectorAll('input[type="time"]');
    start.value = '20:30';
    start.dispatchEvent(new Event('input', { bubbles: true }));
    end.value = '06:45';
    end.dispatchEvent(new Event('input', { bubbles: true }));
    const storiesControl = form.querySelector('.social-control');
    storiesControl.open = true;
    const storiesMode = storiesControl.querySelector('select');
    storiesMode.value = 'scheduled';
    storiesMode.dispatchEvent(new Event('change', { bubbles: true }));
    storiesControl.querySelector('.windows-editor > button').click();
    form.requestSubmit();
    await waitFor(() => form.querySelector('.message').textContent === 'Saved.');
    const settings = (await chrome.runtime.sendMessage({ type: 'QB_LIST' })).data.sites[
      'https://www.instagram.com'
    ].settings;
    const gray = settings.grayscale;
    assert(gray.enabled && gray.scheduled, 'Schedule mode and master grayscale switch are saved');
    assert(
      gray.windows.length === 1 &&
        gray.windows[0].start === '20:30' &&
        gray.windows[0].end === '06:45',
      'Overnight start and end times are saved',
    );
    assert(
      settings.socialSchedules.socialStories.scheduled &&
        settings.socialSchedules.socialStories.windows.length === 1,
      'Stories can be hidden on their own local-time schedule',
    );
    assert(
      !settings.socialSchedules.socialSuggestions.scheduled &&
        !settings.socialSchedules.socialShortVideo.scheduled &&
        !settings.socialSchedules.socialHomeFeed.scheduled,
      'Stories, follow recommendations, short video, and scrollable-feed schedules remain independent',
    );
    const youtubeCard = document.querySelector('[data-site="https://www.youtube.com"]');
    youtubeCard.open = true;
    const youtubeForm = youtubeCard.querySelector('form');
    const youtubeControl = youtubeForm.querySelector('.youtube-control');
    youtubeControl.open = true;
    youtubeControl.querySelector('input[type="checkbox"]').click();
    youtubeForm.requestSubmit();
    await waitFor(() => youtubeForm.querySelector('.message').textContent === 'Saved.');
    const youtubeSettings = (await chrome.runtime.sendMessage({ type: 'QB_LIST' })).data.sites[
      'https://www.youtube.com'
    ].settings;
    assert(
      youtubeSettings.youtubePictureCover === true,
      'Sites & privacy can save persistent YouTube picture covering',
    );
    document.getElementById('adult-domains').value = 'custom.example';
    const sourceChoices = [...document.querySelectorAll('#adult-source-options-off input')];
    sourceChoices.forEach((input) => {
      input.checked = true;
    });
    sourceChoices.at(-1).dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() =>
      document.getElementById('adult-message').textContent.includes('saved for next time'),
    );
    document.getElementById('adult-enable').click();
    await waitFor(() => !document.getElementById('adult-on').hidden);
    assert(
      document.getElementById('adult-status').textContent.includes('1 added'),
      'Quit Porn activates the local blocker and an additional domain',
    );
    assert(
      document.querySelectorAll('#adult-source-options-on input:checked').length === 3 &&
        document.getElementById('adult-status').textContent.includes('4,542 downloaded'),
      'US, China, and Japan lists show independent selected state and a combined active count',
    );
    document.getElementById('adult-refresh').click();
    await waitFor(() =>
      document.getElementById('adult-message').textContent.includes('Selected lists updated'),
    );
    assert(
      !document.getElementById('adult-refresh').disabled,
      'The selected regional lists can be refreshed manually',
    );
    assert(
      !document.getElementById('adult-current-password').offsetParent,
      'Password input stays hidden when password protection was not selected',
    );
    document.getElementById('adult-disable').click();
    await waitFor(() => !document.getElementById('adult-off').hidden);
    assert(
      document.querySelectorAll('#adult-source-options-off input:checked').length === 3 &&
        (await chrome.runtime.sendMessage({ type: 'QB_ADULT_STATUS' })).data.remoteSources
          .length === 3,
      'Turning the blocker off removes active filtering but remembers list choices across settings reloads',
    );
  }
  status.textContent = `PASS — ${count} interface checks. Chrome APIs simulated.`;
} catch (error) {
  status.textContent = `FAIL — ${error.message}`;
  console.error(error);
}
