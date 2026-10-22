# Mermaid 12 Migration Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to execute task by task. Update this file after every gate and commit so another session can resume after a reboot. The user authorized execution and push to GitHub main on 2026-10-23.

**Goal:** 在離線與 MV3 限制內將核心升到 Mermaid 12.2.0，逐項驗證 30 種核心圖與 ZenUML，保留 Original／Anthropic blog style。

**Architecture:** Markdown 同步產生 escaped source placeholder；獨立 renderer 以序列佇列執行設定初始化、非同步渲染與清理。每次文件更新建立 generation，只有有效工作可插入 DOM、更新搜尋索引或還原閱讀位置。先以與產品相同的 isolated-world content script 執行 probe，再調整產品依賴。

**Tech Stack:** TypeScript、MarkdownIt、webpack 5、Chrome MV3、Mermaid 12.2.0、`@mermaid-js/mermaid-zenuml` 1.0.1、既有 Node test runner 與本機 Playwright。

**Spec:** [Mermaid modernization design](../specs/2026-10-22-mermaid-modernization-design.md)。同時遵守 [developer guide](../../developer_guide.md)。

## Current Checkpoint

- Updated: 2026-10-23, Asia/Taipei.
- Product baseline: `5df0a82`, version 1.8.2, wrapper 0.5.1 / Mermaid 9.1.6.
- GitHub: baseline push to `origin/main` completed; verify remote SHA before subsequent push.
- Current task: A, reproducible isolated-world MV3 feasibility probe.
- Product migration: not started. A must pass before B changes the root lockfile.
- Next command after resume: `git status --short --branch`, then read this file and the spec; inspect existing probe results before rerunning.

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
- [ ] A1: Commit versioned probe sources, manifest, independent lockfile and commands.
- [ ] A2: Run 30 core types and ZenUML in a real content script; save individual and full-gallery receipts.
- [ ] A3: Run HTTP, file, strict-CSP and malicious-resource checks; classify every failure and decide whether B is allowed.
- [ ] B: Migrate product rendering, security, completion/search lifecycle and corresponding permanent tests.
- [ ] C: Integrate ZenUML and validate all 31 types in the product.
- [ ] D: Preserve styling, viewer controls, localization and reading position.
- [ ] E: Run full matrix/regression, update documentation and record final review.
- [ ] Commit all completed stages, push authorized verified changes and verify remote SHA / clean worktree.

## Task A: Reproducible MV3 Probe

**Files:** Create `tests/probes/mermaid12/{package.json,package-lock.json,build.cjs,content.js,background.js,manifest.json,probe.test.mjs,README.md}`. Create `docs/research/mermaid12-probe.md` after executing. Artifacts go in `dist/probes/mermaid12/`.

**Consumes:** The 31 Mermaid fences in `example/mermaid-compatibility.md`, root webpack installation and local Playwright. The probe's own npm install supplies Mermaid and ZenUML without modifying root dependencies.

**Produces:** A repeatable `npm ci --ignore-scripts --prefix tests/probes/mermaid12` install; `node tests/probes/mermaid12/build.cjs` build; `node --test tests/probes/mermaid12/probe.test.mjs` runtime command; JSON evidence with package/browser versions, per-diagram dimensions/errors, requests and gate results.

- [ ] Save the probe package with exact versions and generate its independent lockfile. Keep `node_modules` ignored.
- [ ] Use webpack with `LimitChunkCountPlugin({ maxChunks: 1 })` to test eager bundling first. Copy a versioned MV3 manifest and service worker; inject `js/content.js` in the default isolated world on matching HTTP/file documents.
- [ ] Parse the shared Markdown fixture using MarkdownIt. The content script reads a JSON payload from a DOM node, clears the fixture page and renders each diagram serially with protected settings; result nodes expose status, source, SVG and errors for browser assertions.
- [ ] Test without ZenUML registration first, then with locally bundled registration; verify each core type and a separate full mixed gallery. Reject error SVGs and zero-size output.
- [ ] Run an HTTP document with strict CSP and a local file document with Chrome's extension file access enabled. Record any permission setup explicitly; do not weaken page CSP to pass.
- [ ] Include remote HTML image labels, SVG image nodes, CSS URL imports and directives attempting to lower security. Observe requests from before navigation until completion, including aborted attempts. A normal fixture alone is insufficient.
- [ ] Add broken/unknown input followed by a known flowchart; source must remain readable and later work must finish.
- [ ] Store machine-readable evidence and screenshots in ignored artifacts; commit a readable report with exact failures. Do not call A passed when any required environment or safety check is unavailable or fails.
- [ ] Commit `test: add reproducible Mermaid 12 MV3 feasibility probe` with Why / What / How / Boundary and update the checklist.

**Gate:** All 30 core fixtures render, HTTP/file/CSP checks pass and protected rendering emits no unexpected remote requests. ZenUML gets an independent result. A failed resource boundary requires a concrete rendering-policy fix and another A run before product migration. If no safe local candidate works, keep the product baseline and document the blocker.

## Task B: Async Product Renderer and Lifecycle

**Files:** Modify `package.json`, `pnpm-lock.yaml`, `src/core/markdown.ts`, `src/core/mermaid-style.ts`, `src/plugins/index.ts`, `src/main.ts`, `src/plugins/diagram-viewer.ts`, `src/plugins/remote-guard.ts`, build configuration only as justified by A. Create `src/core/mermaid-renderer.ts`, `src/plugins/mermaid-renderer.ts`, `tests/unit/mermaid-renderer.test.mjs` and `tests/e2e/mermaid-lifecycle.e2e.mjs`. Update `tests/e2e/mermaid-compatibility.e2e.mjs` in this same task.

