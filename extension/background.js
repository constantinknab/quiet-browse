// Quiet Browse background service worker.
//
// This is the extension's trusted coordination layer. It validates messages, owns
// saved settings, manages exact host permissions and content-script registrations,
// schedules local-time refreshes, and installs adult-site blocking rules. Content
// scripts cannot read extension storage directly.
import {
  STATE_KEY,
  RECOMMENDED_SITES,
  RECOMMENDED_VERSION,
  SOCIAL_SCHEDULE_KEYS,
  cleanState,
  cleanSettings,
  defaultsForSite,
  isRecommendedSite,
  isValidSite,
  siteFromUrl,
  sitePattern,
  registrationId,
} from './shared/settings.js';
import {
  ADULT_SOURCES,
  ADULT_SOURCE_IDS,
  ADULT_LIST_PERMISSION,
  PACKAGED_ADULT_DOMAINS,
} from './shared/adult-domains.js';
const CONTENT_FILES = [
  'shared/comfort.js',
  'content/comfort.js',
  'content/social.js',
  'content/engine.js',
];
const CLOCK_ALARM = 'qb-schedule-clock';
const OLD_CLOCK_ALARM = 'qb-grayscale-clock';
const CONTENT_ENGINE_VERSION = 9;
const ADULT_KEY = 'quietBrowseAdultGuard';
const ADULT_RULE_START = 100000;
const ADULT_RULE_RANGE = 10000;
const RETIRED_ADULT_RULE_STARTS = Object.freeze([200000]);
const ADULT_UPDATE_ALARM = 'qb-adult-list-update';
const ADULT_UPDATE_MINUTES = 7 * 24 * 60;
const ADULT_RETRY_MINUTES = 6 * 60;
const ADULT_LIST_MAX_BYTES = 256 * 1024;
const ADULT_STORED_MAX_DOMAINS = 150000;
const ADULT_UPDATE_ERRORS = Object.freeze({
  download: 'This list could not be downloaded. Its previous rules remain active.',
  format:
    'The downloaded file was not in the expected domain-list format. Its previous rules remain active.',
  rules: 'Chrome could not install the downloaded domain rules. The previous list remains active.',
  unknown: 'This list could not be updated. Its previous rules remain active.',
});
const PASSWORD_ITERATIONS = 160000;
const PROTECTED_REMOTE_DOMAINS = Object.freeze([
  'apple.com',
  'raw.githubusercontent.com',
  'chrome.com',
  'cloudflare.com',
  'github.com',
  'google.com',
  'microsoft.com',
  'mozilla.org',
]);

// Chrome can deliver UI messages, alarms, install events, and permission changes
// concurrently. Mutations run in order so an older write cannot overwrite a newer one.
let mutationQueue = Promise.resolve();
function runSerializedMutation(operation) {
  const result = mutationQueue.then(operation);
  mutationQueue = result.catch(() => {});
  return result;
}

async function loadSiteState() {
  return cleanState((await chrome.storage.local.get(STATE_KEY))[STATE_KEY]);
}

