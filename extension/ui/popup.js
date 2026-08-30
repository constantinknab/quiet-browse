import { FEATURES, SOCIAL_FEATURES, cleanSettings, defaultsForSite, grayscaleAt, siteFromUrl, sitePattern, isYouTube, socialPlatform } from '../shared/settings.js';

const $ = id => document.getElementById(id);
let tab;
let site;
let config = { enabled: false, settings: cleanSettings() };
let page = null;
let busy = false;
let youtubeSite = false;
let socialSite = null;

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Could not reach the extension. Try reopening these controls.');
  return response.data;
}
function say(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
const receiverMissing = error => /Receiving end does not exist|Could not establish connection/i.test(error?.message || '');
async function rawPageMessage(message) {
  const response = await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  if (response?.error) throw new Error(response.error);
  return response;
}
async function repairPage() {
  if (!config.enabled || !site || !Number.isInteger(tab?.id) || !chrome.scripting) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: () => {
        for (const key of ['__quietBrowseV1', '__quietBrowseV2', '__quietBrowseV3', '__quietBrowseV4', '__quietBrowseV5', '__quietBrowseV6']) {
          try { globalThis[key]?.dispose?.(); } catch { /* Stale extension context. */ }
          try { delete globalThis[key]; } catch { /* Non-configurable collision. */ }
        }
      },
    });
    const css = { target: { tabId: tab.id, frameIds: [0] }, files: ['content/presentation.css'] };
    try { await chrome.scripting.removeCSS(css); } catch { /* It may not be present yet. */ }
    await chrome.scripting.insertCSS(css);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      files: ['shared/comfort.js', 'content/comfort.js', 'content/social.js', 'content/engine.js'],
    });
    const status = await rawPageMessage({ type: 'QB_REFRESH' });
    return status?.engineVersion === 6;
  } catch { return false; }
}
async function pageMessage(message, retry = true) {
  try { return await rawPageMessage(message); }
  catch (error) {
    if (retry && receiverMissing(error) && await repairPage()) return pageMessage(message, false);
    throw error;
  }
}
function render() {
  $('enable').disabled = busy || !site;
  $('enable').textContent = config.enabled ? 'Turn off for this site' : 'Enable on this site';
  $('features').disabled = busy || !config.enabled;
  $('navigation').disabled = busy || !config.enabled;
  $('social-controls').disabled = busy || !config.enabled;
  $('grayscale-controls').disabled = busy || !config.enabled;
  for (const feature of [...FEATURES, ...SOCIAL_FEATURES]) $(feature.key).checked = config.settings[feature.key];
  const gray = config.settings.grayscale;
  $('gray-toggle').textContent = gray.enabled ? 'Turn grayscale off' : 'Enable grayscale';
  $('gray-toggle').setAttribute('aria-pressed', String(gray.enabled));
  $('gray-level').value = gray.level;
  $('gray-value').textContent = `${gray.level}%`;
  $('gray-level').disabled = gray.scheduled || busy || !config.enabled;
  $('gray-mode').value = gray.scheduled ? 'scheduled' : 'manual';
  const effective = !page || page.paused || !config.enabled ? 0 : grayscaleAt(gray);
  $('gray-status').textContent = !gray.enabled ? 'Off. Color stays unchanged.' : !page
    ? `Saved at ${gray.scheduled ? 'scheduled amounts' : `${gray.level}%`}. Reload this page to apply it.`
    : gray.scheduled
    ? `${effective}% now. ${gray.windows.length} time window(s), using your computer’s local time. Each window has its own amount.`
    : `${effective}% now. 0% is full color; 100% removes color. Slider applies when released.`;
  $('session').hidden = !config.enabled || (!page && !youtubeSite);
  $('pause').disabled = busy;
  $('pause').hidden = !config.enabled || !page;
  $('pause').textContent = page?.paused ? 'Restore Quiet Browse' : 'Show original page';
  $('cover').hidden = !youtubeSite;
  $('cover').disabled = busy || !page?.active || !page?.coverAvailable;
  $('cover').textContent = page?.covered ? 'Show YouTube video picture' : 'Hide YouTube video picture';
  $('cover-note').hidden = !youtubeSite;
  $('cover-note').textContent = page?.coverAvailable
    ? 'Hides the video picture, not the audio or edits. Playback and YouTube controls—including mute—remain available. Ads and picture-in-picture are not covered.'
    : 'Reload this YouTube page to make Hide video picture available. Your saved site settings are intact.';
  $('counts').hidden = !page;
  $('counts').textContent = page?.active
    ? `${page.loops} loops paused · ${page.choices} choices emphasized · ${page.videos} background videos paused${page.platform ? ` · ${page.hidden} social surfaces hidden` : ''}`
    : 'Original presentation. Paused videos do not restart automatically.';
}
async function refreshPage() {
  try { page = await pageMessage({ type: 'QB_STATUS' }); } catch { page = null; }
}
async function save() {
  const intended = { enabled: config.enabled, settings: cleanSettings(config.settings) };
  try { config = await request({ type: 'QB_SAVE', site, tabId: tab.id, ...config }); }
  catch (error) {
    if (!receiverMissing(error)) throw error;
    const saved = (await request({ type: 'QB_LIST' })).sites[site];
    if (!saved || saved.enabled !== intended.enabled ||
        JSON.stringify(cleanSettings(saved.settings)) !== JSON.stringify(intended.settings)) throw error;
    config = saved;
  }
  await refreshPage();
}
async function action(operation) {
  if (busy) return;
  busy = true; render();
  try { await operation(); }
  catch (error) {
    say(receiverMissing(error) ? 'Reload this page to reconnect Quiet Browse. Your saved site settings are intact.' : error.message, !receiverMissing(error));
    try { const saved = await request({ type: 'QB_LIST' }); config = saved.sites[site] || { enabled: false, settings: cleanSettings() }; } catch { /* Keep controls recoverable. */ }
  }
  finally { busy = false; render(); }
}

