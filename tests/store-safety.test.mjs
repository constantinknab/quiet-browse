import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADULT_LIST_PERMISSION, ADULT_SOURCES } from '../extension/shared/adult-domains.js';

// This suite is deliberately written as a policy-oriented review, not as a
// collection of clever one-liners. Each test names the promise we make to users
// and then checks the concrete files that must remain true for that promise.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionRoot = join(projectRoot, 'extension');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

async function text(path) {
  return readFile(path, 'utf8');
}

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

const manifest = JSON.parse(await text(join(extensionRoot, 'manifest.json')));
const extensionFiles = await walk(extensionRoot);
const javascriptFiles = extensionFiles.filter(path => extname(path) === '.js');
const htmlFiles = extensionFiles.filter(path => extname(path) === '.html');

test('declared Chrome permissions are narrow, known, and used by current features', async () => {
  // An unexpected permission can expose new browser data even when no UI was
  // added. Keeping an exact allowlist makes any permission increase fail loudly.
  const expected = ['activeTab', 'alarms', 'declarativeNetRequest', 'scripting', 'storage'];
  assert.deepEqual([...manifest.permissions].sort(), expected);

  // These high-risk capabilities are not needed by Quiet Browse.
  const forbidden = ['bookmarks', 'clipboardRead', 'cookies', 'debugger', 'downloads', 'geolocation',
    'history', 'identity', 'management', 'nativeMessaging', 'proxy', 'tabs', 'webRequest'];
  assert.deepEqual(manifest.permissions.filter(permission => forbidden.includes(permission)), []);

  // A permission should not be requested merely for a possible future feature.
  // These checks tie every declared permission to code that currently uses it.
  const worker = await text(join(extensionRoot, 'background.js'));
  const evidence = {
    activeTab: /chrome\.tabs\.(?:get|query)\s*\(/,
    alarms: /chrome\.alarms\./,
    declarativeNetRequest: /chrome\.declarativeNetRequest\./,
    scripting: /chrome\.scripting\./,
    storage: /chrome\.storage\.local\./,
  };
  for (const permission of expected) {
    assert.match(worker, evidence[permission], `${permission} has no implementation evidence`);
  }
});

test('host access is explicit for built-in sites and optional everywhere else', () => {
  const requiredHosts = [
    'https://www.instagram.com/*', 'https://www.facebook.com/*', 'https://www.tiktok.com/*',
    'https://www.amazon.com/*', 'https://www.ebay.com/*', 'https://www.etsy.com/*',
    'https://www.walmart.com/*', 'https://www.target.com/*', 'https://www.temu.com/*',
    'https://us.shein.com/*', 'https://www.aliexpress.com/*',
  ];
  assert.deepEqual(manifest.host_permissions, requiredHosts);
  assert.deepEqual(manifest.optional_host_permissions, ['https://*/*', 'http://*/*']);

  // These manifest keys can expose extension pages or accept outside messages.
  // Quiet Browse needs neither capability.
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(manifest.oauth2, undefined);
  assert.equal(manifest.update_url, undefined);
});

test('all executable logic is packaged locally and protected by a strict CSP', async () => {
  const csp = manifest.content_security_policy.extension_pages;
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline|https?:\/\/[^;\s]*\.(?:js|wasm)/i);

  const forbiddenRuntimePatterns = [
    [/\beval\s*\(/, 'eval'],
    [/new\s+Function\b/, 'Function constructor'],
    [/\bimportScripts\s*\(/, 'importScripts'],
    [/\bimport\s*\(/, 'dynamic import'],
    [/\bWebAssembly\b/, 'WebAssembly'],
    [/createElement\s*\(\s*['"]script['"]\s*\)/i, 'created script element'],
    [/(?:setTimeout|setInterval)\s*\(\s*['"`]/, 'string-evaluating timer'],
  ];
  for (const path of javascriptFiles) {
    const source = await text(path);
    for (const [pattern, label] of forbiddenRuntimePatterns) {
      assert.doesNotMatch(source, pattern, `${label} found in ${relative(projectRoot, path)}`);
    }
  }

  // Extension HTML may reference packaged scripts, but never remote or inline
  // executable code. This makes the reviewer-visible package self-contained.
  for (const path of htmlFiles) {
    const source = await text(path);
    assert.doesNotMatch(source, /<script[^>]+src=['"]https?:/i);
    assert.doesNotMatch(source, /\son[a-z]+\s*=/i);
    for (const match of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      assert.equal(match[2].trim(), '', `inline script found in ${relative(projectRoot, path)}`);
    }
  }
});

test('the only runtime download is bounded data from the disclosed GitHub host', async () => {
  const workerPath = join(extensionRoot, 'background.js');
  const worker = await text(workerPath);

  // Only the background worker may make a request, and it has one fetch call.
  assert.equal(occurrences(worker, /\bfetch\s*\(/g), 1);
  assert.equal(ADULT_LIST_PERMISSION, 'https://raw.githubusercontent.com/*');
  for (const source of ADULT_SOURCES) {
    const url = new URL(source.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'raw.githubusercontent.com');
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.ok(source.limit < 2000, `${source.id} exceeds its disclosed rule cap`);
  }

  // These options prevent credentials, referrers, redirects, unbounded waits,
  // and unexpectedly large list responses from becoming hidden data channels.
  for (const phrase of ["credentials: 'omit'", "redirect: 'error'", "referrerPolicy: 'no-referrer'", 'AbortController', 'ADULT_LIST_MAX_BYTES']) {
    assert.ok(worker.includes(phrase), `download safeguard is missing: ${phrase}`);
  }
});

test('page-facing scripts have no network or telemetry capability', async () => {
  const networkPrimitives = [
    [/\bfetch\s*\(/, 'fetch'],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bEventSource\b/, 'EventSource'],
    [/\bsendBeacon\s*\(/, 'sendBeacon'],
  ];
  for (const path of javascriptFiles) {
    if (path === join(extensionRoot, 'background.js')) continue;
    const source = await text(path);
    for (const [pattern, label] of networkPrimitives) {
      assert.doesNotMatch(source, pattern, `${label} found in ${relative(projectRoot, path)}`);
    }
  }

  // Common analytics identifiers are also rejected anywhere in the package.
  const packageText = (await Promise.all(extensionFiles
    .filter(path => ['.js', '.html', '.json'].includes(extname(path)))
    .map(text))).join('\n');
  for (const marker of ['google-analytics.com', 'googletagmanager.com', 'segment.io', 'mixpanel.com', 'facebook.com/tr']) {
    assert.ok(!packageText.includes(marker), `analytics marker found: ${marker}`);
  }
});

test('JavaScript remains human-reviewable instead of concealed or encoded', async () => {
  for (const path of javascriptFiles) {
    const source = await text(path);
    const lines = source.split(/\r?\n/);

    // A generous line limit allows ordinary selectors and messages while still
    // catching a future opaque minified bundle accidentally added to the ZIP.
    assert.ok(Math.max(...lines.map(line => line.length)) <= 800,
      `${relative(projectRoot, path)} contains an unusually long line`);
    assert.ok(lines.length <= 1200, `${relative(projectRoot, path)} needs to be split for review`);

    // Large encoded strings and repeated escape sequences are common ways to
    // hide logic from reviewers. Quiet Browse has no reason to contain them.
    assert.doesNotMatch(source, /[A-Za-z0-9+/]{300,}={0,2}/);
    assert.doesNotMatch(source, /(?:\\x[0-9a-f]{2}){4,}/i);
    assert.doesNotMatch(source, /(?:\\u[0-9a-f]{4}){4,}/i);
  }
});

test('sensitive browser databases and direct storage access stay out of page scripts', async () => {
  const allJavascript = (await Promise.all(javascriptFiles.map(text))).join('\n');
  for (const api of ['chrome.cookies', 'chrome.history', 'chrome.downloads', 'chrome.identity',
    'chrome.management', 'chrome.debugger', 'chrome.webRequest', 'chrome.storage.sync']) {
    assert.ok(!allJavascript.includes(api), `unexpected sensitive API use: ${api}`);
  }

  const worker = await text(join(extensionRoot, 'background.js'));
  assert.ok(worker.includes("setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })"),
    'local storage must remain hidden from content-script contexts');
  for (const path of javascriptFiles.filter(path => path !== join(extensionRoot, 'background.js'))) {
    assert.doesNotMatch(await text(path), /chrome\.storage\./,
      `direct storage access found in ${relative(projectRoot, path)}`);
  }
});

test('password protection uses a random salt and a deliberately expensive hash', async () => {
  const worker = await text(join(extensionRoot, 'background.js'));
  const iterations = Number(/const PASSWORD_ITERATIONS = (\d+);/.exec(worker)?.[1]);
  assert.ok(iterations >= 100000, 'PBKDF2 work factor is unexpectedly low');
  assert.match(worker, /crypto\.getRandomValues\(new Uint8Array\(16\)\)/);
  assert.match(worker, /name: 'PBKDF2', hash: 'SHA-256'/);
  assert.doesNotMatch(worker, /\b(?:MD5|SHA-1)\b/);

  // The behavior test in background.test.mjs separately proves that the
  // submitted plaintext passphrase never appears in serialized storage.
  const privacy = await text(join(projectRoot, 'website/privacy.html'));
  assert.ok(privacy.includes('PBKDF2-SHA-256'));
  assert.ok(privacy.includes('does not store the plaintext password'));
});

test('adult-site rules can only block top-level navigation', async () => {
  const worker = await text(join(extensionRoot, 'background.js'));
  assert.match(worker, /action: \{ type: 'block' \}/);
  assert.match(worker, /resourceTypes: \['main_frame'\]/);
  assert.doesNotMatch(worker, /action: \{ type: '(?:redirect|modifyHeaders|allowAllRequests)'/);
  assert.doesNotMatch(worker, /onRuleMatchedDebug|getMatchedRules/);

  // This source check is backed by the fake-Chrome behavior test, which checks
  // every installed dynamic rule rather than trusting this text alone.
  assert.ok(worker.includes('urlFilter: `||${domain}^`'));
});

test('public disclosures stay aligned with the package behavior and version', async () => {
  const publicPrivacy = await text(join(projectRoot, 'website/privacy.html'));
  const packagedPrivacy = await text(join(extensionRoot, 'ui/privacy.html'));
  const listing = await text(join(projectRoot, 'docs/STORE-LISTING.md'));
  const readme = await text(join(projectRoot, 'README.md'));

  for (const policy of [publicPrivacy, packagedPrivacy]) {
    assert.ok(policy.includes(`Version ${manifest.version}`) || policy.includes(`VERSION ${manifest.version}`));
    for (const fact of ['PBKDF2-SHA-256', 'raw.githubusercontent.com', 'no analytics', 'remote executable code']) {
      assert.ok(policy.includes(fact), `privacy policy is missing: ${fact}`);
    }
  }
  assert.ok(publicPrivacy.includes('GitHub and its infrastructure can receive ordinary connection information'));
  assert.ok(publicPrivacy.includes('Chrome Web Store User Data Policy'));
  assert.ok(listing.includes('not affiliated with or endorsed by Google, Meta, TikTok'));
  assert.ok(readme.includes('has not been submitted to or approved by the Chrome Web Store'));
});

test('the release package boundary excludes secrets, hidden files, and unknown formats', async () => {
  const allowedExtensions = new Set(['.css', '.html', '.js', '.json', '.png', '.txt']);
  const packageFiles = extensionFiles.filter(path => !relative(extensionRoot, path).split('/').some(part => part.startsWith('.')));
  assert.ok(packageFiles.some(path => relative(extensionRoot, path) === 'manifest.json'));
  assert.ok(packageFiles.some(path => relative(extensionRoot, path) === 'LICENSE.txt'));

  const secretPatterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bAIza[0-9A-Za-z_-]{35}\b/,
    /\bgh[pousr]_[0-9A-Za-z]{36,}\b/,
    /\bsk_live_[0-9A-Za-z]{16,}\b/,
  ];
  for (const path of packageFiles) {
    const info = await lstat(path);
    assert.equal(info.isSymbolicLink(), false, `symlink would enter package: ${relative(extensionRoot, path)}`);
    assert.ok(allowedExtensions.has(extname(path)), `unknown package format: ${relative(extensionRoot, path)}`);
    assert.ok(info.size < 1024 * 1024, `unexpectedly large package file: ${relative(extensionRoot, path)}`);
    if (['.js', '.json', '.html', '.css', '.txt'].includes(extname(path))) {
      const source = await text(path);
      for (const pattern of secretPatterns) {
        assert.doesNotMatch(source, pattern, `possible secret in ${relative(extensionRoot, path)}`);
      }
    }
  }

  assert.equal(await text(join(extensionRoot, 'LICENSE.txt')), await text(join(projectRoot, 'LICENSE')));
  const contentLicense = await text(join(projectRoot, 'CONTENT-LICENSE.md'));
  assert.ok(contentLicense.includes('CC BY 4.0'));
  assert.ok(contentLicense.includes('Downloaded regional domain lists are independent works'));
});