// Adult Guard state is sanitized on every read. Unknown fields never move from
// storage into Chrome rules or a response returned to an extension page.
function cleanAdult(value = {}) {
  const requested = Array.isArray(value.remoteSources)
    ? value.remoteSources
    : value.remoteUpdates === true && ADULT_SOURCE_IDS.includes(value.remoteSourceId)
      ? [value.remoteSourceId]
      : [];
  const remoteSources = [...new Set(requested.filter((id) => ADULT_SOURCE_IDS.includes(id)))];
  const remoteStatus = Object.create(null);
  for (const source of ADULT_SOURCES) {
    const legacy = source.id === value.remoteSourceId ? value : {};
    const status = value.remoteStatus?.[source.id] || legacy;
    remoteStatus[source.id] = {
      count:
        Number.isInteger(status.count ?? status.remoteCount) &&
        (status.count ?? status.remoteCount) >= 0 &&
        (status.count ?? status.remoteCount) <= ADULT_STORED_MAX_DOMAINS
          ? (status.count ?? status.remoteCount)
          : 0,
      lastChecked:
        Number.isInteger(status.lastChecked) && status.lastChecked > 0 ? status.lastChecked : 0,
      lastUpdated:
        Number.isInteger(status.lastUpdated) && status.lastUpdated > 0 ? status.lastUpdated : 0,
      lastError: typeof status.lastError === 'string' ? status.lastError.slice(0, 180) : '',
    };
  }
  return {
    enabled: value.enabled === true,
    customDomains: cleanDomains(value.customDomains),
    remoteSources,
    remoteStatus,
    salt: typeof value.salt === 'string' && /^[0-9a-f]{32}$/.test(value.salt) ? value.salt : '',
    passwordHash:
      typeof value.passwordHash === 'string' && /^[0-9a-f]{64}$/.test(value.passwordHash)
        ? value.passwordHash
        : '',
    iterations:
      Number.isInteger(value.iterations) && value.iterations >= 100000
        ? value.iterations
        : PASSWORD_ITERATIONS,
  };
}

function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase().replace(/^\*\./, '');
  if (!trimmed || trimmed.length > 253 || /[/?#:@]/.test(trimmed)) return null;
  let host;
  try {
    host = new URL(`https://${trimmed}`).hostname;
  } catch {
    return null;
  }
  if (
    host !== trimmed ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)
  )
    return null;
  return host;
}

function cleanDomains(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 500).map(normalizeDomain).filter(Boolean))].sort();
}

function submittedDomains(value) {
  if (!Array.isArray(value) || value.length > 500)
    throw new Error('Enter no more than 500 additional hostnames.');
  const submitted = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  if (submitted.some((entry) => !normalizeDomain(entry)))
    throw new Error('Enter hostnames only, one per line, such as example.com.');
  return cleanDomains(submitted);
}

async function loadAdultGuardState() {
  return cleanAdult((await chrome.storage.local.get(ADULT_KEY))[ADULT_KEY]);
}

function publicAdultGuardState(config) {
  const sources = ADULT_SOURCES.map((source) => ({
    id: source.id,
    region: source.region,
    label: source.label,
    detail: source.detail,
    homepage: source.homepage,
    license: source.license,
    limit: source.limit,
    selected: config.remoteSources.includes(source.id),
    ...config.remoteStatus[source.id],
  }));
  const selected = sources.filter((source) => source.selected);
  return {
    enabled: config.enabled,
    passwordProtected: !!config.passwordHash,
    customDomains: [...config.customDomains],
    packagedCount: PACKAGED_ADULT_DOMAINS.length,
    remoteUpdates: config.enabled && selected.length > 0,
    remoteSources: [...config.remoteSources],
    remoteCount: selected.reduce((sum, source) => sum + source.count, 0),
    lastChecked: Math.max(0, ...selected.map((source) => source.lastChecked)),
    lastUpdated: Math.max(0, ...selected.map((source) => source.lastUpdated)),
    lastError: selected
      .map((source) => source.lastError)
      .filter(Boolean)
      .join(' ')
      .slice(0, 500),
    sources,
  };
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/../g)?.map((value) => Number.parseInt(value, 16)) || []);
}

