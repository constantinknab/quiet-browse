import test from 'node:test';
import assert from 'node:assert/strict';

await import('../extension/content/social.js');
const { platform, routeFor, routeCategories, categoryForLink } = globalThis.QuietBrowseSocial;

// Route classification is tested separately from live DOM selectors so messages
// and direct links cannot accidentally become part of a scrollable-feed rule.

test('supported social hosts and routes preserve messages and direct items', () => {
  assert.equal(platform('www.instagram.com'), 'instagram');
  assert.equal(platform('www.facebook.com'), 'facebook');
  assert.equal(platform('www.tiktok.com'), 'tiktok');
  assert.equal(platform('instagram.com.evil.test'), null);

  assert.equal(routeFor('instagram', '/'), 'home');
  assert.equal(routeFor('instagram', '/direct/t/123/'), 'messages');
  assert.equal(routeFor('instagram', '/reel/abc/'), 'direct');
  assert.equal(routeFor('instagram', '/reels/'), 'short');
  assert.equal(routeFor('instagram', '/explore/'), 'explore');

  assert.equal(routeFor('facebook', '/'), 'home');
  assert.equal(routeFor('facebook', '/messages/t/123'), 'messages');
  assert.equal(routeFor('facebook', '/reel/123'), 'direct');
  assert.equal(routeFor('facebook', '/watch/'), 'short');
  assert.equal(routeFor('facebook', '/discover/'), 'explore');

  // TikTok's root route remains a usable landing page. A separate setting hides
  // only its inner scrolling feed, so the root navigation link has no category.
  assert.equal(routeFor('tiktok', '/'), 'home');
  assert.deepEqual(routeCategories('tiktok', '/'), ['home']);
  assert.deepEqual(routeCategories('tiktok', '////'), ['home']);
  assert.equal(categoryForLink('tiktok', '/'), null);
  assert.equal(routeFor('tiktok', '/messages/'), 'messages');
  assert.equal(routeFor('tiktok', '/@user/video/123'), 'direct');
  assert.equal(routeFor('tiktok', '/following/'), 'short');
  assert.equal(routeFor('tiktok', '/explore/'), 'explore');
});

test('TikTok localized landing pages are home routes without blocking shared videos or utilities', () => {
  // These are URL variants, not a country allowlist. Region/script suffixes,
  // casing, escaped language codes, and trailing slashes must behave alike.
  for (const landing of [
    '/',
    '/en',
    '/en/',
    '/en-US/',
    '/ja-JP/',
    '/zh-Hant-TW/',
    '/pt-br/',
    '/%65%6e/',
    '/eng/',
    '/foryou/',
    '/en/foryou/',
    '/en-US/for-you/',
    '/en/home/',
  ]) {
    assert.equal(routeFor('tiktok', landing), 'home', landing);
    assert.deepEqual(routeCategories('tiktok', landing), ['home'], landing);
    assert.equal(categoryForLink('tiktok', landing), null, `${landing} keeps its navigation link`);
  }
  for (const prefix of ['', '/en', '/zh-Hant-TW']) {
    assert.equal(routeFor('tiktok', `${prefix}/@user/video/123`), 'direct');
    assert.equal(routeFor('tiktok', `${prefix}/messages/`), 'messages');
    for (const utility of [
      '/@user',
      '/search',
      '/tag',
      '/music',
      '/shop',
      '/upload',
      '/login',
      '/embed',
    ]) {
      assert.equal(routeFor('tiktok', `${prefix}${utility}`), 'other', utility);
    }
    assert.equal(routeFor('tiktok', `${prefix}/following/`), 'short');
    assert.equal(categoryForLink('tiktok', `${prefix}/following/`), 'short');
  }
  // A new, unknown path needs homepage DOM evidence; a route alone is not enough.
  assert.equal(routeFor('tiktok', '/landing-experiment/'), 'other');
  assert.equal(routeFor('tiktok', '/%broken/'), 'other');
  assert.equal(routeFor('tiktok', '/%65%6e/%40user/video/123'), 'direct');
});
