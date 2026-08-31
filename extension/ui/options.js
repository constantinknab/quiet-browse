// Options-page controller.
// It builds site editors and schedules with DOM methods, saves only sanitized settings,
// and keeps Adult Guard permission requests inside explicit user click handlers.
import {
  SOCIAL_FEATURES,
  cleanSettings,
  grayscaleAt,
  settingAt,
  siteCategory,
  isYouTube,
} from '../shared/settings.js';
import { ADULT_LIST_PERMISSION } from '../shared/adult-domains.js';

const getElement = (elementId) => document.getElementById(elementId);
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CATEGORY_DESCRIPTIONS = Object.freeze({
  social: ['Social', 'Stories, discovery, short video, and scrollable feeds'],
  ecommerce: ['Ecommerce', 'Shopping sites with a calmer 20% grayscale starting point'],
  other: ['Other websites', 'Sites you added from the toolbar'],
});
let saved = { sites: {} };
const selectedSite = new URLSearchParams(location.search).get('site') || '';
let adult = {
  enabled: false,
  passwordProtected: false,
  customDomains: [],
  packagedCount: 0,
  remoteSources: [],
  remoteCount: 0,
  sources: [],
};
let adultOperationInProgress = false;
let adultPreferenceSaveQueue = Promise.resolve();

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'The operation could not be completed.');
  return response.data;
}
function formatLocalDate(timestamp) {
  return timestamp
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(timestamp),
      )
    : 'never';
}
function readDomainLines(textAreaId) {
  return getElement(textAreaId)
    .value.split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}
function setMessage(elementId, messageText, isError = false) {
  getElement(elementId).textContent = messageText;
  getElement(elementId).classList.toggle('error', isError);
}
function inputLabel(labelText, inputElement) {
  const label = document.createElement('label');
  label.append(inputElement, document.createTextNode(labelText));
  return label;
}
function selectedSourceIds(containerId) {
  return [...getElement(containerId).querySelectorAll('input[data-source-id]:checked')].map(
    (input) => input.dataset.sourceId,
  );
}
function renderAdultSources(containerId) {
  const container = getElement(containerId);
  container.replaceChildren();
  for (const source of adult.sources || []) {
    const sourceOption = document.createElement('label');
    sourceOption.className = 'source-choice';
    const sourceCheckbox = document.createElement('input');
    sourceCheckbox.type = 'checkbox';
    sourceCheckbox.dataset.sourceId = source.id;
    sourceCheckbox.checked = source.selected;
    sourceCheckbox.disabled = adultOperationInProgress;
    const sourceDescription = document.createElement('span');
    const sourceTitle = document.createElement('strong');
    sourceTitle.textContent = `${source.label} · up to ${source.limit.toLocaleString()}`;
    const sourceDetail = document.createElement('small');
    sourceDetail.textContent = source.detail;
    sourceDescription.append(sourceTitle, sourceDetail);
    if (adult.enabled) {
      const sourceStatus = document.createElement('small');
      sourceStatus.className = source.lastError ? 'error' : 'muted';
      const errorSuffix = source.lastError ? ` · ${source.lastError}` : '';
      sourceStatus.textContent = source.count
        ? [
            `${source.count.toLocaleString()} active`,
            `updated ${formatLocalDate(source.lastUpdated)}${errorSuffix}`,
          ].join(' · ')
        : source.selected
          ? `No successful update yet${errorSuffix}`
          : 'Not selected';
      sourceDescription.append(sourceStatus);
    }
    sourceOption.append(sourceCheckbox, sourceDescription);
    container.append(sourceOption);
    if (containerId === 'adult-source-options-off')
      sourceCheckbox.addEventListener('change', () => {
        const sources = selectedSourceIds(containerId);
        const selected = new Set(sources);
        adult.remoteSources = [...sources];
        adult.sources.forEach((itemSource) => {
          itemSource.selected = selected.has(itemSource.id);
        });
        // Preserve click order so a slower earlier storage write cannot restore
        // checkboxes the user subsequently cleared.
        adultPreferenceSaveQueue = adultPreferenceSaveQueue
          .then(() => request({ type: 'QB_ADULT_PREFERENCES', sources }))
          .then((result) => {
            if (!adult.enabled) adult = result;
            setMessage('adult-message', 'List choices saved for next time.');
          })
          .catch((error) => {
            setMessage('adult-message', error.message, true);
          });
      });
  }
}
function renderAdultGuard() {
  getElement('adult-off').hidden = adult.enabled;
  getElement('adult-on').hidden = !adult.enabled;
  for (const id of [
    'adult-enable',
    'adult-save',
    'adult-disable',
    'adult-apply-sources',
    'adult-refresh',
  ])
    getElement(id).disabled = adultOperationInProgress;
  getElement('adult-refresh').disabled = adultOperationInProgress || !adult.remoteSources?.length;
  getElement('adult-current-label').hidden = !adult.passwordProtected;
  getElement('adult-current-password').hidden = !adult.passwordProtected;
  renderAdultSources('adult-source-options-off');
  renderAdultSources('adult-source-options-on');
  if (adult.enabled && document.activeElement !== getElement('adult-active-domains'))
    getElement('adult-active-domains').value = adult.customDomains.join('\n');
  const domainCountSummary = [
    `${adult.packagedCount} packaged`,
    `${adult.customDomains.length} added`,
    `${adult.remoteCount.toLocaleString()} downloaded domains`,
  ].join(', ');
  const updateSummary = adult.remoteSources.length
    ? 'Selected lists refresh about weekly.'
    : 'No community list is selected.';
  const passwordSummary = adult.passwordProtected
    ? 'A password is required to weaken or disable the blocker.'
    : 'No password is set.';
  getElement('adult-status').textContent = adult.enabled
    ? `${domainCountSummary} are active. ${updateSummary} ${passwordSummary}`
    : '';
}
async function runAdultGuardAction(operation, success = '') {
  if (adultOperationInProgress) return;
  adultOperationInProgress = true;
  setMessage('adult-message', '');
  renderAdultGuard();
  try {
    adult = await operation();
    if (success) setMessage('adult-message', success);
  } catch (error) {
    setMessage('adult-message', error.message, true);
  } finally {
    adultOperationInProgress = false;
    renderAdultGuard();
  }
}