// Passwords are compared as PBKDF2 hashes. The plaintext password is never stored.
async function passwordHash(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function protect(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw new Error('A protection password must be 8–128 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: bytesToHex(salt),
    passwordHash: await passwordHash(password, salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

async function verifyAdult(config, password) {
  if (!config.passwordHash) return true;
  if (typeof password !== 'string' || password.length > 128) return false;
  const actual = await passwordHash(password, hexToBytes(config.salt), config.iterations);
  let difference = actual.length ^ config.passwordHash.length;
  for (let index = 0; index < Math.min(actual.length, config.passwordHash.length); index += 1)
    difference |= actual.charCodeAt(index) ^ config.passwordHash.charCodeAt(index);
  return difference === 0;
}

function inRuleRange(id, start) {
  return id >= start && id < start + ADULT_RULE_RANGE;
}

function domainRules(domains, start) {
  if (domains.length > ADULT_RULE_RANGE)
    throw new Error('The domain list exceeds the reserved Chrome rule range.');
  return domains.map((domain, index) => ({
    id: start + index,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: `||${domain}^`, resourceTypes: ['main_frame'] },
  }));
}

// Each list owns a fixed, non-overlapping dynamic-rule range. Replacing one list
// cannot delete rules installed for another selected list.
async function replaceAdultRules(start, domains) {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = current.map((rule) => rule.id).filter((id) => inRuleRange(id, start));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: domainRules(domains, start),
  });
}

async function reconcileAdult(config) {
  config ||= await loadAdultGuardState();
  const baseDomains = [...new Set([...PACKAGED_ADULT_DOMAINS, ...config.customDomains])].sort();
  await replaceAdultRules(ADULT_RULE_START, config.enabled ? baseDomains : []);
  for (const start of RETIRED_ADULT_RULE_STARTS) await replaceAdultRules(start, []);
  for (const source of ADULT_SOURCES) {
    if (!config.enabled || !config.remoteSources.includes(source.id))
      await replaceAdultRules(source.ruleStart, []);
  }
}

async function adultSourcePermitted() {
  return chrome.permissions.contains({ origins: [ADULT_LIST_PERMISSION] });
}

async function scheduleAdultUpdate(config, retrySoon = false) {
  if (!config.enabled || !config.remoteSources.length || !(await adultSourcePermitted())) {
    await chrome.alarms.clear(ADULT_UPDATE_ALARM);
    return;
  }
  const existing = await chrome.alarms.get(ADULT_UPDATE_ALARM);
  if (!existing || retrySoon) {
    await chrome.alarms.create(ADULT_UPDATE_ALARM, {
      when: Date.now() + (retrySoon ? ADULT_RETRY_MINUTES : ADULT_UPDATE_MINUTES) * 60000,
      periodInMinutes: ADULT_UPDATE_MINUTES,
    });
  }
}

async function saveAdult(config) {
  const cleaned = cleanAdult(config);
  await reconcileAdult(cleaned);
  await chrome.storage.local.set({ [ADULT_KEY]: cleaned });
  await scheduleAdultUpdate(cleaned);
  return publicAdultGuardState(cleaned);
}

function protectedRemoteDomain(domain) {
  return PROTECTED_REMOTE_DOMAINS.some(
    (protectedDomain) =>
      domain === protectedDomain ||
      domain.endsWith(`.${protectedDomain}`) ||
      protectedDomain.endsWith(`.${domain}`),
  );
}

function sourceAccepts(domain, source) {
  if (source.filter !== 'japanese-content') return true;
  // The upstream category establishes adult classification. These stable terms
  // select a conservative Japanese-content subset without geolocating servers.
  return (
    domain.endsWith('.jp') ||
    /jav|hentai|doujin|japan|manga|anime|ero|(?:^|[0-9.-])av(?:[0-9.-]|$)/.test(domain)
  );
}

function adultUpdateFailure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseAdultList(text, source) {
  if (typeof text !== 'string' || text.includes('\0')) throw new Error('Invalid list data.');
  const domains = new Set();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.split('#', 1)[0].trim().toLowerCase();
    if (!line) continue;
    let candidate = '';
    if (source.format === 'hosts') {
      const fields = line.split(/\s+/);
      if (fields.length !== 2 || fields[0] !== '0.0.0.0')
        throw new Error('Invalid hosts-list entry.');
      candidate = fields[1];
    } else if (source.format === 'adblock') {
      if (line.startsWith('!') || line === '[adblock plus]') continue;
      const match = /^\|\|([^/^|*]+)\^$/.exec(line);
      if (!match) throw new Error('Invalid adblock-list entry.');
      candidate = match[1];
    } else if (source.format === 'v2fly') {
      const token = line.split(/\s+/, 1)[0];
      if (/^(?:include|regexp|keyword):/.test(token)) continue;
      candidate = token.replace(/^(?:domain|full):/, '');
    }
    const domain = normalizeDomain(candidate);
    if (!domain) {
      if (source.format === 'v2fly') continue;
      throw new Error('Invalid domain-list entry.');
    }
    if (!protectedRemoteDomain(domain) && sourceAccepts(domain, source)) domains.add(domain);
    if (domains.size >= source.limit) break;
  }
  const count = domains.size;
  if (count < source.minimum) throw new Error('List is unexpectedly small.');
  return [...domains];
}

