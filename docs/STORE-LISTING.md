# Listing draft — review before submitting

## Name

Quiet Browse

Working name; the publisher must check availability and trademark concerns.

## Short description

Calmer browsing with scheduled social controls, reliable instant paging, grayscale, and selectable regional adult-site lists.

## Single purpose

Reduce high-stimulation and compulsive browsing with local, user-controlled presentation changes and optional top-level adult-site blocking.

## Full description

Quiet Browse offers calmer browsing through individually controlled features. Built-in profiles start enabled for the disclosed Instagram, Facebook, TikTok, and major shopping hosts. Other sites are authorized from the toolbar.

- Optionally replace continuous vertical wheel scrolling with instant screen-by-screen jumps, on-page arrows, and a one-click return to normal scrolling. A small overlap keeps context, while sticky-header deductions are capped so they cannot reduce a jump to half a screen.
- Apply adjustable 0–100% grayscale manually or during local-time windows for that site. Scheduled grayscale discourages use but does not block access.
- Built-in shopping profiles begin at 20% manual grayscale. This default remains individually adjustable or removable.

- Pause recognized decorative CSS animation loops while leaving finite animations and recognized loading/status indicators alone.
- Give recognized English cookie accept/reject controls equal emphasis without clicking either choice.
- Optionally pause muted background autoplay videos and add native playback controls. This feature excludes YouTube.
- Hide supported desktop YouTube preview surfaces and ambient effects.
- Optionally collapse YouTube recommendations behind a reveal button.
- Manually hide the YouTube video picture for the current page while playback continues. The cover hides visual information; it does not remove edits or reconstruct footage. Native controls, including mute, and captions are intended to remain visible. Recognized ads and picture-in-picture are not covered.
- Independently hide supported Stories, short-video hubs, Explore/Discover, and home feeds on Instagram, Facebook, and TikTok, always or during separate local-time schedules. TikTok's landing stream is treated as both short-video and home-feed content, so either applicable hide control stops it. Messages, profiles, search, and direct item URLs remain available. Supported continuation recommendations are removed from direct-item and conversation routes.
- Manage saved profiles under collapsible Social, Ecommerce, and Other website categories, with one settings dropdown per site.
- Optionally enable Quit Porn, which asks Chrome to block top-level navigation matching a packaged adult-domain starter list and up to 500 additional hostnames. With a separate consent prompt, Quiet Browse can download any selected US-coverage, China-coverage, and Japan-coverage supplements now and about weekly. Each source is capped below 2,000 installed domains, fails independently, and keeps its own last successful rules. An optional password is stored only as a salted hash and is required for extension-UI changes that weaken or disable protection.

Use Show original page to undo the current page's presentation changes. Each host has separate settings. Removing another site revokes optional access; required access to the exact built-in hosts remains installed but removed profiles do not run.

Privacy: page structure and limited static labels/text are processed on your device. Hostnames, feature preferences, optional grayscale and social schedules, adult-blocker state, selected sources, additional blocked domains, update metadata, and an optional salted password hash are stored locally. No blocked-visit log is created. There is no developer server, analytics, cloud AI, account, or upload of page content. If community updates are enabled, GitHub's raw-content host receives ordinary connection metadata such as IP address and request time; no browsing history, matches, settings, or password is sent. Independent source licenses and links are disclosed in the privacy policy; Quiet Browse parses fixed data formats and filters selected protected entries.

Limits: this is not a universal dark-pattern detector, complete adult-content filter, tamper-proof parental control, flashing-content safety tool, or precise time-limit system. The independent community lists are unsigned and can contain false positives or omissions. Platform interfaces change. Long direct items, comments, and conversations may still scroll. The password cannot prevent disabling/uninstalling the extension, clearing its data, or using another browser/profile. Paging leaves zoom gestures, text fields, media controls, touch swipes, and app-like controls alone. It does not click consent, make purchases, download media, skip ads, filter advertising subresources, or bypass access controls.

Quiet Browse is independent and is not affiliated with or endorsed by Google, Meta, TikTok, or any supported shopping platform.

## Permission explanations

| Permission | Why the implemented features need it |
|---|---|
| activeTab | Identifies the current site's host after a user opens the toolbar popup. No persistent tabs/history permission is requested. |
| scripting | Registers local CSS and the presentation engine for an authorized host and applies them to the current page. |
| storage | Saves selected hostnames, enable/disable flags, feature preferences, optional grayscale and social schedules, and adult-list update status locally. |
| alarms | Reevaluates scheduled grayscale and social controls about once per minute and schedules selected community-list downloads about weekly. It does not show notifications or wake a sleeping device. |
| declarativeNetRequest | Installs local block rules only when Quit porn is enabled. Rules block matching top-level navigation; they do not redirect, log, or filter ads/subresources. |
| Required HTTPS hosts | Enables automatic built-in profiles on the exact disclosed Instagram, Facebook, TikTok, Amazon, eBay, Etsy, Walmart, Target, Temu, SHEIN US, and AliExpress hosts. |
| Optional HTTP/HTTPS hosts | Lets the presentation engine operate automatically on a site the user explicitly enables. Broad patterns declare the supported class of sites; actual requests are scoped to one HTTP or HTTPS host, including all ports. A separate user gesture requests only `https://raw.githubusercontent.com/*` for community-list updates. |

## Reviewer instructions

No login, payment, API key, or developer server is required for basic review. Verify the listed built-in profiles after install. On Instagram, Facebook, and TikTok, test each social switch separately, messages, search, a profile, and a direct item URL. Test route changes without a reload and confirm continuation feeds are removed without hiding the opened item. On a shopping profile, verify ordinary search/cart/checkout navigation without completing a purchase.

Test page-by-page navigation, grayscale, consent presentation, undo, and YouTube mute as described in the repository checklist. For Quit Porn, first decline community-list access and verify the packaged fallback works. Then select regional sources, inspect the fixed permission prompt and update status, and verify a controlled test domain through Chrome's ordinary blocked-client page. Repeat with an additional controlled hostname and a password; verify a wrong password cannot change, weaken, or disable it. Do not use private accounts, explicit screenshots, real purchases, or the local fixture as public proof.

Supply your own publicly accessible demonstration page or a short factual test video if the reviewer requests reproducible examples. Do not include private information or promise that a localhost fixture is publicly accessible.
