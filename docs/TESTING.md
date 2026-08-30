# Verification report and manual acceptance checklist

Date: August 30, 2026. Tests are intentionally split by what they establish. No live Chrome extension installation, real permission prompt, Web Store review, or live YouTube verification has been completed in this build session.

## Automated Node tests

Run `node --test tests/*.test.mjs` (Node 20+; no dependency installation).

The tests exercise URL normalization, protected-page exclusion, state migration, recommended-profile defaults, grayscale and social schedule boundaries, wheel grouping, capped sticky-header page distances, sender authorization, host grants, content-script migration, alarms, registration, current-tab injection, removal, permission revocation, adult-domain validation, three independent bounded dynamic-rule ranges, cleanup of a retired source range, optional source permission, update scheduling, fixed-source fetching, critical-domain protection, distinct download/format/Chrome-install failures, per-source last-known-good behavior, salted password verification, protected reset, and first-install seeding. A table-driven lifecycle matrix also exercises Instagram, Facebook, TikTok, all eight built-in shopping profiles, and YouTube. For every host it turns all boolean features and schedules on, disables the master switch, changes every feature while off, simulates a page policy reload and service-worker startup, enables without resubmitting settings, reverses every feature, and repeats the off/on cycle. The background uses a controlled Chrome API and fetch double, not Chrome or the live source.

Observed result during development: **51 reported tests passed, zero failed** (including 12 per-site lifecycle cases and the parent lifecycle test). Rerun after any changes.

## Static checks

Run `node scripts/check.mjs`.

Checks include manifest format, the exact required HTTPS host count, absence of blanket required host access, declared permissions, the narrowly scoped connection policy, icon dimensions, referenced files, JavaScript syntax, no inline executable HTML, no eval/Function construction, exactly one worker fetch call for the fixed data source, no other extension network-request primitives, and no innerHTML assignment. These are limited checks, not a complete security audit.

## Real-browser DOM fixtures

Start `python3 scripts/serve_demo.py`. Open:

- `/demo/tests.html`: 17 checks covering decorative vs. functional animations, consent presentation without automatic clicks, original handlers, sensitive-dialog exclusion, background video pause, newly inserted prompts, reversible styling, preservation of an unfinished note, and policy removal.
- `/demo/youtube-tests.html`: 22 checks covering recommendations/reveal, previews, saved and page-only picture-cover modes, temporary override persistence, YouTube and browser-history navigation reapplication, pause/restore, native mute hit-testing and audio state, fixture caption/control stacking, recognized ad states, and undo.
- `/demo/social-tests.html`: 16 checks covering Instagram route classification, independent Stories/Reels/Explore/home controls, local-time Stories scheduling, message/profile preservation, direct Reel preservation, continuation-feed removal, notices, and complete undo.
- `/demo/tiktok-tests.html`: 10 checks covering TikTok root classification, short-video/home-feed overlap, entry-point removal, message preservation, direct-video preservation, continuation-feed removal, and complete undo.
- `/demo/comfort.html`: 39 checks covering instant jumps, momentum grouping, sticky headers, nested panels, key and arrow controls, normal-scroll bypass, input/zoom exemptions, local schedule boundaries, grayscale composition, and full undo.
- `/demo/popup-tests.html`, its direct-repair, reload-fallback, social and shopping scenarios, and `/demo/options-tests.html`: 44 checks covering site enablement, direct missing-receiver repair, safe fallback, saved and page-only YouTube picture-cover controls, four independent social controls, the 20% shopping default, categorized site dropdowns, grayscale and social overnight-window editing, the three-source adult-blocker flow, and list-choice persistence after shutdown.

**Observed results: all 148 checks passed in the in-app Chromium browser.** Fixtures use real DOM/CSS/animation/media elements under a content security policy that forbids inline scripts and inline styles. Chrome messaging, permissions, fetch, and declarativeNetRequest are simulated; the YouTube and social fixtures use local markup and test-only host adapters. This does not prove compatibility with live platforms, the live lists, or a loaded Chrome extension.

The additional lifecycle matrix at `/demo/lifecycle-<profile>.html` runs the production content controllers against local structural fixtures for Instagram, Facebook, TikTok, all eight built-in shopping hosts, and YouTube. Each profile tests every feature alone, unsupported-feature isolation, all features together, full restoration after the master switch is disabled, a reload while disabled, re-enabling with saved off choices, restoring the features, a reload while enabled, scheduled grayscale and social activation, and final restoration. It performs **280 assertions per profile across two real document reloads (3,360 total)**. The observed result on August 30, 2026 was all 12 profiles passing. These are deterministic adapter tests with simulated policy messaging, not live-site or installed-extension results.

The popup and schedule editor were inspected in the browser. Enabling a site, paging, the grayscale slider, effective-strength feedback, overnight-window creation, saving, host switching, and session pause/restore states were exercised with simulated Chrome APIs. These UI checks do not test Chrome's permission dialog.

## Required live Chrome checks — not yet completed

