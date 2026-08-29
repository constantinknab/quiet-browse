# Policy and legal review notes

This is an engineering risk assessment, not legal advice, a legal opinion, or a guarantee of approval. Applicable law depends on jurisdiction and actual distribution/use. Chrome Web Store policies and website contracts are separate from law; satisfying one does not establish compliance with the others.

## Technical safeguards implemented

- Manifest V3; all executable code and CSS are bundled. No remote executable updates, evaluation of downloaded code, cloud model, or analytics SDK. The optional adult-list response is parsed strictly as data and cannot select code, URLs, actions, resource types, or rule priorities.
- Required permissions are activeTab, scripting, storage, alarms, and declarativeNetRequest. Exact HTTPS host access is required for the disclosed built-in social and shopping profiles; other hosts are optional and requested individually. Browser-internal pages and the Web Store are excluded.
- The adult-site feature creates one local dynamic block rule per domain for top-level navigation. The extension does not receive or log matching request URLs and does not redirect traffic. It does not filter ads or subresources. With separate runtime consent, it requests only the selected fixed US-coverage, China-coverage, and Japan-coverage sources now and about weekly, accepts bounded domain data through source-specific parsers, protects selected critical domains, and retains per-source last-known-good rules.
- No credential or browser-cookie access, video-frame access, tab capture, recording, downloading, redistribution, payment, automated consent, or account-change code.
- No paywall, DRM, login, security, or region restriction bypass. No ad-skipping or ad-blocking network rules.
- The picture cover is an explicit, temporary presentation change. It leaves recognized ad playback visible and does not alter the playback stream.
- Site input cannot select privileged actions: the worker checks the sender, derives policy scope from Chrome metadata, restricts write actions to its own UI, validates preferences, and limits storage to trusted extension contexts.
- Optional protection passwords are processed in the trusted extension UI/worker and stored only as salted PBKDF2-SHA-256 hashes. Password protection is disclosed as friction, not a security or parental-control boundary.
- No executable webpage strings are evaluated. Page labels are displayed with textContent, not HTML parsing.
- No Google/YouTube logos, approval claims, or third-party copied artwork are included.

## Residual risks to review before public release

1. **Third-party terms.** YouTube and the supported social/shopping platforms may restrict modification or interference. A local presentation change is not automatically permitted merely because it does not download content. Review each current agreement and feature before publishing. This project does not use a platform API, so do not claim API compliance based on an integration that does not exist. [YouTube terms](https://www.youtube.com/static?template=terms)
2. **Data protection.** Selected hostnames can be personal information. Local-only handling still needs truthful disclosure and an assessment of applicable obligations. Publishing a support site, collecting bug reports, adding telemetry, syncing settings, or monetizing the product changes that assessment.
3. **Functionality and accessibility.** Heuristic styling can be wrong. It does not identify all manipulation, verify whether urgency claims are true, or guarantee a safe visual experience. Check critical tasks and avoid medical/accessibility certification claims.
4. **Intellectual property and identity.** Check the final name, publisher identity, screenshots, and all added assets. Do not imply affiliation or Google approval.
5. **Marketing scope.** Advertise only implemented and verified behavior. The current package is an alpha with local fixture tests, not proof of universal compatibility.
6. **Advisory scheduling.** Chrome may deliver alarms late after sleep or heavy load. Describe scheduled grayscale as a preference that discourages use, never as an access control, parental control, or precise time-limit system.
7. **Content-filter completeness and age claims.** A finite domain list cannot block all adult material, and a local extension password cannot resist an administrator of the browser profile. Do not market Quit porn as child protection, legal age verification, pornography detection, or guaranteed relapse prevention. Review the blocklist and local law before each release.
8. **Single purpose and permissions.** The store listing must connect social-feed controls, presentation changes, and adult-site blocking to one narrow purpose: reducing high-stimulation or compulsive browsing. Reviewers may still disagree. Remove unrelated functions and justify every required host and the request-blocking permission.
9. **Remote-list supply chain, license, scope, and privacy.** Jarelllama's list and V2Fly domain-list-community are independent, unsigned sources under GPL-3.0 and MIT respectively. Coverage labels describe intended audience, not a domain's or server's location. Keep visible attribution and recheck licenses before distribution. Validation and last-known-good behavior do not eliminate false positives, omissions, malicious but syntactically valid domains, source compromise, raw GitHub availability, or connection-metadata disclosure. The packaged list remains necessary for major global domains. Confirm each source URL, license, maintenance status, file size, and behavior before every release; provide conspicuous opt-in and keep the fixed source permission optional. A publisher-controlled signed mirror would provide stronger provenance but also creates publisher infrastructure and data-handling duties.

## Relevant official references

- [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies): user data, minimum permissions, truthful marketing, intellectual property, and prohibited circumvention.
- [Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements): reviewer visibility into packaged functionality.
- [Content script capabilities](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts): document access and isolation.
- [Chrome permission model](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions): optional host access and limitations.
- [Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions): optional requests require a user gesture.
- [Declarative Net Request](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest): local block-rule behavior and permission model.
- [Remote hosted code policy](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code): distinguishes remote data from prohibited remotely hosted executable logic.
- [Jarelllama NSFW list](https://github.com/jarelllama/Scam-Blocklist#nsfw-blocklist): independent Tranco-derived popular-site supplement and Adblock format.
- [V2Fly domain-list-community](https://github.com/v2fly/domain-list-community): independent community source for the China and Japanese-content presets.
- [Store quality guidance](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq/): single purpose and minimum permissions.

There has been no legal sign-off, Google review, account registration, public deployment, or store submission as part of this build.