for (const feature of [...FEATURES, ...SOCIAL_FEATURES]) {
  const label = document.createElement('label'); label.className = 'feature';
  const input = document.createElement('input'); input.type = 'checkbox'; input.id = feature.key;
  const text = document.createElement('span');
  const name = document.createElement('strong'); name.textContent = feature.label;
  const detail = document.createElement('small'); detail.textContent = feature.detail;
  text.append(name, detail); label.append(input, text);
  $(feature.key === 'pageMode' ? 'navigation' : feature.key.startsWith('social') ? 'social-controls' : 'features').append(label);
  input.addEventListener('change', () => {
    const checked = input.checked;
    action(async () => {
      config.settings[feature.key] = checked;
      await save(); say(!page ? 'Saved. Reload this page to apply it.' : page.paused ? 'Saved. Restore Quiet Browse to apply on this page.' : 'Saved for this site.');
    });
  });
}

$('enable').addEventListener('click', () => {
  if (busy || !site) return;
  // Request immediately in the user gesture; no preceding asynchronous work.
  const grant = config.enabled ? Promise.resolve(true) : chrome.permissions.request({ origins: [sitePattern(site)] });
  action(async () => {
    if (!await grant) { say('Site access was not granted. This page is unchanged.'); return; }
    config.enabled = !config.enabled;
    await save();
    say(config.enabled ? (page ? 'Enabled. Changes are reversible below.' : 'Enabled. Reload this page if changes do not appear.') : 'Turned off. Use Sites & privacy to remove saved preferences and site access.');
  });
});
$('pause').addEventListener('click', () => action(async () => { page = await pageMessage({ type: 'QB_PAUSE', paused: !page.paused }); say('This setting resets on page reload.'); }));
$('cover').addEventListener('click', () => action(async () => { page = await pageMessage({ type: 'QB_COVER', covered: !page.covered }); say(page.covered ? 'Picture covered. Visual information is hidden until you restore it.' : 'Original picture restored.'); }));
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('gray-toggle').addEventListener('click', () => action(async () => {
  config.settings.grayscale.enabled = !config.settings.grayscale.enabled;
  await save(); say(!page ? 'Saved. Reload this page to apply it.' : config.settings.grayscale.enabled ? 'Grayscale enabled for the selected mode.' : 'Grayscale turned off.');
}));
$('gray-level').addEventListener('input', event => { $('gray-value').textContent = `${event.target.value}%`; });
$('gray-level').addEventListener('change', event => {
  const level = Number(event.target.value);
  action(async () => { config.settings.grayscale.level = level; await save(); say(page ? 'Grayscale amount saved.' : 'Saved. Reload this page to apply it.'); });
});
$('gray-mode').addEventListener('change', event => {
  const scheduled = event.target.value === 'scheduled';
  action(async () => { config.settings.grayscale.scheduled = scheduled; await save(); say(scheduled ? 'Edit times and days to configure your windows.' : 'Manual mode selected.'); });
});
$('schedule').addEventListener('click', () => {
  if (site) chrome.tabs.create({ url: `${chrome.runtime.getURL('ui/options.html')}?site=${encodeURIComponent(site)}` });
});

try {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  site = siteFromUrl(tab?.url);
  $('site').textContent = site ? new URL(site).hostname : 'Unsupported page';
  if (!site) {
    $('scope').textContent = 'Open an ordinary website. Browser settings, the Web Store, files, and other extensions cannot be changed.';
  } else {
    const saved = await request({ type: 'QB_LIST' });
    config = saved.sites[site] || { enabled: false, settings: defaultsForSite(site) };
    config.settings = cleanSettings(config.settings);
    if (!await chrome.permissions.contains({ origins: [sitePattern(site)] })) config.enabled = false;
    youtubeSite = isYouTube(site);
    socialSite = socialPlatform(site);
    $('social-controls').hidden = !socialSite;
    $('social-note').hidden = !socialSite;
    $('social-legend').textContent = socialSite ? `${socialSite} controls` : 'Social feed controls';
    for (const feature of FEATURES.filter(item => item.key.startsWith('youtube'))) {
      $(feature.key).closest('label').hidden = !isYouTube(site);
    }
    if (isYouTube(site)) $('backgroundVideo').closest('label').hidden = true;
    await refreshPage();
    $('scope').textContent = `${new URL(site).protocol === 'https:' ? 'HTTPS' : 'HTTP'} on this host, including all ports. Page analysis stays on your device.`;
  }
} catch (error) { say(error.message, true); }
render();
