Quiet Browse 1.0.3 is a focused TikTok landing-feed fix.

### Changes

- Hides supported inner TikTok landing streams by default without disabling the landing page or its surrounding navigation.
- Handles localized URLs such as `/en/`, language/region/script prefixes, escaped language codes, and For You landing aliases.
- Recognizes alternate homepage/feed wrappers, single virtualized items, independently mounted items, and streams replaced after navigation.
- Mutes and pauses both video and separate audio inside the hidden landing stream, including attempts to restart or unmute playback.
- Keeps the dedicated landing-feed switch and schedule reversible. Turning it off restores prior mute choices without starting playback automatically.
- Preserves direct videos, profiles, search, messages, and utility pages, including when TikTok retains old homepage markup during navigation.
- Leaves YouTube, Instagram, Facebook, ecommerce, paging, grayscale, the adult content filter, and TikTok's Following feed adapter unchanged. No permissions or runtime dependencies were added.

### Focused verification

- All 62 affected TikTok landing-page isolation checks passed in isolated headless Chrome.
- The same checks passed with autoplay allowed in a disposable test profile, so audio protection does not rely only on Chrome denying playback.
- Both social-route tests passed, including the `/en/` regression that failed before the correction and localized shared-video/message safeguards.
- The attached ZIP and extracted local test folder match all 21 extension source files byte-for-byte.
- SHA-256: `17d1f9b4b32b47838b47d12712ee027ca7e931141d82fc4713ef93e3d5395782`

Constantin approved shipping after the local testing handoff on September 13, 2026. Unrelated fixture suites were not rerun for this TikTok-only patch. These are local structural tests, not a guarantee for every future TikTok layout or evidence of Google approval.

### Install or update

Download `quiet-browse-1.0.3.zip`, extract it, and load the folder containing `manifest.json` through `chrome://extensions` → **Developer mode** → **Load unpacked**. For an existing local copy, replace its files, reload its extension card, and reload TikTok tabs too. Check that **Hide TikTok landing feed** is enabled and not outside its schedule.

The source-code archives below are repository snapshots, not the extension-only Web Store upload. This GitHub release does not automatically update the Chrome Web Store listing.
