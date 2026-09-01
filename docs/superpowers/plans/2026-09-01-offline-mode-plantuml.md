# v1.4.0 實作計畫：離線總開關 + PlantUML

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依核可 spec（`docs/superpowers/specs/2026-09-01-offline-mode-plantuml-design.md`）落地 offlineMode（預設 true、封鎖五處 egress）與 PlantUML（opt-in 網路、離線下停用），發版 v1.4.0。

**Architecture:** core 純函式 network.ts（isNetworkAllowed/isRemoteUrl）、plantuml.ts；content script 端在四個自身 fetch 站點 + 一個渲染後 DOM 清掃站點各設閘門；沿用 applySetting 生效架構（offlineMode reload、plantuml 重渲染）。

**Tech Stack:** TS 4.8.2、webpack、Svelte 3 + SMUI、markdown-it、plantuml-encoder（新依賴）、node --test、Playwright（網路監聽驗收）。

## Global Constraints

- 零 host 權限；**無 manifest 變更**；`background.ts` 僅允許 actionMap 三列增列（offlineMode/plantumlEnabled/plantumlServer → applySetting）；`git diff main -- src/manifest.json` 須為空。
- 既有 113 條測試不得回歸；測試指定檔名跑（Task 1 起含 network、plantuml）：`node --test tests/github-url.test.mjs tests/fsa-path.test.mjs tests/doc-search.test.mjs tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs tests/settings.test.mjs tests/plugin-options.test.mjs tests/charset.test.mjs tests/network.test.mjs tests/plantuml.test.mjs`。
- 新 core 檔用 `#core/*` subpath import；shell 用 `@/` alias。
- 每 task 結尾：測試綠 + `tsc --noEmit` 乾淨 + commit（四段中文 + trailers：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR`）。
- i18n 新 key 僅 en/zh-CN/zh-TW。
- spec 的「五處 egress 完整封鎖」「站點 5 廣查選擇器」「background 僅 actionMap 增列」「folderTree 不變灰」「canRenderPlantuml 唯一實作」為 binding。

---

### Task 1: core network.ts + plantuml.ts + data.ts + 單元測試

**Files:** Create `src/core/network.ts`、`src/core/plantuml.ts`、`tests/network.test.mjs`、`tests/plantuml.test.mjs`；Modify `src/core/data.ts`

**Interfaces（Produces）:**

- `Data` 新欄位：`offlineMode?: boolean`、`plantumlEnabled?: boolean`、`plantumlServer?: string`；`getDefaultData` 預設 `offlineMode: true, plantumlEnabled: false, plantumlServer: 'https://www.plantuml.com/plantuml'`。
- `src/core/network.ts`：

```ts
export function isNetworkAllowed(offlineMode: boolean): boolean {
  return !offlineMode
}

export function isRemoteUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  const u = url.trim()
  if (!u) return false
  if (/^\/\//.test(u)) return true // protocol-relative
  return /^https?:\/\//i.test(u)
}
```

- `src/core/plantuml.ts`：

```ts
const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml'

export function normalizePlantumlServer(server: unknown): string {
  if (typeof server !== 'string') return DEFAULT_SERVER
  const s = server.trim().replace(/\/+$/, '')
  return s || DEFAULT_SERVER
}

export function buildPlantumlImageUrl(server: string, encoded: string): string {
  return `${normalizePlantumlServer(server)}/svg/${encoded}`
}

export function canRenderPlantuml(
  enabled: boolean,
  offlineMode: boolean,
  server: string,
): boolean {
  return !!enabled && !offlineMode && !!String(server ?? '').trim()
}
```

**Steps:**

- [ ] 寫 `tests/network.test.mjs`（`#core/network`）：isNetworkAllowed（true→false、false→true）；isRemoteUrl（`http://x`/`https://x`/`//x`→true；`img.png`/`./a`/`../a`/`data:x`/`blob:x`/`chrome-extension://x`/`file:///x`/``/非字串 →false）≥ 8 block。
- [ ] 寫 `tests/plantuml.test.mjs`（`#core/plantuml`）：normalizePlantumlServer（去尾多斜線、非字串 → 預設、空/空白 → 預設、trim）；buildPlantumlImageUrl（含 server 尾斜線正規化）；canRenderPlantuml（enabled+online+server→true；offline→false；未啟用 →false；空 server→false）≥ 10 block。
- [ ] 跑新測試確認 FAIL。
- [ ] 實作兩 core 檔；改 data.ts 加三欄位＋預設。
- [ ] 全測試（11 檔）綠、tsc 乾淨、commit。

---

### Task 2: 離線閘門佈線（polling / initFilesContent / remote-guard / actionMap / reload）+ i18n

**Files:** Modify `src/main.ts`、`src/background.ts`（僅 actionMap）、`src/core/plugin.ts`（initPlugins 傳 offlineMode）、`src/config/class-name.ts`、`src/config/i18n/locale.json`、`src/style/index.less`；Create `src/plugins/remote-guard.ts`；Modify `src/plugins/index.ts`（註冊）

