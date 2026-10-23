# Mermaid Style Selection Implementation Plan

> Historical 2026-10-22 design. The next day's [modernization plan](2026-10-23-mermaid-modernization.md) supersedes the Mermaid 9 wrapper, Original default and synchronous rendering details below. Current product defaults to Anthropic and uses a confined async Mermaid 12 renderer; the permanent behavioral cases remain regression references.

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax for tracking. Follow the repository's Why / What / How / Boundary commit format.

**Goal:** Let readers choose Original or Anthropic blog style for Mermaid diagrams so diagrams can complement the current Developer CSS reading experience.

**Architecture:** Store `Mermaid.style` inside the existing `mdPluginOptions` object. A pure resolver builds a fresh Mermaid configuration for each render; `src/core/markdown.ts` passes it to the existing plugin. The Plugins tab persists the selection through the current background message flow, and the active content page redraws without navigation.

**Tech Stack:** Chrome MV3, TypeScript, Svelte 3, SMUI Select, LESS, `@md-reader/markdown-it-mermaid@0.5.1`, installed Mermaid 9.1.6, Node `node --test`, Playwright headed Chromium.

**Spec:** Bounded in-chat design, Q1-Q8 accepted by the user on 2026-10-22. The complete agreed behavior is recorded below. This plan is the requested planning deliverable, including a permanent Test Plan.

**Status:** Completed on 2026-10-22 on `main`. Implementation commits: `5b2c9e9`, `fe380da`, `b24f88c`. Shipped documentation is finalized in the accompanying documentation commit.

## Agreed Design

| Decision             | Agreed behavior                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Menu                 | Settings > Plugins > Plugin Options > Mermaid > Mermaid style                                                     |
| Choices              | `Original` and `Anthropic blog style`                                                                             |
| Persisted values     | `original` and `anthropic-blog`                                                                                   |
| Default              | `original` for both new installations and existing installations without the setting                              |
| Original appearance  | Existing Mermaid `default` on a light page and `dark` on a dark page; auto follows the system color scheme        |
| Anthropic appearance | Warm paper surface, charcoal labels, muted terracotta accents, thin connections, softly rounded rectangular nodes |
| Dark page            | Anthropic keeps its light paper surface and dark labels                                                           |
| Font                 | Local serif stack: `Georgia, 'Times New Roman', 'Noto Serif TC', serif`; no downloaded fonts                      |
| Scope                | Every diagram type supported by the installed Mermaid version, Markdown fences and standalone `.mmd` documents    |
| CSS customization    | Independent of the CSS customization switch and the selected Developer, Editorial, User 1, or User 2 slot         |
| Author styling       | Explicit document styling wins; preserve `classDef`, `style`, `linkStyle`, and accepted Mermaid init directives   |
| Applying             | Selecting a style saves and redraws immediately; no Apply button                                                  |
| Reading position     | Preserve the current reading position when geometry permits; diagram pan/zoom resets                              |
| Other tabs           | Persist globally; other already-open documents use the selection when next loaded                                 |
| Mermaid disabled     | Style selection is retained, its control is disabled, and fences follow existing disabled-plugin behavior         |

The preset name describes this project's interpretation of an editorial aesthetic. The colors below are project choices, not an assertion of official Anthropic brand tokens. The user-approved fixed light diagram surface also applies on a dark reading page.

## Global Constraints

- Follow `docs/developer_guide.md` and the portable-core boundary in `docs/ARCHITECTURE.md`.
- Keep pure option handling free of `chrome`, DOM, and Mermaid runtime imports.
- Continue using the installed renderer; do not upgrade Mermaid or add dependencies as part of this change.
- Store the new field in `mdPluginOptions.Mermaid.style`. Reuse the existing top-level storage key and background action.
- Preserve existing Linkify and Alert options when reading and saving settings.
- Do not add requests, external fonts, analytics, manifest permissions, or offline-mode exceptions.
- Author-defined colors and directives may make a diagram differ from the selected preset. Do not strip or rewrite Mermaid source to force uniformity.
- Scope all additional diagram presentation to actual Mermaid containers. DOT inside a Mermaid fence must continue through Graphviz.
- Do not change Graphviz or PlantUML palettes, diagram semantics, node shapes, or layout direction.
- Keep the Original rendering baseline intact, including switching back after Anthropic and toggling page light/dark/auto.
- Work on the existing branch as previously requested. Inspect dirty files before implementation and preserve unrelated changes.
- Commit each independently testable segment with Why / What / How / Boundary paragraphs. Do not push, tag, bump versions, or release as part of implementing this plan.

## Review Focus

