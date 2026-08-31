// Toolbar popup controller for the active tab.
// It requests exact host access only after a user click, persists per-site choices,
// and repairs a missing or outdated content-script receiver when Chrome allows it.
import {
  FEATURES,
  SOCIAL_FEATURES,
  cleanSettings,
  defaultsForSite,
  grayscaleAt,
  siteFromUrl,
  sitePattern,
  isYouTube,
  socialPlatform,
} from '../shared/settings.js';

const getElement = (elementId) => document.getElementById(elementId);
let tab;
let site;
let config = { enabled: false, settings: cleanSettings() };
let page = null;
let operationInProgress = false;
let isYouTubeSite = false;
let socialPlatformName = null;
const EXPECTED_ENGINE_VERSION = 9;

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok)
    throw new Error(
      response?.error || 'Could not reach the extension. Try reopening these controls.',
    );
  return response.data;
}
function showMessage(text, error = false) {
  getElement('message').textContent = text;
  getElement('message').classList.toggle('error', error);
}
const isPageReceiverMissing = (error) =>
  /Receiving end does not exist|Could not establish connection/i.test(error?.message || '');
async function sendPageMessageOnce(message) {
  const response = await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  if (response?.error) throw new Error(response.error);
  return response;
}
async function repairContentScripts() {
  if (!config.enabled || !site || !Number.isInteger(tab?.id) || !chrome.scripting) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: () => {
        for (const key of [
          '__quietBrowseV1',
          '__quietBrowseV2',
          '__quietBrowseV3',
          '__quietBrowseV4',
          '__quietBrowseV5',
          '__quietBrowseV6',
          '__quietBrowseV7',
          '__quietBrowseV8',
          '__quietBrowseV9',
        ]) {
          try {
            globalThis[key]?.dispose?.();
          } catch {
            /* Stale extension context. */
          }
          try {
            delete globalThis[key];
          } catch {
            /* Non-configurable collision. */
          }
        }
      },
    });
    const css = { target: { tabId: tab.id, frameIds: [0] }, files: ['content/presentation.css'] };
    try {
      await chrome.scripting.removeCSS(css);
    } catch {
      /* It may not be present yet. */
    }
    await chrome.scripting.insertCSS(css);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      files: ['shared/comfort.js', 'content/comfort.js', 'content/social.js', 'content/engine.js'],
    });
    const status = await sendPageMessageOnce({ type: 'QB_REFRESH' });
    return status?.engineVersion === EXPECTED_ENGINE_VERSION;
  } catch {
    return false;
  }
}
async function sendPageMessage(message, retry = true) {
  try {
    const response = await sendPageMessageOnce(message);
    if (
      retry &&
      response?.engineVersion &&
      response.engineVersion !== EXPECTED_ENGINE_VERSION &&
      (await repairContentScripts())
    )
      return sendPageMessage(message, false);
    return response;
  } catch (error) {
    if (retry && isPageReceiverMissing(error) && (await repairContentScripts()))
      return sendPageMessage(message, false);
    throw error;
  }
}
function renderControls() {
  getElement('enable').disabled = operationInProgress || !site;
  getElement('enable').textContent = config.enabled
    ? 'Turn off for this site'
    : 'Enable on this site';
  getElement('features').disabled = operationInProgress || !config.enabled;
  getElement('navigation').disabled = operationInProgress || !config.enabled;
  getElement('social-controls').disabled = operationInProgress || !config.enabled;
  getElement('youtube-controls').disabled = operationInProgress || !config.enabled;
  getElement('grayscale-controls').disabled = operationInProgress || !config.enabled;
  for (const feature of [...FEATURES, ...SOCIAL_FEATURES])
    getElement(feature.key).checked = config.settings[feature.key];
  const grayscaleSettings = config.settings.grayscale;
  getElement('gray-toggle').textContent = grayscaleSettings.enabled
    ? 'Turn grayscale off'
    : 'Enable grayscale';
  getElement('gray-toggle').setAttribute('aria-pressed', String(grayscaleSettings.enabled));
  getElement('gray-level').value = grayscaleSettings.level;
  getElement('gray-value').textContent = `${grayscaleSettings.level}%`;
  getElement('gray-level').disabled =
    grayscaleSettings.scheduled || operationInProgress || !config.enabled;
  getElement('gray-mode').value = grayscaleSettings.scheduled ? 'scheduled' : 'manual';
  const effectiveGrayscale =
    !page || page.paused || !config.enabled ? 0 : grayscaleAt(grayscaleSettings);
  getElement('gray-status').textContent = !grayscaleSettings.enabled
    ? 'Off. Color stays unchanged.'
    : !page
      ? [
          `Saved at ${
            grayscaleSettings.scheduled ? 'scheduled amounts' : `${grayscaleSettings.level}%`
          }.`,
          'Reload this page to apply it.',
        ].join(' ')
      : grayscaleSettings.scheduled
        ? [
            `${effectiveGrayscale}% now.`,
            `${grayscaleSettings.windows.length} time window(s), using your computer’s local time.`,
            'Each window has its own amount.',
          ].join(' ')
        : `${effectiveGrayscale}% now. 0% is full color; 100% removes color. Slider applies when released.`;
  getElement('session').hidden = !config.enabled || (!page && !isYouTubeSite);
  getElement('pause').disabled = operationInProgress;
  getElement('pause').hidden = !config.enabled || !page;
  getElement('pause').textContent = page?.paused ? 'Restore Quiet Browse' : 'Show original page';
  getElement('cover').hidden = !isYouTubeSite;
  getElement('cover').disabled = operationInProgress || !page?.active || !page?.coverAvailable;
  getElement('cover').textContent = page?.covered
    ? 'Show YouTube video picture'
    : 'Hide YouTube video picture';
  getElement('cover-note').hidden = !isYouTubeSite;
  const persistentCoverNote = config.settings.youtubePictureCover
    ? 'Your saved cover returns after reloads and video changes.'
    : '';
  getElement('cover-note').textContent = page?.coverAvailable
    ? [
        persistentCoverNote,
        'Hides the video picture, not the audio or edits.',
        'Playback and YouTube controls—including mute—remain available.',
        'Ads and picture-in-picture are not covered.',
      ]
        .filter(Boolean)
        .join(' ')
    : 'Reload this YouTube page to make Hide video picture available. Your saved site settings are intact.';
  getElement('counts').hidden = !page;
  const activityCounts = page?.active
    ? [
        `${page.loops} loops paused`,
        `${page.choices} choices emphasized`,
        `${page.videos} background videos paused`,
        page.platform ? `${page.hidden} social surfaces hidden` : '',
      ].filter(Boolean)
    : [];
  getElement('counts').textContent = activityCounts.length
    ? activityCounts.join(' · ')
    : 'Original presentation. Paused videos do not restart automatically.';
}
async function refreshPageStatus() {
  try {
    page = await sendPageMessage({ type: 'QB_STATUS' });
  } catch {
    page = null;
  }
}
async function saveSiteConfiguration() {
  const intendedConfiguration = {
    enabled: config.enabled,
    settings: cleanSettings(config.settings),
  };
  try {
    config = await request({ type: 'QB_SAVE', site, tabId: tab.id, ...config });
  } catch (error) {
    if (!isPageReceiverMissing(error)) throw error;
    const storedConfiguration = (await request({ type: 'QB_LIST' })).sites[site];
    if (
      !storedConfiguration ||
      storedConfiguration.enabled !== intendedConfiguration.enabled ||
      JSON.stringify(cleanSettings(storedConfiguration.settings)) !==
        JSON.stringify(intendedConfiguration.settings)
    )
      throw error;
    config = storedConfiguration;
  }
  await refreshPageStatus();
}
async function runUserAction(operation) {
  if (operationInProgress) return;
  operationInProgress = true;
  renderControls();
  try {
    await operation();
  } catch (error) {
    showMessage(
      isPageReceiverMissing(error)
        ? 'Reload this page to reconnect Quiet Browse. Your saved site settings are intact.'
        : error.message,
      !isPageReceiverMissing(error),
    );
    try {
      const saved = await request({ type: 'QB_LIST' });
      config = saved.sites[site] || { enabled: false, settings: cleanSettings() };
    } catch {
      /* Keep controls recoverable. */
    }
  } finally {
    operationInProgress = false;
    renderControls();
  }
}

