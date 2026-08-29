import test from 'node:test';
import assert from 'node:assert/strict';
import { STATE_KEY, RECOMMENDED_SITES, sitePattern } from '../extension/shared/settings.js';
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
  let receiverVersion = 5;
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
        receiver = true; receiverVersion = 5;
      }
    } },
    tabs: { query: async () => [{ id: 1 }], get: async id => ({ id, url: 'https://example.com/a?private=yes' }), sendMessage: async (id, message) => {
      messages.push({ id, message });
      if (!receiver) throw new Error('Could not establish connection. Receiving end does not exist.');
      return { engineVersion: receiverVersion, active: true };
    } },
  };
  return { chrome, grants, registered, injected, messages, alarms, dynamicRules, data: () => data, resetData: () => { data = {}; }, setData: value => { data = structuredClone(value); },
    setReceiver: (value, version = 5) => { receiver = value; receiverVersion = version; },
    setFailInjection: value => { failInjection = value; },
    setFailDynamicUpdate: value => { failDynamicUpdate = value; } };
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
  await t.test('an outdated live page saves safely and asks for a reload instead of adding duplicate listeners', async () => {
    const before = f.injected.filter(entry => entry.files).length;
    f.setReceiver(true, 2);
    const response = await send({ type: 'QB_SAVE', site: 'https://example.com', enabled: true, tabId: 1, settings: { pageMode: true } });
    assert.equal(response.ok, true);
    assert.equal(response.data.pageReady, false);
    assert.equal(f.injected.filter(entry => entry.files).length, before);
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
  await t.test('adult-site rules are local, password protected, editable and reset only with the password', async () => {
    const enabled = await send({ type: 'QB_ADULT_ENABLE', domains: ['custom.example', 'custom.example'], password: 'shared passphrase' });
    assert.equal(enabled.ok, true);
    assert.equal(enabled.data.passwordProtected, true);
    assert.equal(enabled.data.customDomains.length, 1);
    assert.equal(f.dynamicRules.size, enabled.data.packagedCount + 1);
    assert.ok([...f.dynamicRules.values()].some(rule => rule.condition.urlFilter === '||custom.example^'));
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