1. Shared Mermaid configuration can retain a previous preset. Verify Original -> Anthropic -> Original and dark/light transitions using actual SVG appearance, not only stored options.
2. `app.svelte` deduplicates writes by object identity. Updating the nested field must replace the top-level options object so selection reliably persists and repaints.
3. Explicit author colors carry meaning. Check a red failure node, a custom connection, and a document-specific init theme; a later plain diagram must not inherit those styles.
4. Re-rendering replaces diagram DOM and sizes. Verify reading position, settings-overlay continuity, and fresh functioning panzoom controls after repeated changes.
5. Native theme support differs by diagram type. Verify flowchart, sequence, class, state, ER, Gantt, pie, gitGraph, and journey; preserve readable native elements where 9.1.6 has no customization hook.

## Current Code Evidence

- `src/core/markdown.ts` registers Mermaid with only `theme: default/dark` and `themeVariables: undefined`.
- The installed plugin's `dist/index.js` calls `Object.assign(plugin.default, options)` followed by Mermaid `initialize`. Both the plugin and Mermaid initialization mutate configuration, so each render must explicitly reset every top-level option this feature changes.
- Mermaid's bundled source map shows author init directives merging into diagram configuration and `initialize` deriving theme variables. This supports keeping author directives without source rewriting.
- `src/core/plugin-options.ts` currently supplies only Linkify and Alert defaults. `mergePluginOptions` only keeps known plugin keys; Mermaid must be registered there.
- `src/popup/components/app.svelte` skips `updateConfig` when `persisted[key] === value`. Mutating `data.mdPluginOptions.Mermaid.style` in place is insufficient.
- `src/background.ts` already maps `mdPluginOptions` to `applySetting`; `src/main.ts` already redraws for that key. Background broadcasting is limited to the active tab.
- `src/main.ts` wraps `.mmd` documents in one Mermaid fence, so the same resolver must cover both entry paths.
- `src/plugins/diagram-viewer.ts` attaches Panzoom to `pre.mermaid` SVGs on `contentRendered`; replacement SVGs must receive controls again without duplicates.
- `tests/e2e/_harness.mjs` supplies a headed extension context and storage helpers. Its current Markdown fixture contains no Mermaid diagrams, so add a dedicated suite and fixture server rather than enlarge every existing suite.

## Visual Specification

| Role                         | Value                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| Diagram paper                | `#faf9f5`                                                              |
| Primary node                 | `#f1eadf`                                                              |
| Secondary node               | `#e7ede5`                                                              |
| Tertiary node                | `#eee9f1`                                                              |
| Main text                    | `#24231f`                                                              |
| Connections and muted labels | `#5e5b54`                                                              |
| Node/cluster border          | `#8a8074`                                                              |
| Accent                       | `#bd684b`                                                              |
| Notes                        | `#f7edce` with charcoal text                                           |
| Rectangular-node radius      | `8px` where the installed renderer supports it                         |
| Body label size              | `16px`; diagram-specific axis labels may retain readable native sizing |
| Local font stack             | `Georgia, 'Times New Roman', 'Noto Serif TC', serif`                   |

Use `theme: 'base'` with `darkMode: false`. Supply theme variables for flowchart, sequence, class/state/ER, and chart-series colors supported by 9.1.6. Use a restrained distinguishable multi-series palette, beginning with `#d49a83`, `#a7b8a1`, `#b4a6c0`, `#d7c184`, `#91afb8`, and `#c3b3a3`; use native per-type text hooks to keep their labels readable. Do not assume one fill color suits every series or every label background.

Apply the paper background to the rendered Mermaid container as well as the Mermaid theme background. This is needed when the SVG background is transparent. Restrict optional `themeCSS` to softening existing rectangular nodes/actors; do not force all shapes to rectangles, overwrite authored fills/strokes, use `!important` for SVG colors, or round diamonds/circles.

## File Map

| File                                                                         | Responsibility                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Create `src/core/mermaid-style.ts`                                           | Pure style normalization and fresh render configuration                              |
| Modify `src/core/plugin-options.ts`                                          | Default Mermaid options and legacy stored-option merging                             |
| Modify `src/core/markdown.ts`                                                | Pass resolved configuration; mark real Mermaid wrappers with selected style          |
| Modify `src/popup/components/tab-plugins.svelte`                             | SMUI style Select and immutable settings update                                      |
| Modify `src/config/i18n/locale.json`                                         | Labels for all five current UI locales                                               |
| Modify `src/main.ts`                                                         | Preserve reading position around Mermaid-style redraw using the existing render flow |
| Modify `src/style/index.less`                                                | Scoped Anthropic Mermaid surface and narrow-screen behavior                          |
| Create `tests/unit/mermaid-style.test.mjs`                                   | Invalid settings, fresh configuration, and mode restoration contracts                |
| Modify `tests/unit/plugin-options.test.mjs`                                  | Legacy/default merges and unrelated-option preservation                              |
| Create `tests/e2e/mermaid-styles.e2e.mjs`                                    | Dedicated fixture server, live settings, actual SVGs, interaction and visual checks  |
| Modify `README.md` and `docs/developer_guide.md`                             | Actual shipped setting and regression commands after implementation                  |
| Modify both `docs/chrome-store-description-*.md` and `docs/store-listing.md` | Brief Mermaid-style feature description after implementation                         |
| Modify `docs/plans.md`                                                       | Register this plan with its actual status                                            |