// Remote files are inert domain data, never JavaScript. Downloads reject redirects,
// credentials, invalid UTF-8, oversized responses, and requests that take too long.
async function downloadAdultText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    let response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
    } catch {
      throw adultUpdateFailure('download');
    }
    if (!response.ok) throw adultUpdateFailure('download');
    try {
      const reportedLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(reportedLength) && reportedLength > ADULT_LIST_MAX_BYTES)
        throw new Error('List is too large.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > ADULT_LIST_MAX_BYTES) throw new Error('List is too large.');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw adultUpdateFailure('format');
    }
  } finally {
    clearTimeout(timer);
  }
}

async function downloadAdultList(source, downloads = new Map()) {
  if (!downloads.has(source.url)) downloads.set(source.url, downloadAdultText(source.url));
  const text = await downloads.get(source.url);
  try {
    return parseAdultList(text, source);
  } catch {
    throw adultUpdateFailure('format');
  }
}

async function refreshAdultLists() {
  let config = await loadAdultGuardState();
  if (!config.enabled || !config.remoteSources.length) return publicAdultGuardState(config);
  const now = Date.now();
  if (!(await adultSourcePermitted())) {
    const remoteStatus = { ...config.remoteStatus };
    for (const id of config.remoteSources)
      remoteStatus[id] = {
        ...remoteStatus[id],
        lastChecked: now,
        lastError: 'List access was removed. Previous rules remain active.',
      };
    config = cleanAdult({ ...config, remoteStatus });
    await chrome.storage.local.set({ [ADULT_KEY]: config });
    await scheduleAdultUpdate(config);
    return publicAdultGuardState(config);
  }
  const remoteStatus = { ...config.remoteStatus };
  let failed = false;
  const downloads = new Map();
  for (const source of ADULT_SOURCES.filter((item) => config.remoteSources.includes(item.id))) {
    try {
      const domains = await downloadAdultList(source, downloads);
      try {
        await replaceAdultRules(source.ruleStart, domains);
      } catch {
        throw adultUpdateFailure('rules');
      }
      remoteStatus[source.id] = {
        count: domains.length,
        lastChecked: now,
        lastUpdated: now,
        lastError: '',
      };
    } catch (error) {
      failed = true;
      remoteStatus[source.id] = {
        ...remoteStatus[source.id],
        lastChecked: now,
        lastError: ADULT_UPDATE_ERRORS[error?.code] || ADULT_UPDATE_ERRORS.unknown,
      };
    }
  }
  config = cleanAdult({ ...config, remoteStatus });
  await chrome.storage.local.set({ [ADULT_KEY]: config });
  await scheduleAdultUpdate(config, failed);
  return publicAdultGuardState(config);
}