- [ ] Load `extension/` unpacked in current stable Chrome. Record the Chrome version and OS.
- [ ] No manifest, service-worker, or content-script errors appear in `chrome://extensions`.
- [ ] Review and accept the required exact built-in HTTPS hosts and declarativeNetRequest warning. Upgrade from v0.2.2 and verify Chrome's permission-change behavior.
- [ ] On first version 0.5 install/update, verify the 11 disclosed profiles are seeded once. Remove one, restart Chrome, and confirm it stays removed.
- [ ] Deny the site-access prompt: the site remains unchanged.
- [ ] Grant one host: the extension works there and remains inactive elsewhere.
- [ ] Verify host permissions in Chrome. Confirm HTTP/HTTPS separation and all-port behavior.
- [ ] Toggle each setting, reopen the popup, reload the page, and restart Chrome: preferences and registrations behave correctly.
- [ ] Let the service worker become idle; reopening the popup still works.
- [ ] Try several real mouse wheels and trackpads: exactly one intended screen moves per gesture without an animated transition. Check the on-page arrows, keys, sticky headers, normal-scroll bypass, nested panels, infinite feeds, text fields, zoom, media, and touch separately.
- [ ] Test manual grayscale at 0%, a middle value, and 100%, including sites with existing CSS filters, fixed elements, fullscreen, print, and picture-in-picture.
- [ ] Test grayscale and each social schedule at start/end boundaries, overnight/all-day/overlapping windows, a timezone or DST change, Chrome restart, device sleep/wake, and deletion. Confirm late alarms fail open to ordinary site access.
- [ ] Show original without reloading: restore styles while retaining unfinished form data.
- [ ] Remove a site in extension settings and revoke access in Chrome separately: loaded pages restore and later loads remain inactive.
- [ ] Test multiple tabs with the same host and different hosts.
- [ ] Disable/uninstall through Chrome; save unfinished work and reload affected pages to clear residual DOM modifications.
- [ ] Check normal search, sign-in, reading, checkout (without an actual purchase), and cancellation navigation (without confirming cancellation) on representative sites. Never use real financial actions merely as a test.
- [ ] Check keyboard navigation, focus indicators, zoom, light/dark appearance, and screen-reader labels.
- [ ] Confirm there are no developer/analytics network connections and no stored page text, full URLs, credentials, or video data. With community updates off, confirm no raw GitHub request occurs; with selected sources on, confirm their fixed raw GitHub requests are the only extension-initiated external requests.

## Required live social and adult-blocker checks — not yet completed

- [ ] Instagram, Facebook, and TikTok signed-out and authorized signed-in layouts. Toggle Stories, short-video, Explore/Discover, and home-feed controls one at a time. On TikTok, verify that `/` is stopped by either the short-video or home-feed hide control and returns only when both applicable controls allow it.
- [ ] Give Stories, short video, Explore, and the home feed separate schedules. Verify each surface changes at its own local-time boundary without changing messages or direct items.
- [ ] Verify messages, search, profiles, notifications needed for ordinary use, and direct post/video links. Check SPA route transitions and browser back/forward navigation.
- [ ] Confirm a directly opened item remains visible while supported continuation feeds are absent. Test long comments and conversations; document any necessary scrolling.
- [ ] Test every built-in shopping host through search, cart, login, account, cancellation, and checkout navigation without placing an order. Confirm no price, choice, or purchase control is changed.
- [ ] Enable Quit porn and confirm packaged and user-added domains block only top-level navigation. Confirm normal subresources and unrelated domains are unaffected.
- [ ] Test duplicate, malformed, Unicode/punycode, and maximum custom domain inputs. Inspect dynamic rules after Chrome restart and extension update.
- [ ] Decline the community-list permission and confirm the packaged blocker still enables. Then select each preset and confirm Chrome asks only for `https://raw.githubusercontent.com/*`, the initial downloads succeed, per-source counts and timestamps appear, and every installed source remains below 2,000 domains without exceeding Chrome's dynamic-rule quota.
- [ ] Inspect the live responses, formats, attribution, and licenses before release. On August 29, 2026, Jarelllama NSFW was 118,247 bytes and hit its 1,995 cap; V2Fly category-porn was 92,745 bytes and hit the China 1,900 cap, while the conservative Japanese-content/.jp subset accepted 647 domains. These are point-in-time engineering observations rather than bundled data or permanence claims. Licenses disclosed by the projects are GPL-3.0 and MIT respectively.
- [ ] Simulate an outage, malformed file, oversized file, and Chrome rule-install rejection for each format. Confirm only the failing source keeps its old rules, the UI identifies the source and stage, and a six-hour retry is scheduled. Remove source permission and confirm automatic updates stop while installed snapshots remain active.
- [ ] Enable password protection, verify wrong passwords fail and the correct password permits update/disable/reset. Confirm plaintext is absent from extension storage. Verify the documented no-recovery and disable/uninstall bypass limits.

## Required live YouTube checks — not yet completed

- [ ] Desktop watch page, search, subscriptions, signed-out state, and a signed-in state authorized by the tester.
- [ ] Preview hiding, recommendation reveal, normal links, comments, and search remain functional.
- [ ] Hide YouTube video picture can be shown and removed; playback is neither skipped nor duplicated. Verify the saved preference reapplies after a full reload, another YouTube video opens through in-page navigation, and browser back/forward. Confirm page-only Show picture remains temporary without changing the saved preference. While covered, verify YouTube’s native mute button changes audio state and the remaining controls are clickable.
- [ ] Standard captions and controls remain visible and usable; test embedded/burned-in text separately (it is intentionally hidden by the cover).
- [ ] Recognized ad playback is uncovered; test actual ad variants. If a variant stays covered, fix the adapter or exclude the cover from release.
- [ ] Fullscreen, theater mode, live streams, seeking, keyboard shortcuts, navigation between videos, and restored playback after a page change.
- [ ] Picture-in-picture stays original, as documented.
- [ ] Record regressions and reassess platform terms before public distribution.

## Release evidence

Keep actual screenshots of the installed extension and a short record of the manual tests. Do not relabel the fixture preview as a live Chrome screenshot. Complete the flags in `release.json` only after the corresponding checks and reviews have happened.