`Data` already models `mdPluginOptions` as a record and needs no extra flat key. `background.ts` already handles the storage key. Avoid touching either unless implementation uncovers an actual contract gap.

## Task 1: Resolve and Render Both Styles Without State Leakage

**Deliverable:** Both configurations work through the existing renderer; old options remain valid and author styling is preserved. A dedicated browser fixture establishes Original behavior before changing rendering.

**Interfaces:**

```ts
export type MermaidStyle = 'original' | 'anthropic-blog'
export type ResolvedMermaidStyleOptions = {
  theme: 'default' | 'dark' | 'base'
  themeVariables: Record<string, string | number | boolean> | undefined
  themeCSS: string | undefined
  fontFamily: string | undefined
  darkMode: boolean
}
export function resolveMermaidStyle(value: unknown): MermaidStyle
export function hasMermaidThemeDirective(source: string): boolean
export function resolveMermaidRenderOptions(
  options: unknown,
  pageTheme: 'light' | 'dark',
): ResolvedMermaidStyleOptions
```

`options` is the stored `mdPluginOptions.Mermaid` subobject, not its parent. Each call returns a fresh object with a fresh nested theme-variable object when present. Original returns the native theme and explicitly clears custom `themeVariables`, `themeCSS`, and `fontFamily`; native page-dark colors come from the `dark` theme. Use top-level `darkMode: false`, matching the installed Mermaid default; the native `dark` theme still supplies its own dark theme variables.

- [x] **Step 1: Establish Original browser baseline before changing rendering.**

Create the dedicated e2e suite using `launchExtension` from `_harness.mjs` and a suite-local HTTP server. Close both in `after`. Serve documents as `text/markdown; charset=utf-8`, including `.mmd` fixture routes. For fresh storage, capture node fill/stroke, text color/font, edge stroke, viewBox, and visible labels in light and dark. Use a plain flowchart with one `Start` rectangle and one `Done` rectangle. Store baseline values in memory for same-test before/after comparison, and save visual evidence under ignored `dist/qa/mermaid-styles/` during verification.

Use the real rendered DOM to measure nodes:

```js
async function readFlowchart(page) {
  return page
    .locator('pre.mermaid')
    .first()
    .evaluate(container => {
      const svg = container.querySelector('svg')
      const node = svg?.querySelector('.node rect')
      const label = svg?.querySelector('.nodeLabel, .label, text')
      const edge = svg?.querySelector('.flowchart-link')
      const bounds = svg?.getBoundingClientRect()
      return {
        fill: node && getComputedStyle(node).fill,
        stroke: node && getComputedStyle(node).stroke,
        font: label && getComputedStyle(label).fontFamily,
        color: label && getComputedStyle(label).color,
        edge: edge && getComputedStyle(edge).stroke,
        paper: getComputedStyle(container).backgroundColor,
        width: bounds?.width,
        height: bounds?.height,
        text: svg?.textContent,
      }
    })
}
```

Check nonzero width/height and both expected labels. Do not compare complete SVG strings or randomized internal element IDs.

- [x] **Step 2: Add failing unit tests for the option contract.**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
const load = () => import('#core/mermaid-style')

test('invalid and missing styles preserve Original', async () => {
  const { resolveMermaidStyle, resolveMermaidRenderOptions } = await load()
  for (const value of [undefined, null, '', 'forest', 1, {}, []]) {
    assert.equal(resolveMermaidStyle(value), 'original')
  }
  assert.equal(resolveMermaidRenderOptions(undefined, 'light').theme, 'default')
  assert.equal(
    resolveMermaidRenderOptions({ style: 'original' }, 'dark').theme,
    'dark',
  )
})

