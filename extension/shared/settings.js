import './comfort.js';
export const { cleanGrayscale, cleanSchedule, grayscaleAt, settingAt } = globalThis.QuietBrowseComfort;
export const STATE_KEY = 'quietBrowseState';
const BOOLEAN_DEFAULTS = Object.freeze({
  pageMode: false,
  motion: true,
  consentChoices: true,
  backgroundVideo: false,
  youtubeQuiet: true,
  youtubeRecommendations: false,
  socialStories: true,
  socialShortVideo: true,
  socialExplore: true,
  socialHomeFeed: true,
});
const EMPTY_SCHEDULE = Object.freeze({ scheduled: false, windows: Object.freeze([]) });
const SOCIAL_SCHEDULE_DEFAULTS = Object.freeze(Object.fromEntries(
  ['socialStories', 'socialShortVideo', 'socialExplore', 'socialHomeFeed'].map(key => [key, EMPTY_SCHEDULE])));
export const DEFAULTS = Object.freeze({
  ...BOOLEAN_DEFAULTS,
  grayscale: Object.freeze({ enabled: false, level: 100, scheduled: false, windows: Object.freeze([]) }),
  socialSchedules: SOCIAL_SCHEDULE_DEFAULTS,
});

export const FEATURES = Object.freeze([
  { key: 'pageMode', label: 'Instant page-by-page navigation', detail: 'Arrows or one scroll gesture move one screen, without a scrolling transition.' },
  { key: 'motion', label: 'Pause decorative loops', detail: 'Keeps loading, status, and interaction animations running.' },
  { key: 'consentChoices', label: 'Clarify cookie choices', detail: 'Emphasizes existing accept and reject controls equally. Never clicks them.' },
  { key: 'backgroundVideo', label: 'Pause background autoplay', detail: 'Only muted, autoplay videos without controls. Adds native play controls. Excludes YouTube.' },
  { key: 'youtubeQuiet', label: 'Quiet YouTube previews', detail: 'Hides supported hover-preview surfaces and ambient background effects.' },
  { key: 'youtubeRecommendations', label: 'Collapse YouTube recommendations', detail: 'Adds a Show recommendations button. Keeps the original links.' },
]);

export const SOCIAL_FEATURES = Object.freeze([
  { key: 'socialStories', label: 'Hide Stories', detail: 'Removes supported Stories trays and navigation. Direct links and messages remain available.' },
  { key: 'socialShortVideo', label: 'Hide short-video feeds and tabs', detail: 'Removes supported Reels, Watch, and TikTok discovery surfaces. A direct video link still opens.' },
  { key: 'socialExplore', label: 'Hide Explore and Discover', detail: 'Removes supported discovery tabs and feeds without disabling search, profiles, or messages.' },
  { key: 'socialHomeFeed', label: 'Hide the home feed', detail: 'Keeps navigation and messages while removing the supported infinite home feed.' },
]);
export const SOCIAL_SCHEDULE_KEYS = Object.freeze(SOCIAL_FEATURES.map(feature => feature.key));

export const RECOMMENDED_VERSION = 2;
export const RECOMMENDED_SITES = Object.freeze([
  { site: 'https://www.instagram.com', kind: 'social' },
  { site: 'https://www.facebook.com', kind: 'social' },
  { site: 'https://www.tiktok.com', kind: 'social' },
  { site: 'https://www.amazon.com', kind: 'shopping' },
  { site: 'https://www.ebay.com', kind: 'shopping' },
  { site: 'https://www.etsy.com', kind: 'shopping' },
  { site: 'https://www.walmart.com', kind: 'shopping' },
  { site: 'https://www.target.com', kind: 'shopping' },
  { site: 'https://www.temu.com', kind: 'shopping' },
  { site: 'https://us.shein.com', kind: 'shopping' },
  { site: 'https://www.aliexpress.com', kind: 'shopping' },
]);

// Chrome host patterns cover every port of this host; do not imply port isolation.
export function siteFromUrl(input) {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (['chromewebstore.google.com', 'chrome.google.com'].includes(url.hostname)) return null;
    return `${url.protocol}//${url.hostname}`;
  } catch { return null; }
}

export function isValidSite(site) {
  return typeof site === 'string' && site.length <= 300 && siteFromUrl(site) === site;
}

export function sitePattern(site) {
  if (!isValidSite(site)) throw new Error('Unsupported site. Open an ordinary HTTP or HTTPS page.');
  return `${site}/*`;
}

export function cleanSettings(value = {}) {
  return {
    ...Object.fromEntries(Object.entries(BOOLEAN_DEFAULTS).map(([key, fallback]) =>
      [key, typeof value?.[key] === 'boolean' ? value[key] : fallback])),
    grayscale: cleanGrayscale(value?.grayscale),
    socialSchedules: Object.fromEntries(SOCIAL_SCHEDULE_KEYS.map(key => [key, cleanSchedule(value?.socialSchedules?.[key])])),
  };
}

export function cleanState(value) {
  const sites = Object.create(null);
  for (const [site, config] of Object.entries(value?.sites ?? {})) {
    if (isValidSite(site) && config && typeof config === 'object') {
      sites[site] = { enabled: config.enabled === true, settings: cleanSettings(config.settings) };
    }
  }
  return { version: 4, recommendedVersion: Number.isInteger(value?.recommendedVersion) ? Math.max(0, value.recommendedVersion) : 0, sites };
}

export function isYouTube(site) {
  try {
    return ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(new URL(site).hostname);
  } catch { return false; }
}

export function socialPlatform(site) {
  try {
    const host = new URL(site).hostname.replace(/^www\./, '');
    if (host === 'instagram.com') return 'Instagram';
    if (host === 'facebook.com') return 'Facebook';
    if (host === 'tiktok.com') return 'TikTok';
  } catch { /* Unsupported input. */ }
  return null;
}

export function isRecommendedSite(site) {
  return RECOMMENDED_SITES.some(entry => entry.site === site);
}

export function siteCategory(site) {
  const kind = RECOMMENDED_SITES.find(entry => entry.site === site)?.kind;
  if (kind === 'social' || socialPlatform(site)) return 'social';
  if (kind === 'shopping') return 'ecommerce';
  return 'other';
}

export function defaultsForSite(site) {
  const settings = cleanSettings();
  const profile = RECOMMENDED_SITES.find(entry => entry.site === site);
  if (!socialPlatform(site)) {
    for (const feature of SOCIAL_FEATURES) settings[feature.key] = false;
  }
  settings.backgroundVideo = !!profile;
  if (profile?.kind === 'shopping') settings.grayscale = cleanGrayscale({ enabled: true, level: 20, scheduled: false, windows: [] });
  return settings;
}

export async function registrationId(site) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(site));
  return `qb-${Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2, '0')).join('')}`;
}
