import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, STATE_KEY, RECOMMENDED_SITES, SOCIAL_SCHEDULE_KEYS, cleanSettings, sitePattern } from '../extension/shared/settings.js';
import { ADULT_LIST_PERMISSION, ADULT_SOURCES } from '../extension/shared/adult-domains.js';

function event() {
  const listeners = [];
  return { listeners, addListener: fn => listeners.push(fn), emit: value => listeners.forEach(fn => fn(value)) };
}
function fakeChrome() {
  let data = {};
  const grants = new Set();
  const registered = new Map();
  const injected = [];
  const messages = [];
  const alarms = new Map();
  let receiver = false;
  let receiverVersion = 9;
  let failInjection = false;
  let failDynamicUpdate = false;
  const dynamicRules = new Map();
  const runtime = { id: 'test-extension', getURL: path => `chrome-extension://test-extension/${path}`, onMessage: event(), onInstalled: event(), onStartup: event() };
  const chrome = {
    runtime,
    alarms: { onAlarm: event(), get: async name => alarms.get(name), create: async (name, info) => { alarms.set(name, { name, ...info }); }, clear: async name => alarms.delete(name) },
    storage: { local: { get: async key => ({ [key]: structuredClone(data[key]) }), set: async value => { Object.assign(data, structuredClone(value)); }, setAccessLevel: async () => {} } },
    permissions: { contains: async ({ origins }) => origins.every(x => grants.has(x)), getAll: async () => ({ origins: [...grants] }), onRemoved: event(), remove: async ({ origins }) => { origins.forEach(x => grants.delete(x)); return true; } },
    declarativeNetRequest: { getDynamicRules: async () => [...dynamicRules.values()], updateDynamicRules: async ({ removeRuleIds = [], addRules = [] }) => {
      if (failDynamicUpdate) throw new Error('Fixture DNR install failure');
      removeRuleIds.forEach(id => dynamicRules.delete(id)); addRules.forEach(rule => dynamicRules.set(rule.id, rule));
    } },
    scripting: { insertCSS: async () => {}, removeCSS: async () => {}, getRegisteredContentScripts: async () => [...registered.values()], registerContentScripts: async list => list.forEach(x => registered.set(x.id, x)), updateContentScripts: async list => list.forEach(x => registered.set(x.id, x)), unregisterContentScripts: async ({ ids }) => ids.forEach(id => registered.delete(id)), executeScript: async options => {
      injected.push(options);
      if (options.files) {
        if (failInjection) throw new Error('Fixture injection failure');
        receiver = true; receiverVersion = 9;
      }
    } },
    tabs: { query: async () => [{ id: 1 }], get: async id => ({ id, url: 'https://example.com/a?private=yes' }), sendMessage: async (id, message) => {
      messages.push({ id, message });
      if (!receiver) throw new Error('Could not establish connection. Receiving end does not exist.');
      return { engineVersion: receiverVersion, active: true };
    } },
  };
  return { chrome, grants, registered, injected, messages, alarms, dynamicRules, data: () => data, resetData: () => { data = {}; }, setData: value => { data = structuredClone(value); },
    setReceiver: (value, version = 9) => { receiver = value; receiverVersion = version; },
    setFailInjection: value => { failInjection = value; },
    setFailDynamicUpdate: value => { failDynamicUpdate = value; } };
}

const BOOLEAN_FEATURE_KEYS = Object.freeze(Object.entries(DEFAULTS)
  .filter(([, value]) => typeof value === 'boolean')
  .map(([key]) => key));

function completeFeatureSettings(value) {
  const settings = Object.fromEntries(BOOLEAN_FEATURE_KEYS.map(key => [key, value]));
  settings.grayscale = value
    ? { enabled: true, level: 73, scheduled: true, windows: [{ days: [1, 3, 5], start: '21:15', end: '06:45', level: 84 }] }
    : { enabled: false, level: 11, scheduled: false, windows: [] };
  settings.socialSchedules = Object.fromEntries(SOCIAL_SCHEDULE_KEYS.map((key, index) => [key, value
    ? { scheduled: true, windows: [{ days: [index, (index + 2) % 7], start: `0${index + 1}:00`, end: `0${index + 2}:30` }] }
    : { scheduled: false, windows: [] }]));
  return cleanSettings(settings);
}