// Recommended profiles are created once. Later upgrades preserve user edits and do
// not recreate profiles a user deliberately removed.
function seedRecommended(saved) {
  if (saved.recommendedVersion >= RECOMMENDED_VERSION) return false;
  const firstSeed = saved.recommendedVersion === 0;
  for (const { site, kind } of RECOMMENDED_SITES) {
    if (!saved.sites[site]) {
      // A later migration must not resurrect a profile the user removed.
      if (firstSeed) saved.sites[site] = { enabled: true, settings: defaultsForSite(site) };
      continue;
    }
    if (saved.recommendedVersion < 2 && kind === 'shopping') {
      const settings = cleanSettings(saved.sites[site].settings);
      const gray = settings.grayscale;
      // Upgrade only the old untouched default; preserve any deliberate grayscale choice.
      if (!gray.enabled && !gray.scheduled && gray.level === 100 && gray.windows.length === 0) {
        settings.grayscale = defaultsForSite(site).grayscale;
        saved.sites[site].settings = settings;
      }
    }
  }
  saved.recommendedVersion = RECOMMENDED_VERSION;
  return true;
}

async function hasSitePermission(site) {
  return chrome.permissions.contains({ origins: [sitePattern(site)] });
}

async function loadSitePolicy(site) {
  if (!site) return { enabled: false };
  const config = (await loadSiteState()).sites[site];
  if (!config?.enabled || !(await hasSitePermission(site))) return { enabled: false };
  return { enabled: true, settings: cleanSettings(config.settings) };
}

// Turn saved site settings into Chrome's persistent content-script registrations.
// Registration IDs are hashes so the installed-script inventory does not expose hosts.
async function reconcileContentScripts() {
  const saved = await loadSiteState();
  const desired = new Map();
  for (const [site, config] of Object.entries(saved.sites)) {
    if (!config.enabled || !(await hasSitePermission(site))) continue;
    const id = await registrationId(site);
    desired.set(id, {
      id,
      matches: [sitePattern(site)],
      js: CONTENT_FILES,
      css: ['content/presentation.css'],
      runAt: 'document_start',
      allFrames: false,
      persistAcrossSessions: true,
      world: 'ISOLATED',
    });
  }
  const currentRegistrations = (await chrome.scripting.getRegisteredContentScripts()).filter(
    (registeredScript) => registeredScript.id.startsWith('qb-'),
  );
  const staleRegistrationIds = currentRegistrations
    .filter((registeredScript) => !desired.has(registeredScript.id))
    .map((registeredScript) => registeredScript.id);
  if (staleRegistrationIds.length) {
    await chrome.scripting.unregisterContentScripts({ ids: staleRegistrationIds });
  }
  const presentRegistrationIds = new Set(
    currentRegistrations.map((registeredScript) => registeredScript.id),
  );
  const newRegistrations = [...desired.values()].filter(
    (desiredScript) => !presentRegistrationIds.has(desiredScript.id),
  );
  if (newRegistrations.length) {
    await chrome.scripting.registerContentScripts(newRegistrations);
  }
  const changedRegistrations = currentRegistrations.filter(
    (registeredScript) =>
      desired.has(registeredScript.id) &&
      (registeredScript.runAt !== 'document_start' ||
        JSON.stringify(registeredScript.css || []) !==
          JSON.stringify(desired.get(registeredScript.id).css) ||
        JSON.stringify(registeredScript.js) !== JSON.stringify(CONTENT_FILES)),
  );
  if (changedRegistrations.length) {
    await chrome.scripting.updateContentScripts(
      changedRegistrations.map((registeredScript) => desired.get(registeredScript.id)),
    );
  }
  const needsClock = Object.entries(saved.sites).some(
    ([site, config]) =>
      config.enabled &&
      ((config.settings.grayscale.enabled &&
        config.settings.grayscale.scheduled &&
        config.settings.grayscale.windows.length) ||
        SOCIAL_SCHEDULE_KEYS.some(
          (key) =>
            config.settings[key] &&
            config.settings.socialSchedules[key].scheduled &&
            config.settings.socialSchedules[key].windows.length,
        )) &&
      [...desired.values()].some((script) => script.matches[0] === sitePattern(site)),
  );
  if (needsClock) {
    if (!(await chrome.alarms.get(CLOCK_ALARM)))
      await chrome.alarms.create(CLOCK_ALARM, {
        when: Date.now() - (Date.now() % 60000) + 60000,
        periodInMinutes: 1,
      });
  } else await chrome.alarms.clear(CLOCK_ALARM);
}