**Interfaces:** Consumes Task 1 的 isNetworkAllowed/isRemoteUrl。Produces `applySetting` 的 offlineMode case。

**Steps:**

- [ ] **background.ts actionMap** 加三列 `offlineMode: 'applySetting'`、`plantumlEnabled: 'applySetting'`、`plantumlServer: 'applySetting'`。
- [ ] **main.ts applySetting** 加 `case 'offlineMode':`（→ `window.location.reload()`）；`plantumlEnabled`/`plantumlServer` case → 重渲染（`actions.updateMdPlugins()`）。
- [ ] **polling 閘門**：初始 `if (configData.refresh) polling()` 改為 `if (configData.refresh && isNetworkAllowed(configData.offlineMode)) polling()`；`toggleRefresh` handler 同樣 `value && isNetworkAllowed(configData.offlineMode) && polling()`。import isNetworkAllowed 自 `@/core/network`。
- [ ] **initFilesContent 守門**（binding 精確落點，現況見 main.ts:280-296）：
  - GitHub 分支 `if (gh)` 內最前：`if (!isNetworkAllowed(configData.offlineMode)) { buildTree(undefined); return }`（buildTree 顯示樹內訊息——加 `offline_blocked` i18n；沿用既有 dir_error 呈現機制，訊息文字用 offline_blocked）。
  - http probe 前：`if (!isFile && !isNetworkAllowed(configData.offlineMode)) { buildTree(undefined); return }` 置於 `try { await fetchDirListing... }` **之前**。
  - file:// FSA 分支不加守門。
  - 註：buildTree 顯示 offline_blocked 的機制——file-tree 的 root 空/錯訊息目前用 `dir_error`；最小改法為 buildTree 增一參數或 initFilesContent 離線時走一個顯示 offline_blocked 的路徑。實作定案：在 file-tree `createFileTree` 的 options 加 `rootMessage?: string`（離線時傳 `offline_blocked` 的 localize 結果），無則沿用現行。
- [ ] **remote-guard 插件**：新 `src/plugins/remote-guard.ts` export `(ctx) => ctx.event.on('contentRendered', c => { if (!isNetworkAllowed(ctx.offlineMode)) blockRemoteResources(c) })`；`blockRemoteResources(container)` 用廣查 `container.querySelectorAll('img,video,audio,source,iframe,embed,track,object,image,input[type="image"]')`，對每元素檢查屬性集 `['src','srcset','poster','data','href','xlink:href']`——`el.getAttribute(attr)` 且 `isRemoteUrl(值)` → `el.setAttribute('data-blocked-'+attr, 值); el.removeAttribute(attr); el.classList.add(className.BLOCKED_REMOTE)`。className 加 `BLOCKED_REMOTE = p\`blocked-remote\``。
- [ ] **plugin.ts / main.ts**：`initPlugins({ event, offlineMode })` ——`initPlugins` 型別加 `offlineMode?: boolean` 併入 ctx；`main.ts` 呼叫改 `initPlugins({ event: globalEvent, offlineMode: configData.offlineMode })`。`plugins/index.ts` 註冊 remoteGuardPlugin（放在其他 render 插件之後，確保 contentRendered 時 DOM 已就緒）。
- [ ] **index.less**：`.md-reader__blocked-remote` 占位樣式（虛線框 + 「遠端資源已封鎖」偽元素或最小樣式，沿用 --color-border）。
- [ ] **locale.json**：`offline_blocked`（en/zh-CN/zh-TW，如「離線模式：已封鎖遠端目錄請求」）。
- [ ] 手動 smoke（build）：離線預設下 http 頁 Files tab 顯示 offline_blocked、遠端圖片被擋。
- [ ] 全測試綠、tsc 乾淨、`git diff main -- src/background.ts` 只見三列、`git diff main -- src/manifest.json` 空、commit。

---

### Task 3: PlantUML 插件 + markdown 透傳

**Files:** Create `src/plugins/plantuml.ts`；Modify `src/core/markdown.ts`、`src/main.ts`、`src/config/class-name.ts`、`src/style/index.less`、`package.json`（依賴）

**Interfaces:** Consumes Task 1 的 canRenderPlantuml/buildPlantumlImageUrl/normalizePlantumlServer/isNetworkAllowed。

**Steps:**

- [ ] `pnpm add plantuml-encoder`（確認 pnpm-lock 更新、無 postinstall build；純 JS）。
- [ ] `src/plugins/plantuml.ts`：`export default function PlantumlPlugin(md, opts?: { server?: string; allowed?: boolean })`——覆寫 fence rule（比照 graphviz-block.ts pattern），info 為 `plantuml` 時：
  - `opts?.allowed` → `import encoder from 'plantuml-encoder'`；`const encoded = encoder.encode(code)`；回 `<img class="md-reader__plantuml" src="${buildPlantumlImageUrl(opts.server, encoded)}" alt="PlantUML diagram" loading="lazy">`。
  - 否則 → 回 `<div class="md-reader__plantuml-disabled">${localize 或英文占位}</div><pre>${escapeHtml(code)}</pre>`（占位文字用固定英文或經 md env 傳入——最小化：固定「PlantUML disabled」+ 原碼；i18n 於 popup 警告，占位可英文）。
  - 非 plantuml fence → fallback。