test('Anthropic remains light and configurations do not share mutations', async () => {
  const { resolveMermaidRenderOptions } = await load()
  const a = resolveMermaidRenderOptions({ style: 'anthropic-blog' }, 'dark')
  assert.equal(a.theme, 'base')
  assert.equal(a.darkMode, false)
  assert.equal(a.themeVariables.background, '#faf9f5')
  a.themeVariables.primaryColor = 'changed-by-renderer'
  const b = resolveMermaidRenderOptions({ style: 'anthropic-blog' }, 'light')
  assert.equal(b.themeVariables.primaryColor, '#f1eadf')
  const original = resolveMermaidRenderOptions({ style: 'original' }, 'light')
  assert.equal(original.themeVariables, undefined)
  assert.equal(original.themeCSS, undefined)
  assert.equal(original.fontFamily, undefined)
})
```

Extend `plugin-options.test.mjs` to assert default Mermaid style is `original`, `{ Linkify: { fuzzyLink: false }, Alert: { deep: false } }` gets that missing default without losing either override, and a saved Anthropic style survives the merge. Test invalid/null Mermaid values at the rendering resolver, rather than rewriting every plugin's merge behavior.

Run `node --test tests/unit/mermaid-style.test.mjs tests/unit/plugin-options.test.mjs`; expect failures for the missing module/default before production edits.

- [x] **Step 3: Implement the resolver, register defaults, and integrate the renderer.**

Use these concrete configuration values in the new pure module, together with the exported types above:

```ts
const FONT = "Georgia, 'Times New Roman', 'Noto Serif TC', serif"
const SERIES = [
  '#d49a83',
  '#a7b8a1',
  '#b4a6c0',
  '#d7c184',
  '#91afb8',
  '#c3b3a3',
]

export function resolveMermaidStyle(value: unknown): MermaidStyle {
  return value === 'anthropic-blog' ? 'anthropic-blog' : 'original'
}

export function resolveMermaidRenderOptions(
  options: unknown,
  pageTheme: 'light' | 'dark',
): ResolvedMermaidStyleOptions {
  const value =
    options && typeof options === 'object'
      ? (options as Record<string, unknown>).style
      : undefined
  if (resolveMermaidStyle(value) === 'original') {
    return {
      theme: pageTheme === 'dark' ? 'dark' : 'default',
      themeVariables: undefined,
      themeCSS: undefined,
      fontFamily: undefined,
      darkMode: false,
    }
  }
  const themeVariables: Record<string, string | number | boolean> = {
    darkMode: false,
    background: '#faf9f5',
    fontFamily: FONT,
    fontSize: '16px',
    primaryColor: '#f1eadf',
    primaryTextColor: '#24231f',
    primaryBorderColor: '#8a8074',
    secondaryColor: '#e7ede5',
    secondaryTextColor: '#24231f',
    secondaryBorderColor: '#8a8074',
    tertiaryColor: '#eee9f1',
    tertiaryTextColor: '#24231f',
    tertiaryBorderColor: '#8a8074',
    textColor: '#24231f',
    titleColor: '#24231f',
    lineColor: '#5e5b54',
    edgeLabelBackground: '#faf9f5',
    noteBkgColor: '#f7edce',
    noteTextColor: '#24231f',
    noteBorderColor: '#8a8074',
    actorBkg: '#f1eadf',
    actorBorder: '#8a8074',
    actorTextColor: '#24231f',
    actorLineColor: '#5e5b54',
    signalColor: '#5e5b54',
    signalTextColor: '#24231f',
    activationBkgColor: '#e7ede5',
    activationBorderColor: '#8a8074',
    taskBkgColor: '#e7ede5',
    taskBorderColor: '#8a8074',
    activeTaskBkgColor: '#f1eadf',
    activeTaskBorderColor: '#bd684b',
    critBkgColor: '#d49a83',
    critBorderColor: '#8a8074',
    todayLineColor: '#bd684b',
    gridColor: '#d9d3c8',
    pieStrokeColor: '#faf9f5',
    pieStrokeWidth: '1px',
    pieOpacity: '1',
    pieSectionTextColor: '#24231f',
    pieLegendTextColor: '#24231f',
    gitBranchLabel0: '#24231f',
    gitBranchLabel1: '#24231f',
    gitBranchLabel2: '#24231f',
    gitBranchLabel3: '#24231f',
    gitBranchLabel4: '#24231f',
    gitBranchLabel5: '#24231f',
  }
  SERIES.forEach((color, index) => {
    themeVariables[`pie${index + 1}`] = color
    themeVariables[`fillType${index}`] = color
    themeVariables[`git${index}`] = color
  })
  return {
    theme: 'base',
    themeVariables,
    themeCSS:
      '.node rect:not([rx]):not([ry]), .node rect[rx="0"][ry="0"], rect.actor { rx: 8px; ry: 8px; }',
    fontFamily: FONT,
    darkMode: false,
  }
}
```

These variables are present in the installed `theme-base.js` bundled source map. The theme recalculates and then reapplies explicitly supplied values, so git branch labels are deliberately charcoal on the final supplied pastel colors; screenshot verification must inspect that actual output. Preserve native connection thickness when no separate per-type theme hook is available. Narrowly adjust a per-type variable only when an actual rendered label/edge fails the readability requirement, then record the final value and regression evidence.

```ts
// In getDefaultPluginOptions():
Mermaid: { style: 'original' },

