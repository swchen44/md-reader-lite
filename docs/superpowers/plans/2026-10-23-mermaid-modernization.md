# Mermaid 12 Migration Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to execute task by task. Update this file after every gate and commit so another session can resume after a reboot. The user authorized execution and push to GitHub main on 2026-10-23.

**Goal:** 在離線與 MV3 限制內將核心升到 Mermaid 12.2.0，逐項驗證 30 種核心圖與 ZenUML，保留 Original／Anthropic blog style。

**Architecture:** Markdown 同步產生 escaped source placeholder；獨立 renderer 以序列佇列執行設定初始化、非同步渲染與清理。每次文件更新建立 generation，只有有效工作可插入 DOM、更新搜尋索引或還原閱讀位置。先以與產品相同的 isolated-world content script 執行 probe，再調整產品依賴。

**Tech Stack:** TypeScript、MarkdownIt、webpack 5、Chrome MV3、Mermaid 12.2.0、`@mermaid-js/mermaid-zenuml` 1.0.1、既有 Node test runner 與本機 Playwright。

**Spec:** [Mermaid modernization design](../specs/2026-10-22-mermaid-modernization-design.md)。同時遵守 [developer guide](../../developer_guide.md)。

## Current Checkpoint

- Updated: 2026-10-23, Asia/Taipei.
- Product baseline: `5df0a82`, version 1.8.2, wrapper 0.5.1 / Mermaid 9.1.6.
- GitHub: C `35b4294` is pushed; D `4eea56a`, CI notices `1065b21` and E receipt await the final authorized push/remote verification.
- Probe checkpoint: expanded shared confined suite **33/33** pass; raw strict resource counterexamples remain as comparison evidence. See [probe report](../../research/mermaid12-probe.md).
- Product migration: A–E runtime accepted. Root Mermaid 12.2.0, TypeScript 5.0.4, ZenUML plugin 1.0.1/core 3.50.1. Both styles cover 31 fixtures and all 372 matrix outputs.
- Final checks: **239 unit, 146 serial e2e, 33 confined probe**, zero fail/cancel/skip/TODO; evidence helpers 3/3, compiler/build/zip checks pass. Width is 85% for new/reset settings; saved pixel/percent/disabled choices remain unchanged. Full notices ship in the zip.
- Performance/audit: final clean-source raw JSON and [acceptance/handoff report](../../research/2026-10-23-mermaid12-acceptance.md) are saved under docs. Shared-11 cold median is 3.05/3.11× baseline, warm 4.37/3.60×; zip 2.33×. Tradeoff explicitly reviewed below. No new audit advisory IDs; four existing high advisories remain.
- Next task after resume: commit E documentation/receipts, push authorized main and verify SHA/clean status. The clean owned baseline worktree has been removed after preserving its raw measurements; do not remove other worktrees. No remaining feature implementation; do not restart A–C, release, bump version or claim hosted CI ran.

## Global Constraints

- Pin exact Mermaid and ZenUML versions; the root `pnpm-lock.yaml` stays unchanged during A.
- No CDN, remote renderer, downloaded fonts, new host permissions or weakened CSP.
- `securityLevel: strict`; document directives cannot lower protected resource or size limits.
- `example/mermaid-compatibility.md` remains the shared 31-type fixture; preserve old syntax as regression cases when a correction is necessary.
- A public registry version or external-plugin peer range is source evidence only; acceptance requires actual extension rendering.
- Test attempts to contact remote endpoints count as failures even when intercepted by the test runner.
- Keep every stage independently verifiable. Update tests alongside B and C, not only during E.
- Use scoped commits with real multiline Why / What / How / Boundary. No automatic version bump, tag or release.
- Record real pass/fail/skip/TODO counts and browser/build versions. Keep limitations explicit.

## Review Focus

- Normal diagrams may pass while remote image or CSS resources load during rendering: A tests the entire network interval before DOM insertion.
- An extension page can pass while a content script fails to load chunks: A uses manifest injection on HTTP and file pages, including strict page CSP.
- A search opened before a placeholder becomes SVG may retain stale entries: B rebuilds only for the active generation and exercises active-query updates.
- A rejected or stale render can block the shared queue: B tests failure followed by success and skips obsolete work before expensive rendering.
- ZenUML can work only in a single filtered view: C tests full unfiltered galleries and repeated registrations as well as individual cases.

## Durable Checklist

- [x] Inspect clean worktree, remote and recent commits.
- [x] Verify the existing baseline before push: 213 unit pass; typecheck/build pass; 87 focused e2e pass, 0 fail, 1 existing TODO, 0 skip.
- [x] Push the existing eight commits to `origin/main` at `5df0a82`.
- [x] Incorporate all four review findings into the design and this implementation plan.
- [x] A1: Commit versioned probe sources, manifest, independent lockfile and commands.
- [x] A2: Run 30 core types and ZenUML in a real content script; save individual measurements and full-gallery receipts.
- [x] A3: Run HTTP, file, strict-CSP and malicious-resource checks; B is not allowed yet because four privacy gates fail.
- [x] A4: Prove a resource policy that acts before Mermaid can initiate requests, then repeat A's environment and safety gates.
- [x] B: Migrate product rendering, security, completion/search lifecycle and corresponding permanent tests.
- [x] C: Integrate ZenUML and validate all 31 types in the product.
- [x] D: Preserve styling, viewer controls, localization and reading position.
- [x] D2: Default Mermaid to Anthropic without overwriting saved Original; restyle all settings tabs and preserve controls/accessibility (user approved 2026-10-23).
- [x] D3: Default new/reset custom width to 85 percent; preserve existing pixel/percent/disabled settings (user approved 2026-10-23).
- [x] E: Run full matrix/regression, update documentation and record final review.
- [ ] Commit all completed stages, push authorized verified changes and verify remote SHA / clean worktree.