function createScheduleWindowEditor(schedule, { levels = false, idPrefix, changed }) {
  // Each editor mutates only its in-memory draft. The enclosing site form performs
  // one sanitized save when the user chooses Save site settings.
  const editorContainer = document.createElement('div');
  editorContainer.className = 'windows-editor';
  const windowList = document.createElement('div');
  const addWindowButton = document.createElement('button');
  addWindowButton.type = 'button';
  addWindowButton.textContent = 'Add time window';
  const renderWindows = () => {
    windowList.replaceChildren();
    if (!schedule.windows.length) {
      const empty = document.createElement('p');
      empty.className = 'notice';
      empty.textContent =
        'No windows yet. Scheduled mode leaves this feature inactive until you add one.';
      windowList.append(empty);
    }
    schedule.windows.forEach((entry, index) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'schedule-window';
      const legend = document.createElement('legend');
      legend.textContent = `Window ${index + 1}`;
      fieldset.append(legend);
      const dayRow = document.createElement('div');
      dayRow.className = 'days';
      DAY_LABELS.forEach((day, dayIndex) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = entry.days.includes(dayIndex);
        checkbox.setAttribute('aria-label', `${day}, ${idPrefix} window ${index + 1}`);
        checkbox.addEventListener('change', () => {
          entry.days = checkbox.checked
            ? [...entry.days, dayIndex].sort()
            : entry.days.filter((value) => value !== dayIndex);
          changed();
        });
        dayRow.append(inputLabel(day, checkbox));
      });
      fieldset.append(dayRow);
      const timeRow = document.createElement('div');
      timeRow.className = 'time-fields';
      for (const [key, labelText] of [
        ['start', 'Start'],
        ['end', 'End'],
      ]) {
        const input = document.createElement('input');
        input.type = 'time';
        input.required = true;
        input.value = entry[key];
        input.addEventListener('input', () => {
          entry[key] = input.value;
          changed();
        });
        const label = document.createElement('label');
        label.textContent = labelText;
        label.append(input);
        timeRow.append(label);
      }
      fieldset.append(timeRow);
      if (levels) {
        const label = document.createElement('label');
        label.className = 'range-label';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = '0';
        input.max = '100';
        input.value = entry.level;
        const output = document.createElement('output');
        output.textContent = `${entry.level}%`;
        input.addEventListener('input', () => {
          entry.level = Number(input.value);
          output.textContent = `${entry.level}%`;
          changed();
        });
        label.append(document.createTextNode('Grayscale amount '), input, output);
        fieldset.append(label);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-button';
      remove.textContent = 'Remove window';
      remove.addEventListener('click', () => {
        schedule.windows.splice(index, 1);
        changed();
        renderWindows();
      });
      fieldset.append(remove);
      windowList.append(fieldset);
    });
    addWindowButton.disabled = schedule.windows.length >= 12;
  };
  addWindowButton.addEventListener('click', () => {
    const entry = { days: [1, 2, 3, 4, 5], start: '20:00', end: '23:00' };
    if (levels) entry.level = 80;
    schedule.windows.push(entry);
    changed();
    renderWindows();
  });
  editorContainer.append(windowList, addWindowButton);
  renderWindows();
  return editorContainer;
}

