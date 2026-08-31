# Quiet Browse

A usable Chrome 123+ extension for calmer browsing. It combines local presentation controls, scheduled social-feed controls, and an optional adult-site blocker with a packaged fallback and three opt-in regional sources. **Version 0.5.6 is a user-tested beta that has not been submitted to or approved by the Chrome Web Store; it is not a legal certification or tamper-proof parental control.**

[Website](https://constantinknab.github.io/quiet-browse/) · [Privacy](https://constantinknab.github.io/quiet-browse/privacy.html) · [Support](https://constantinknab.github.io/quiet-browse/support.html) · [GitHub releases](https://github.com/constantinknab/quiet-browse/releases)

The extension code and build/test scripts are MIT licensed. Documentation, the public website, icon, and store graphics are available under CC BY 4.0; see `CONTENT-LICENSE.md`. The public-site source is in `website/`, promotional assets are in `store-assets/`, and the complete release workflow is in `docs/STORE-SUBMISSION-GUIDE.md`.

## Install it locally — no coding tools needed

1. Download the release ZIP from [GitHub releases](https://github.com/constantinknab/quiet-browse/releases) and extract it into a dedicated folder. Alternatively, clone this repository and use its `extension/` folder.
2. Open Chrome and type `chrome://extensions` into its address bar.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**, then select the extracted folder containing `manifest.json` (or this repository's `extension/` folder). Do not select the ZIP or repository root.
5. Open Chrome's puzzle-piece Extensions menu and pin **Quiet Browse**.
6. Review Chrome's install warnings. Built-in profiles start enabled for the exact HTTPS social and shopping hosts listed below. Open any other ordinary website, click the extension icon, and choose **Enable on this site** to request that host separately.
7. Turn on **Instant page-by-page navigation** if you want wheel gestures and the page arrows to jump one screen at a time.
8. Use **Grayscale** for a manual 0–100% amount. Choose **Edit times and days** for per-site grayscale, Stories, follow-recommendation, short-video, Explore, and home-feed windows.
9. Use **Normal scroll** for a temporary bypass, **Show original page** if something looks wrong, or **Turn off for this site** for a lasting change.
10. Open **Sites & privacy** for categorized Social, Ecommerce, and Other site dropdowns, plus **Quit Porn**, additional blocked hostnames, optional password protection, and the selectable US-coverage, China-coverage, and Japan-coverage lists. Chrome asks separately before the selected sources can be contacted.

No developer account, registration payment, API key, npm install, or Google review is needed just to load your own unpacked copy. Managed Chrome profiles may prohibit developer mode; do not circumvent an administrator's restrictions.

## What is implemented

| Control | Default on an enabled site | Behavior |
|---|---|---|
| Instant page-by-page navigation | Off | One vertical wheel gesture, an arrow key, Page Up/Down, Space, or the on-page arrows jumps about one visible screen with a small overlap and no scrolling transition. Sticky-header deductions are capped and a selected scrollable panel pages locally. |
| Grayscale | 20% on built-in shopping profiles; off elsewhere | Applies an adjustable 0–100% grayscale amount, manually or in up to 12 local-time windows per site. Outside scheduled windows the page returns to full color. |
| Decorative loops | On | Pauses recognized infinite CSS loops; leaves finite animations and recognized status/loading indicators alone. |
| Cookie choices | On | Styles recognized English accept and reject controls equally; never clicks or submits. |
| Background autoplay | Off | Pauses muted autoplay videos lacking native controls and adds those controls. Excludes YouTube. |
| YouTube previews | On | Hides supported preview surfaces and ambient decoration. Does not stop all decoding or network activity. |
| YouTube recommendations | Off | Collapses the supported watch-page list behind a reveal button. |
| Hide YouTube video picture | Manual by default; optional saved mode | Covers the picture while playback continues. A saved preference reapplies after reloads and YouTube video changes; Show picture remains a page-only override. It does not edit cuts or change audio. Native controls, including mute, and captions remain available; recognized ads and picture-in-picture are uncovered. |
| Social Stories | On for built-in social profiles | Hides supported Stories navigation and trays on Instagram, Facebook, and TikTok, always or during up to 12 local-time windows. |
| Social follow recommendations | On for built-in social profiles | Hides supported suggested-account modules on home pages, independently from Stories and the followed-post feed. |
| Social short video | On for built-in social profiles | Hides supported Reels, Watch, and TikTok short-video hubs and entry points, always or on a separate schedule. TikTok's `/` landing stream counts as both short-video and home-feed content, so either hide control stops it. A direct item URL remains viewable. |
| Social Explore | On for built-in social profiles | Hides supported Explore and Discover navigation and route feeds, always or on a separate schedule, while leaving search, profiles, and messages available. |
| Social home feed | On for built-in social profiles | Hides supported home/infinite feeds, always or on a separate schedule. Direct items and conversations remain; marked continuation recommendations are removed. |
| Quit Porn | Off | Adds local Chrome request-blocking rules for a packaged starter list plus up to 500 user-entered hostnames. With separate consent, it downloads any selected bounded US-coverage, China-coverage, and Japan-coverage lists now and about weekly. It only blocks top-level navigation and stores no visit log. |

Built-in profiles start enabled for `www.instagram.com`, `www.facebook.com`, `www.tiktok.com`, `www.amazon.com`, `www.ebay.com`, `www.etsy.com`, `www.walmart.com`, `www.target.com`, `www.temu.com`, `us.shein.com`, and `www.aliexpress.com`. These exact HTTPS host permissions are required because automatic operation is a core feature. Other hosts remain off until separately authorized. Each profile can be turned off or removed.

Downloaded lists are treated only as untrusted domain data. Each fixed parser accepts its documented plain format, filters selected critical domains, and caps output at 1,995 US-coverage entries, 1,900 China-coverage entries, or 1,500 Japan-coverage entries. One source can fail without replacing the other sources or its own last successful rules. The sources are [Jarelllama's Tranco-derived NSFW list](https://github.com/jarelllama/Scam-Blocklist#nsfw-blocklist) (GPL-3.0) and [V2Fly domain-list-community](https://github.com/v2fly/domain-list-community) (MIT). Coverage labels describe the intended audience and do not prove where a domain or server is located. These independent, unsigned lists can contain false positives and omissions. Optional requests expose ordinary connection metadata such as IP address and time to GitHub's raw-content host, but send no browsing history, settings, matches, or password.

The adult-site password is stored only as a salted PBKDF2-SHA-256 hash. There is no recovery. It adds friction for settings changes, but anyone with control of Chrome can disable or uninstall the extension, clear its data, or use another profile or browser.

## What is not implemented

Universal dark-pattern detection; complete adult-domain coverage; tamper-proof blocking; cryptographic verification of the community lists; automatic cancellation or consent; guaranteed flash protection; GIF/canvas animation control; video reconstruction or cut smoothing; network ad blocking; downloads; paywall/DRM/login bypass; third-party iframe or closed-shadow-root support. Paging does not intercept touch swipes, zoom gestures, text/media controls, canvas or app-like custom controls. Social and YouTube selectors may change. Long direct posts, comments, and conversations may still scroll; the social adapter removes supported feed entry points and continuation surfaces rather than disabling every scrollbar.

The picture cover intentionally hides visual information. Use it for material you can follow without the picture. It is **not** an accessibility or seizure-safety guarantee.

## Folder map

```text
quiet-browse/
  extension/                 ← load this directory in Chrome
    manifest.json
    background.js            permission checks, registration, saved preferences
    shared/                  normalized host scopes, schedules, and paging logic
    shared/adult-domains.js packaged adult-domain starter list and fixed update-source metadata
    content/comfort.js       instant paging toolbar and grayscale presentation
    content/social.js        route-aware, reversible social surface adapter
    content/engine.js        reversible DOM, motion, video, social, and YouTube behavior
    content/presentation.css extension-injected CSS
    ui/                      popup, site manager, help, privacy policy
    icons/                   original PNG artwork
  tests/                     dependency-free Node tests and a plain-English test guide
  demo/                      local real-DOM fixtures; excluded from release ZIP
  scripts/                   checks, icon generation, packaging, local server
  docs/                      submission guide, listing draft, release gates, tests
  dist/quiet-browse-0.5.6.zip ← generated extension-only archive
```

## Developer commands

With Node 20+ and Python 3 installed:

```sh
cd quiet-browse
npm test
npm run check
npm run demo
npm run package
npm run verify
```

There are no third-party runtime or test dependencies. `npm` only runs the scripts; it does not need to install anything. You can also run `node --test tests/*.test.mjs` and `node scripts/check.mjs` directly. Packaging and the local demo use Python:

```sh
python3 scripts/serve_demo.py
python3 scripts/package.py
python3 scripts/audit_package.py
python3 scripts/release_check.py
```

The server binds only to `127.0.0.1:8674`. Visit these URLs while it runs:

- [Manual installed-extension lab](http://127.0.0.1:8674/demo/index.html)
- [Automated DOM fixtures](http://127.0.0.1:8674/demo/tests.html)
- [YouTube structural fixtures](http://127.0.0.1:8674/demo/youtube-tests.html)
- [Social route fixtures](http://127.0.0.1:8674/demo/social-tests.html)
- [Paging and grayscale fixtures](http://127.0.0.1:8674/demo/comfort.html)
- [Popup UI preview with simulated Chrome APIs](http://127.0.0.1:8674/demo/popup.html)
- [Schedule editor preview with simulated Chrome APIs](http://127.0.0.1:8674/demo/options.html)

Use only the manual lab when testing the actual installed extension. Automated fixture pages inject a test double and should not also run an enabled installed copy.

After installing this update, Chrome may require acceptance of the exact built-in host permissions and request-blocking permission. Regional lists remain off until the user selects them and accepts a separate runtime permission for `raw.githubusercontent.com`. Reload the extension card at `chrome://extensions`, accept only if the disclosed scope is acceptable, and reload affected pages after saving unfinished work. Existing preferences migrate locally; the built-in profiles are seeded once, and the adult-site blocker starts off.

## Publishing

Read [the complete submission guide](docs/STORE-SUBMISSION-GUIDE.md), [the listing draft](docs/STORE-LISTING.md), [the verification report](docs/TESTING.md), and [the policy and legal review notes](docs/POLICY-AND-LEGAL.md). The source repository, support channel, and privacy website are public. The Chrome Web Store checklist remains incomplete until the publisher performs the live Chrome and website checks and completes the developer-dashboard disclosures. No Chrome Web Store submission has been made.

The extension can reduce certain presentation pressures; it cannot ensure that every website becomes non-predatory. Website terms, store approval, privacy obligations, and law are separate considerations.