## Task A: Reproducible MV3 Probe

**Files:** Create `tests/probes/mermaid12/{package.json,package-lock.json,build.cjs,content.js,background.js,manifest.json,probe.test.mjs,README.md}`. Create `docs/research/mermaid12-probe.md` after executing. Artifacts go in `dist/probes/mermaid12/`.

**Consumes:** The 31 Mermaid fences in `example/mermaid-compatibility.md`, root webpack installation and local Playwright. The probe's own npm install supplies Mermaid and ZenUML without modifying root dependencies.

**Produces:** A repeatable `npm ci --ignore-scripts --prefix tests/probes/mermaid12` install; `node tests/probes/mermaid12/build.cjs` build; `node --test tests/probes/mermaid12/probe.test.mjs` runtime command; JSON evidence with package/browser versions, per-diagram dimensions/errors, requests and gate results.

- [x] Save the probe package with exact versions and generate its independent lockfile. Keep `node_modules` ignored.
- [x] Use webpack with `LimitChunkCountPlugin({ maxChunks: 1 })` to test eager bundling first. Copy a versioned MV3 manifest and service worker; inject `js/content.js` in the default isolated world on matching HTTP/file documents.
- [x] Parse the shared Markdown fixture using MarkdownIt. The content script reads a JSON payload from a DOM node, clears the fixture page and renders each diagram serially with protected settings; result nodes expose status, source, SVG and errors for browser assertions.
- [x] Test without ZenUML registration first, then with locally bundled registration; verify each core type and a separate full mixed gallery. Reject error SVGs and zero-size output.
- [x] Run an HTTP document with strict CSP and a local file document with Chrome's extension file access enabled. Record any permission setup explicitly; do not weaken page CSP to pass.
- [x] Include remote HTML image labels, SVG image nodes, CSS URL imports and directives attempting to lower security. Observe requests from before navigation until completion, including aborted attempts. A normal fixture alone is insufficient.
- [x] Add broken/unknown input followed by a known flowchart; source must remain readable and later work must finish.
- [x] Store machine-readable evidence and screenshots in ignored artifacts; commit a readable report with exact failures. Do not call A passed when any required environment or safety check is unavailable or fails.
- [x] Commit `test: add reproducible Mermaid 12 MV3 feasibility probe` with Why / What / How / Boundary and update the checklist.

**Gate:** All 30 core fixtures render, HTTP/file/CSP checks pass and protected rendering emits no unexpected remote requests. ZenUML gets an independent result. A failed resource boundary requires a concrete rendering-policy fix and another A run before product migration. If no safe local candidate works, keep the product baseline and document the blocker.

## Task A4: Close the Pre-render Resource Boundary

**Files:** Extend `tests/probes/mermaid12/` only until a safe candidate passes. Keep raw strict-mode failures as comparison evidence; put candidate policy in a separate module and identify the policy in the receipt. Update the spec if an isolated renderer becomes necessary.

- [x] Inspect the pinned public parse/config interfaces and the image/HTML/CSS paths in the report. Determine which operations can occur before a returned SVG exists.
- [x] Prototype a conservative policy that accepts ordinary fixtures and explicitly rejects unsupported resource-bearing input before rendering. Use structured configuration, HTML and CSS parsing; URL substring matching is insufficient for entities, CSS escapes or relative URLs.
- [x] If public APIs cannot establish the boundary, prototype a locally confined renderer. Verify host CSP, WAR, execution world, message sender identity and returned SVG before changing product architecture. Do not alter whole-page policy or browser-wide globals as an incidental fix.
- [x] Add HTML entity URLs, CSS-escaped URLs, YAML resource configuration, relative images, SVG use/image resources and resource-loading style declarations. Keep the four valid raw negative fixtures; add explicit policy-rejection assertions with preserved source and later-diagram recovery.
- [x] Run evidence helpers, build fingerprint verification and the same 30/31, HTTP/file/strict-CSP, recovery and no-request gates for the candidate. Test interception never counts as an implemented product policy.
- [x] Record tradeoffs and outcomes. Permit B only after a safe candidate passes; otherwise preserve root dependencies with a concrete reproducible blocker.

**Next action:** Implement B with the proven local frame/policy; B–E remain pending, not accepted.

## Task B: Async Product Renderer and Lifecycle

