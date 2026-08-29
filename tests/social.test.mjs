import test from 'node:test';
import assert from 'node:assert/strict';

await import('../extension/content/social.js');
const { platform, routeFor } = globalThis.QuietBrowseSocial;

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

  assert.equal(routeFor('tiktok', '/'), 'home');
  assert.equal(routeFor('tiktok', '/messages/'), 'messages');
  assert.equal(routeFor('tiktok', '/@user/video/123'), 'direct');
  assert.equal(routeFor('tiktok', '/following/'), 'short');
  assert.equal(routeFor('tiktok', '/explore/'), 'explore');
});