// In src/core/markdown.ts PLUGINS, replacing only the Mermaid entry:
Mermaid: ({ theme, pluginOptions }) => [
  mMermaid,
  resolveMermaidRenderOptions(pluginOptions?.Mermaid, theme),
],
```

Normalize style by strict equality with `anthropic-blog`, otherwise use Original. Build fresh literal options; do not export mutable config objects to the renderer. Mirror the supplied serif stack in top-level `fontFamily` and `themeVariables.fontFamily`: Mermaid 9.1.6 initialization can replace the variable object when these disagree.

After installing Mermaid and before the Graphviz override, wrap the existing fence renderer. For output whose root is exactly the known `<pre class="mermaid">`, add `data-mermaid-style="original"` or `data-mermaid-style="anthropic-blog"`. Use the validated enum, never user source, in the attribute. Preserve the inner SVG and source unchanged. Leave non-Mermaid fence output untouched. Then install the existing Graphviz override in its current order.

Add the paper surface rule under the existing Markdown content scope:

```less
pre.mermaid[data-mermaid-style='anthropic-blog'] {
  background: #faf9f5;
  color: #24231f;
  border: 1px solid #d9d3c8;
  border-radius: 8px;
  padding: 16px;
}
```

Keep diagram scaling and overflow compatible with the existing Panzoom wrapper. Use scoped specificity only if the bundled theme otherwise overrides this surface. Do not apply this rule to `pre.md-reader__code-block` or Graphviz.

- [x] **Step 4: Exercise actual SVGs in the dedicated e2e suite.**

Until the menu exists, set `mdPluginOptions` using the existing harness storage helper and reload the fixture. Compare original baseline -> Anthropic -> restored Original, for both page themes. Anthropic must produce the specified paper, fill, readable labels and edges; restored Original must match baseline color/font measurements. Check all fixture diagram kinds in the permanent matrix below. Verify authored styles and directives are respected and do not leak into a later plain diagram. Check DOT-in-Mermaid remains Graphviz.

Run focused unit tests, `npm run typecheck`, `npm run build`, and `node --test tests/e2e/mermaid-styles.e2e.mjs`. Browser unavailability or skipped tests must be reported as unverified, never as a pass.

- [x] **Step 5: Commit the independently tested rendering change.**

Subject: `feat: add isolated Mermaid visual presets`

Body: Why: diagrams need an editorial option alongside the native appearance. What: add default normalization and both renderer configurations. How: pure resolver plus actual SVG round-trip and author-style verification. Boundary: Mermaid-only presentation, existing library and no network changes.

## Task 2: Persist the Menu Choice and Redraw the Reading Page

**Deliverable:** A usable localized menu immediately saves and applies the style; reopening settings and reloading documents retain the selection.

**Consumes:** `MermaidStyle`, `resolveMermaidStyle`, defaults and render integration from Task 1.

**Produces:** Immutable `mdPluginOptions` updates through existing `updateConfig`; live application via the current `applySetting` route.

- [x] **Step 1: Add failing user-driven e2e scenarios.**

Open the in-page settings overlay using the float menu and select the Plugins tab. Assert there is a Mermaid style Select with exactly the two agreed options. Click its SMUI anchor, choose Anthropic, and wait for both stored value and the actual diagram appearance to change. Do not satisfy the test by setting storage or invoking an internal handler directly.

Use locator assertions with polling (`waitForFunction` / `expect.poll` equivalent supported by this Node test harness). Record navigation events only after the initial load. Assert no main-frame navigation, the overlay remains open, and both diagrams on a two-diagram page repaint.

Include this storage assertion after the click:

```js
const stored = (await getStorage('mdPluginOptions')).mdPluginOptions
assert.equal(stored.Mermaid.style, 'anthropic-blog')
assert.equal(stored.Linkify.fuzzyLink, false)
assert.equal(stored.Alert.deep, false)
```

Set the unrelated overrides before opening settings. Switch back and then to Anthropic again in the same overlay to catch the object-identity persistence failure.

- [x] **Step 2: Add the Select with immutable updates.**

Import SMUI `Select, { Option }` and the style type/resolver into `tab-plugins.svelte`. Bind a normalized local string to the Select, reactively derived from `data.mdPluginOptions.Mermaid`. Place the control under a Mermaid subheading in Plugin Options. Disable it when the extension or Mermaid plugin is disabled; keep the stored choice.

Use `MDCSelect:change` and replace both object levels:

```ts
function onMermaidStyleChange(e: CustomEvent<{ value: string }>) {
  const style = resolveMermaidStyle(e.detail.value)
  if (style === resolveMermaidStyle(data.mdPluginOptions.Mermaid?.style)) return
  data.mdPluginOptions = {
    ...data.mdPluginOptions,
    Mermaid: { ...data.mdPluginOptions.Mermaid, style },
  }
  updateConfig('mdPluginOptions', data.mdPluginOptions)
}
```

Do not change unrelated Linkify/Alert handlers in this task. No reactive block may call `updateConfig`: opening settings must not persist an unchanged value or repaint the page.

Add `label_mermaid-style`, `mermaid-style_original`, and `mermaid-style_anthropic-blog` to `en`, `zh-CN`, `zh-TW`, `ko`, and `ja`. Keep `Anthropic blog style` as the shared preset name. Use `Mermaid 風格` and `原始風格` for the Traditional Chinese label and Original option. Verify all locales display actual strings without a raw translation key or cropped option text.

- [x] **Step 3: Preserve the reading position around the style redraw.**

In `main.ts`, detect a changed normalized Mermaid style when handling `mdPluginOptions`. Capture the first visible stable heading/paragraph anchor and its viewport offset before `actions.updateMdPlugins()`. Capture window coordinates as fallback. After redraw and the next animation frame, restore the matching anchor's viewport offset; clamp to the available scroll range. Use a content-relative index/tag for a plain paragraph if it has no ID. Do not rely on regenerated Mermaid SVG IDs. Limit the change to this style-setting update.

Keep settings overlay DOM mounted. Let the existing `contentRendered` hook attach new Panzoom instances to replacement SVGs. Do not preserve old diagram transforms. Keep the inactive Files tab lazy: changing Mermaid style must not fetch a listing, call GitHub, or trigger a document reload.

- [x] **Step 4: Validate persistence, controls, CSS independence, and theme behavior.**

Reopen settings, reload the document, open a standalone `.mmd`, and confirm Anthropic persists. Change Developer/Editorial and turn CSS customization off/on; assert Mermaid style does not change and Anthropic paper/labels stay readable. Disable/re-enable Mermaid and confirm the selected style returns. Use Reset to Defaults and confirm Original is restored.

On a long fixture document, record a visible heading/paragraph's position before changing style; require its restored top offset to be within 8px when enough document height remains. Hover the new diagram, zoom in, reset, switch styles twice, then verify controls work and only one controls group exists per hovered diagram.

Use light, dark, and emulated auto color schemes. Original follows the page; Anthropic remains the same light preset. Compare an already-open background document before and after selecting the new setting, then reload it: the agreed contract requires next-load consistency, not live broadcast to background tabs.

Run the dedicated suite plus existing `extension.e2e.mjs`, then typecheck. Save desktop and narrow-screen evidence for the fixed light diagram on both light/dark pages.

- [x] **Step 5: Commit the independently tested menu and live application.**

Subject: `feat: expose Mermaid style selection in plugin settings`

Body: Why: readers need to select diagram appearance during reading. What: localized style Select and immediate persisted application. How: immutable nested settings updates, existing background route, reading-anchor restoration and headed user-input tests. Boundary: active-page live redraw with next-load consistency elsewhere; page CSS selection remains independent.

## Task 3: Complete Permanent Regression Evidence and Shipped Documentation

**Deliverable:** Repeatable permanent tests and documentation describe the behavior users actually receive.

- [x] **Step 1: Complete the matrix below in the dedicated suite.**

Serve the listed minimal sources in Markdown fences and also serve the flowchart as `/diagram.mmd`. Use separate routes for invalid syntax and the long scrolled document. Suite-local HTTP server code must choose fixture content by parsed URL pathname rather than returning one unrelated page for every request.

```js
const diagramSources = {
  flowchart: 'graph TD\n  A[Start] --> B[Done]',
  sequence:
    'sequenceDiagram\n  participant A as Reader\n  participant B as Renderer\n  A->>B: Draw\n  Note right of B: Ready\n  B-->>A: SVG',
  class:
    'classDiagram\n  class Reader {\n    +render()\n  }\n  Reader --> Diagram',
  state: 'stateDiagram-v2\n  [*] --> Ready\n  Ready --> Done\n  Done --> [*]',
  er: 'erDiagram\n  READER ||--o{ DOCUMENT : opens\n  DOCUMENT {\n    string title\n  }',
  gantt:
    'gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Work\n  Render :a1, 2026-10-22, 2d\n  Review :after a1, 1d',
  pie: 'pie title Reading\n  "Markdown" : 60\n  "Diagrams" : 40',
  git: 'gitGraph\n  commit\n  branch feature\n  checkout feature\n  commit\n  checkout main\n  merge feature',
  journey:
    'journey\n  title Reading\n  section Document\n  Open: 5: Reader\n  Inspect: 4: Reader',
  authored:
    'graph TD\n  A[Failure] --> B[Retry]\n  classDef failure fill:#b91c1c,color:#ffffff,stroke:#7f1d1d\n  class A failure\n  style B fill:#dbeafe,stroke:#1d4ed8\n  linkStyle 0 stroke:#15803d',
  cjk: 'graph LR\n  A[來源文件與較長的中文標籤] --> B[完成渲染並保留可讀文字]',
}
```

Verify each source works with the installed library before treating its output as a visual assertion. A fixture typo must fail that test; it must not be hidden by accepting an error image. Include a document with `%%{init: {"theme": "forest"}}%%` before a flowchart and then a plain flowchart to validate directive precedence and diagram isolation. Keep source comments untouched.

- [x] **Step 2: Verify failure isolation and zero requests.**

Use one invalid Mermaid fence followed by a valid fence and a heading; the error must stay local and the later content must render. This change retains the existing plugin error presentation. On a fixture without external resources, register a network listener before navigation, ignore extension-local asset URLs, record the initial Markdown GET separately, and assert no additional HTTP(S) request during rendering or style switching. Keep Files closed. Do not use this test to claim arbitrary author CSS never requests resources.

- [x] **Step 3: Update user/developer docs to match the implemented result.**

Add a concise feature bullet to README and the store copy, documenting the two styles without implying an official Anthropic integration. Add the exact setting location, default, author-style precedence, CSS independence, fixed light Anthropic surface, active-tab live behavior, and test command to `developer_guide.md`. Link this permanent Test Plan. Update `docs/plans.md` status only after the required checks pass. Record real test counts and actual evidence rather than planned counts.

- [x] **Step 4: Run final regression checks and inspect screenshots.**

Run each command separately:

```sh
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