**Files:** Modify `package.json`, `pnpm-lock.yaml`, `src/core/markdown.ts`, `src/core/mermaid-style.ts`, `src/plugins/index.ts`, `src/main.ts`, `src/plugins/diagram-viewer.ts`, `src/plugins/remote-guard.ts`, build configuration only as justified by A. Create `src/core/mermaid-renderer.ts`, `src/plugins/mermaid-renderer.ts`, `tests/unit/mermaid-renderer.test.mjs` and `tests/e2e/mermaid-lifecycle.e2e.mjs`. Update `tests/e2e/mermaid-compatibility.e2e.mjs` in this same task.

**Interfaces:** The core exposes a factory `createMermaidQueue(render: (job: MermaidJob) => Promise<string>)` with `run(job: MermaidJob): Promise<MermaidResult>`; jobs contain `id`, `source`, `style`, `theme` and `isCurrent(): boolean`. Results distinguish ready/error/stale. The plugin emits `diagramsRendered` with `{ container, generation }` only after the active generation settles. Keep the existing `contentRendered(container)` event synchronous.

- [x] Write unit tests with an injected deferred renderer: settings/render work must be serialized; a rejection must not poison the queue; outdated jobs must not start or write back; later valid jobs still succeed. Run the new file and observe failure before implementation.
- [x] Add escaped `<pre class="mermaid"><code>…</code></pre>` placeholders with source and style metadata; preserve the DOT override and disabled-plugin plain-code path.
- [x] Implement the queue and the resource policy proven by A. Only then pin root `mermaid`, remove the wrapper and update the Node engine requirement to `>=22.12.0`.
- [x] Connect the plugin before the first document render. Track generation on every content render and skip disconnected elements; use unique IDs per render, not source text as an ID. Clean up temporary/error DOM in `finally`.
- [x] Keep body text usable during rendering. Completion events invalidate search entries and refresh active-query highlights only for the current container. Successful Mermaid source placeholders are excluded from code-search results after replacement; failed source remains searchable.
- [x] Update dependency/version assertions and the 30 core expectations immediately. Keep the historical 9.1.6 report unchanged as a dated baseline; ZenUML remains explicitly unintegrated until C.
- [x] Test pending-search → completed SVG, failed-source search, rapid style/file changes, obsolete work, disable/enable, invalid → valid, source view and page reload.
- [x] Verify unit/typecheck/build, core compatibility, lifecycle and existing style e2e. Commit `refactor: migrate Mermaid to a local async renderer` and record actual counts.

**Gate:** Core 30/30 in the built product, privacy policy from A preserved, tests aligned with the new dependency, no stale results or stuck queue. Resolve changed v12 typings within the existing toolchain or record a narrowly scoped compiler prerequisite before upgrading it.

## Task C: Local ZenUML

**Files:** Product dependency/lockfile, renderer registration, shared fixture if evidence requires syntax correction, compatibility and lifecycle e2e.

- [x] Write the failing product ZenUML case and mixed-gallery assertion before registration.
- [x] Pin 1.0.1 and register once per actual Mermaid instance, using only bundled resources. Test alias, nesting, branches, loops and broken → valid recovery in `.md` and `.mmd`.
- [x] Verify all 31 types individually and the unfiltered gallery; rerun network observation including first load and redraw. Keep rendering and style conformance as distinct assertions.
- [x] Commit `feat: support locally bundled ZenUML diagrams` with the independent ZenUML runtime receipt.

**Gate:** 31/31 real product rendering without external assets, eval or expanded permissions. If ZenUML alone is blocked, record 30/31 and its exact failure; no automatic remote fallback.

## Task D: Styling, Viewer and Reading Position

**Files:** `src/core/mermaid-style.ts`, `src/style/index.less`, `src/main.ts`, `src/plugins/diagram-viewer.ts`, affected keys in `src/config/i18n/locale.json`, style/lifecycle unit and e2e tests.

- [x] Keep the stored style schema. Resolve directive/frontmatter author configuration through public Mermaid parsing or a structured parser; protected security values remain authoritative.
- [x] For old diagram types choose explicit compatible theme/look/layout settings; retain required native layout for new types such as Swimlanes. Test authored colors, fonts, shapes and absence of theme leakage.
- [x] Extend Anthropic blog style to every newly supported diagram type, not just the previous 11. Verify each type in both styles for palette, local typography, borders, titles and light/dark behavior; preserve meaningful native shapes and document any renderer-specific limitation.
- [x] Fit Original GitGraph within 320/390 px frames; preserve meaningful shapes and C4 styling without broad shape overrides.
- [x] Ensure viewer observers settle on ready/error/stale and do not attach duplicate controls. Restore reading anchors after current work completes only when the user has not scrolled meanwhile.
- [x] Localize new pending/error messages in all five existing languages. Test CSS off / Developer / Editorial / User1 / User2 without altering Mermaid settings.
- [x] Run the existing 20 style e2e plus added lifecycle/author tests. Capture C4 and ZenUML and document any native styling limits.
- [x] Commit verified styling/defaults as `4eea56a` (`fix: preserve Mermaid styling and settings after upgrade`).

## Task D2: Settings and Default