for (const feature of [...FEATURES, ...SOCIAL_FEATURES]) {
  const featureLabel = document.createElement('label');
  featureLabel.className = 'feature';
  const featureCheckbox = document.createElement('input');
  featureCheckbox.type = 'checkbox';
  featureCheckbox.id = feature.key;
  const featureDescription = document.createElement('span');
  const featureName = document.createElement('strong');
  featureName.textContent = feature.label;
  const featureDetail = document.createElement('small');
  featureDetail.textContent = feature.detail;
  featureDescription.append(featureName, featureDetail);
  featureLabel.append(featureCheckbox, featureDescription);
  getElement(
    feature.key === 'pageMode'
      ? 'navigation'
      : feature.key.startsWith('social')
        ? 'social-controls'
        : feature.key === 'youtubePictureCover'
          ? 'youtube-controls'
          : 'features',
  ).append(featureLabel);
  featureCheckbox.addEventListener('change', () => {
    const checked = featureCheckbox.checked;
    runUserAction(async () => {
      config.settings[feature.key] = checked;
      await saveSiteConfiguration();
      if (feature.key === 'youtubePictureCover') {
        showMessage(
          checked
            ? 'Saved. YouTube video pictures will be covered after reloads and video changes.'
            : 'Saved. Persistent YouTube picture covering is off.',
        );
      } else
        showMessage(
          !page
            ? 'Saved. Reload this page to apply it.'
            : page.paused
              ? 'Saved. Restore Quiet Browse to apply on this page.'
              : 'Saved for this site.',
        );
    });
  });
}

