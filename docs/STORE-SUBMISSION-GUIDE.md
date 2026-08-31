# Quiet Browse 0.5.5 — complete Chrome Web Store submission guide

Prepared August 29, 2026. Check the live dashboard when its wording differs. Following this guide improves review clarity but cannot guarantee approval.

## What is ready

- Store package: `dist/quiet-browse-0.5.5.zip`
- SHA-256: `3d74cd40778d4a300355c825a8732c0b3a40b74e060070dd00f17167e412b02c`
- Manifest V3, 21 packaged files, and no remote executable code
- 38 Node tests, 136 browser fixture checks, static checks, and ZIP integrity checks passed
- Draft listing copy: `docs/STORE-LISTING.md`
- Public website source: `website/`
- Store icon and promotional tiles: `store-assets/`

These checks are not a live Chrome compatibility test, Google approval, legal review, or security certification.

## Cheapest release budget

| Item | Cheapest reasonable option | Cost |
|---|---|---:|
| Extension website | GitHub Pages from a public GitHub Free repository | $0 |
| HTTPS certificate | Included with the GitHub Pages address | $0 |
| Public support page | GitHub Issues | $0 |
| Screenshots | Chrome's built-in screenshot or macOS screenshot tools | $0 |
| Demo video | macOS screen recording plus an unlisted YouTube upload | $0 |
| Custom domain | Skip it initially | $0 |
| Chrome Web Store developer registration | Mandatory one-time fee shown in Google's dashboard | Required fee |

The minimum total is therefore the Chrome Web Store registration fee. A custom domain can be added later but does not establish compliance by itself.

## Phase 1 — choose the public identity

1. Choose the exact publisher name that will appear below the store listing.
2. Verify the support email in the Chrome Web Store dashboard. The public website uses GitHub Issues so this address does not need to appear in the repository.
3. Enable two-step verification on the Google account that will own the Chrome Web Store item.
4. Use Constantin Knab as the publisher name. Confirm that GitHub Issues is monitored as the public support channel.
5. Run:

   ```bash
   python3 scripts/check_publish_site.py
   ```

   Do not publish or submit while this command reports an error.

## Phase 2 — confirm licensing before making the repository public

The prepared repository uses:

- MIT for extension code, tests, and scripts (`LICENSE`).
- Creative Commons Attribution 4.0 for documentation, website copy/design, the Quiet Browse icon, and promotional graphics (`CONTENT-LICENSE.md`).

Creative Commons recommends software-specific licenses for software. Do not change the code to a CC license merely for branding consistency without understanding the compatibility and patent consequences. Publishing a permissive license grants rights to copies already received and is not a reversible trial.

## Phase 3 — publish the code and free website on GitHub

1. Sign in to the GitHub account that should own the project.
2. Create a **public** repository named `quiet-browse` without adding a generated README, license, or `.gitignore` because the local project already contains them.
3. From the project folder, initialize and push the prepared source:

   ```bash
   git init
   git branch -M main
   git add .
   git commit -m "Publish Quiet Browse 0.5.5"
   git remote add origin https://github.com/YOUR-GITHUB-USERNAME/quiet-browse.git
   git push -u origin main
   ```

4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **GitHub Actions**. The included `.github/workflows/pages.yml` deploys only `website/`.
6. Open **Actions** and wait for **Deploy Quiet Browse website** to pass.
7. Visit:

   - `https://YOUR-GITHUB-USERNAME.github.io/quiet-browse/`
   - `https://YOUR-GITHUB-USERNAME.github.io/quiet-browse/privacy.html`
   - `https://YOUR-GITHUB-USERNAME.github.io/quiet-browse/support.html`

8. Verify all three URLs load over HTTPS in a signed-out/private browser window. They must not require a GitHub login.
9. Do not add analytics, a contact form, advertising, a chat widget, or remote fonts before submission. Those additions change the website and possibly extension disclosures.

## Phase 4 — complete live Chrome acceptance testing

1. Open `chrome://extensions` in current stable desktop Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the repository's `extension/` folder.
4. Record the Chrome version, macOS version, and Quiet Browse version.
5. Complete every unchecked item in `docs/TESTING.md`.
6. Pay special attention to:

   - Fresh installation and upgrade from an earlier version.
   - Every required social and ecommerce host.
   - YouTube mute, captions, ads, theater mode, fullscreen, and picture cover.
   - Page-by-page scrolling with a mouse and trackpad.
   - Keyboard focus, inputs, nested scrolling panels, and zoom.
   - Social messages, profiles, search, direct posts, and route changes.
   - Shopping search, cart, login, cancellation, and checkout navigation without making a purchase.
   - Grayscale and social schedules across overnight boundaries.
   - Regional-list selection persistence after disabling and reloading settings.
   - Adult blocking with a harmless custom test hostname rather than explicit material.

