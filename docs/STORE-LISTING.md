# Listing draft — review before submitting

## Name

Quiet Browse

Working name; the publisher must check availability and trademark concerns.

## Short description

Calmer browsing with social controls, an adult content filter, instant paging, motion limits, and grayscale.

## Single purpose

Reduce high-stimulation and compulsive browsing with local, user-controlled presentation changes and optional top-level adult-content filtering.

## Full description

Quiet Browse offers calmer browsing through individually controlled features. Built-in profiles start enabled for the disclosed Instagram, Facebook, TikTok, YouTube, and major shopping hosts. Other sites are authorized from the toolbar.

- Optionally replace continuous vertical wheel scrolling with instant screen-by-screen jumps, on-page arrows, and a one-click return to normal scrolling. A small overlap keeps context, while sticky-header deductions are capped so they cannot reduce a jump to half a screen.
- Apply adjustable 0–100% grayscale manually or during local-time windows for that site. Scheduled grayscale discourages use but does not block access.
- Built-in shopping profiles begin at 20% manual grayscale. This default remains individually adjustable or removable.

- Pause recognized decorative CSS animation loops while leaving finite animations and recognized loading/status indicators alone.
- Give recognized English cookie accept/reject controls equal emphasis without clicking either choice.
- Optionally pause muted background autoplay videos and add native playback controls. This feature excludes YouTube.
- Hide supported desktop YouTube preview surfaces and ambient effects.
- Optionally collapse YouTube recommendations behind a reveal button.
- Hide supported YouTube Shorts shelves and carousels by default while preserving ordinary recommendations and direct Shorts links.
- Hide supported Shorts hub entries from YouTube navigation by default. This is independent from the Shorts-shelf control and does not hide a direct `/shorts/{video}` link that the user receives.
- Hide supported YouTube Playables navigation, shelves, game cards, and route content by default. The separate control restores Playables without changing Shorts or ordinary video settings.
- Hide the YouTube video picture manually for the current page or save the preference so it reapplies after reloads and YouTube video changes. Page-only Show picture temporarily reveals the current video without changing the saved preference. The cover hides visual information; it does not remove edits or reconstruct footage. Native controls, including mute, and captions are intended to remain visible. Recognized ads and picture-in-picture are not covered.
- Independently hide supported Stories, follow recommendations, short-video hubs, Explore/Discover, and home feeds, always or during separate local-time schedules. On Instagram, only the individual post regions are hidden, so restoring or hiding the followed-post feed does not change Stories or suggested-account modules. TikTok has a separate default-on landing-feed control that hides only the vertically scrolling stream inside `/`, leaving the page, navigation, messages, profiles, and direct links available. Supported continuation recommendations are removed from direct-item and conversation routes.
- Manage saved profiles under collapsible Social, Video, Ecommerce, and Other website categories, with one settings dropdown per site.
- Optionally enable the Adult content filter, which asks Chrome to block top-level navigation matching a packaged adult-domain starter list and up to 500 additional hostnames. With a separate consent prompt, Quiet Browse can download any selected US-coverage, China-coverage, and Japan-coverage supplements now and about weekly. A failed refresh retries after about six hours. Each source is capped below 2,000 installed domains, fails independently, and keeps its own last successful rules. An optional password is stored only as a salted hash and is required for extension-UI changes that weaken or disable protection.

Use Show original page to undo the current page's presentation changes. Each host has separate settings. Removing another site revokes optional access; required access to the exact built-in hosts remains installed but removed profiles do not run.

Privacy: page structure and limited static labels/text are processed on your device. Hostnames, feature preferences, optional grayscale and social schedules, adult-content-filter state, selected sources, additional blocked domains, update metadata, and an optional salted password hash are stored locally. No blocked-visit log is created. There is no developer server, analytics, cloud AI, account, or upload of page content. If community updates are enabled, GitHub's raw-content host receives ordinary connection metadata such as IP address and request time; no browsing history, matches, settings, or password is sent. Independent source licenses and links are disclosed in the privacy policy; Quiet Browse parses fixed data formats and filters selected protected entries.

Limits: this is not a universal dark-pattern detector, complete adult-content filter, tamper-proof parental control, flashing-content safety tool, or precise time-limit system. The independent community lists are unsigned and can contain false positives or omissions. Platform interfaces change. Long direct items, comments, and conversations may still scroll. The password cannot prevent disabling/uninstalling the extension, clearing its data, or using another browser/profile. Paging leaves zoom gestures, text fields, media controls, touch swipes, and app-like controls alone. It does not click consent, make purchases, download media, skip ads, filter advertising subresources, or bypass access controls.

Quiet Browse is independent and is not affiliated with or endorsed by Google, Meta, TikTok, or any supported shopping platform.

## Permission explanations

| Permission | Why the implemented features need it |
|---|---|
| activeTab | Identifies the current site's host after a user opens the toolbar popup. No persistent tabs/history permission is requested. |
| scripting | Registers local CSS and the presentation engine for an authorized host and applies them to the current page. |
| storage | Saves selected hostnames, enable/disable flags, feature preferences, optional grayscale and social schedules, and adult-list update status locally. |
| alarms | Reevaluates scheduled grayscale and social controls about once per minute, schedules selected community-list downloads about weekly, and retries a failed refresh after about six hours. It does not show notifications or wake a sleeping device. |
| declarativeNetRequest | Installs local block rules only when the adult content filter is enabled. Rules block matching top-level navigation; they do not redirect, log, or filter ads/subresources. |
| Required HTTPS hosts | Enables automatic built-in profiles on the exact disclosed Instagram, Facebook, TikTok, YouTube, Amazon, eBay, Etsy, Walmart, Target, Temu, SHEIN US, and AliExpress hosts. |
| Optional HTTP/HTTPS hosts | Lets the presentation engine operate automatically on a site the user explicitly enables. Broad patterns declare the supported class of sites; actual requests are scoped to one HTTP or HTTPS host, including all ports. A separate user gesture requests only `https://raw.githubusercontent.com/*` for community-list updates. |

## Reviewer instructions

No login, payment, API key, or developer server is required for basic review. Verify the listed built-in profiles after install. On Instagram, Facebook, and TikTok, test each social switch separately, messages, search, a profile, and a direct item URL. On Instagram, toggle the home feed while Stories and follow recommendations remain independently hidden or visible. On TikTok `/`, toggle only Hide TikTok landing feed and confirm the inner stream changes while the page and navigation remain. On YouTube home, test Hide YouTube Shorts shelves, Hide the YouTube Shorts tab, and Hide YouTube Playables separately. Confirm ordinary recommendations and a direct Shorts link remain available, then visit `/playables` and confirm its content returns only when the Playables control is unchecked. Test route changes without a reload and confirm continuation feeds are removed without hiding the opened item. On a shopping profile, verify ordinary search/cart/checkout navigation without completing a purchase.

Test page-by-page navigation, grayscale, consent presentation, undo, and YouTube mute as described in the repository checklist. For the adult content filter, first decline community-list access and verify the packaged fallback works. Then select regional sources, inspect the fixed permission prompt and update status, and verify a controlled test domain through Chrome's ordinary blocked-client page. Repeat with an additional controlled hostname and a password; verify a wrong password cannot change, weaken, or disable it. Do not use private accounts, explicit screenshots, real purchases, or the local fixture as public proof.

Supply your own publicly accessible demonstration page or a short factual test video if the reviewer requests reproducible examples. Do not include private information or promise that a localhost fixture is publicly accessible.
