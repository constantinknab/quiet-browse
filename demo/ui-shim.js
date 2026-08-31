// UI preview/test only. This file is not packaged and never requests real permissions.
(() => {
  const socialPreview = new URLSearchParams(location.search).has('social');
  const shoppingPreview = new URLSearchParams(location.search).has('shopping');
  const site = socialPreview ? 'https://www.instagram.com' : shoppingPreview ? 'https://www.amazon.com' : 'https://www.youtube.com';
  const isOptions = location.pathname.includes('/options');
  const repairable = new URLSearchParams(location.search).has('repair');
  const stale = new URLSearchParams(location.search).has('stale');
  let pageUnavailable = new URLSearchParams(location.search).has('offline') || repairable;
  const schedules = () => Object.fromEntries(['socialStories', 'socialSuggestions', 'socialShortVideo', 'socialExplore', 'socialHomeFeed'].map(key => [key, { scheduled: false, windows: [] }]));
  const defaults = { pageMode: false, motion: true, consentChoices: true, backgroundVideo: false, youtubeQuiet: true, youtubeRecommendations: false, youtubePictureCover: false, socialStories: true, socialSuggestions: true, socialShortVideo: true, socialExplore: true, socialHomeFeed: true, grayscale: { enabled: false, scheduled: false, level: 100, windows: [] }, socialSchedules: schedules() };
  const saved = { version: 4, recommendedVersion: 2, sites: isOptions ? {
    'https://www.instagram.com': { enabled: true, settings: structuredClone(defaults) },
    'https://www.amazon.com': { enabled: true, settings: { ...structuredClone(defaults), socialStories: false, socialSuggestions: false, socialShortVideo: false, socialExplore: false, socialHomeFeed: false, grayscale: { enabled: true, scheduled: false, level: 20, windows: [] } } },
    'https://www.youtube.com': { enabled: true, settings: structuredClone(defaults) },
    'https://example.com': { enabled: true, settings: structuredClone(defaults) },
  } : {} };
  const sourceTemplates = [
    { id: 'jarelllama-us-v1', region: 'United States', label: 'United States · popular-site supplement', detail: 'Popular English-language and US-facing coverage.', limit: 1995, activeCount: 1995, count: 0, lastChecked: 0, lastUpdated: 0, lastError: '' },
    { id: 'v2fly-china-v1', region: 'China', label: 'China · community supplement', detail: 'Chinese-community-maintained category coverage.', limit: 1900, activeCount: 1900, count: 0, lastChecked: 0, lastUpdated: 0, lastError: '' },
    { id: 'v2fly-japan-v1', region: 'Japan', label: 'Japan · Japanese-content supplement', detail: 'Japanese-content and .jp coverage from V2Fly.', limit: 1500, activeCount: 647, count: 0, lastChecked: 0, lastUpdated: 0, lastError: '' },
  ];
  let adult = { enabled: false, passwordProtected: false, customDomains: [], packagedCount: 44, remoteUpdates: false, remoteSources: [], remoteCount: 0, lastChecked: 0, lastUpdated: 0, lastError: '', sources: sourceTemplates.map(source => ({ ...source, selected: false })) };
  let granted = isOptions;
  const page = { engineVersion: stale ? 8 : 9, active: false, paused: false, covered: false, coverAvailable: !socialPreview && !shoppingPreview, loops: 0, choices: 0, videos: 0, recommendations: 0, platform: socialPreview ? 'instagram' : null, hidden: socialPreview ? 5 : 0 };
  window.chrome = {
    runtime: {
      getURL: path => `${location.origin}/${path.replace('ui/', 'demo/')}`,
      openOptionsPage: async () => { window.location.href = '/demo/options.html'; },
      sendMessage: async message => {
        if (message.type === 'QB_LIST') return { ok: true, data: structuredClone(saved) };
        if (message.type === 'QB_ADULT_STATUS') return { ok: true, data: structuredClone(adult) };
        if (message.type === 'QB_ADULT_PREFERENCES') { adult.remoteSources = [...message.sources]; adult.remoteUpdates = false; adult.sources = adult.sources.map(source => ({ ...source, selected: message.sources.includes(source.id) })); return { ok: true, data: structuredClone(adult) }; }
        if (message.type === 'QB_ADULT_ENABLE') {
          const selected = message.sources || []; const now = Date.now();
          adult = { ...adult, enabled: true, passwordProtected: !!message.password, customDomains: [...message.domains], remoteUpdates: !!selected.length, remoteSources: [...selected], remoteCount: selected.reduce((sum, id) => sum + sourceTemplates.find(source => source.id === id).activeCount, 0), lastChecked: now, lastUpdated: selected.length ? now : 0,
            sources: sourceTemplates.map(source => ({ ...source, selected: selected.includes(source.id), count: selected.includes(source.id) ? source.activeCount : 0, lastChecked: selected.includes(source.id) ? now : 0, lastUpdated: selected.includes(source.id) ? now : 0 })) };
          return { ok: true, data: structuredClone(adult) };
        }
        if (message.type === 'QB_ADULT_UPDATE') { adult.customDomains = [...message.domains]; return { ok: true, data: structuredClone(adult) }; }
        if (message.type === 'QB_ADULT_AUTO') { adult.remoteSources = [...message.sources]; adult.remoteUpdates = !!message.sources.length; adult.sources = adult.sources.map(source => ({ ...source, selected: message.sources.includes(source.id) })); adult.remoteCount = adult.sources.filter(source => source.selected).reduce((sum, source) => sum + source.count, 0); return { ok: true, data: structuredClone(adult) }; }
        if (message.type === 'QB_ADULT_REFRESH') { const now = Date.now(); adult.lastChecked = now; adult.lastUpdated = now; adult.lastError = ''; adult.sources = adult.sources.map(source => source.selected ? { ...source, count: source.activeCount, lastChecked: now, lastUpdated: now, lastError: '' } : source); adult.remoteCount = adult.sources.filter(source => source.selected).reduce((sum, source) => sum + source.count, 0); return { ok: true, data: structuredClone(adult) }; }
        if (message.type === 'QB_ADULT_DISABLE') { const selected = message.sources || adult.remoteSources; adult = { ...adult, enabled: false, passwordProtected: false, customDomains: [], remoteUpdates: false, remoteSources: [...selected], remoteCount: 0, lastChecked: 0, lastUpdated: 0, lastError: '', sources: sourceTemplates.map(source => ({ ...source, selected: selected.includes(source.id) })) }; return { ok: true, data: structuredClone(adult) }; }
        if (message.type === 'QB_SAVE') {
          saved.sites[message.site] = { enabled: message.enabled, settings: structuredClone(message.settings) };
          page.active = message.enabled && !page.paused;
          if (site === 'https://www.youtube.com') page.covered = page.active && message.settings.youtubePictureCover === true;
          return { ok: true, data: structuredClone(saved.sites[message.site]) };
        }
        if (message.type === 'QB_FORGET') { delete saved.sites[message.site]; return { ok: true, data: {} }; }
        if (message.type === 'QB_RESET') { saved.sites = {}; adult = { ...adult, enabled: false, passwordProtected: false, customDomains: [], remoteUpdates: false, remoteSources: [], remoteCount: 0, lastChecked: 0, lastUpdated: 0, lastError: '', sources: sourceTemplates.map(source => ({ ...source, selected: false })) }; return { ok: true, data: {} }; }
        return { ok: false, error: 'Not implemented in UI preview.' };
      },
    },
    permissions: { contains: async () => granted, request: async () => { granted = true; return true; }, remove: async () => { granted = false; return true; } },
    tabs: { create: async ({ url }) => { window.location.href = url; }, query: async () => [{ id: 1, url: `${site}/watch?v=fixture` }], sendMessage: async (id, message) => {
      if (pageUnavailable) throw new Error('Could not establish connection. Receiving end does not exist.');
      if (message.type === 'QB_PAUSE') { page.paused = message.paused; page.active = !page.paused; if (page.paused) page.covered = false; }
      if (message.type === 'QB_COVER') page.covered = message.covered;
      return structuredClone(page);
    } },
  };
  if (repairable) {
    window.chrome.scripting = {
      removeCSS: async () => {},
      insertCSS: async () => {},
      executeScript: async options => {
        if (options.files) { pageUnavailable = false; page.engineVersion = 9; page.active = true; }
      },
    };
  }
})();
