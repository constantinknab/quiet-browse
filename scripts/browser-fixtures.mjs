// Run every real-DOM fixture in one isolated headless Chrome session.
// This release check uses only Node's built-in APIs and the local loopback server.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixturePort = 8765;
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`;
const fixturePaths = [
  '/demo/tests.html',
  '/demo/youtube-tests.html',
  '/demo/social-tests.html',
  '/demo/tiktok-tests.html',
  '/demo/comfort.html',
  '/demo/popup-tests.html',
  '/demo/popup-tests.html?social=1',
  '/demo/popup-tests.html?tiktok=1',
  '/demo/popup-tests.html?shopping=1',
  '/demo/popup-tests.html?offline=1',
  '/demo/popup-tests.html?repair=1',
  '/demo/popup-tests.html?stale=1',
  '/demo/options-tests.html',
  ...[
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'amazon',
    'ebay',
    'etsy',
    'walmart',
    'target',
    'temu',
    'shein',
    'aliexpress',
  ].map((profile) => `/demo/lifecycle-${profile}.html`),
].filter(
  (path) =>
    !process.env.QUIET_BROWSE_BROWSER_FILTER ||
    path.includes(process.env.QUIET_BROWSE_BROWSER_FILTER),
);

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function browserExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  if (!executable)
    throw new Error('Chrome or Chromium was not found. Set CHROME_BIN to its executable path.');
  return executable;
}

function waitForServer(serverProcess) {
  return new Promise((resolveServer, rejectServer) => {
    let diagnostics = '';
    const timeout = setTimeout(
      () => rejectServer(new Error('Fixture server did not start.')),
      5000,
    );
    serverProcess.stdout.on('data', (chunk) => {
      diagnostics += chunk.toString();
      if (!diagnostics.includes('Quiet Browse local lab:')) return;
      clearTimeout(timeout);
      resolveServer();
    });
    serverProcess.stderr.on('data', (chunk) => {
      diagnostics += chunk.toString();
    });
    serverProcess.once('exit', (code) => {
      clearTimeout(timeout);
      rejectServer(new Error(`Fixture server exited with ${code}. ${diagnostics.trim()}`));
    });
  });
}

function waitForDevTools(browserProcess) {
  return new Promise((resolveBrowser, rejectBrowser) => {
    let diagnostics = '';
    const timeout = setTimeout(
      () => rejectBrowser(new Error('Headless Chrome did not start.')),
      15000,
    );
    browserProcess.stderr.on('data', (chunk) => {
      diagnostics += chunk.toString();
      const match = diagnostics.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolveBrowser(match[1]);
    });
    browserProcess.once('exit', (code) => {
      clearTimeout(timeout);
      rejectBrowser(new Error(`Headless Chrome exited with ${code}. ${diagnostics.slice(-1000)}`));
    });
  });
}

class DevToolsConnection {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextIdentifier = 1;
    this.pending = new Map();
    this.opened = new Promise((resolveOpen, rejectOpen) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', rejectOpen, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolveCall, rejectCall } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) rejectCall(new Error(message.error.message));
      else resolveCall(message.result);
    });
  }

  async call(method, params = {}, sessionId) {
    await this.opened;
    const identifier = this.nextIdentifier;
    this.nextIdentifier += 1;
    const response = new Promise((resolveCall, rejectCall) => {
      this.pending.set(identifier, { resolveCall, rejectCall });
    });
    this.socket.send(JSON.stringify({ id: identifier, method, params, sessionId }));
    return response;
  }

  close() {
    this.socket.close();
  }
}

async function waitForFixture(connection, sessionId, path) {
  await connection.call('Page.navigate', { url: fixtureOrigin + path }, sessionId);
  const deadline = Date.now() + (path.includes('/lifecycle-') ? 90000 : 20000);
  let lastStatus = '';
  while (Date.now() < deadline) {
    try {
      const response = await connection.call(
        'Runtime.evaluate',
        {
          expression: "document.querySelector('#test-status,#ui-test-status')?.textContent || ''",
          returnByValue: true,
        },
        sessionId,
      );
      const status = response.result?.value || '';
      lastStatus = status;
      if (status.startsWith('PASS')) return status;
      if (status.startsWith('FAIL')) throw new Error(`${path}: ${status}`);
    } catch (error) {
      // A planned lifecycle reload briefly destroys the JavaScript context.
      if (!/context|navigation|frame/i.test(error.message)) throw error;
    }
    await delay(100);
  }
  throw new Error(`${path}: timed out before PASS or FAIL. Last status: ${lastStatus || 'empty'}`);
}

const chromeProfile = await mkdtemp(join(tmpdir(), 'quiet-browse-chrome-'));
const serverProcess = spawn('python3', ['scripts/serve_demo.py'], {
  cwd: projectRoot,
  env: { ...process.env, QUIET_BROWSE_DEMO_PORT: String(fixturePort) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let browserProcess;
let connection;

try {
  await waitForServer(serverProcess);
  browserProcess = spawn(
    browserExecutable(),
    [
      '--headless=new',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-gpu',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-pings',
      '--remote-debugging-port=0',
      `--user-data-dir=${chromeProfile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const devToolsUrl = await waitForDevTools(browserProcess);
  connection = new DevToolsConnection(devToolsUrl);
  const created = await connection.call('Target.createTarget', { url: 'about:blank' });
  const attached = await connection.call('Target.attachToTarget', {
    targetId: created.targetId,
    flatten: true,
  });
  await connection.call('Runtime.enable', {}, attached.sessionId);
  await connection.call('Page.enable', {}, attached.sessionId);

  const statuses = [];
  for (const path of fixturePaths) {
    const status = await waitForFixture(connection, attached.sessionId, path);
    statuses.push(status);
    console.log(`PASS: ${path} · ${status}`);
  }
  assert.equal(statuses.length, fixturePaths.length);
  console.log(
    `PASS: ${statuses.length} browser fixture pages completed in isolated headless Chrome.`,
  );
  for (const status of statuses) console.log(` - ${status}`);
} finally {
  try {
    await connection?.call('Browser.close');
  } catch {
    browserProcess?.kill('SIGTERM');
  }
  connection?.close();
  serverProcess.kill('SIGTERM');
  await rm(chromeProfile, { recursive: true, force: true });
}