The current `npm run lint` script needs explicit filenames to format/check files: it is `prettier --write --ignore-unknown` without a default glob. Use `node_modules/.bin/prettier --check` with the actual changed files. Do not treat a no-argument invocation that formatted nothing as evidence.

All required e2e suites must report executed passes with zero skips. Record existing build warnings separately from failures. Inspect screenshots at 1200x900 and 390x844, with CSS customization disabled, Developer, and Editorial in representative combinations. Diagrams must be visible, edges/labels legible, the diagram paper must not overlap nearby text, and a wide chart must remain inspectable through the existing viewer.

- [x] **Step 5: Commit regression coverage and documentation.**

Subject: `test: document permanent Mermaid style regression coverage`

Body: Why: style changes must remain verifiable across diagram types and renderer updates. What: finalize fixture matrix, behavioral/visual checks and shipped documentation. How: record actual unit/headed e2e outcomes and screenshot evidence. Boundary: validation/documentation for the two approved presets, without changing release version or workflow.

## Implementation Notes

- The planned in-chat design is implemented. Each Mermaid fence additionally initializes the existing plugin with fresh configuration so author themes fully override the preset in sequence diagrams as well as flowcharts. `hasMermaidThemeDirective(source)` parses supported init/initialize JSON using the installed Mermaid 9 single-quote normalization. An explicit valid author theme starts with native options; source is unchanged and subsequent plain diagrams return to the selected preset.
- Radius selectors target rectangles without explicit radii or with zero radii. Stadium semicircular ends and deliberately rounded shapes retain their geometry. The visual-spec code above reflects this narrowed selector.
- Reading restoration uses only headings/paragraphs intersecting the viewport. When a code block fills the viewport, it preserves window coordinates instead of anchoring to a later, offscreen paragraph.
- Anthropic SVGs use `display: block; max-width: 100%; height: auto`, fixing the observed mobile gitGraph clipping and avoiding excessive SVG whitespace. The native Original surface is untouched.
- Existing SMUI plugin chips mutated the stored selection array in place. Their user click/key handlers now wait for binding and persist a copy; programmatic synchronization does not trigger these handlers.
- The browser suite opens Select via ArrowDown and clicks real options after the opening animation finishes; it activates pre-existing settings tabs/reset buttons using Enter. Both are ordinary user input and avoid timing sleeps or calling production handlers directly.
- Malformed-diagram coverage preserves the installed wrapper's fallback presentation, which may contain `undefined` because this dependency does not always provide an error message. It verifies that the fallback is isolated and a later valid diagram and heading remain usable. Changing the dependency's error wording is outside this feature.
- A fresh reviewer identified the sequence-theme, stadium, and offscreen-anchor issues; all three were reproduced RED, fixed, and verified GREEN. Follow-up review confirmed those findings resolved with no specific new issue.