7. Fix any material failure and increment the manifest version before submission.
8. Do a private pilot on at least one second computer/profile if possible.

## Phase 5 — capture five truthful screenshots

Set the Chrome window content area to 1280×800 if practical and save PNGs. Use a clean Chrome profile with no personal bookmarks, account avatar, notifications, messages, addresses, orders, or search history. Keep the real browser UI and extension UI visible; do not use the simulated local test fixture.

### Screenshot 1 — primary popup

1. Open the published Quiet Browse homepage or another neutral page you control.
2. Enable Quiet Browse for that host.
3. Open the toolbar popup.
4. Show page-by-page navigation enabled and grayscale at a visible middle value such as 40%.
5. Capture the full browser content area with the popup open.

Suggested caption: **Replace continuous scrolling with calmer page-by-page navigation and adjustable grayscale.**

### Screenshot 2 — categorized site settings

1. Open **Sites & privacy**.
2. Show the Social, Ecommerce, and Other website categories.
3. Expand one ecommerce site so the 20% grayscale setting is visible.
4. Do not show test-result banners or localhost URLs.

Suggested caption: **Keep separate, understandable controls for each website.**

### Screenshot 3 — scheduled social controls

1. Expand the Instagram profile in settings without showing an Instagram account or feed.
2. Show Stories, follow-recommendation, short-video, Explore/Discover, and home-feed controls.
3. Expand one schedule with a harmless example such as 8:00 PM–7:00 AM.

Suggested caption: **Hide high-stimulation social surfaces always or on your own schedule.**

### Screenshot 4 — grayscale and paging on a real neutral page

1. Use the public Quiet Browse homepage so you own the page being shown.
2. Set grayscale to 100% and show the on-page paging arrows.
3. Avoid a before/after composite unless both halves are truthful captures from the same version.

Suggested caption: **Reduce color and move one screen at a time without animated scrolling.**

### Screenshot 5 — optional adult-site blocker settings

1. Show the blocker settings page with US, China, and Japan list choices.
2. Do not show explicit pages, explicit imagery, or a list of adult domains.
3. If demonstrating blocking, add `example.com` as a temporary custom hostname, capture Chrome's ordinary blocked page separately if needed, then remove it.

Suggested caption: **Optional local top-level blocking with selectable lists and password friction.**

### Screenshot rejection risks

- No fake reviews, user counts, awards, medical outcomes, or Google-approval claims.
- No explicit sexual content or direct links to commercial adult sites.
- No personal accounts, messages, carts, orders, addresses, or payment details.
- No fixture pages presented as the real extension.
- No excessive platform logos or implication of affiliation.
- No feature shown unless it exists in version 0.5.5.

## Phase 6 — prepare the promotional video

Google's current listing documentation asks for a YouTube promo-video URL. Make a 45–60 second screen recording with captions and no personal data:

1. 0–8 seconds: Quiet Browse homepage and toolbar popup.
2. 8–18 seconds: one page-by-page jump with no animated transition.
3. 18–28 seconds: change grayscale from 0% to 60%.
4. 28–40 seconds: open categorized settings and a social schedule.
5. 40–52 seconds: show the blocker settings using `example.com`, never an adult page.
6. 52–60 seconds: disable the blocker and show that ordinary access returns.

Upload it as **Unlisted** on YouTube. Title it `Quiet Browse 0.5.5 — Chrome extension demonstration`. In the description, state that it shows version 0.5.5 and contains no paid endorsement.

## Phase 7 — register the Chrome Web Store developer account

1. Visit the Chrome Web Store Developer Dashboard with the permanent publishing Google account.
2. Accept the current developer agreement and policies yourself.
3. Pay the one-time registration fee shown in the dashboard.
4. Open **Account**.
5. Set the exact publisher name.
6. Add and verify the support email.
7. Confirm two-step verification is enabled.
8. Enable publication/review notification emails.
9. Add a physical address only if the current dashboard requires one for the selected business or monetization status; do not invent one.

## Phase 8 — create the item and upload version 0.5.5

1. In the dashboard, choose **Add new item**.
2. Upload `dist/quiet-browse-0.5.5.zip`.
3. Confirm the dashboard identifies Manifest V3 and version 0.5.5.
4. Do not upload the source repository ZIP. The Web Store package must have `manifest.json` at its root.

## Phase 9 — Store Listing tab

Use these fields:

- **Name:** `Quiet Browse`
- **Primary language:** English
- **Category:** Productivity
- **Summary:** `Calmer browsing with scheduled social controls, reliable instant paging, grayscale, and selectable regional adult-site lists.`
- **Detailed description:** Start from `docs/STORE-LISTING.md`. Keep its limits and independence statement; do not add universal effectiveness, addiction-treatment, safety-certification, or approval claims.
- **Homepage URL:** the GitHub Pages homepage
- **Support URL:** the GitHub Pages `support.html` URL
- **Store icon:** `store-assets/store-icon-128.png`
- **Screenshots:** the five real 1280×800 captures above
- **Small promo tile:** `store-assets/small-promo-440x280.png`
- **Marquee tile:** `store-assets/marquee-1400x560.png` (optional)
- **Promo video:** the unlisted YouTube URL

Turn on **Mature content** because the extension includes an adult-site blocking integration. This does not permit explicit material; keep the item, website, screenshots, and video free of it.

## Phase 10 — Privacy tab

### Single purpose

Paste:

> Reduce high-stimulation and compulsive browsing with local, user-controlled presentation changes and optional top-level adult-site blocking.

### Remote code

Choose **No, I am not using remote code**.

If a reviewer asks about downloads, explain:

> The optional regional sources are fixed domain-list data fetched from disclosed raw GitHub URLs. Bundled source-specific parsers accept domain strings only. The extension does not download or execute JavaScript, CSS, WebAssembly, instructions, actions, or rule definitions.

### Conservative data-category mapping

Read the dashboard's live definitions before answering. For the current code, disclose at least:

- **Website content:** yes; limited structure, labels, animation properties, and media state are processed locally for visible features.
- **Web history/browsing activity:** yes under Google's broad definition; the current hostname is processed and chosen hostnames are stored, although the extension has no `history` permission and creates no chronological history log.
- **Authentication information:** disclose the optional extension-protection password if the dashboard definition includes passwords. Only its salted PBKDF2 hash is stored locally; website credentials are not read.

For every category, state that data is used only for the disclosed feature, remains on the device, is not sold, is not used for advertising or credit decisions, and is not transmitted to the publisher. The only optional external requests fetch selected list data; GitHub receives ordinary connection metadata but no page content, settings, matches, added domains, or password.

### Privacy policy URL

Use the public GitHub Pages `privacy.html` URL. Confirm that the public wording and dashboard answers match exactly.

### Permission justifications

Use the permission table in `docs/STORE-LISTING.md`. Mention that broad HTTP/HTTPS patterns are optional declarations and Chrome requests access to one user-selected origin at a time. Explain every one of the eleven exact required hosts as disclosed built-in profiles.

## Phase 11 — Distribution and reviewer instructions

1. Start with **Private** for named trusted testers or **Unlisted** for a link-based pilot.
2. Select only the regions where you are prepared to support the extension.
3. Do not claim the extension is a regulated health, safety, parental-control, or age-verification product.
4. Paste these reviewer instructions:

> No account, API key, payment, or developer server is required. Open the toolbar popup on a neutral HTTPS page and authorize that host to test paging, grayscale, motion limits, and undo. Open Sites & privacy to inspect the exact built-in Social and Ecommerce profiles and the separate social schedules. YouTube preview/recommendation and picture-cover controls can be tested signed out; the picture cover must leave native controls, including mute, usable. To test top-level blocking without visiting adult content, deselect all regional lists, add example.com as an additional hostname, enable the blocker, navigate to https://example.com and observe Chrome's ERR_BLOCKED_BY_CLIENT page, then disable the blocker and confirm access returns. Regional lists require a separate optional raw.githubusercontent.com permission and are parsed only as bounded domain data. The extension contains no analytics, remote executable code, advertising, media downloading, ad skipping, purchase automation, or access-control bypass.

5. Do not give reviewers personal social-media credentials. If a signed-in layout is necessary, provide a dedicated test account only after reviewing that platform's rules.

## Phase 12 — submit safely

1. Review every dashboard tab for warnings.
2. Confirm the package, listing, privacy answers, website, screenshots, video, and reviewer instructions all describe version 0.5.5.
3. Choose **Submit for Review**.
4. Disable automatic publication so approval produces a staged release.
5. Monitor the verified publisher email.
6. If Google requests clarification, answer directly and update code/listing rather than adding review-only behavior.
7. If approved, run a short private/unlisted pilot before switching to public visibility.
8. Publish the staged release within the dashboard's stated window; Google's documentation currently gives up to 30 days.

## Phase 13 — final local release gate

Fill in `docs/release.json` only after each item is actually complete, then run:

```bash
python3 scripts/check_publish_site.py
python3 scripts/release_check.py
```

The checks record preparation; they do not represent Google approval or legal certification.
