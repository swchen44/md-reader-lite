# v1.5.0 實作計畫：.mdc/.puml/.plantuml + 關閉顯示原碼 + 伺服器教學 + language 修正 + 全按鈕測試

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依核可 spec（`docs/superpowers/specs/2026-09-02-plantuml-files-and-fixes-design.md`）落地 .mdc/.puml/.plantuml 副檔名、PlantUML 關閉顯示原碼、伺服器教學連結、language 修正，發版 v1.5.0。

**Architecture:** .puml/.plantuml 獨立檔包成 ```plantuml fence 復用站點 4 管制；isPlantumlUrl 純函式 + content-type 縮窄繞過；language 加 actionMap reload + 事件驅動；沿用 v1.4.0 隱私原則。

**Tech Stack:** TS 4.8.2、webpack、Svelte 3 + SMUI、markdown-it、plantuml-encoder、node --test、Playwright。

## Global Constraints

- 零 host 權限；**無新 permission**；manifest 僅加 .mdc/.puml/.plantuml matches；background 僅加 `language: 'reload'`。`git diff main -- src/background.ts` 只該一列。
- 既有 155 條測試不回歸；測試指定檔名跑（Task 1 起同 v1.4.0 12 檔）。
- 新 core 函式加在既有 `src/core/plantuml.ts`（已 `#core` 可測）。
- 每 task：測試綠 + `tsc --noEmit` 乾淨 + commit（四段中文 + trailers `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR`）。
- i18n 新 key en/zh-CN/zh-TW。
- spec 的「content-type 繞過縮窄（非 text/html）」「.puml wrap-as-fence」「language reload+事件驅動」為 binding。

---

### Task 1: manifest matches + isPlantumlUrl + .puml 渲染佈線 + content-type 縮窄

**Files:** Modify `src/manifest.json`、`src/core/plantuml.ts`、`tests/plantuml.test.mjs`、`src/main.ts`

**Steps:**

- [ ] `src/core/plantuml.ts` 加 `export function isPlantumlUrl(url: string): boolean`（`new URL(url).pathname` 以 `.puml`/`.plantuml` 結尾不分大小寫，try/catch，比照 `isTxtUrl` in settings.ts）。
- [ ] `tests/plantuml.test.mjs` 加 isPlantumlUrl ≥5：`a.puml`/`a.plantuml`/`A.PUML`→true、`a.puml?x=1`→true、`a.md`/`a.txt`→false、非字串/壞 URL→false。跑確認先 FAIL。
- [ ] `src/manifest.json` matches 加 .mdc/.puml/.plantuml——每個 6 種：`*://*/*.X`、`file://*/*.X`、大寫兩者、`*://*/*.X?*`、`file://*/*.X?*`（比照 .txt 那組；.mdc 也要大寫 .MDC）。共約 18 條（3 副檔名 × 6，大寫另計則更多——比照既有 .md 的大寫模式補齊）。
- [ ] `src/main.ts` content-type 閘門重構（spec §二程式碼）：`const isPuml = isPlantumlUrl(window.location.href)`；`if (!configData.enable) return`；`if (isPuml) { const ct=document.contentType; if(!ct.startsWith('text/')||ct==='text/html') return } else if (!CONTENT_TYPES.includes(document.contentType)) return`。import isPlantumlUrl 自 `@/core/plantuml`。注意此重構在既有 `isTxtUrl` early-return 之後。
- [ ] `src/main.ts` wrap：在 `mdRaw = rawContainer?.textContent` 之後加 ` if (isPuml && mdRaw) mdRaw = '```plantuml\\n' + mdRaw.trim() + '\\n```' `（實際用反引號 fence；注意 mdRaw 可能為空）。
- [ ] 全測試綠、tsc 乾淨、`export npm_package_version=1.5.0 npm_package_name=md-reader-lite; node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js` build 過後 `git checkout src/manifest.json` **不做**（本 task 有意改 matches，version 欄位手動還原：build 前先記錄 version，build 後 `git checkout src/manifest.json` 會連 matches 一起還原——改為：build 用 `node ./scripts/manifest.mjs` 只改 version 欄位，故 build 後 `git checkout src/manifest.json` 會還原 version ＋ matches。定案：本 task 改完 matches 先 commit，再 build 驗證時接受 version 被 manifest.mjs 改動、build 後只 `git checkout` version 那一行——最簡：build 前 `git stash` 不用；改為 build 後用 `sed` 把 version 改回 dev 值。**實作定案**：commit matches 變更後，build 驗證時 `node ./scripts/manifest.mjs` 產生的 version 改動在 build 完 `git checkout src/manifest.json` 還原全部（含剛 commit 的 matches 已在 git，checkout 還原到 HEAD 含 matches）——安全）。commit。

**Interfaces（Produces）:** `isPlantumlUrl`；main.ts isPuml wrap。

---

### Task 2: PlantUML 關閉顯示原碼（小提示 + 原碼 class + i18n）

**Files:** Modify `src/plugins/plantuml.ts`、`src/core/markdown.ts`、`src/main.ts`、`src/config/class-name.ts`、`src/style/index.less`、`src/config/i18n/locale.json`