## Permanent Test Plan

This section remains the acceptance contract after implementation. Re-run it whenever Mermaid, the wrapper plugin, theme styles, CSS presets, or the rendering lifecycle changes. Keep the plan and automated suite together.

| ID  | Scenario                                              | Required result                                                                         | Coverage                   |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| M01 | Fresh or legacy options missing Mermaid               | Original; existing Linkify/Alert overrides survive                                      | Unit + e2e                 |
| M02 | Unknown style/null/non-object options                 | Safe Original fallback                                                                  | Unit                       |
| M03 | Anthropic configuration requested repeatedly          | Independent objects, identical values; no mutation leakage                              | Unit                       |
| M04 | Select Anthropic, Original, Anthropic in one overlay  | Actual diagram changes each time; stored selection follows; no reload                   | Headed e2e                 |
| M05 | Reopen overlay/reload/open another document           | Saved selection retained; opening unchanged settings causes no write/redraw             | Headed e2e                 |
| M06 | Original light/dark/auto                              | Matches pre-feature native baseline; follows system when auto                           | Headed e2e                 |
| M07 | Anthropic light/dark/auto                             | Same paper/light palette and readable charcoal labels                                   | Headed e2e + screenshots   |
| M08 | All nine minimal diagram fixtures                     | Nonblank SVGs and correct labels; themed where supported                                | Headed e2e + screenshots   |
| M09 | Explicit node/connection styles and init theme        | Authored styling wins; later plain diagram stays independent                            | Headed e2e                 |
| M10 | Anthropic -> Original after theme changes             | Native colors/fonts restored, no custom surface/radius rules remain                     | Headed e2e                 |
| M11 | Markdown fence and standalone `.mmd`                  | Same selected style and functioning viewer                                              | Headed e2e                 |
| M12 | DOT within Mermaid fence                              | Existing Graphviz routing and appearance retained                                       | Existing unit + headed e2e |
| M13 | PlantUML under privacy mode                           | Existing disabled behavior retained; no network request                                 | Existing unit + headed e2e |
| M14 | Developer/Editorial/User slots and CSS off            | Mermaid selection persists independently; native user CSS cascade remains available     | Headed e2e + screenshots   |
| M15 | Mermaid disabled then enabled                         | Control disables without erasing choice; renderer returns with saved style              | Headed e2e                 |
| M16 | Reset defaults                                        | Original restored                                                                       | Headed e2e                 |
| M17 | Scrolled long document, style redraw                  | Visible reading anchor stays within 8px where scroll range permits; overlay stays open  | Headed e2e                 |
| M18 | Repeated redraw, hover, zoom and reset                | Fresh working viewer; no duplicate control groups                                       | Headed e2e                 |
| M19 | Invalid diagram before valid content                  | Error isolated; subsequent SVG and heading remain visible                               | Headed e2e                 |
| M20 | Chinese/long labels and wide charts at both viewports | Nonblank labels; no unintended clipping/overlap; chart inspectable                      | Headed e2e + screenshots   |
| M21 | Plain document load and style change with privacy on  | No extra HTTP(S) request, font download, folder fetch or reload                         | Headed e2e                 |
| M22 | All five locales                                      | Label/options readable; no untranslated keys or crop                                    | Headed e2e                 |
| M23 | Background document already open                      | Uses saved style after reload; current tab changes immediately                          | Headed e2e                 |
| M24 | Existing repository suites                            | CSS slots, search history, folder navigation, settings overlay and manifest checks pass | Full regression            |

