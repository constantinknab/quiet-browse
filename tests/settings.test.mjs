import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, RECOMMENDED_SITES, cleanState, cleanSettings, defaultsForSite, isRecommendedSite, siteCategory, siteFromUrl, sitePattern, isYouTube, socialPlatform, registrationId } from '../extension/shared/settings.js';

test('site scope discards paths, credentials, query strings, fragments, and ports', () => {
  assert.equal(siteFromUrl('https://user:pass@example.com:8443/private?q=secret#private'), 'https://example.com');
  assert.equal(sitePattern('https://example.com'), 'https://example.com/*');
});
test('restricted and malformed URLs cannot become registrations', () => {
  for (const url of ['chrome://settings', 'file:///tmp/x', 'data:text/html,hello', 'javascript:alert(1)', 'https://chromewebstore.google.com/detail/x', 'https://chrome.google.com/webstore', 'not a url']) assert.equal(siteFromUrl(url), null);
  assert.throws(() => sitePattern('https://example.com/private'));
});
test('YouTube host matching excludes lookalikes', () => {
  assert.equal(isYouTube('https://www.youtube.com'), true);
  assert.equal(isYouTube('https://youtube.com.evil.test'), false);
});
test('social and recommended profiles are exact and use calmer defaults', () => {
  assert.equal(socialPlatform('https://www.instagram.com'), 'Instagram');
  assert.equal(socialPlatform('https://instagram.com.evil.test'), null);
  assert.equal(isRecommendedSite('https://www.amazon.com'), true);
  assert.equal(isRecommendedSite('https://amazon.com.evil.test'), false);
  assert.equal(RECOMMENDED_SITES.length, 11);
  assert.equal(defaultsForSite('https://www.instagram.com').socialHomeFeed, true);
  assert.equal(defaultsForSite('https://www.instagram.com').socialSuggestions, true);
  assert.equal(defaultsForSite('https://www.amazon.com').socialHomeFeed, false);
  assert.equal(defaultsForSite('https://www.amazon.com').socialSuggestions, false);
  assert.equal(defaultsForSite('https://www.amazon.com').backgroundVideo, true);
  assert.equal(defaultsForSite('https://www.amazon.com').grayscale.enabled, true);
  assert.equal(defaultsForSite('https://www.amazon.com').grayscale.level, 20);
  assert.equal(defaultsForSite('https://www.instagram.com').grayscale.enabled, false);
  assert.equal(defaultsForSite('https://www.youtube.com').youtubePictureCover, false);
  assert.equal(defaultsForSite('https://example.com').grayscale.enabled, false);
  assert.equal(siteCategory('https://www.instagram.com'), 'social');
  assert.equal(siteCategory('https://www.amazon.com'), 'ecommerce');
  assert.equal(siteCategory('https://example.com'), 'other');
});
test('settings accept only known boolean flags', () => {
  assert.deepEqual(cleanSettings({ motion: false, backgroundVideo: 'yes', remoteScript: 'https://evil.test' }), { ...DEFAULTS, motion: false });
  assert.equal(cleanSettings({ youtubePictureCover: true }).youtubePictureCover, true);
  assert.equal(cleanSettings({ youtubePictureCover: 'yes' }).youtubePictureCover, false);
  assert.equal(cleanSettings({ socialSuggestions: false }).socialSuggestions, false);
  assert.equal(cleanSettings({ socialSuggestions: 'yes' }).socialSuggestions, true);
});
test('malformed stored scopes and account-like data are discarded', () => {
  const state = cleanState({ sites: { 'https://example.com/private': { enabled: true }, 'https://example.com': { enabled: 1, settings: { motion: false }, token: 'secret' } }, history: ['private'] });
  assert.deepEqual(Object.keys(state.sites), ['https://example.com']);
  assert.equal(state.sites['https://example.com'].enabled, false);
  assert.equal('token' in state.sites['https://example.com'], false);
  assert.equal('history' in state, false);
});
test('registration IDs are stable, distinct, and do not disclose hostnames', async () => {
  const a = await registrationId('https://example.com');
  assert.equal(a, await registrationId('https://example.com'));
  assert.notEqual(a, await registrationId('http://example.com'));
  assert.match(a, /^qb-[0-9a-f]{64}$/);
});