**Steps:**

- [ ] `class-name.ts` 加 `PLANTUML_SOURCE = p\`plantuml-source\``。
- [ ] `plugins/plantuml.ts`：not-allowed 分支改為 `<div class="md-reader__plantuml-disabled">${opts?.disabledHint || 'PlantUML disabled'}</div><pre class="md-reader__plantuml-source">${escapeHtml(code)}</pre>`；`opts` 型別加 `disabledHint?: string`。
- [ ] `markdown.ts`：`MdOptions.plantuml` 型別加 `disabledHint?: string`；`md.use(mPlantuml, mdOpts.plantuml)` 不變（opts 多帶一欄）。
- [ ] `main.ts mdRenderer`：plantuml opts 加 `disabledHint: localize('plantuml_disabled_render')`（localize 已在 main scope）。
- [ ] `index.less`：`.md-reader__plantuml-disabled`（淡色小字）、`.md-reader__plantuml-source`（code block 樣式，沿用既有 pre/code 樣式或 --color-border）。
- [ ] `locale.json`：`plantuml_disabled_render`（en/zh-CN/zh-TW，如「PlantUML 已關閉——啟用插件並關閉離線模式即可算圖」）。
- [ ] 全測試綠、tsc 乾淨、commit。

---

### Task 3: 伺服器教學文件 + popup 連結 + language 修正

**Files:** Create `docs/plantuml-server-setup.md`、`docs/plantuml-server-setup.zh-TW.md`；Modify `src/popup/components/tab-plugins.svelte`、`src/popup/components/tab-general.svelte`、`src/popup/components/app.svelte`、`src/background.ts`、`src/config/i18n/locale.json`

**Steps:**

- [ ] 寫 `docs/plantuml-server-setup.md`（English）與 `docs/plantuml-server-setup.zh-TW.md`（繁中）：內網自架 PlantUML（Docker `docker run -d -p 8080:8080 plantuml/plantuml-server:jetty`、伺服器 URL 填 `http://<內網IP>:8080`、`/svg/<encoded>` 路徑、與公開 plantuml.com 的隱私差異、驗證方式）。兩檔頂部互連對方語言。
- [ ] `tab-plugins.svelte`：plantumlServer input 下方加兩個連結 `<a href="https://github.com/swchen44/md-reader-lite/blob/main/docs/plantuml-server-setup.zh-TW.md" target="_blank" rel="noopener">中文</a>` 與英文版；前綴 label `label_plantuml-help`。
- [ ] **language 修正**：`background.ts` actionMap 加 `language: 'reload'`；`tab-general.svelte` 語言 Select 加 `on:MDCSelect:change={onLanguageChange}`，`function onLanguageChange(e){ updateConfig('language', e.detail.value) }`（bind:value 保留供顯示）；`app.svelte` 把 `$: if (data.language) { updateConfig('language',...); changeLocale(...) }` 改為 `$: localize = i18n(data.language || i18n().locale)`（移除 updateConfig 副作用；移除 changeLocale 函式若不再用）。確認 app.svelte 無殘留會寫 storage 的 `$:`。
- [ ] `locale.json`：`label_plantuml-help`（en/zh-CN/zh-TW，如「內網自架教學」）。
- [ ] 全測試綠、tsc 乾淨、build 過、`git diff main -- src/background.ts` 只見 language 一列、commit。

---

### Task 4: 全按鈕驗收 + 文件 + 合併發版 v1.5.0（controller）

- [ ] Playwright 全按鈕驗收（spec §六）：popup 每控件（一般/外觀/插件全部 + 伺服器教學連結 href/target/rel + 浮動選單 5 項）逐一點/切/填 → 斷言寫入正確 storage key 或 DOM 生效；language 改後頁面 reload；.puml/.plantuml 檔（啟用+非離線 →img、離線 → 小提示+原碼）；.mdc 檔渲染；v1.4.0 隱私迴歸（離線零網路）。
- [ ] README/PRIVACY 補：.mdc/.puml/.plantuml 支援、.puml 受離線管制；docs/plans.md/designs.md/ROADMAP 登記。
- [ ] 最終整分支審查（opus，涉隱私+注入面）→ fix batch → 合入 main（--no-ff）→ bump 1.5.0 → 檢查無繼承舊 tag → tag v1.5.0 → CI release 監控。

## Self-Review 紀錄

- **Spec coverage**：.mdc/.puml/.plantuml matches+isPlantumlUrl+wrap+content-type 縮窄（T1）、關閉顯示原碼（T2）、伺服器教學+連結+language 修正（T3）、全按鈕驗收+文件（T4）。content-type 縮窄 binding 落 T1、language reload 落 T3。
- **Placeholder scan**：無 TBD；T1 build/manifest version 還原流程已定案（commit matches 後 checkout 還原到含 matches 的 HEAD）。
- **Type consistency**：MdOptions.plantuml 加 disabledHint（T2）；isPlantumlUrl 簽名 T1 定義 T1 用。
