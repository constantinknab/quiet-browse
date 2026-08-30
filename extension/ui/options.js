import { SOCIAL_FEATURES, cleanSettings, grayscaleAt, settingAt, siteCategory, isYouTube } from '../shared/settings.js';
import { ADULT_LIST_PERMISSION } from '../shared/adult-domains.js';

const $ = id => document.getElementById(id);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CATEGORY_META = Object.freeze({
  social: ['Social', 'Stories, discovery, short video, and scrollable feeds'],
  ecommerce: ['Ecommerce', 'Shopping sites with a calmer 20% grayscale starting point'],
  other: ['Other websites', 'Sites you added from the toolbar'],
});
let saved = { sites: {} };
const selectedSite = new URLSearchParams(location.search).get('site') || '';
let adult = { enabled: false, passwordProtected: false, customDomains: [], packagedCount: 0, remoteSources: [], remoteCount: 0, sources: [] };
let adultBusy = false;
let adultPreferenceSave = Promise.resolve();

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'The operation could not be completed.');
  return response.data;
}
function localDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'never';
}
function domainLines(id) { return $(id).value.split(/\r?\n/).map(value => value.trim()).filter(Boolean); }
function setMessage(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
function inputLabel(text, input) {
  const label = document.createElement('label'); label.append(input, document.createTextNode(text)); return label;
}
function sourceIds(containerId) {
  return [...$(containerId).querySelectorAll('input[data-source-id]:checked')].map(input => input.dataset.sourceId);
}
function renderSources(containerId) {
  const container = $(containerId); container.replaceChildren();
  for (const source of adult.sources || []) {
    const item = document.createElement('label'); item.className = 'source-choice';
    const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.sourceId = source.id;
    input.checked = source.selected; input.disabled = adultBusy;
    const copy = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = `${source.label} · up to ${source.limit.toLocaleString()}`;
    const detail = document.createElement('small'); detail.textContent = source.detail; copy.append(title, detail);
    if (adult.enabled) {
      const status = document.createElement('small'); status.className = source.lastError ? 'error' : 'muted';
      status.textContent = source.count
        ? `${source.count.toLocaleString()} active · updated ${localDate(source.lastUpdated)}${source.lastError ? ` · ${source.lastError}` : ''}`
        : source.selected ? `No successful update yet${source.lastError ? ` · ${source.lastError}` : ''}` : 'Not selected';
      copy.append(status);
    }
    item.append(input, copy); container.append(item);
    if (containerId === 'adult-source-options-off') input.addEventListener('change', () => {
      const sources = sourceIds(containerId); const selected = new Set(sources);
      adult.remoteSources = [...sources]; adult.sources.forEach(itemSource => { itemSource.selected = selected.has(itemSource.id); });
      adultPreferenceSave = adultPreferenceSave.then(() => request({ type: 'QB_ADULT_PREFERENCES', sources }))
        .then(result => { if (!adult.enabled) adult = result; setMessage('adult-message', 'List choices saved for next time.'); })
        .catch(error => { setMessage('adult-message', error.message, true); });
    });
  }
}
function renderAdult() {
  $('adult-off').hidden = adult.enabled; $('adult-on').hidden = !adult.enabled;
  for (const id of ['adult-enable', 'adult-save', 'adult-disable', 'adult-apply-sources', 'adult-refresh']) $(id).disabled = adultBusy;
  $('adult-refresh').disabled = adultBusy || !adult.remoteSources?.length;
  $('adult-current-label').hidden = !adult.passwordProtected; $('adult-current-password').hidden = !adult.passwordProtected;
  renderSources('adult-source-options-off'); renderSources('adult-source-options-on');
  if (adult.enabled && document.activeElement !== $('adult-active-domains')) $('adult-active-domains').value = adult.customDomains.join('\n');
  $('adult-status').textContent = adult.enabled
    ? `${adult.packagedCount} packaged, ${adult.customDomains.length} added, and ${adult.remoteCount.toLocaleString()} downloaded domains are active. ${adult.remoteSources.length ? 'Selected lists refresh about weekly.' : 'No community list is selected.'} ${adult.passwordProtected ? 'A password is required to weaken or disable the blocker.' : 'No password is set.'}`
    : '';
}
async function adultAction(operation, success = '') {
  if (adultBusy) return;
  adultBusy = true; setMessage('adult-message', ''); renderAdult();
  try { adult = await operation(); if (success) setMessage('adult-message', success); }
  catch (error) { setMessage('adult-message', error.message, true); }
  finally { adultBusy = false; renderAdult(); }
}

function windowEditor(schedule, { levels = false, idPrefix, changed }) {
  const wrap = document.createElement('div'); wrap.className = 'windows-editor';
  const list = document.createElement('div');
  const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add time window';
  const render = () => {
    list.replaceChildren();
    if (!schedule.windows.length) {
      const empty = document.createElement('p'); empty.className = 'notice';
      empty.textContent = 'No windows yet. Scheduled mode leaves this feature inactive until you add one.'; list.append(empty);
    }
    schedule.windows.forEach((entry, index) => {
      const fieldset = document.createElement('fieldset'); fieldset.className = 'schedule-window';
      const legend = document.createElement('legend'); legend.textContent = `Window ${index + 1}`; fieldset.append(legend);
      const dayRow = document.createElement('div'); dayRow.className = 'days';
      DAYS.forEach((day, dayIndex) => {
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = entry.days.includes(dayIndex);
        checkbox.setAttribute('aria-label', `${day}, ${idPrefix} window ${index + 1}`);
        checkbox.addEventListener('change', () => { entry.days = checkbox.checked ? [...entry.days, dayIndex].sort() : entry.days.filter(value => value !== dayIndex); changed(); });
        dayRow.append(inputLabel(day, checkbox));
      });
      fieldset.append(dayRow);
      const timeRow = document.createElement('div'); timeRow.className = 'time-fields';
      for (const [key, labelText] of [['start', 'Start'], ['end', 'End']]) {
        const input = document.createElement('input'); input.type = 'time'; input.required = true; input.value = entry[key];
        input.addEventListener('input', () => { entry[key] = input.value; changed(); });
        const label = document.createElement('label'); label.textContent = labelText; label.append(input); timeRow.append(label);
      }
      fieldset.append(timeRow);
      if (levels) {
        const label = document.createElement('label'); label.className = 'range-label';
        const input = document.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '100'; input.value = entry.level;
        const output = document.createElement('output'); output.textContent = `${entry.level}%`;
        input.addEventListener('input', () => { entry.level = Number(input.value); output.textContent = `${entry.level}%`; changed(); });
        label.append(document.createTextNode('Grayscale amount '), input, output); fieldset.append(label);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button'; remove.textContent = 'Remove window';
      remove.addEventListener('click', () => { schedule.windows.splice(index, 1); changed(); render(); });
      fieldset.append(remove); list.append(fieldset);
    });
    add.disabled = schedule.windows.length >= 12;
  };
  add.addEventListener('click', () => {
    const entry = { days: [1, 2, 3, 4, 5], start: '20:00', end: '23:00' };
    if (levels) entry.level = 80;
    schedule.windows.push(entry); changed(); render();
  });
  wrap.append(list, add); render(); return wrap;
}

function scheduleMode(select, schedule, editor, changed) {
  select.value = schedule.scheduled ? 'scheduled' : 'always';
  const sync = () => { editor.hidden = !schedule.scheduled; };
  select.addEventListener('change', () => { schedule.scheduled = select.value === 'scheduled'; changed(); sync(); }); sync();
}
function siteEditor(site, config) {
  const details = document.createElement('details'); details.className = 'site-card'; details.dataset.site = site;
  const summary = document.createElement('summary');
  const host = document.createElement('strong'); host.textContent = new URL(site).hostname;
  const state = document.createElement('span'); state.textContent = config.enabled ? 'On' : 'Off'; summary.append(host, state); details.append(summary);
  const form = document.createElement('form'); form.className = 'site-settings';
  let draft = cleanSettings(structuredClone(config.settings)); let enabled = config.enabled; let dirty = false;
  const message = document.createElement('p'); message.className = 'message'; message.setAttribute('role', 'status');
  const changed = () => { dirty = true; message.textContent = 'Unsaved changes.'; };

  const enabledInput = document.createElement('input'); enabledInput.type = 'checkbox'; enabledInput.checked = enabled;
  enabledInput.addEventListener('change', () => { enabled = enabledInput.checked; changed(); });
  form.append(inputLabel('Quiet Browse enabled for this site', enabledInput));

  if (isYouTube(site)) {
    const youtube = document.createElement('details'); youtube.className = 'control-block youtube-control';
    const summary = document.createElement('summary'); summary.textContent = 'YouTube picture'; youtube.append(summary);
    const body = document.createElement('div'); body.className = 'control-body';
    const persistentCover = document.createElement('input'); persistentCover.type = 'checkbox';
    persistentCover.checked = draft.youtubePictureCover;
    persistentCover.addEventListener('change', () => { draft.youtubePictureCover = persistentCover.checked; changed(); });
    body.append(inputLabel('Keep YouTube video picture hidden', persistentCover));
    const description = document.createElement('p'); description.className = 'muted';
    description.textContent = 'Automatically returns the picture cover after reloads and YouTube video changes. Audio, controls, captions, ads, and picture-in-picture stay available.';
    body.append(description); youtube.append(body); form.append(youtube);
  }

  const gray = document.createElement('details'); gray.className = 'control-block';
  const graySummary = document.createElement('summary'); graySummary.textContent = 'Grayscale and times'; gray.append(graySummary);
  const grayBody = document.createElement('div'); grayBody.className = 'control-body';
  const grayEnabled = document.createElement('input'); grayEnabled.type = 'checkbox'; grayEnabled.checked = draft.grayscale.enabled;
  grayEnabled.addEventListener('change', () => { draft.grayscale.enabled = grayEnabled.checked; changed(); }); grayBody.append(inputLabel('Enable grayscale', grayEnabled));
  const modeLabel = document.createElement('label'); modeLabel.className = 'field'; modeLabel.textContent = 'When';
  const grayMode = document.createElement('select'); grayMode.append(new Option('Always use the manual amount', 'always'), new Option('Only during scheduled times', 'scheduled')); modeLabel.append(grayMode); grayBody.append(modeLabel);
  const rangeLabel = document.createElement('label'); rangeLabel.className = 'range-label';
  const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '100'; range.value = draft.grayscale.level;
  const amount = document.createElement('output'); amount.textContent = `${draft.grayscale.level}%`;
  range.addEventListener('input', () => { draft.grayscale.level = Number(range.value); amount.textContent = `${range.value}%`; changed(); });
  rangeLabel.append(document.createTextNode('Manual amount '), range, amount); grayBody.append(rangeLabel);
  const grayWindows = windowEditor(draft.grayscale, { levels: true, idPrefix: `${site} grayscale`, changed });
  scheduleMode(grayMode, draft.grayscale, grayWindows, () => { changed(); range.disabled = draft.grayscale.scheduled; });
  range.disabled = draft.grayscale.scheduled; grayBody.append(grayWindows);
  const grayNow = document.createElement('p'); grayNow.className = 'muted'; grayNow.textContent = `Current local-clock result: ${grayscaleAt(draft.grayscale)}%.`; grayBody.append(grayNow);
  gray.append(grayBody); form.append(gray);

  if (siteCategory(site) === 'social') {
    const heading = document.createElement('h3'); heading.textContent = 'Social surfaces and times'; form.append(heading);
    const socialHelp = document.createElement('p'); socialHelp.className = 'muted';
    socialHelp.textContent = "Checked means hidden. TikTok's landing stream counts as both short-video and home-feed content, so either checked control stops it.";
    form.append(socialHelp);
    for (const feature of SOCIAL_FEATURES) {
      const control = document.createElement('details'); control.className = 'control-block social-control';
      const controlSummary = document.createElement('summary'); controlSummary.textContent = feature.label; control.append(controlSummary);
      const body = document.createElement('div'); body.className = 'control-body';
      const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = draft[feature.key];
      toggle.addEventListener('change', () => { draft[feature.key] = toggle.checked; changed(); }); body.append(inputLabel(feature.label, toggle));
      const description = document.createElement('p'); description.className = 'muted'; description.textContent = feature.detail; body.append(description);
      const label = document.createElement('label'); label.className = 'field'; label.textContent = 'When hidden';
      const mode = document.createElement('select'); mode.append(new Option('Always', 'always'), new Option('Only during scheduled times', 'scheduled')); label.append(mode); body.append(label);
      const schedule = draft.socialSchedules[feature.key];
      const editor = windowEditor(schedule, { idPrefix: `${site} ${feature.key}`, changed }); scheduleMode(mode, schedule, editor, changed); body.append(editor);
      const now = document.createElement('p'); now.className = 'muted'; now.textContent = settingAt(draft[feature.key], schedule) ? 'Hidden at the current local time.' : 'Available at the current local time.'; body.append(now);
      control.append(body); form.append(control);
    }
  }

  const actions = document.createElement('div'); actions.className = 'button-row';
  const save = document.createElement('button'); save.type = 'submit'; save.className = 'primary'; save.textContent = 'Save site settings';
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = 'Remove saved site'; actions.append(save, remove); form.append(actions, message); details.append(form);
  form.addEventListener('submit', async event => {
    event.preventDefault(); save.disabled = true; remove.disabled = true; message.classList.remove('error'); message.textContent = 'Saving…';
    try {
      const result = await request({ type: 'QB_SAVE', site, enabled, settings: cleanSettings(draft) });
      saved.sites[site] = result; draft = cleanSettings(result.settings); dirty = false; state.textContent = result.enabled ? 'On' : 'Off'; message.textContent = 'Saved.';
    } catch (error) { message.textContent = error.message; message.classList.add('error'); }
    finally { save.disabled = false; remove.disabled = false; }
  });
  remove.addEventListener('click', async () => {
    if (dirty && !confirm('Discard unsaved changes and remove this site?')) return;
    if (!confirm(`Remove Quiet Browse settings for ${new URL(site).hostname}?`)) return;
    remove.disabled = true;
    try { await request({ type: 'QB_FORGET', site }); delete saved.sites[site]; renderSites(); setMessage('site-message', 'Site settings removed.'); }
    catch (error) { remove.disabled = false; message.textContent = error.message; message.classList.add('error'); }
  });
  if (site === selectedSite) details.open = true;
  return details;
}
function renderSites() {
  const container = $('site-categories'); container.replaceChildren();
  for (const category of ['social', 'ecommerce', 'other']) {
    const entries = Object.entries(saved.sites).filter(([site]) => siteCategory(site) === category)
      .sort(([a], [b]) => new URL(a).hostname.localeCompare(new URL(b).hostname));
    if (!entries.length) continue;
    const group = document.createElement('details'); group.className = 'site-category';
    const summary = document.createElement('summary');
    const title = document.createElement('strong'); title.textContent = CATEGORY_META[category][0];
    const count = document.createElement('span'); count.textContent = `${entries.length} site${entries.length === 1 ? '' : 's'}`;
    const detail = document.createElement('small'); detail.textContent = CATEGORY_META[category][1]; summary.append(title, count, detail); group.append(summary);
    const list = document.createElement('div'); list.className = 'site-list'; entries.forEach(([site, config]) => list.append(siteEditor(site, config))); group.append(list);
    group.open = entries.some(([site]) => site === selectedSite); container.append(group);
  }
  if (!container.children.length) container.textContent = 'No saved sites.';
  const selected = container.querySelector(`[data-site="${CSS.escape(selectedSite)}"]`);
  if (selected) requestAnimationFrame(() => selected.scrollIntoView({ block: 'start' }));
}

$('adult-enable').addEventListener('click', () => {
  const sources = sourceIds('adult-source-options-off');
  const permission = sources.length ? chrome.permissions.request({ origins: [ADULT_LIST_PERMISSION] }) : Promise.resolve(true);
  adultAction(async () => {
    await adultPreferenceSave;
    const already = sources.length && await chrome.permissions.contains({ origins: [ADULT_LIST_PERMISSION] });
    if (!await permission) throw new Error('Community-list access was not granted. Deselect the lists to use only the packaged set.');
    try { return await request({ type: 'QB_ADULT_ENABLE', domains: domainLines('adult-domains'), password: $('adult-password').value, sources }); }
    catch (error) { if (sources.length && !already) await chrome.permissions.remove({ origins: [ADULT_LIST_PERMISSION] }); throw error; }
  }, 'Quit Porn is on.');
});
$('adult-apply-sources').addEventListener('click', () => {
  const sources = sourceIds('adult-source-options-on');
  const permission = sources.length ? chrome.permissions.request({ origins: [ADULT_LIST_PERMISSION] }) : Promise.resolve(true);
  adultAction(async () => {
    if (!await permission) throw new Error('Community-list access was not granted.');
    return request({ type: 'QB_ADULT_AUTO', sources, password: $('adult-current-password').value });
  }, 'Regional list selection saved and refreshed.');
});
$('adult-refresh').addEventListener('click', () => adultAction(() => request({ type: 'QB_ADULT_REFRESH' }), 'Selected lists updated.'));
$('adult-save').addEventListener('click', () => adultAction(() => request({ type: 'QB_ADULT_UPDATE', domains: domainLines('adult-active-domains'), password: $('adult-current-password').value }), 'Additional domains saved.'));
$('adult-disable').addEventListener('click', () => {
  const sources = sourceIds('adult-source-options-on');
  adultAction(async () => {
    const result = await request({ type: 'QB_ADULT_DISABLE', password: $('adult-current-password').value, sources }); $('adult-current-password').value = ''; return result;
  }, 'Quit Porn is off.');
});
$('reset').addEventListener('click', async () => {
  if (!confirm('Delete all Quiet Browse settings and optional access?')) return;
  const password = adult.passwordProtected ? prompt('Enter the Quit Porn protection password:') : '';
  if (adult.passwordProtected && password === null) return;
  $('reset').disabled = true;
  try { await request({ type: 'QB_RESET', password }); location.reload(); }
  catch (error) { setMessage('reset-message', error.message, true); $('reset').disabled = false; }
});

try {
  [saved, adult] = await Promise.all([request({ type: 'QB_LIST' }), request({ type: 'QB_ADULT_STATUS' })]); renderSites(); renderAdult();
} catch (error) { setMessage('site-message', error.message, true); }