test('background permission, scope, messaging, persistence and revocation lifecycle', async t => {
  const f = fakeChrome(); globalThis.chrome = f.chrome;
  globalThis.fetch = async () => { throw new Error('Unexpected test network request.'); };
  await import('../extension/background.js');
  const ui = { id: f.chrome.runtime.id, url: f.chrome.runtime.getURL('ui/popup.html') };
  const page = { id: f.chrome.runtime.id, tab: { id: 1 }, frameId: 0, url: 'https://example.com/private' };
  const send = (message, sender = ui) => new Promise(resolve => f.chrome.runtime.onMessage.listeners[0](message, sender, resolve));

  await t.test('a content script cannot enable a site or read other saved sites', async () => {
    assert.equal((await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true }, page)).ok, false);
    assert.equal((await send({ type: 'QB_LIST' }, page)).ok, false);
  });
  await t.test('sender identity and extension-page URLs cannot be forged', async () => {
    // A website content script has the extension ID, so the worker must also
    // require the exact packaged popup/options URL for every privileged action.
    assert.equal((await send({ type: 'QB_ADULT_STATUS' }, page)).ok, false);
    assert.equal((await send({ type: 'QB_RESET' }, page)).ok, false);
    assert.equal((await send({ type: 'QB_LIST' }, { id: 'different-extension', url: ui.url })).ok, false);
    assert.equal((await send({ type: 'QB_LIST' }, { id: f.chrome.runtime.id, url: `${ui.url}.lookalike` })).ok, false);

    // Policy is the sole content-script-readable message, and subframes fail
    // closed so an embedded third-party frame cannot inherit the top page scope.
    assert.equal((await send({ type: 'QB_POLICY' }, { ...page, frameId: 3 })).data.enabled, false);
  });
  await t.test('enable requires an already granted exact host permission', async () => {
    assert.equal((await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true })).ok, false);
    assert.equal(f.registered.size, 0);
  });
  await t.test('enable persists only preferences, registers the host, and injects the current tab', async () => {
    f.grants.add('https://example.com/*');
    const response = await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, tabId: 1, settings: { motion: false } });
    assert.equal(response.ok, true);
    assert.equal(f.registered.size, 1);
    assert.deepEqual([...f.registered.values()][0].matches, ['https://example.com/*']);
    assert.equal([...f.registered.values()][0].allFrames, false);
    assert.equal([...f.registered.values()][0].runAt, 'document_start');
    assert.equal(f.injected.filter(entry => entry.files).length, 1);
    assert.equal(response.data.pageReady, true);
    assert.equal(JSON.stringify(f.data()).includes('private'), false);
  });
  await t.test('policy scope comes from the sender, not caller input', async () => {
    assert.equal((await send({ type: 'QB_POLICY', site: 'https://evil.test' }, page)).data.enabled, true);
    assert.equal((await send({ type: 'QB_POLICY', site: 'https://example.com' }, { ...page, url: 'https://evil.test' })).data.enabled, false);
    assert.equal((await send({ type: 'QB_POLICY' }, { ...page, frameId: 2 })).data.enabled, false);
  });
  await t.test('new content scripts migrate an existing registration', async () => {
    const registration = [...f.registered.values()][0];
    registration.js = ['content/engine.js'];
    await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, settings: { pageMode: true } });
    assert.deepEqual([...f.registered.values()][0].js, ['shared/comfort.js', 'content/comfort.js', 'content/social.js', 'content/engine.js']);
    assert.equal((await send({ type: 'QB_POLICY' }, page)).data.settings.pageMode, true);
    assert.equal(f.alarms.size, 0);
  });
  await t.test('an outdated live page is replaced before newly saved settings are applied', async () => {
    const before = f.injected.filter(entry => entry.files).length;
    f.setReceiver(true, 8);
    const response = await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, tabId: 1, settings: { pageMode: true } });
    assert.equal(response.ok, true);
    assert.equal(response.data.pageReady, true);
    assert.equal(f.injected.filter(entry => entry.files).length, before + 1);
    assert.equal((await send({ type: 'QB_POLICY' }, page)).data.settings.pageMode, true);
  });
  await t.test('a missing receiver is cleaned up and reinjected', async () => {
    f.setReceiver(false);
    const response = await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, tabId: 1, settings: { pageMode: true } });
    assert.equal(response.ok, true);
    assert.equal(response.data.pageReady, true);
    assert.ok(f.injected.some(entry => typeof entry.func === 'function'));
  });
  await t.test('a page injection failure never rolls back or reports a failed preference save', async () => {
    f.setReceiver(false); f.setFailInjection(true);
    const response = await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, tabId: 1, settings: { pageMode: false } });
    f.setFailInjection(false);
    assert.equal(response.ok, true);
    assert.equal(response.data.pageReady, false);
    assert.equal((await send({ type: 'QB_POLICY' }, page)).data.settings.pageMode, false);
    f.setReceiver(true);
  });
  await t.test('trusted options query URLs can save schedules; lookalike URLs cannot', async () => {
    const schedule = { enabled: true, scheduled: true, windows: [{ days: [1], start: '21:00', end: '07:00', level: 75 }] };
    const options = { id: f.chrome.runtime.id, url: f.chrome.runtime.getURL('ui/options.html?site=https%3A%2F%2Fexample.com') };
    assert.equal((await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, settings: { grayscale: schedule } }, options)).ok, true);
    assert.equal(f.alarms.size, 1);
    assert.equal(f.alarms.get('qb-schedule-clock').periodInMinutes, 1);
    assert.deepEqual((await send({ type: 'QB_POLICY' }, page)).data.settings.grayscale.windows, schedule.windows);
    assert.equal((await send({ type: 'QB_LIST' }, { ...options, url: options.url.replace('options.html?', 'options.html.evil?') })).ok, false);
  });
  await t.test('alarm wakes pages without resetting their session or invoking full refresh', async () => {
    const start = f.messages.length;
    f.chrome.alarms.onAlarm.emit({ name: 'unrelated' });
    f.chrome.alarms.onAlarm.emit({ name: 'qb-schedule-clock' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.messages.slice(start).map(x => x.message.type), ['QB_CLOCK']);
  });
  await t.test('manual grayscale and empty schedules need no background alarm', async () => {
    for (const grayscale of [{ enabled: true, scheduled: false, level: 65 }, { enabled: true, scheduled: true, windows: [] }]) {
      await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, settings: { grayscale } });
      assert.equal(f.alarms.size, 0);
    }
  });
  await t.test('turning off unregisters future execution and notifies loaded pages', async () => {
    await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: false });
    assert.equal(f.registered.size, 0);
    assert.equal(f.alarms.size, 0);
    assert.equal((await send({ type: 'QB_POLICY' }, page)).data.enabled, false);
    assert.ok(f.messages.some(x => x.message.type === 'QB_REFRESH'));
  });
  await t.test('removing a site deletes data and its optional permission', async () => {
    assert.equal((await send({ type: 'QB_FORGET', site: 'https://example.com' })).ok, true);
    assert.equal(f.grants.size, 0);
    assert.equal(Object.keys(f.data()[STATE_KEY].sites).length, 0);
  });
  await t.test('Chrome-side permission revocation disables saved configuration', async () => {
    f.grants.add('https://example.com/*');
    await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true });
    f.grants.clear();
    f.chrome.permissions.onRemoved.emit({ origins: ['https://example.com/*'] });
    const saved = await send({ type: 'QB_LIST' });
    assert.equal(saved.data.sites['https://example.com'].enabled, false);
    assert.equal(f.registered.size, 0);
  });
  await t.test('reset clears every saved host and optional permission', async () => {
    f.grants.add('https://example.com/*');
    await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, settings: { grayscale: { enabled: true, scheduled: true, windows: [{ days: [0], start: '00:00', end: '00:00', level: 100 }] } } });
    assert.equal(f.alarms.size, 1);
    assert.equal((await send({ type: 'QB_RESET' })).ok, true);
    assert.equal(f.grants.size, 0);
    assert.equal(f.registered.size, 0);
    assert.equal(f.alarms.size, 0);
    assert.equal(Object.keys(f.data()[STATE_KEY].sites).length, 0);
  });
  await t.test('every built-in site preserves every feature through off, on, page reload, and worker restart cycles', async t => {
    const sites = [...RECOMMENDED_SITES.map(entry => entry.site), 'https://www.youtube.com'];
    const allOn = completeFeatureSettings(true);
    const allOff = completeFeatureSettings(false);
    assert.deepEqual([...BOOLEAN_FEATURE_KEYS].sort(), [
      'backgroundVideo', 'consentChoices', 'motion', 'pageMode',
      'socialExplore', 'socialHomeFeed', 'socialShortVideo', 'socialStories', 'socialSuggestions',
      'youtubePictureCover', 'youtubeQuiet', 'youtubeRecommendations',
    ].sort(), 'the lifecycle matrix must include every boolean feature');

    for (const site of sites) {
      await t.test(new URL(site).hostname, async () => {
        const page = { id: f.chrome.runtime.id, tab: { id: 1 }, frameId: 0, url: `${site}/fixture` };
        f.grants.add(sitePattern(site));

        // Activate with every feature selected and simulate a newly loaded page
        // asking the restarted worker for its policy.
        assert.equal((await send({ type: 'QB_SAVE', site, enabled: true, settings: allOn })).ok, true);
        let current = await send({ type: 'QB_POLICY' }, page);
        assert.equal(current.data.enabled, true);
        assert.deepEqual(current.data.settings, allOn);
        assert.ok([...f.registered.values()].some(script => script.matches[0] === sitePattern(site)));
        f.chrome.runtime.onStartup.emit();
        await send({ type: 'QB_LIST' }); // Serialized behind worker initialization.
        current = await send({ type: 'QB_POLICY' }, page);
        assert.equal(current.data.enabled, true);
        assert.deepEqual(current.data.settings, allOn);

        // The master switch restores the original page but retains choices. A
        // bare switch message also models an older popup that submits no settings.
        assert.equal((await send({ type: 'QB_SAVE', site, enabled: false })).ok, true);
        assert.equal((await send({ type: 'QB_POLICY' }, page)).data.enabled, false);
        let saved = (await send({ type: 'QB_LIST' })).data.sites[site];
        assert.equal(saved.enabled, false);
        assert.deepEqual(saved.settings, allOn);
        assert.ok(![...f.registered.values()].some(script => script.matches[0] === sitePattern(site)));

        // Change every feature while the extension is off, reload/restart, and
        // verify those disabled choices do not leak into the page prematurely.
        assert.equal((await send({ type: 'QB_SAVE', site, enabled: false, settings: allOff })).ok, true);
        f.chrome.runtime.onStartup.emit();
        saved = (await send({ type: 'QB_LIST' })).data.sites[site];
        assert.equal(saved.enabled, false);
        assert.deepEqual(saved.settings, allOff);
        assert.equal((await send({ type: 'QB_POLICY' }, page)).data.enabled, false);

        // Re-enable without resubmitting settings. A new page receives the exact
        // off-state choices, including grayscale and all five social schedules.
        assert.equal((await send({ type: 'QB_SAVE', site, enabled: true })).ok, true);
        current = await send({ type: 'QB_POLICY' }, page);
        assert.equal(current.data.enabled, true);
        assert.deepEqual(current.data.settings, allOff);
        f.chrome.runtime.onStartup.emit();
        await send({ type: 'QB_LIST' });
        current = await send({ type: 'QB_POLICY' }, page);
        assert.equal(current.data.enabled, true);
        assert.deepEqual(current.data.settings, allOff);

        // Reverse every feature while active, then repeat an off/on cycle to
        // prove the second direction is persistent as well.
        assert.equal((await send({ type: 'QB_SAVE', site, enabled: true, settings: allOn })).ok, true);
        assert.deepEqual((await send({ type: 'QB_POLICY' }, page)).data.settings, allOn);
        await send({ type: 'QB_SAVE', site, enabled: false });
        await send({ type: 'QB_SAVE', site, enabled: true });
        assert.deepEqual((await send({ type: 'QB_POLICY' }, page)).data.settings, allOn);

        await send({ type: 'QB_FORGET', site });
        assert.equal((await send({ type: 'QB_LIST' })).data.sites[site], undefined);
      });
    }
  });
  await t.test('adult-site rules are local, password protected, editable and reset only with the password', async () => {
    const enabled = await send({ type: 'QB_ADULT_ENABLE', domains: ['custom.example', 'custom.example'], password: 'shared passphrase' });
    assert.equal(enabled.ok, true);
    assert.equal(enabled.data.passwordProtected, true);
    assert.equal(enabled.data.customDomains.length, 1);
    assert.equal(f.dynamicRules.size, enabled.data.packagedCount + 1);
    assert.ok([...f.dynamicRules.values()].some(rule => rule.condition.urlFilter === '||custom.example^'));
    for (const rule of f.dynamicRules.values()) {
      assert.deepEqual(rule.action, { type: 'block' });
      assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
    }
    assert.equal(JSON.stringify(f.data()).includes('shared passphrase'), false);
    assert.equal((await send({ type: 'QB_ADULT_UPDATE', domains: ['changed.example'], password: 'wrong password' })).ok, false);
    assert.equal((await send({ type: 'QB_RESET' })).ok, false);
    assert.equal((await send({ type: 'QB_ADULT_UPDATE', domains: ['changed.example'], password: 'shared passphrase' })).data.customDomains[0], 'changed.example');
    assert.equal((await send({ type: 'QB_RESET', password: 'shared passphrase' })).ok, true);
    assert.equal(f.dynamicRules.size, 0);
  });
  await t.test('three bounded regional lists are parsed independently, clear retired rules, and remain last-known-good', async () => {
    const lists = {
      adblock: '[Adblock Plus]\n! generated fixture\n' + Array.from({ length: 2500 }, (_, index) => `||us${index}.example^`).join('\n') + '\n||raw.githubusercontent.com^\n',
      v2fly: 'include:category-porn-all\n' + Array.from({ length: 2500 }, (_, index) => `cn${index}.example`).join('\n') + '\n' + Array.from({ length: 800 }, (_, index) => `jav${index}.example`).join('\n') + '\nregexp:.*ignored.*\n',
    };
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'omit');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
      assert.equal(options.referrerPolicy, 'no-referrer');
      assert.ok(options.signal instanceof AbortSignal);
      const source = ADULT_SOURCES.find(item => item.url === String(url));
      assert.ok(source);
      const bytes = new TextEncoder().encode(lists[source.format]);
      return { ok: true, headers: { get: name => name === 'content-length' ? String(bytes.byteLength) : null }, arrayBuffer: async () => bytes.buffer };
    };
    f.grants.add(ADULT_LIST_PERMISSION);
    f.dynamicRules.set(200000, { id: 200000, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||retired.example^', resourceTypes: ['main_frame'] } });
    const enabled = await send({ type: 'QB_ADULT_ENABLE', domains: [], password: '', sources: ADULT_SOURCES.map(source => source.id) });
    assert.equal(enabled.ok, true);
    assert.equal(enabled.data.remoteUpdates, true);
    assert.equal(enabled.data.remoteCount, 1995 + 1900 + 800);
    assert.equal(enabled.data.lastError, '');
    assert.deepEqual(enabled.data.sources.map(source => source.count), [1995, 1900, 800]);
    assert.equal(f.dynamicRules.has(200000), false);
    assert.equal(f.dynamicRules.size, enabled.data.packagedCount + 1995 + 1900 + 800);
    const remoteDomains = [...f.dynamicRules.values()].filter(rule => rule.id >= 200000).map(rule => rule.condition.urlFilter.slice(2, -1));
    assert.equal(remoteDomains.length, 4695);
    assert.equal(remoteDomains.includes('google.com'), false);
    assert.equal(remoteDomains.includes('raw.githubusercontent.com'), false);
    assert.equal(f.alarms.get('qb-adult-list-update').periodInMinutes, 7 * 24 * 60);
    assert.equal(JSON.stringify(f.data()).includes('us1000.example'), false);

    const remoteRuleIds = [...f.dynamicRules.keys()].filter(id => id >= 200000);
    await send({ type: 'QB_ADULT_UPDATE', domains: ['custom.example'], password: '' });
    assert.deepEqual([...f.dynamicRules.keys()].filter(id => id >= 200000), remoteRuleIds);

    globalThis.fetch = async url => {
      const source = ADULT_SOURCES.find(item => item.url === String(url));
      const content = source.format === 'adblock' ? 'not-an-adblock-row.example' : lists[source.format];
      const bytes = new TextEncoder().encode(content);
      return { ok: true, headers: { get: () => String(bytes.byteLength) }, arrayBuffer: async () => bytes.buffer };
    };
    const malformed = await send({ type: 'QB_ADULT_REFRESH' });
    assert.equal(malformed.data.remoteCount, 4695);
    assert.match(malformed.data.sources[0].lastError, /expected domain-list format/i);
    assert.deepEqual([...f.dynamicRules.keys()].filter(id => id >= 200000), remoteRuleIds);

    globalThis.fetch = async url => {
      const source = ADULT_SOURCES.find(item => item.url === String(url));
      const bytes = new TextEncoder().encode(lists[source.format]);
      return { ok: true, headers: { get: () => String(bytes.byteLength) }, arrayBuffer: async () => bytes.buffer };
    };
    f.setFailDynamicUpdate(true);
    const rejected = await send({ type: 'QB_ADULT_REFRESH' });
    f.setFailDynamicUpdate(false);
    assert.equal(rejected.data.remoteCount, 4695);
    assert.match(rejected.data.lastError, /Chrome could not install/i);
    assert.deepEqual([...f.dynamicRules.keys()].filter(id => id >= 200000), remoteRuleIds);

    globalThis.fetch = async () => { throw new Error('Fixture outage'); };
    const failed = await send({ type: 'QB_ADULT_REFRESH' });
    assert.equal(failed.ok, true);
    assert.equal(failed.data.remoteCount, 4695);
    assert.match(failed.data.lastError, /could not be downloaded/i);
    assert.deepEqual([...f.dynamicRules.keys()].filter(id => id >= 200000), remoteRuleIds);

    const stopped = await send({ type: 'QB_ADULT_AUTO', sources: [], password: '' });
    assert.equal(stopped.data.remoteUpdates, false);
    assert.equal(f.grants.has(ADULT_LIST_PERMISSION), false);
    assert.deepEqual([...f.dynamicRules.keys()].filter(id => id >= 200000), []);
    const remembered = [ADULT_SOURCES[0].id, ADULT_SOURCES[2].id];
    const disabled = await send({ type: 'QB_ADULT_DISABLE', password: '', sources: remembered });
    assert.equal(disabled.ok, true);
    assert.equal(disabled.data.enabled, false);
    assert.equal(disabled.data.remoteUpdates, false);
    assert.deepEqual(disabled.data.remoteSources, remembered);
    assert.deepEqual((await send({ type: 'QB_ADULT_STATUS' })).data.remoteSources, remembered);
    const changedWhileOff = await send({ type: 'QB_ADULT_PREFERENCES', sources: [ADULT_SOURCES[2].id] });
    assert.deepEqual(changedWhileOff.data.remoteSources, [ADULT_SOURCES[2].id]);
    assert.deepEqual((await send({ type: 'QB_ADULT_STATUS' })).data.remoteSources, [ADULT_SOURCES[2].id]);
    assert.equal(f.dynamicRules.size, 0);
  });
  await t.test('shopping-default migration preserves customized grayscale and removed profiles', async () => {
    f.setData({ [STATE_KEY]: { version: 3, recommendedVersion: 1, sites: {
      'https://www.amazon.com': { enabled: true, settings: { grayscale: { enabled: true, level: 47 } } },
      'https://www.ebay.com': { enabled: true, settings: {} },
    } } });
    for (const site of ['https://www.amazon.com', 'https://www.ebay.com']) f.grants.add(sitePattern(site));
    f.chrome.runtime.onInstalled.emit({ reason: 'update' });
    const migrated = await send({ type: 'QB_LIST' });
    assert.equal(migrated.data.recommendedVersion, 2);
    assert.equal(migrated.data.sites['https://www.amazon.com'].settings.grayscale.level, 47);
    assert.equal(migrated.data.sites['https://www.ebay.com'].settings.grayscale.enabled, true);
    assert.equal(migrated.data.sites['https://www.ebay.com'].settings.grayscale.level, 20);
    assert.equal(migrated.data.sites['https://www.etsy.com'], undefined);
  });
  await t.test('first installation seeds the disclosed recommended profiles once', async () => {
    f.resetData();
    RECOMMENDED_SITES.forEach(({ site }) => f.grants.add(sitePattern(site)));
    f.chrome.runtime.onInstalled.emit({ reason: 'install' });
    const installed = await send({ type: 'QB_LIST' });
    assert.equal(installed.data.recommendedVersion, 2);
    assert.equal(Object.keys(installed.data.sites).length, RECOMMENDED_SITES.length);
    assert.equal(installed.data.sites['https://www.instagram.com'].settings.socialHomeFeed, true);
    assert.equal(installed.data.sites['https://www.amazon.com'].settings.socialHomeFeed, false);
    assert.equal(installed.data.sites['https://www.amazon.com'].settings.grayscale.level, 20);
  });
});