function configureScheduleMode(select, schedule, editor, changed) {
  select.value = schedule.scheduled ? 'scheduled' : 'always';
  const sync = () => {
    editor.hidden = !schedule.scheduled;
  };
  select.addEventListener('change', () => {
    schedule.scheduled = select.value === 'scheduled';
    changed();
    sync();
  });
  sync();
}
function createSiteEditor(site, config) {
  const details = document.createElement('details');
  details.className = 'site-card';
  details.dataset.site = site;
  const summary = document.createElement('summary');
  const host = document.createElement('strong');
  host.textContent = new URL(site).hostname;
  const state = document.createElement('span');
  state.textContent = config.enabled ? 'On' : 'Off';
  summary.append(host, state);
  details.append(summary);
  const form = document.createElement('form');
  form.className = 'site-settings';
  let draft = cleanSettings(structuredClone(config.settings));
  let enabled = config.enabled;
  let dirty = false;
  const message = document.createElement('p');
  message.className = 'message';
  message.setAttribute('role', 'status');
  const changed = () => {
    dirty = true;
    message.textContent = 'Unsaved changes.';
  };

  const enabledInput = document.createElement('input');
  enabledInput.type = 'checkbox';
  enabledInput.checked = enabled;
  enabledInput.addEventListener('change', () => {
    enabled = enabledInput.checked;
    changed();
  });
  form.append(inputLabel('Quiet Browse enabled for this site', enabledInput));

  if (isYouTube(site)) {
    const youtube = document.createElement('details');
    youtube.className = 'control-block youtube-control';
    const summary = document.createElement('summary');
    summary.textContent = 'YouTube picture';
    youtube.append(summary);
    const body = document.createElement('div');
    body.className = 'control-body';
    const persistentCover = document.createElement('input');
    persistentCover.type = 'checkbox';
    persistentCover.checked = draft.youtubePictureCover;
    persistentCover.addEventListener('change', () => {
      draft.youtubePictureCover = persistentCover.checked;
      changed();
    });
    body.append(inputLabel('Keep YouTube video picture hidden', persistentCover));
    const description = document.createElement('p');
    description.className = 'muted';
    description.textContent = [
      'Automatically returns the picture cover after reloads and YouTube video changes.',
      'Audio, controls, captions, ads, and picture-in-picture stay available.',
    ].join(' ');
    body.append(description);
    youtube.append(body);
    form.append(youtube);
  }

  const gray = document.createElement('details');
  gray.className = 'control-block';
  const graySummary = document.createElement('summary');
  graySummary.textContent = 'Grayscale and times';
  gray.append(graySummary);
  const grayBody = document.createElement('div');
  grayBody.className = 'control-body';
  const grayEnabled = document.createElement('input');
  grayEnabled.type = 'checkbox';
  grayEnabled.checked = draft.grayscale.enabled;
  grayEnabled.addEventListener('change', () => {
    draft.grayscale.enabled = grayEnabled.checked;
    changed();
  });
  grayBody.append(inputLabel('Enable grayscale', grayEnabled));
  const modeLabel = document.createElement('label');
  modeLabel.className = 'field';
  modeLabel.textContent = 'When';
  const grayMode = document.createElement('select');
  grayMode.append(
    new Option('Always use the manual amount', 'always'),
    new Option('Only during scheduled times', 'scheduled'),
  );
  modeLabel.append(grayMode);
  grayBody.append(modeLabel);
  const rangeLabel = document.createElement('label');
  rangeLabel.className = 'range-label';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = draft.grayscale.level;
  const amount = document.createElement('output');
  amount.textContent = `${draft.grayscale.level}%`;
  range.addEventListener('input', () => {
    draft.grayscale.level = Number(range.value);
    amount.textContent = `${range.value}%`;
    changed();
  });
  rangeLabel.append(document.createTextNode('Manual amount '), range, amount);
  grayBody.append(rangeLabel);
  const grayWindows = createScheduleWindowEditor(draft.grayscale, {
    levels: true,
    idPrefix: `${site} grayscale`,
    changed,
  });
  configureScheduleMode(grayMode, draft.grayscale, grayWindows, () => {
    changed();
    range.disabled = draft.grayscale.scheduled;
  });
  range.disabled = draft.grayscale.scheduled;
  grayBody.append(grayWindows);
  const grayNow = document.createElement('p');
  grayNow.className = 'muted';
  grayNow.textContent = `Current local-clock result: ${grayscaleAt(draft.grayscale)}%.`;
  grayBody.append(grayNow);
  gray.append(grayBody);
  form.append(gray);

  if (siteCategory(site) === 'social') {
    const heading = document.createElement('h3');
    heading.textContent = 'Social surfaces and times';
    form.append(heading);
    const socialHelp = document.createElement('p');
    socialHelp.className = 'muted';
    socialHelp.textContent = [
      'Checked means hidden.',
      "TikTok's landing stream counts as both short-video and home-feed content,",
      'so either checked control stops it.',
    ].join(' ');
    form.append(socialHelp);
    for (const feature of SOCIAL_FEATURES) {
      const control = document.createElement('details');
      control.className = 'control-block social-control';
      const controlSummary = document.createElement('summary');
      controlSummary.textContent = feature.label;
      control.append(controlSummary);
      const body = document.createElement('div');
      body.className = 'control-body';
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = draft[feature.key];
      toggle.addEventListener('change', () => {
        draft[feature.key] = toggle.checked;
        changed();
      });
      body.append(inputLabel(feature.label, toggle));
      const description = document.createElement('p');
      description.className = 'muted';
      description.textContent = feature.detail;
      body.append(description);
      const label = document.createElement('label');
      label.className = 'field';
      label.textContent = 'When hidden';
      const mode = document.createElement('select');
      mode.append(
        new Option('Always', 'always'),
        new Option('Only during scheduled times', 'scheduled'),
      );
      label.append(mode);
      body.append(label);
      const schedule = draft.socialSchedules[feature.key];
      const editor = createScheduleWindowEditor(schedule, {
        idPrefix: `${site} ${feature.key}`,
        changed,
      });
      configureScheduleMode(mode, schedule, editor, changed);
      body.append(editor);
      const now = document.createElement('p');
      now.className = 'muted';
      now.textContent = settingAt(draft[feature.key], schedule)
        ? 'Hidden at the current local time.'
        : 'Available at the current local time.';
      body.append(now);
      control.append(body);
      form.append(control);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'button-row';
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'primary';
  save.textContent = 'Save site settings';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'danger';
  remove.textContent = 'Remove saved site';
  actions.append(save, remove);
  form.append(actions, message);
  details.append(form);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    save.disabled = true;
    remove.disabled = true;
    message.classList.remove('error');
    message.textContent = 'Saving…';
    try {
      const result = await request({
        type: 'QB_SAVE',
        site,
        enabled,
        settings: cleanSettings(draft),
      });
      saved.sites[site] = result;
      draft = cleanSettings(result.settings);
      dirty = false;
      state.textContent = result.enabled ? 'On' : 'Off';
      message.textContent = 'Saved.';
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('error');
    } finally {
      save.disabled = false;
      remove.disabled = false;
    }
  });
  remove.addEventListener('click', async () => {
    if (dirty && !confirm('Discard unsaved changes and remove this site?')) return;
    if (!confirm(`Remove Quiet Browse settings for ${new URL(site).hostname}?`)) return;
    remove.disabled = true;
    try {
      await request({ type: 'QB_FORGET', site });
      delete saved.sites[site];
      renderSavedSites();
      setMessage('site-message', 'Site settings removed.');
    } catch (error) {
      remove.disabled = false;
      message.textContent = error.message;
      message.classList.add('error');
    }
  });
  if (site === selectedSite) details.open = true;
  return details;
}
function renderSavedSites() {
  const container = getElement('site-categories');
  container.replaceChildren();
  for (const category of ['social', 'ecommerce', 'other']) {
    const entries = Object.entries(saved.sites)
      .filter(([site]) => siteCategory(site) === category)
      .sort(([firstSite], [secondSite]) =>
        new URL(firstSite).hostname.localeCompare(new URL(secondSite).hostname),
      );
    if (!entries.length) continue;
    const group = document.createElement('details');
    group.className = 'site-category';
    const summary = document.createElement('summary');
    const title = document.createElement('strong');
    title.textContent = CATEGORY_DESCRIPTIONS[category][0];
    const count = document.createElement('span');
    count.textContent = `${entries.length} site${entries.length === 1 ? '' : 's'}`;
    const detail = document.createElement('small');
    detail.textContent = CATEGORY_DESCRIPTIONS[category][1];
    summary.append(title, count, detail);
    group.append(summary);
    const list = document.createElement('div');
    list.className = 'site-list';
    entries.forEach(([site, config]) => list.append(createSiteEditor(site, config)));
    group.append(list);
    group.open = entries.some(([site]) => site === selectedSite);
    container.append(group);
  }
  if (!container.children.length) container.textContent = 'No saved sites.';
  const selected = container.querySelector(`[data-site="${CSS.escape(selectedSite)}"]`);
  if (selected) requestAnimationFrame(() => selected.scrollIntoView({ block: 'start' }));
}