async function notifyPages() {
  // No tabs permission or browsing-history inventory. Only IDs are used.
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'QB_REFRESH' }, { frameId: 0 })),
  );
}

async function persistSiteState(saved) {
  await chrome.storage.local.set({ [STATE_KEY]: cleanState(saved) });
  await reconcileContentScripts();
  await notifyPages();
}

async function applyToCurrentPage(tabId, site) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (siteFromUrl(tab.url) !== site) return false;
    try {
      const current = await chrome.tabs.sendMessage(tab.id, { type: 'QB_STATUS' }, { frameId: 0 });
      if (current?.engineVersion !== CONTENT_ENGINE_VERSION)
        throw new Error('Outdated content engine.');
      await chrome.tabs.sendMessage(tab.id, { type: 'QB_REFRESH' }, { frameId: 0 });
      return true;
    } catch {
      // No live receiver: remove an invalidated same-page instance before reinjection.
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
        files: CONTENT_FILES,
      });
      const refreshed = await chrome.tabs.sendMessage(
        tab.id,
        { type: 'QB_REFRESH' },
        { frameId: 0 },
      );
      return refreshed?.engineVersion === CONTENT_ENGINE_VERSION;
    }
  } catch {
    // The preference is already saved. A page navigation race should not undo it.
    return false;
  }
}