**Interfaces:** The core exposes a factory `createMermaidQueue(render: (job: MermaidJob) => Promise<string>)` with `run(job: MermaidJob): Promise<MermaidResult>`; jobs contain `id`, `source`, `style`, `theme` and `isCurrent(): boolean`. Results distinguish ready/error/stale. The plugin emits `diagramsRendered` with `{ container, generation }` only after the active generation settles. Keep the existing `contentRendered(container)` event synchronous.

- [ ] Write unit tests with an injected deferred renderer: settings/render work must be serialized; a rejection must not poison the queue; outdated jobs must not start or write back; later valid jobs still succeed. Run the new file and observe failure before implementation.
- [ ] Add escaped `<pre class="mermaid"><code>…</code></pre>` placeholders with source and style metadata; preserve the DOT override and disabled-plugin plain-code path.
- [ ] Implement the queue and the resource policy proven by A. Only then pin root `mermaid`, remove the wrapper and update the Node engine requirement to `>=22.12.0`.
- [ ] Connect the plugin before the first document render. Track generation on every content render and skip disconnected elements; use unique IDs per render, not source text as an ID. Clean up temporary/error DOM in `finally`.
- [ ] Keep body text usable during rendering. Completion events invalidate search entries and refresh active-query highlights only for the current container. Successful Mermaid source placeholders are excluded from code-search results after replacement; failed source remains searchable.
- [ ] Update dependency/version assertions and the 30 core expectations immediately. Keep the historical 9.1.6 report unchanged as a dated baseline; ZenUML remains explicitly unintegrated until C.
- [ ] Test pending-search → completed SVG, failed-source search, rapid style/file changes, obsolete work, disable/enable, invalid → valid, source view and page reload.
- [ ] Verify unit/typecheck/build, core compatibility, lifecycle and existing style e2e. Commit `refactor: migrate Mermaid to a local async renderer` and record actual counts.

**Gate:** Core 30/30 in the built product, privacy policy from A preserved, tests aligned with the new dependency, no stale results or stuck queue. Resolve changed v12 typings within the existing toolchain or record a narrowly scoped compiler prerequisite before upgrading it.

## Task C: Local ZenUML

**Files:** Product dependency/lockfile, renderer registration, shared fixture if evidence requires syntax correction, compatibility and lifecycle e2e.

- [ ] Write the failing product ZenUML case and mixed-gallery assertion before registration.
- [ ] Pin 1.0.1 and register once per actual Mermaid instance, using only bundled resources. Test alias, nesting, branches, loops and broken → valid recovery in `.md` and `.mmd`.
- [ ] Verify all 31 types individually and the unfiltered gallery; rerun network observation including first load and redraw. Keep rendering and style conformance as distinct assertions.
- [ ] Commit `feat: support locally bundled ZenUML diagrams` with the independent ZenUML runtime receipt.

**Gate:** 31/31 real product rendering without external assets, eval or expanded permissions. If ZenUML alone is blocked, record 30/31 and its exact failure; no automatic remote fallback.

## Task D: Styling, Viewer and Reading Position

**Files:** `src/core/mermaid-style.ts`, `src/style/index.less`, `src/main.ts`, `src/plugins/diagram-viewer.ts`, affected keys in `src/config/i18n/locale.json`, style/lifecycle unit and e2e tests.

- [ ] Keep the stored style schema. Resolve directive/frontmatter author configuration through public Mermaid parsing or a structured parser; protected security values remain authoritative.
- [ ] For old diagram types choose explicit compatible theme/look/layout settings; retain required native layout for new types such as Swimlanes. Test authored colors, fonts, shapes and absence of theme leakage.
- [ ] Fit Original GitGraph within 320/390 px frames; preserve meaningful shapes and C4 styling without broad shape overrides.
- [ ] Ensure viewer observers settle on ready/error/stale and do not attach duplicate controls. Restore reading anchors after current work completes only when the user has not scrolled meanwhile.
- [ ] Localize new pending/error messages in all five existing languages. Test CSS off / Developer / Editorial / User1 / User2 without altering Mermaid settings.
- [ ] Run the existing 20 style e2e plus added lifecycle/author tests. Capture C4 and ZenUML and document any native styling limits.
- [ ] Commit `fix: preserve Mermaid styling and reading behavior after upgrade`.

## Task E: Permanent Test Plan and Regression

**Files:** `tests/e2e/mermaid-compatibility.e2e.mjs`, style/lifecycle tests, `example/mermaid-compatibility.md`, `docs/research/mermaid-diagram-compatibility.md`, `docs/developer_guide.md`, `docs/ARCHITECTURE.md`, this plan/spec/indexes and the appropriate changelog. Review README/PRIVACY for changed claims.

- [ ] Measure 31 types × two styles × light/dark × 1200/390/320 px = 372 diagram outputs. Check visible labels, positive dimensions, no error diagrams and initial frame fit. This is fixture coverage, not every possible syntax combination.
- [ ] Exercise auto-theme changes twice, authored configuration isolation, malformed and excessive input, duplicate diagrams, rapid changes, HTTP/file/`.mmd`, DOT and PlantUML privacy gates.
- [ ] Keep 62 desktop crops plus dark/mobile/full-gallery screenshots. Manually inspect text, shapes, titles, contrast, C4 and long labels; do not count automated dimensions as full visual approval.
- [ ] Measure old 11-type baseline and candidate on the same hardware/viewport with at least five cold and ten warm runs; record median/max, raw values and browser. Review a greater-than-twofold size or median-time increase before acceptance.
- [ ] Check production dependency audit/license and record newly introduced issues separately from existing ones.
- [ ] Run the regression commands below; remove the old GitGraph TODO only after its real assertion passes. Record skips as unverified.
- [ ] Review the whole change against the spec and fix material findings; commit `test: verify Mermaid 12 diagram coverage and document migration`.
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