Design: [approved default/settings addendum](../specs/2026-10-22-mermaid-modernization-design.md#2026-10-23-核准追加預設與設定面板).

- [x] Observe failing default/legacy/explicit-Original unit tests before changing the resolver and plugin defaults.
- [x] Observe failing real-popup appearance/default tests; then use shared local tokens in popup CSS and scoped component styles.
- [x] Preserve all settings, SMUI native control hitboxes, disabled state, monospace editor and keyboard interaction.
- [x] Verify General/Appearance/Plugins, expanded menus, five locales and 320/360/390 px; capture screenshots and assert no horizontal overflow.
- [x] Verify embedded settings, reset defaults, legacy missing choice and saved Original across reloads; no unexpected network.
- [x] Update developer guide, current design/checklist and lessons learned; commit verified changes with Why/What/How/Boundary (`4eea56a`, `1065b21`).

This additive bounded change was explicitly approved in chat. It does not authorize a release or override E's remaining acceptance gates.

## Task D3: Width Default

- [x] Confirm new/reset 85%, preserving saved pixel/percent/disabled choices, including legacy pixels without a unit.
- [x] Observe failing unit and actual-browser tests before changing grouped width/unit default resolution.
- [x] Verify new/legacy/disabled article width, popup controls, Reset and five-locale narrow layout.
- [x] Update design, developer guide, lessons and final receipts; commit with verified settings changes (`4eea56a`).

## Task E: Permanent Test Plan and Regression

**Files:** `tests/e2e/mermaid-compatibility.e2e.mjs`, style/lifecycle tests, `example/mermaid-compatibility.md`, `docs/research/mermaid-diagram-compatibility.md`, `docs/developer_guide.md`, `docs/ARCHITECTURE.md`, this plan/spec/indexes and the appropriate changelog. Review README/PRIVACY for changed claims.

- [x] Measure 31 types × two styles × light/dark × 1200/390/320 px = 372 diagram outputs. Check visible labels, positive dimensions, no error diagrams and initial frame fit. This is fixture coverage, not every possible syntax combination.
- [x] Exercise auto-theme changes twice, authored configuration isolation, malformed and excessive input, duplicate diagrams, rapid changes, HTTP/file/`.mmd`, DOT and PlantUML privacy gates.
- [x] Keep 62 desktop crops plus dark/mobile/full-gallery screenshots. Manually inspect text, shapes, titles, contrast, C4 and long labels; do not count automated dimensions as full visual approval.
- [x] Measure old 11-type baseline and candidate on the same hardware/viewport with at least five cold and ten warm runs; record median/max, raw values and browser. Review a greater-than-twofold size or median-time increase before acceptance.
- [x] Check production dependency audit/license and record newly introduced issues separately from existing ones.
- [x] Run the regression commands below; remove the old GitGraph TODO only after its real assertion passes. Record skips as unverified.
- [x] Review the whole change against the spec and fix material findings; preserve final receipts in the E documentation commit.
- [ ] Push completed verified commits within the user's authorization; verify `HEAD`, `origin/main`, `git ls-remote origin refs/heads/main` and clean status. A release requires a separate version/tag request.

```sh
corepack pnpm install --frozen-lockfile
npm run test:unit
npm run typecheck
npm run build
node --test --test-concurrency=1 tests/e2e/mermaid-compatibility.e2e.mjs tests/e2e/mermaid-styles.e2e.mjs tests/e2e/mermaid-lifecycle.e2e.mjs
npm run test:e2e
git diff --check
git status --short
```

Format only changed files with the installed Prettier. Each receipt states the command, exit code, counts, known failures, artifact path and source commit.

## Execution Ledger

### 2026-10-23: Baseline and Review Corrections

- `npm run test:unit`: 213 pass, zero fail/skip/TODO.
- `npm run typecheck` and `npm run build`: exit 0; existing webpack bundle-size warnings.
- Focused Mermaid e2e: 87 pass, zero fail/skip, one executed Original GitGraph narrow-width TODO. Both suites ran in Chrome for Testing.
- Existing `content.js`: 4,369,082 bytes; release zip: 1,706,468 bytes.
- Rechecked npm metadata: Mermaid 12.2.0 and ZenUML 1.0.1 remain registry latest; runtime is still unverified at this checkpoint.
- Pushed baseline `5df0a82756e333c33963af7910149266f0199359` to GitHub main.
- Ruling: Keep the probe source and independent lockfile in Git while retaining large artifacts under ignored `dist/`; this implements the review and reboot-recovery requirement.

Append each task's actual outcome here before stopping or handing off. Update Current Checkpoint and Durable Checklist together so a reboot does not require reconstructing chat history.

### 2026-10-23: A1 Probe Harness

- Independent npm install completed with Mermaid 12.2.0 / ZenUML 1.0.1; root dependencies and pnpm lockfile remain unchanged.
- `npm audit --json --prefix tests/probes/mermaid12`: zero reported vulnerabilities at this checkpoint.
- Eager webpack probe build succeeds: 14,125,240 bytes, unminified. This cannot be compared directly with the minified product bundle.
- Initial runtime: core 30/30, mixed 31/31 and strict-page-CSP 31/31 pass. Recovery after invalid input passes. Four remote image/CSS fixtures each trigger intercepted outbound attempts under strict mode; privacy gate fails.
- Initial file-access test used a wrong Chrome settings selector; corrected against the actual Chrome for Testing UI. Re-run before recording file acceptance.
- Next: execute the committed harness again, save final results and classify A's privacy blocker before considering any product migration.

### 2026-10-23: A2–A3 Results and Independent Review

- Probe sources committed as `5b71970`; five independent review findings fixed as `405cb02`.
- Evidence helper tests: observed RED before implementation, then 3/3 PASS. Tests pin failed gate receipts, stale source/bundle rejection and cleanup-failure persistence.
- Final runtime at `405cb02`: 11 gates, 7 pass, 4 fail, zero skip/TODO/unavailable, exit 1. Normal core/ZenUML galleries, strict host CSP, file injection and three kinds of error recovery pass.
- Four privacy cases remain failures: HTML image, image node, CSS URL and directive containing a remote image. Settings remain strict; six HTTP(S) attempts were intercepted. No negative-fixture request was allowed to complete.
- Final bundle: 14,126,428 bytes, unminified. Source/output fingerprints verified; cleanupErrors is empty. Complete hashes, environment and limitations are in the probe report.
- Ruling: Stop before B because the approved privacy gate failed. Preserve root Mermaid 9.1.6 and perform A4 before product migration; cost is postponing the upgrade until its resource boundary is proven.
- A4 has not been implemented. Original/Anthropic migration, the 372-output matrix, whole-product final regression and release remain pending.

### A4 Working Checkpoint

- Added an extension-local renderer frame with restrictive CSP, a private MessagePort transport, pure HTML/CSS/flowchart-metadata preflight, and sanitized inline SVG output.
- Strict-host-CSP full gallery: 31/31 rendered. Original four privacy fixtures: 4/4 reject with no requests and no CSP violations; raw comparison still demonstrates the old intercepted attempts.
- CSS/parser/evidence helper tests: 12 pass. Added source-entity regression RED→GREEN. Invalid native CSS is discarded, missing local filter references become `none`, and CSS variables resolve without host inheritance.
- Two independent eager webpack compilations prevent shared chunks across execution worlds. Root dependencies remain unchanged.
- Next: run the full confined suite, resolve the independent security review, and commit/update the A4 gate before B. This checkpoint is not final product acceptance.

### A4 Accepted Probe Boundary

- `node --test` over evidence/CSS/preflight/transport helper suites: 15 pass, zero fail/skip/TODO. Independent review regressions were observed RED, then GREEN: exponential CSS expansion, selector escape and render-after-dispose.
- `MERMAID_PROBE_POLICY=confined node --test tests/probes/mermaid12/probe.test.mjs`: 25 pass, zero fail/unavailable/skip/TODO, exit 0; Chrome for Testing 147.0.7727.15. Cleanup errors empty; fingerprints verified before launch.
- All 31 normal fixtures work under strict host CSP and file injection. Four raw negative counterexamples still reproduce requests; guarded versions and 11 encoded/structured cases reject before requests or CSP violations. Safe class colors and host selector isolation pass.
- Ruling: The attempted classDef URL fixture is invalid in the pinned flowchart grammar, including quoted/escaped-parenthesis variants. Replace that false negative with a positive authored-class browser test; keep parsed-class resource policy tests and valid themeCSS escape/URL negatives. Do not count parser rejection as a security pass.
- Ruling: Permit B using the confined architecture. Reject image nodes, external resource markup/CSS, unsupported CSS functions/at-rules and conflicting scoped variables rather than silently enabling resource loading. Root dependencies remain unchanged in this commit.
- User clarification: after upgrading, extend Anthropic blog style to all newly supported diagrams; D and the permanent 372-output matrix include this requirement.

### B Working Checkpoint

- Replaced the synchronous wrapper with safe source placeholders, serial queue and a local eager renderer frame. Shared policy modules moved to `src/core/mermaid/`; the probe imports these exact sources. Policy tests moved into the permanent unit glob.
- Queue/placeholder regressions observed RED→GREEN. Product lifecycle browser regression observed RED on the old build, then 3/3 GREEN: failed source, active search + rapid styles, strict-CSP privacy/recovery. Existing 20 style cases pass after adapting assertions to v12's label rectangles, curved stadium path, asynchronous theme redraw and explicit error container.
- `npm run test:unit`: 228 pass, zero fail/skip/TODO. `npm run typecheck` and production build exit 0. Compatibility previously rendered all 30 core types in both styles; ZenUML deliberately remains unsupported until C.
- Ruling: d3-dispatch const type parameters cannot parse in TypeScript 4.8. Pin the minimal compiler prerequisite 5.0.4, retain Svelte 3 and other build versions, and suppress only its inherited 5.0 deprecation options. Source: TypeScript 5.0 release notes; runtime/compiler failure was observed before the change.
- Content bundle 3,253,981 B; separate Mermaid frame 5,744,120 B; zip 3,028,163 B at this checkpoint. Review aggregate size/performance during E, not only the smaller content bundle.
- Next: fresh B compatibility/transport probe reruns, commit verified B, then C ZenUML and D new-diagram Anthropic style. No release/version/tag change.

### B Accepted Product Boundary

- Fresh compatibility run: 68/68 pass, no fail/skip/TODO. All 30 core fixtures render individually and in complete mixed pages in both styles, with no external requests. Original GitGraph narrow fit now passes its real assertion; removed the old TODO and fit exception.
- Style suite: 20/20 pass. Expanded lifecycle suite: 4/4 pass, including observed pending-source search hits disappearing after completion, failed-source search retained, rapid styles, raw view during rendering, reload and strict-host-CSP privacy/recovery.
- Shared-module probe rerun: 25/25 pass, zero fail/unavailable/skip/TODO, cleanup errors empty. Product unit suite remains 228/228; typecheck/build exit 0.
- Ruling: Adopt v12's native curved stadium SVG path instead of assuming it remains a rect. Tests still require a native curved shape and preserve an explicitly rounded rect's radius; the softening selector targets primary unrounded rectangles only, never invisible label rectangles.
- Remaining boundary: ZenUML is intentionally still a negative product case. Per-type new-diagram palette/typography, structured author frontmatter isolation, delayed reading restoration and the full E matrix remain C/D/E work.

### C Local ZenUML Accepted

- Product baseline commit B: `3d5fee5`, pushed and remote SHA verified. C's new ZenUML test first failed before registration, then exposed the external wrapper's no-op parser: an unclosed brace produced an SVG instead of a rejected source.
- Pin plugin 1.0.1 and direct core 3.50.1. Register once per renderer instance. Use core's public stateless `parse` method without constructing its React UI, after Mermaid's public Diagram parsing has removed frontmatter/directives. This relies on pinned 3.50.1 behavior and has an actual parser regression; future upgrades must revalidate it.
- `node --test --test-concurrency=1 tests/e2e/mermaid-zenuml.e2e.mjs tests/e2e/mermaid-compatibility.e2e.mjs`: 70 pass, zero fail/skip/TODO. All 31 types work individually and in unfiltered galleries in both styles. Additional cases cover aliases, nested branches/loops, invalid→valid recovery and standalone `.mmd`; no external HTTP requests.
- Compiler and production build exit 0. ZenUML syntax unit test passes without a DOM/React constructor, using only location/theme-storage shims for browser-module initialization.
- Two concurrent browser suites stalled before recording cases; terminated only their owned Chrome processes and reran serially. Do not count the interrupted run as acceptance. Make the permanent e2e command serial in E.
- Rendering acceptance does not mean ZenUML/C4/new-type Anthropic palette acceptance. D resolver tests observed RED and then GREEN in an unused helper; wiring and visual verification are next.

### D Working Checkpoint

- Wired structured Mermaid parse/config into per-diagram options; new types retain required native layout, old supported types use classic look. Added nested chart palettes, C4 muted high-contrast element colors, local serif settings and a scoped ZenUML SVG stylesheet. Removed the parent renderer's regex-based theme decision; the old unused helper/test still needs cleanup.
- Added delayed reading restoration with generation checks and wheel/touch/key cancellation. New browser test first failed on the early-RAF implementation, then passed with 20 preceding diagrams and native scroll anchoring disabled.
- First D browser run: 95 cases, 83 pass/12 fail, zero skip/TODO. All 31 still render; failures were typography: Developer paragraph CSS leaked into foreignObject p; Journey/UseCase use their own font options; Wardley inherited pre's monospace font. Applied scoped p font inheritance, native per-type font config and a Wardley text rule; fresh compatibility/font run is in `dist/mermaid-upgrade-d-fonts.log`.
- Packet uses nested `themeVariables.packet`; Sankey uses per-node configured colors from the pinned diagram metadata. Added paint-value/C4 metadata preflight regression RED→GREEN; runtime now also inspects Swimlanes/C4 metadata before rendering. Still add browser resource regressions for those paths and rerun the shared probe.
- Pending before D commit: verify current font run, add authored YAML/C4/font regressions and screenshots, remove dead v9 theme detector, rerun styles/lifecycle/ZenUML and unit/typecheck/build. Then E's 372 outputs, regression, performance/size/audit/licenses/docs/final review. No release authorized.

### D/D2 Verification and Handoff Checkpoint

- User approved default Anthropic plus all three settings tabs using the same editorial appearance. Explicit saved Original remains unchanged; default/legacy/reset and resolver fallback are updated together. Authored theme bypass now passes explicit Original instead of undefined.
- Observed RED: default tests (3 failures), real-popup default/paper tests (2 failures), author YAML typography (system sans/16.8px/host color instead of Courier New). GREEN: 232 unit, typecheck/build exit 0; first complete focused browser run 98/98, zero fail/skip/TODO (`dist/mermaid-upgrade-d2-e2e.log`).
- The intermediate font run had 58/68 pass: a normal inheritance rule cannot beat host `!important`. The final sanitizer snapshots already-validated HTML label typography inside the confined frame, not arbitrary host styles. All 31 Anthropic font fixtures and authored Courier New/color/16px isolation now pass.
- Additional C4 native authored color and Sankey nodeColors isolation pass. Expanded menus initially failed because Escape was sent back to the closed-menu anchor; changed the key target to the actual option after animation. A later full settings check could not find English Settings; explicit fixture locale and diagnostic assertion now isolate the embedded check. The filtered menu/embedded rerun passes 1/1. User noted possible interaction with the test window; do not claim that as the proven cause.
- Visual inspection: C4 preserves person/database shapes with muted high-contrast colors; ZenUML has serif labels, paper surface and native message semantics. Inspected settings screenshots include zh-TW 320px Plugins and en 360px Appearance; no text overlap observed. Five locales × three widths × three tabs produce 45 permanent screenshot cases.
- Design addendum lives in the modernization spec; checklists here; runtime/development notes in developer guide and architecture; lessons 12–17 in `docs/lesson_learn.md`. Those files form the handoff entry points, not only the chat.
- Native limit: ZenUML's renderer does not implement every core Mermaid theme variable. Explicit Mermaid themes bypass our SVG preset; this preserves the external renderer's native behavior, not a claim that forest/neo become native ZenUML themes.
- Remaining: await complete regression exit status; run the rebuilt shared-policy probe including new Swimlane/C4/Sankey negatives; commit/push verified D/D2. E performance, size/audit/licenses and fresh final review are still unaccepted. Artifacts under ignored dist are machine-local; committed ledger receipts are the cross-machine record.

### D/D2 Accepted Runtime Gates

- `npm run test:e2e` (serial): exit 0, **144 pass**, zero fail/cancel/skip/TODO. Includes 62 individual diagram crops, **372 gallery outputs** (31 × two styles × light/dark × 1200/390/320), narrow GitGraph, 22 style cases, lifecycle, ZenUML, all existing file-tree/UI cases and three settings-theme cases. `dist/mermaid-upgrade-full-e2e.log`; matrix details `dist/qa/mermaid-compatibility/results.json`.
- Shared confined probe: exit 0, **28 pass**, zero fail/skip/TODO; no cleanup errors. New Swimlane image and C4 element paint are rejected before requests/CSP violations. Sankey URL dictionary paint is removed by pinned Mermaid's native sanitizer; raw and confined render locally, while unsafe caller config is rejected by our preflight. The first expanded run was 27/28 because the test incorrectly required an already-filtered native value to be blocked; preserve `dist/mermaid-upgrade-d-probe.log` as evidence, use `dist/mermaid-upgrade-d-probe-final.log` for acceptance.
- Unit/typecheck/build remain green at 232 unit. Performance aggregation adds one further unit test after this receipt; rerun the final suite before E completion.
- Full review is running in a fresh read-only reviewer. Performance compares baseline commit `3b785a2` in the owned detached worktree `/tmp/md-reader-mermaid9-baseline-20261023`; preserve its output before removing only that worktree. First warm benchmark attempt incorrectly sent runtime messages from the SW to itself; second attempted to inspect tab URL without tabs permission. Both failed artifacts are retained, neither is a performance result. Current probe pins the active tab's ID, then uses direct storage + tab messaging, without expanding permissions.
- Production audit: baseline 55 advisories (1 critical/10 high/36 moderate/8 low), candidate 21 (0 critical/4 high/15 moderate/2 low), no newly introduced advisory IDs at this check. Existing Svelte/KaTeX/MarkdownIt/Linkify issues remain out of the Mermaid scope; do not call the product vulnerability-free. Inventory: 229 production package records; khroma's missing package metadata license is resolved from its installed `license` file and README as MIT. ELK retains EPL-2.0; DOMPurify offers MPL-2.0 or Apache-2.0. These are source/inventory checks, not legal certification.
- New user request: custom width default **85%**; user subsequently approved new/reset only with saved choices preserved. The D3 addendum records the final scope.

### D3 Width Default in Progress

- User explicitly approved new/reset 85%, saved choices unchanged. Unit RED: missing resolver; actual-browser RED: fresh article width is empty instead of `85%` (`dist/width-default-{red,e2e-red}.log`).
- Group width and unit defaults so legacy unit-less pixel values and disabled null remain unchanged. Popup percent fallback is 85; width controls use a wrapping grid for narrow locales. No implicit storage migration.
- Final-source build/regression/performance and final D–E commits/push remain pending. Do not use earlier benchmark values as the final artifact receipt.

### Final Whole-change Review and Fix Pass

- Fresh read-only reviewer inspected the full migration from `6c92d3f`, including uncommitted D/settings work. Three material findings were accepted: native State/C4 resource metadata gaps, retained-DOM pagehide reconnects, and pointer/hash navigation not cancelling reading restoration.
- Final: fixed native-resource preflight — State class/inline and C4 relationship browser regressions RED→GREEN. The State RED run included intercepted request attempts; do not describe that old path as safe. All types now expose parsed metadata before rendering; `preflightPassed` distinguishes front-loaded rejection from output cleaning. Source/edge limits have explicit runtime cases.
- Final: fixed retained-DOM lifecycle — actual plugin unit regression RED→GREEN (one connection while hidden; resume unfinished sources on pageshow), plus a synthetic browser page-transition case. This does not prove real BFCache eligibility/hit rate.
- Final: fixed pointer reading cancellation — actual mouse relocation regression RED→GREEN, with the existing delayed 20-diagram anchor case still passing. No separate claim for native scrollbar dragging.
- Architecture icon backgrounds were additionally observed RED (native blue in Anthropic), then GREEN with a narrowly scoped 80×80 background rule. Original and authored themeCSS retain priority.
- Final reviewer is closed; there is no second whole-branch review. The final green suites are the fix-pass gate. D3 is a later bounded, explicitly approved default change with unit/browser/reset tests.
- Notices collect full installed original license documents for 240 package versions, four README fallbacks; missing documents fail the build. New unit test was RED before implementation, then GREEN. Zip contains the notice and machine-readable inventory, not local paths.
- Benchmark scopes cover shared old 11 types, candidate full 31 and standalone ZenUML; inventory-selection regression observed RED→GREEN. Final counts and timings follow after the current full run exits.

### D3 Width Verification

- Unit/typecheck/production build: 238 unit pass, zero fail/skip/TODO, compiler/build exit 0. Width/default/reset plus style/settings focused browser suite: 26/26 pass.
- First full run after width: 145/146 pass, one existing CSS toggle test failed. Its hard-coded frame coordinates pointed below the scrollable panel after width controls became visible. Filtered case reproduced RED; adding scrollIntoViewIfNeeded before its existing coordinate/real-mouse click produced GREEN 1/1. Product CSS toggle behavior and assertions are unchanged. Preserve `dist/width-css-switch-{red,green}.log`; fresh complete regression follows.
- Visual review inspected all 62 individual outputs via eight contact sheets in `dist/qa/visual-review/`, plus narrow CJK, dark/Developer and zh-TW/ja 320px settings screenshots. No blank diagrams or incoherent overlap observed in these fixtures. Very wide Gantt/Packet/C4 scale down initially and remain zoomable; thumbnail legibility is not a claim for arbitrary large input.
- Final complete serial regression after scrolling the test target: **146/146 pass**, zero fail/cancel/skip/TODO, exit 0 (`dist/mermaid-final-e2e.log`). Shared probe rebuilt/fingerprinted and rerun: **33/33 pass**, cleanupErrors empty; evidence helpers **3/3 pass**. Current production zip: 3,973,064 B. E final-source performance and acceptance report still pending.

### D Commit and E Packaging Follow-up

- D/D2/D3 source, tests and handoff docs committed as `4eea56a4bb86801f9fca1c19111504c5bdb99b25`; clean worktree before all three final benchmark scopes. Product asset/zip digests match the measured reports. Full raw performance receipts are ready for E documentation.
- Release workflow independently ran manifest/webpack/zip and omitted new notices. Added a YAML-parsed permanent order test, observed RED, then inserted notices before zip. This follow-up changes CI/test/docs only, not measured browser assets. Local production packaging includes the notices; hosted Actions/release is not performed or authorized in this round.

### E Accepted Measurements and Durable Receipt

- Runtime source `4eea56a`, CI-only follow-up `1065b21`. Final **239 unit / 146 e2e / 33 confined probe / 3 evidence helpers**, zero fail/cancel/skip/TODO. Typecheck/build/zip/diff checks pass. Source/frame/zip digests match all final clean-source performance reports; no product edits after measurement.
- Apple M1/8 GiB, CfT 147.0.7727.15. Shared old 11 fixtures: baseline Original cold/warm medians 438.5/67.25 ms; Anthropic 432.0/86.65 ms. Candidate Original 1337.8/294.2 ms; Anthropic 1344.5/312.2 ms. Every variant/style has five cold and ten warm samples.
- Full candidate 31: cold/warm medians 1953.3/674.15 ms Original, 2012.1/715.2 ms Anthropic. Standalone ZenUML: 768.3/20.2 ms and 738.8/25.15 ms. All observed normal benchmark external-request lists are empty. These are absolute measurements, not additive CPU attribution or p95.
- Baseline content/zip 4,369,101/1,706,477 B; candidate content/frame/zip 3,258,761/9,263,059/3,973,064 B. Aggregate JS 2.87×, zip 2.33×. Historical earlier artifact sizes remain dated and are not substituted for this fresh baseline.
- Ruling: Retain the eager local frame architecture despite >2× size/render medians because it delivers the requested 31 types and pre-render confinement while text/source stay usable. Cost: shared-11 cold 3.05/3.11×, warm 4.37/3.60× and the larger zip; no claim of unchanged performance. Future chunk optimization requires a separate CSP/WAR/all-type review, not an untested late architecture change.
- Audit inventory: 55→21 advisories, no new IDs, 34 removed; existing four high remain disclosed. Notices retain full original texts for 240 macOS package versions with four README fallbacks; CI now has the same packaging step. Audit exit 1 is not a green vulnerability scan, and licenses are not legal certification.
- Six committed JSON receipts under `docs/research/data/` preserve samples, matrix, audit comparison, source/bundle fingerprints and zip/notices digests. [Final acceptance/handoff](../../research/2026-10-23-mermaid12-acceptance.md) includes permanent commands, failures, all residual verification limits and agent entry points. Hosted CI, release and actual BFCache hit rate remain not-performed.
- Final minor findings deferred: none reported by the fresh reviewer. Native limitations and unrelated existing vulnerabilities remain disclosed boundaries, not silently removed tests.
- Removed only `/tmp/md-reader-mermaid9-baseline-20261023` after checking clean status and exact `3b785a2` HEAD; `git worktree list` now contains only the original main workspace. No owned test browser/dev-server processes remain. Source/CI commits use multiline Why/What/How/Boundary; the E receipt commit follows.
