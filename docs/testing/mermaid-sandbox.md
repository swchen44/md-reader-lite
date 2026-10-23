# Mermaid sandbox repair and permanent Test Plan

## Intent and design

User reported three valid diagrams failing on GitHub raw and authorized the repair. Baseline `ca42884` is clean. The raw response includes `default-src 'none'; style-src 'unsafe-inline'; sandbox`. The same source renders 3/3 without sandbox, including under strict CSP. The inherited sandbox prevents the packaged renderer iframe from executing; it is not a missing CDN dependency.

For sandboxed/opaque pages, forward individual render jobs through the extension service worker to a bundled offscreen document. That document embeds the existing 1200×900 renderer iframe, preserving its strict CSP, resource preflight, SVG sanitization, style handling and serialized engine. Return the same sanitized SVG result to the reader. Ordinary pages keep their existing iframe path. No new visible tab, network renderer, remote font, host permission or storage of document source.

Add only the `offscreen` permission. Chrome supports this API from 109; feature-detect the API and report an explicit error if unavailable. The background serializes create/close operations, shares a single offscreen document across tabs, bounds each request, and closes it after idle. A document heartbeat runs only while rendering to cover the service-worker idle deadline. Cancellation/pagehide rejects local work; stale results cannot update an obsolete article generation. A later job can recover after a context failure.

Official boundaries: [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen), [service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle). `DOM_PARSER` is required by the existing DOMPurify/DOMParser pipeline. The offscreen host is private and is not added to web-accessible resources; its only frame/script targets are packaged extension files.

## Checklist

- [x] Reproduce the real raw URL and isolate sandbox from strict CSP.
- [x] Add browser regression and observe baseline RED.
- [x] Add real-module unit coverage for transport, concurrent creation, failure recovery and cleanup.
- [x] Implement offscreen adapter with unchanged engine security policy.
- [x] Verify the supplied URL, all 31 types in both styles, malicious-source rejection and no render egress.
- [x] Verify concurrent tabs, interruption/reload and offscreen idle cleanup.
- [x] Run full unit/typecheck/build/serial e2e and inspect zip.
- [x] Update architecture, developer guide, privacy/permission docs and lessons learned.
- [x] Commit with Why/What/How/Boundary; no push/tag/release or version change. Exact SHA is the commit containing this receipt.

## Permanent tests and regression

`tests/e2e/mermaid-sandbox.e2e.mjs` serves deterministic content under the actual sandbox policy, with no live GitHub dependency in the permanent gate. Network listeners treat even rejected HTTP resource attempts after the local document request as failures. Live GitHub verification is a separate receipt because content, network and browser versions can change.

```sh
npm run test:unit
npm run typecheck
npm run build
node --test tests/e2e/mermaid-sandbox.e2e.mjs
npm run test:e2e
git diff --check
```

Browser suites run serially. Logs/receipts/screenshots live under ignored `dist/`; rebuild them after moving the repository. A successful parser, a rendered sentinel, or a partial run does not establish full acceptance. Previous 173/173 e2e did not cover sandboxed Mermaid and is only historical evidence.

Article image requests observed during the original diagnosis are separate from the Mermaid renderer. This repair does not change media URL handling or claim that an online document makes no network requests. Preserve the renderer's zero-egress gate independently.

## Execution record

- Transport unit: two expected failures from trying to create an iframe in a sandbox, then 3/3 GREEN including the pre-existing disposal case. Host unit: a closed response callback initially caused an unhandled rejection; after cleanup handling, 3/3 GREEN.
- Broker unit: actual module with Chrome boundary mocks; concurrency, creation/send failures, 90-second deadline, sender checks, pre-116 discovery and busy/idle races. Agent reported 29/29 GREEN after functional RED and an idle-race RED. Full local unit run is 278/278, zero skips.
- Browser harness correction: `waitForFunction` uses page-world RAF/timer callbacks that the sandbox itself disables. A timeout receipt showed all three SVGs already `ready`. Poll from Node through isolated locator evaluation, without enabling page scripts or weakening CSP. Re-run the corrected test against a clean `ca42884` archive to establish product RED separately from the harness issue.
- Gallery accounting: count direct `pre > svg` roots; nested SVG icons are part of a diagram, not additional diagrams. All 31 top-level statuses were ready even when a descendant-SVG count reported 36.
- Independent read-only review found no concrete actionable defect in the scoped repair; it did not execute runtime tests. Production build and typecheck passed. Final complete browser/live-URL receipts are recorded below when finished.
- Corrected permanent test against a clean archived/build `ca42884` failed with the actual `Local renderer frame handshake timed out` title. Current build passes 7/7 focused browser tests, including 31 types in both styles and all interruption/security cases; zero skip/cancel/TODO. Initial harness and SVG-count failures remain in diagnostic logs and are not reported as product failures.
- Live reported URL: HTTP 200 with the original sandbox CSP, Chrome for Testing 147.0.7727.15, 3/3 ready SVGs and zero renderer iframes in the article. Receipt `dist/mermaid-sandbox-live.json`, first-diagram screenshot `dist/qa/mermaid-sandbox/physical-ai.png`. This is an observed live result, not a permanent network dependency for the test gate.
- Offscreen targets are not completely visible to Playwright's page request listener. The resource-rejection case therefore also checks the preflight error rather than a post-render CSP rejection, and a server-side trap detects requests from any target. The unchanged renderer CSP/preflight suite remains part of full regression; the article request listener alone is not proof of offscreen zero egress.

## Final receipt

- 278/278 unit and 180/180 full serial headed e2e passed, zero fail/cancel/skip/TODO. Full e2e exit 0, 249270 ms; sandbox subset 7/7, including 62 gallery outputs plus both styles of the three reported diagrams. Existing 31-type/372-output matrix, CSS/settings/search/file tree and sidebar regressions passed.
- Typecheck, production build, zip integrity, changed-file Prettier and git diff checks passed. No added package dependencies or host permission. Version stays 1.8.2; added permission is only `offscreen`. No push/tag/release.
- Logs: `dist/mermaid-sandbox-{corrected-red,transport-red,transport-green,host-red2,host-green,unit,typecheck,build,focused,regression,live}.log`; live receipt and screenshot paths above. These ignored artifacts are local evidence; source tests and this document are permanent. `MD_READER_EXTENSION` can point the browser test at a separately built baseline extension.
- Runtime acceptance is Chrome for Testing 147.0.7727.15 on this machine. Pre-116 discovery is unit-tested, not an older-browser runtime acceptance. Hosted CI, store upload, real BFCache hits and the separate article-media URL behavior were not changed or claimed verified.