getElement('enable').addEventListener('click', () => {
  if (operationInProgress || !site) return;
  // Request immediately in the user gesture; no preceding asynchronous work.
  const permissionRequest = config.enabled
    ? Promise.resolve(true)
    : chrome.permissions.request({ origins: [sitePattern(site)] });
  runUserAction(async () => {
    if (!(await permissionRequest)) {
      showMessage('Site access was not granted. This page is unchanged.');
      return;
    }
    config.enabled = !config.enabled;
    await saveSiteConfiguration();
    showMessage(
      config.enabled
        ? page
          ? 'Enabled. Changes are reversible below.'
          : 'Enabled. Reload this page if changes do not appear.'
        : 'Turned off. Use Sites & privacy to remove saved preferences and site access.',
    );
  });
});
getElement('pause').addEventListener('click', () =>
  runUserAction(async () => {
    page = await sendPageMessage({ type: 'QB_PAUSE', paused: !page.paused });
    showMessage('This setting resets on page reload.');
  }),
);
getElement('cover').addEventListener('click', () =>
  runUserAction(async () => {
    page = await sendPageMessage({ type: 'QB_COVER', covered: !page.covered });
    showMessage(
      page.covered
        ? `Picture covered for this page.${config.settings.youtubePictureCover ? ' The saved cover remains on.' : ''}`
        : config.settings.youtubePictureCover
          ? 'Picture shown temporarily. Your saved cover returns after reload or the next video.'
          : 'Original picture restored.',
    );
  }),
);
getElement('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
getElement('gray-toggle').addEventListener('click', () =>
  runUserAction(async () => {
    config.settings.grayscale.enabled = !config.settings.grayscale.enabled;
    await saveSiteConfiguration();
    showMessage(
      !page
        ? 'Saved. Reload this page to apply it.'
        : config.settings.grayscale.enabled
          ? 'Grayscale enabled for the selected mode.'
          : 'Grayscale turned off.',
    );
  }),
);
getElement('gray-level').addEventListener('input', (event) => {
  getElement('gray-value').textContent = `${event.target.value}%`;
});
getElement('gray-level').addEventListener('change', (event) => {
  const level = Number(event.target.value);
  runUserAction(async () => {
    config.settings.grayscale.level = level;
    await saveSiteConfiguration();
    showMessage(page ? 'Grayscale amount saved.' : 'Saved. Reload this page to apply it.');
  });
});
getElement('gray-mode').addEventListener('change', (event) => {
  const scheduled = event.target.value === 'scheduled';
  runUserAction(async () => {
    config.settings.grayscale.scheduled = scheduled;
    await saveSiteConfiguration();
    showMessage(
      scheduled ? 'Edit times and days to configure your windows.' : 'Manual mode selected.',
    );
  });
});
getElement('schedule').addEventListener('click', () => {
  if (site)
    chrome.tabs.create({
      url: `${chrome.runtime.getURL('ui/options.html')}?site=${encodeURIComponent(site)}`,
    });
});

try {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  site = siteFromUrl(tab?.url);
  getElement('site').textContent = site ? new URL(site).hostname : 'Unsupported page';
  if (!site) {
    getElement('scope').textContent =
      'Open an ordinary website. Browser settings, the Web Store, files, and other extensions cannot be changed.';
  } else {
    const saved = await request({ type: 'QB_LIST' });
    config = saved.sites[site] || { enabled: false, settings: defaultsForSite(site) };
    config.settings = cleanSettings(config.settings);
    if (!(await chrome.permissions.contains({ origins: [sitePattern(site)] })))
      config.enabled = false;
    isYouTubeSite = isYouTube(site);
    socialPlatformName = socialPlatform(site);
    getElement('social-controls').hidden = !socialPlatformName;
    getElement('social-note').hidden = !socialPlatformName;
    getElement('youtube-controls').hidden = !isYouTubeSite;
    getElement('youtube-cover-note').hidden = !isYouTubeSite;
    getElement('social-legend').textContent = socialPlatformName
      ? `${socialPlatformName} controls`
      : 'Social feed controls';
    for (const feature of FEATURES.filter((item) => item.key.startsWith('youtube'))) {
      getElement(feature.key).closest('label').hidden = !isYouTube(site);
    }
    if (isYouTube(site)) getElement('backgroundVideo').closest('label').hidden = true;
    await refreshPageStatus();
    const protocolLabel = new URL(site).protocol === 'https:' ? 'HTTPS' : 'HTTP';
    getElement('scope').textContent = [
      `${protocolLabel} on this host, including all ports.`,
      'Page analysis stays on your device.',
    ].join(' ');
  }
} catch (error) {
  showMessage(error.message, true);
}
renderControls();