### Repeatable Commands

```sh
node --test tests/unit/mermaid-style.test.mjs tests/unit/plugin-options.test.mjs
npm run build
node --test tests/e2e/mermaid-styles.e2e.mjs
```

Run the full regression commands in Task 3 before completion. Keep screenshots in ignored `dist/qa/mermaid-styles/`, named by style, page theme, CSS preset and viewport, for example `anthropic-blog-dark-developer-390x844.png`.

### Completion Evidence

Verified on 2026-10-22 against the production build:

- `npm run test:unit`: 213 passed, zero failed/skipped.
- `npm run typecheck`: passed.
- `npm run build`: passed and produced `dist/md-reader-lite-1.8.2.zip`. The version remains 1.8.2. Only existing webpack bundle-size recommendations were emitted.
- `npm run test:e2e`: 54 passed in four headed Chromium suites, zero failed/skipped. This includes the existing 34 tests and 20 Mermaid tests.
- Final `node --test tests/e2e/mermaid-styles.e2e.mjs`: 20 passed, zero failed/skipped, after strengthening repeated redraw/zoom reattachment.
- Explicit-filename Prettier checks with `--ignore-unknown` passed. Svelte has no installed Prettier parser and is covered by production compilation; it is not claimed as formatted by that check.
- `git diff --check`: passed.
- Twelve full-page screenshot combinations cover CSS off/Developer/Editorial, light/dark pages, and 1200x900/390x844. Each also asserts nine nonzero SVGs within its available surface width. Evidence: `dist/qa/mermaid-styles/anthropic-blog-<light|dark>-<off|developer|editorial>-<1200x900|390x844>.png`.
- Additional evidence: `settings-en.png`, `settings-zh-TW.png`, `settings-zh-CN.png`, `settings-ko.png`, `settings-ja.png`, `anthropic-blog-cjk-390x844.png`, and Original light/dark baseline PNG/JSON files in the same ignored QA directory. Desktop, fixed-light-on-dark mobile, CJK and Traditional Chinese settings images were visually inspected.
- Implementation: `5b2c9e9` rendering/defaults; `fe380da` localized selection/live redraw; `b24f88c` complete regression coverage and review corrections.
- No push, release tag, dependency upgrade, manifest permission change or network feature was performed.