// Only packaged popup and options pages may issue privileged commands. Content
// scripts receive the narrow policy/status responses handled below.
function isTrustedUI(sender) {
  const allowed = ['ui/popup.html', 'ui/options.html'].map((path) => chrome.runtime.getURL(path));
  return sender.id === chrome.runtime.id && allowed.includes(sender.url?.split(/[?#]/, 1)[0]);
}

async function handleRuntimeMessage(message, sender) {
  if (!message || sender.id !== chrome.runtime.id) throw new Error('Untrusted message.');
  if (message.type === 'QB_POLICY') {
    // Derive scope from Chrome's sender metadata, never from a page-provided URL.
    if (!sender.tab || sender.frameId !== 0) return { enabled: false };
    return loadSitePolicy(siteFromUrl(sender.url || sender.tab.url || ''));
  }
  if (!isTrustedUI(sender))
    throw new Error('This action is only available in Quiet Browse controls.');
  if (message.type === 'QB_LIST') return loadSiteState();
  if (message.type === 'QB_ADULT_STATUS') return publicAdultGuardState(await loadAdultGuardState());
  if (message.type === 'QB_ADULT_ENABLE') {
    const current = await loadAdultGuardState();
    if (current.enabled) throw new Error('Adult-site blocking is already active.');
    const customDomains = submittedDomains(message.domains);
    const lock = message.password
      ? await protect(message.password)
      : { salt: '', passwordHash: '', iterations: PASSWORD_ITERATIONS };
    const requested = Array.isArray(message.sources) ? message.sources : current.remoteSources;
    const remoteSources = requested.filter((id) => ADULT_SOURCE_IDS.includes(id));
    if (remoteSources.length && !(await adultSourcePermitted()))
      throw new Error('Grant access to the selected community lists first.');
    await saveAdult({ enabled: true, customDomains, remoteSources, remoteStatus: {}, ...lock });
    return remoteSources.length
      ? refreshAdultLists()
      : publicAdultGuardState(await loadAdultGuardState());
  }
  if (message.type === 'QB_ADULT_UPDATE') {
    const current = await loadAdultGuardState();
    if (!current.enabled) throw new Error('Turn adult-site blocking on first.');
    if (!(await verifyAdult(current, message.password)))
      throw new Error('Incorrect protection password.');
    const customDomains = submittedDomains(message.domains);
    return saveAdult({ ...current, customDomains });
  }
  if (message.type === 'QB_ADULT_PREFERENCES') {
    const current = await loadAdultGuardState();
    if (current.enabled) throw new Error('Use Apply selected lists while the blocker is on.');
    const remoteSources = Array.isArray(message.sources)
      ? [...new Set(message.sources.filter((id) => ADULT_SOURCE_IDS.includes(id)))]
      : current.remoteSources;
    return saveAdult({ ...current, remoteSources });
  }
  if (message.type === 'QB_ADULT_AUTO') {
    const current = await loadAdultGuardState();
    if (!current.enabled) throw new Error('Turn adult-site blocking on first.');
    if (!(await verifyAdult(current, message.password)))
      throw new Error('Incorrect protection password.');
    const requested = Array.isArray(message.sources)
      ? message.sources.filter((id) => ADULT_SOURCE_IDS.includes(id))
      : [];
    if (requested.length && !(await adultSourcePermitted()))
      throw new Error('Grant access to the selected community lists first.');
    await saveAdult({ ...current, remoteSources: requested });
    if (!requested.length) await chrome.permissions.remove({ origins: [ADULT_LIST_PERMISSION] });
    return requested.length
      ? refreshAdultLists()
      : publicAdultGuardState(await loadAdultGuardState());
  }
  if (message.type === 'QB_ADULT_REFRESH') {
    const current = await loadAdultGuardState();
    if (!current.enabled || !current.remoteSources.length)
      throw new Error('Select at least one community list first.');
    return refreshAdultLists();
  }
  if (message.type === 'QB_ADULT_DISABLE') {
    const current = await loadAdultGuardState();
    if (!(await verifyAdult(current, message.password)))
      throw new Error('Incorrect protection password.');
    const remoteSources = Array.isArray(message.sources)
      ? [...new Set(message.sources.filter((id) => ADULT_SOURCE_IDS.includes(id)))]
      : current.remoteSources;
    const result = await saveAdult({
      enabled: false,
      customDomains: [],
      remoteSources,
      remoteStatus: {},
      salt: '',
      passwordHash: '',
      iterations: PASSWORD_ITERATIONS,
    });
    await chrome.permissions.remove({ origins: [ADULT_LIST_PERMISSION] });
    return result;
  }
  if (message.type === 'QB_SAVE') {
    if (!isValidSite(message.site)) throw new Error('Invalid site.');
    if (message.enabled && !(await hasSitePermission(message.site)))
      throw new Error('Grant access to this site first.');
    const saved = await loadSiteState();
    // A bare enable/disable action must not reset the site's feature choices. The
    // current UI submits settings too, but preserving them here keeps lifecycle
    // behavior safe across older UI pages, service-worker restarts, and callers
    // that only intend to change the master switch.
    const previous = saved.sites[message.site];
    const submittedSettings = Object.prototype.hasOwnProperty.call(message, 'settings')
      ? message.settings
      : (previous?.settings ?? defaultsForSite(message.site));
    saved.sites[message.site] = {
      enabled: message.enabled === true,
      settings: cleanSettings(submittedSettings),
    };
    await persistSiteState(saved);
    const pageReady =
      message.enabled && Number.isInteger(message.tabId)
        ? await applyToCurrentPage(message.tabId, message.site)
        : null;
    return { ...saved.sites[message.site], pageReady };
  }
  if (message.type === 'QB_FORGET') {
    if (!isValidSite(message.site)) throw new Error('Invalid site.');
    const saved = await loadSiteState();
    delete saved.sites[message.site];
    await persistSiteState(saved); // Restore loaded pages before revoking site access.
    if (!isRecommendedSite(message.site))
      await chrome.permissions.remove({ origins: [sitePattern(message.site)] });
    return { ok: true };
  }
  if (message.type === 'QB_RESET') {
    const adult = await loadAdultGuardState();
    if (adult.enabled && !(await verifyAdult(adult, message.password)))
      throw new Error('The adult-site blocker password is required before deleting all settings.');
    const saved = await loadSiteState();
    const optionalOrigins = Object.keys(saved.sites)
      .filter((site) => !isRecommendedSite(site))
      .map(sitePattern);
    await persistSiteState({ version: 4, recommendedVersion: RECOMMENDED_VERSION, sites: {} });
    await saveAdult({
      enabled: false,
      customDomains: [],
      remoteSources: [],
      remoteStatus: {},
      salt: '',
      passwordHash: '',
      iterations: PASSWORD_ITERATIONS,
    });
    optionalOrigins.push(ADULT_LIST_PERMISSION);
    await chrome.permissions.remove({ origins: [...new Set(optionalOrigins)] });
    return { ok: true };
  }
  throw new Error('Unknown action.');
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Policy reads must not wait behind notifyPages, whose recipients request policies.
  const operation =
    message?.type === 'QB_POLICY'
      ? handleRuntimeMessage(message, sender)
      : runSerializedMutation(() => handleRuntimeMessage(message, sender));
  operation.then(
    (data) => respond({ ok: true, data }),
    (error) => respond({ ok: false, error: error.message }),
  );
  return true;
});

async function initialize(addRecommended = false) {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.alarms.clear(OLD_CLOCK_ALARM);
  if (addRecommended) {
    const saved = await loadSiteState();
    if (seedRecommended(saved)) await chrome.storage.local.set({ [STATE_KEY]: cleanState(saved) });
  }
  let adult = await loadAdultGuardState();
  await reconcileAdult(adult);
  const adultRules = await chrome.declarativeNetRequest.getDynamicRules();
  const missingSelectedRules = ADULT_SOURCES.some(
    (source) =>
      adult.remoteSources.includes(source.id) &&
      !adultRules.some((rule) => inRuleRange(rule.id, source.ruleStart)),
  );
  if (
    adult.enabled &&
    adult.remoteSources.length &&
    missingSelectedRules &&
    (await adultSourcePermitted())
  ) {
    await refreshAdultLists();
  } else {
    await scheduleAdultUpdate(adult, missingSelectedRules);
  }
  await reconcileContentScripts();
  await notifyPages();
}
chrome.runtime.onInstalled.addListener(() => {
  runSerializedMutation(() => initialize(true)).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  runSerializedMutation(() => initialize(false)).catch(console.error);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ADULT_UPDATE_ALARM) {
    runSerializedMutation(() => refreshAdultLists()).catch(console.error);
    return;
  }
  if (alarm.name === CLOCK_ALARM) {
    chrome.tabs
      .query({})
      .then((tabs) =>
        Promise.allSettled(
          tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'QB_CLOCK' }, { frameId: 0 })),
        ),
      )
      .catch(console.error);
  }
});
chrome.permissions.onRemoved.addListener(() => {
  runSerializedMutation(async () => {
    const saved = await loadSiteState();
    for (const [site, config] of Object.entries(saved.sites)) {
      if (!(await hasSitePermission(site))) config.enabled = false;
    }
    await persistSiteState(saved);
    const adult = await loadAdultGuardState();
    if (adult.enabled && adult.remoteSources.length && !(await adultSourcePermitted())) {
      const remoteStatus = { ...adult.remoteStatus };
      for (const id of adult.remoteSources)
        remoteStatus[id] = {
          ...remoteStatus[id],
          lastChecked: Date.now(),
          lastError: 'List access was removed. Previous rules remain active.',
        };
      const updated = cleanAdult({ ...adult, remoteStatus });
      await chrome.storage.local.set({ [ADULT_KEY]: updated });
      await scheduleAdultUpdate(updated);
    }
  }).catch(console.error);
});
