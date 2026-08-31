# Quiet Browse test guide

The tests are intentionally dependency-free and use Node's built-in test runner. Run all of them with:

```sh
npm test
```

Immediately before an upload, run the complete source and artifact workflow:

```sh
npm run verify
```

That command first checks reproducible Prettier formatting, then runs the Node tests and static review, rebuilds the ZIP, and compares every archived file byte-for-byte with the reviewed `extension/` tree. It also verifies the ZIP path boundary, manifest, integrity, and SHA-256 sidecar.

## How to read a test

Each `test('plain-English promise', ...)` block describes one behavior that should remain true. `assert.equal` compares one actual value with one expected value. `assert.deepEqual` compares complete arrays or objects. `assert.match` requires readable source text to contain a safety control. `assert.doesNotMatch` rejects a dangerous pattern.

A passing test means its specific assertion held for that build. It is not a general security certification, legal opinion, live-platform compatibility guarantee, or promise of Chrome Web Store approval.

## Test files

- `store-safety.test.mjs` is the policy and package review. Its comments explain the threat behind every group of assertions: permission creep, hidden host access, remote code, telemetry, minified or collapsed source, cryptic names, missing comments, sensitive Chrome APIs, weak password hashing, overly broad request blocking, inaccurate disclosures, secrets, and license omissions.
- `background.test.mjs` runs the service worker against a controlled fake Chrome API. It checks sender authorization, permissions, persistence, content-script repair, alarms, request-blocking rules, password behavior, list failures, and enable/disable/reload lifecycles for every built-in site.
- `settings.test.mjs` checks URL scoping, unsafe URL rejection, exact host matching, default settings, state cleanup, and non-identifying registration IDs.
- `comfort.test.mjs` checks schedules, grayscale limits, page distances, and scroll-gesture grouping.
- `social.test.mjs` checks that social routes distinguish feeds from messages and direct items.

## Browser fixtures

The Node tests cannot prove layout behavior in a real document. Start `python3 scripts/serve_demo.py` and use the pages listed in `docs/TESTING.md`. Those fixtures run the packaged content controllers against real local DOM, CSS animation, media, and reload behavior. They deliberately state when Chrome APIs or platform hosts are simulated.

## What still requires a person

Before uploading, inspect the ZIP, review the requested permissions in Chrome, complete every unchecked live test in `docs/TESTING.md`, and compare the developer-dashboard answers with the public privacy policy. Real Instagram, Facebook, TikTok, YouTube, ecommerce pages, permission prompts, accessibility, and Chrome Web Store review cannot be fully simulated by this repository.
