# From local prototype to Chrome Web Store submission

Prepared August 29, 2026. Follow the live dashboard and current policies if they differ from this guide. **Submission and approval have not happened.**

## 1. Finish the live acceptance tests

Load `extension/` unpacked and complete `TESTING.md` in actual Chrome, including new install/update warnings, built-in profile seeding, dynamic adult-site rules, password behavior, real Instagram/Facebook/TikTok routes, shopping checkout paths, and desktop YouTube. Do not treat local test doubles as evidence of live-platform compatibility. Keep a small private pilot before broad distribution.

## 2. Identify the publisher

Choose your actual publisher name and a support email you control. Check the proposed product name for conflicts. Set up a developer account, review Google's agreements yourself, and pay the registration fee shown in the dashboard. These are account and payment steps for you to authorize and perform. [Registration instructions](https://developer.chrome.com/docs/webstore/register)

Enable two-step verification and complete the dashboard's contact/identity disclosures and any applicable trader-status requirements. Do not invent an address, identity, or business classification. [Google's two-step verification policy](https://developer.chrome.com/blog/policy-update-2sv)

## 3. Publish an accurate privacy policy

Use `extension/ui/privacy.html` as the starting content. Before public release, replace its local-build/publisher caveat with your real publisher identity and support contact. Put the finalized policy on a public HTTPS page you control and verify it works without signing in. The extension-internal URL is not an adequate public store-policy link.

Disclose **local processing of page structure/text, required built-in hosts, optional hosts, stored adult-domain additions, salted password hashes, local navigation blocking, and opt-in requests to selected regional lists through GitHub's raw-content host**. Explain that GitHub receives ordinary connection metadata but no browsing history, matches, settings, or password. Include each fixed source and its license. Do not describe the product as accessing no user data or having no external requests. Keep the Limited Use statement. If your support site adds analytics or collects reports, disclose that separately. [Chrome Web Store privacy requirements](https://developer.chrome.com/docs/webstore/program-policies/policies#protecting-user-privacy)

## 4. Prepare honest assets

- Use `extension/icons/icon128.png` as the extension icon. It is original artwork supplied with this project.
- Capture real screenshots of the installed extension and its effects, using your own sample page without personal data.
- Supply at least one screenshot in the current permitted dimensions (the documentation lists 1280×800 or 640×400) and the required promotional tile (440×280). Verify the dashboard's current requirements.
- Do not submit the simulated popup preview as proof that the extension runs in Chrome. Do not include Google endorsement badges, medical claims, universal dark-pattern claims, or fake reviews.

[Official image requirements](https://developer.chrome.com/docs/webstore/images)

## 5. Build and inspect the ZIP

Run the tests and static check, then `python3 scripts/package.py`. The generated archive is `dist/quiet-browse-0.5.5.zip`, with `manifest.json` at its root. Only extension assets are included; fixtures and developer tools are excluded. The packager validates file paths and writes a SHA-256 checksum.

This command produces a local package even when release gates are incomplete. `python3 scripts/release_check.py` separately explains whether publication prerequisites have been recorded. Do not tick those gates without doing the work.

## 6. Complete the dashboard

Create a new item, upload the ZIP, and use `STORE-LISTING.md` as a draft. Add genuine support and policy URLs, a category appropriate to the functionality, accurate screenshots, and your distribution selections. For the privacy tab, carefully apply the current definitions of data access, local handling, collection, and transfer. The facts are listed in the privacy policy; do not guess at questionnaire categories.

Explain the single purpose and every permission. State that executable code and CSS are bundled locally; list every required built-in HTTPS host; explain that other host access is optional; disclose the separate opt-in permission and fixed data-only regional-list requests; and explain that declarativeNetRequest is used only for enabled top-level adult-domain blocks. Do not call the update sources publisher-controlled, global, complete, or cryptographically verified. Google evaluates whether the permissions and behavior are justified; a checklist cannot guarantee acceptance.

## 7. Review and submit

Review third-party terms and applicable law with qualified counsel when needed, especially before marketing the YouTube cover broadly. Set the real URLs and completion flags in `release.json`, then rerun the release checker. Final submission requires the publisher's review and authorization. Respond to review findings with actual fixes, not misleading descriptions or hidden review-only behavior.

[Publishing workflow](https://developer.chrome.com/docs/webstore/publish) · [Program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