getElement('adult-enable').addEventListener('click', () => {
  const sources = selectedSourceIds('adult-source-options-off');
  const permission = sources.length
    ? chrome.permissions.request({ origins: [ADULT_LIST_PERMISSION] })
    : Promise.resolve(true);
  runAdultGuardAction(async () => {
    await adultPreferenceSaveQueue;
    const already =
      sources.length && (await chrome.permissions.contains({ origins: [ADULT_LIST_PERMISSION] }));
    if (!(await permission))
      throw new Error(
        'Community-list access was not granted. Deselect the lists to use only the packaged set.',
      );
    try {
      return await request({
        type: 'QB_ADULT_ENABLE',
        domains: readDomainLines('adult-domains'),
        password: getElement('adult-password').value,
        sources,
      });
    } catch (error) {
      if (sources.length && !already)
        await chrome.permissions.remove({ origins: [ADULT_LIST_PERMISSION] });
      throw error;
    }
  }, 'Quit Porn is on.');
});
getElement('adult-apply-sources').addEventListener('click', () => {
  const sources = selectedSourceIds('adult-source-options-on');
  const permission = sources.length
    ? chrome.permissions.request({ origins: [ADULT_LIST_PERMISSION] })
    : Promise.resolve(true);
  runAdultGuardAction(async () => {
    if (!(await permission)) throw new Error('Community-list access was not granted.');
    return request({
      type: 'QB_ADULT_AUTO',
      sources,
      password: getElement('adult-current-password').value,
    });
  }, 'Regional list selection saved and refreshed.');
});
getElement('adult-refresh').addEventListener('click', () =>
  runAdultGuardAction(() => request({ type: 'QB_ADULT_REFRESH' }), 'Selected lists updated.'),
);
getElement('adult-save').addEventListener('click', () =>
  runAdultGuardAction(
    () =>
      request({
        type: 'QB_ADULT_UPDATE',
        domains: readDomainLines('adult-active-domains'),
        password: getElement('adult-current-password').value,
      }),
    'Additional domains saved.',
  ),
);
getElement('adult-disable').addEventListener('click', () => {
  const sources = selectedSourceIds('adult-source-options-on');
  runAdultGuardAction(async () => {
    const result = await request({
      type: 'QB_ADULT_DISABLE',
      password: getElement('adult-current-password').value,
      sources,
    });
    getElement('adult-current-password').value = '';
    return result;
  }, 'Quit Porn is off.');
});
getElement('reset').addEventListener('click', async () => {
  if (!confirm('Delete all Quiet Browse settings and optional access?')) return;
  const password = adult.passwordProtected
    ? prompt('Enter the Quit Porn protection password:')
    : '';
  if (adult.passwordProtected && password === null) return;
  getElement('reset').disabled = true;
  try {
    await request({ type: 'QB_RESET', password });
    location.reload();
  } catch (error) {
    setMessage('reset-message', error.message, true);
    getElement('reset').disabled = false;
  }
});

try {
  [saved, adult] = await Promise.all([
    request({ type: 'QB_LIST' }),
    request({ type: 'QB_ADULT_STATUS' }),
  ]);
  renderSavedSites();
  renderAdultGuard();
} catch (error) {
  setMessage('site-message', error.message, true);
}
