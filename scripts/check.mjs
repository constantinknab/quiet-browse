import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extension = join(root, 'extension');
async function files(path) {
  const entries = (await readdir(path, { withFileTypes: true })).filter(entry => !entry.name.startsWith('.'));
  return (await Promise.all(entries.map(x => x.isDirectory() ? files(join(path, x.name)) : join(path, x.name)))).flat();
}
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.ok(Number(manifest.minimum_chrome_version) >= 123);
assert.ok(manifest.description.length <= 132);
assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'scripting', 'storage', 'alarms', 'declarativeNetRequest'].sort());
assert.equal(manifest.host_permissions.length, 11);
assert.ok(manifest.host_permissions.every(pattern => pattern.startsWith('https://') && !pattern.includes('<all_urls>')));
assert.equal(manifest.externally_connectable, undefined);
assert.equal(manifest.web_accessible_resources, undefined);
assert.ok(manifest.content_security_policy.extension_pages.includes('connect-src https://raw.githubusercontent.com'));
for (const path of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page, 'shared/comfort.js', 'shared/adult-domains.js', 'content/comfort.js', 'content/social.js', 'content/engine.js', 'content/presentation.css', ...Object.values(manifest.icons)]) await stat(join(extension, path));
for (const [size, path] of Object.entries(manifest.icons)) {
  const png = await readFile(join(extension, path));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), Number(size)); assert.equal(png.readUInt32BE(20), Number(size));
}
const all = await files(extension);
for (const path of all) {
  if (path.endsWith('.js')) {
    const source = await readFile(path, 'utf8');
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const pattern of [/\beval\s*\(/, /new\s+Function\b/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bimport\s*\(\s*['"]https?:/, /\.innerHTML\s*=/, /document\.cookie/]) assert.ok(!pattern.test(source), `Forbidden executable pattern ${pattern} in ${path}`);
    const fetches = source.match(/\bfetch\s*\(/g) || [];
    if (path === join(extension, 'background.js')) assert.equal(fetches.length, 1, 'Only the fixed adult-list data download is allowed in the worker.');
    else assert.equal(fetches.length, 0, `Network requests are forbidden in ${path}`);
  }
  if (path.endsWith('.html')) {
    const source = await readFile(path, 'utf8');
    assert.ok(!/\son\w+\s*=/i.test(source), `Inline event handler in ${path}`);
    assert.ok(!/<script[^>]+src=['"]https?:/i.test(source));
    for (const match of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) assert.equal(match[2].trim(), '', `Inline script in ${path}`);
    for (const match of source.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (!/^[a-z]+:/i.test(match[1])) await stat(resolve(dirname(path), match[1]));
    }
  }
}
console.log(`PASS: manifest, disclosed permissions, exact required hosts, icons, local links, syntax, and static security checks (${all.length} extension files).`);
console.log('This is a limited static check, not a security audit, legal opinion, or store approval.');