- [ ] `markdown.ts`：`MdOptions` 加 `plantuml?: { server: string; allowed: boolean }`；`initRender` 內 `md.use(PlantumlPlugin, mdOpts.plantuml)`（在 mMultimdTable 附近，always-use 讀 config）。
- [ ] `main.ts mdRenderer`：加 `plantuml: { server: normalizePlantumlServer(configData.plantumlServer), allowed: canRenderPlantuml(configData.plantumlEnabled, configData.offlineMode, configData.plantumlServer) }` 傳入 mdRender（import 自 `@/core/plantuml`）。
- [ ] class-name 加 `PLANTUML`、`PLANTUML_DISABLED`；index.less 占位樣式。
- [ ] 手動 smoke：離線關 + plantuml 開 → img 指向 server/svg/<encoded>；離線開 → 占位無 img。
- [ ] 全測試綠、tsc 乾淨、build 成功（記錄 bundle 增量）、commit。

---

### Task 4: popup UI（離線開關 + 變灰 + PlantUML 區塊）+ i18n

**Files:** Modify `src/popup/components/tab-general.svelte`、`src/popup/components/tab-plugins.svelte`、`src/config/i18n/locale.json`

**Steps:**

- [ ] **tab-general.svelte**：頂部（啟用之後）加**離線模式** Switch（`offlineMode`，事件驅動 on:change→updateConfig），hint `hint_offline`＋說明 `desc_offline`（封鎖遠端目錄/GitHub/自動刷新/PlantUML/遠端圖片；本機與 file:// 照常）。既有 refresh Switch 加 `disabled={data.offlineMode}`（folderTree、charsetCompat **不加 disabled**）。
- [ ] **tab-plugins.svelte**：新增 **PlantUML 區塊**——啟用 Switch（`plantumlEnabled`，`disabled={data.offlineMode}`）、伺服器 URL input（`plantumlServer`，`disabled={data.offlineMode || !data.plantumlEnabled}`，on:blur normalize 回寫）、警告文字 `warn_plantuml`。事件驅動、直接賦值（比照既有慣例，勿用會誤觸發的 `$:`）。
- [ ] **locale.json**：`label_offline`、`hint_offline`、`desc_offline`、`label_plantuml`、`label_plantuml-server`、`warn_plantuml`、`hint_offline-disabled`（en/zh-CN/zh-TW；台灣用語）。
- [ ] build 後手動開 popup 檢查三 key 寫入、離線時 refresh/plantuml 變灰、folderTree 不變灰。
- [ ] 全測試綠、tsc 乾淨、commit。

---

### Task 5: 驗收 + 隱私文案 + 合併發版 v1.4.0（controller）

- [ ] Playwright 網路監聽驗收（延續 v1.3.0）：
  - 離線預設：http .md 頁 folderTree+refresh 開、GitHub raw 頁 → 零遠端請求；Files 顯示 offline_blocked；含 `![](http)`+raw `<img/object/svg image src=http>` 的 md → 無該等遠端請求、元素有 blocked-remote class；PlantUML 開但離線 → 占位無 img。
  - 離線關 + 各開：dir/GitHub/polling/PlantUML img/遠端圖片各自恢復（PlantUML img URL = server/svg/<encoded> 驗證）。
  - 本機不受離線：file:// + offlineMode 預設 + FSA（授權資料夾）仍列本機檔、charsetCompat 仍運作。
  - v1.3.0 隱私迴歸 + v1.2.x 全功能迴歸。
- [ ] README/PRIVACY 更新：加離線模式（一鍵封鎖遠端，含文件內遠端圖片/媒體，誠實列殘留 CSS 缺口）＋ PlantUML（唯一會把內容送第三方、預設關、離線下停用）；措辭與 spec 站點 5 揭露一致（「封鎖文件內遠端圖片與媒體」非「一切遠端引用」）。docs/plans.md/designs.md/ROADMAP 登記。
- [ ] 最終整分支審查（opus，因涉隱私宣稱與安全）→ fix batch → 合入 main（--no-ff）→ bump 1.4.0 → 檢查無繼承舊 tag → tag v1.4.0 → CI release 監控。

## Self-Review 紀錄

- **Spec coverage**：五處 egress（T2 polling/initFilesContent/remote-guard、T3 plantuml img）、offlineMode/plantuml 資料模型與純函式（T1）、popup（T4）、隱私文案與驗收（T5）。站點 5 廣查選擇器、folderTree 不變灰、canRenderPlantuml 唯一實作三 binding 落在 T2/T4/T3。
- **Placeholder scan**：無 TBD；offline_blocked 顯示機制於 T2 定案（createFileTree rootMessage 參數）。
- **Type consistency**：MdOptions.plantuml `{server, allowed}` T3 一致；initPlugins ctx.offlineMode T2 定義、remote-guard 用；className 新常數各 task 一致。
