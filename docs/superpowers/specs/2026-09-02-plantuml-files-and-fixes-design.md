# 設計文件（v1.5.0）：.mdc/.puml/.plantuml + PlantUML 關閉顯示原碼 + 伺服器教學連結 + language 修正 + 全按鈕測試

日期：2026-09-02 ／ 分支：`feature/plantuml-files-and-fixes` ／ 目標版本：v1.5.0

## 背景

使用者五項需求 + 一項 code review 發現：

- code review（先做）結論：popup 所有控件與浮動選單五項皆正確接線、無 dead button；**唯一問題**：`language` 不在 background actionMap → 改語言後開啟中頁面的側欄標籤不即時更新（僅 popup 即時、內容頁需重載）；且 app.svelte 用 `$: if(data.language)` 反應式回寫（改任何設定都重複觸發，無害但不乾淨）。

## 一、`.mdc` 副檔名

manifest `content_scripts.matches` 加 `.mdc`（http + file + 大寫 + `?*` 變體，比照既有 .md）。`.mdc` 為一般 Markdown，走既有渲染。無新權限。

## 二、`.puml` / `.plantuml` 獨立檔（整份檔案即一張 PlantUML 圖）

使用者範例（無需 ```）：

```
@startuml test_digram
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response
@enduml
```

### 落地

- manifest matches 加 `.puml`、`.plantuml`（http + file + 大寫 + `?*`）。
- 純函式 `src/core/plantuml.ts` 加 `isPlantumlUrl(url: string): boolean`（pathname 以 `.puml`/`.plantuml` 結尾，不分大小寫，比照 `isTxtUrl`）。
- `main.ts`：**在讀取 mdRaw 後、渲染前**，若 `isPlantumlUrl(location.href)` → 把整份內容包成單一 plantuml fence：` mdRaw = '```plantuml\n' + mdRaw.trim() + '\n```' `，之後照常走 `contentRender(mdRaw)`→markdown→plantuml 插件。如此**離線/啟用管制、關閉顯示原碼全部自動沿用**站點 4 既有機制。
- **content-type 閘門（設計審查 Important 修正——繞過縮窄，保留 HTML 誤命中防線）**：`CONTENT_TYPES`（`text/plain`/`text/markdown`/`text/x-markdown`）是「manifest 以副檔名寬鬆比對後」的第二道防線——擋掉某網站有 `.puml`/`.md` 結尾動態路由但實際回 `text/html`（真實頁面）時擴充誤注入污染版面。`.puml` 常見的 `text/plain` **本就在 CONTENT_TYPES**，不需繞過；唯一需要放行的是「`text/*` 但非 CONTENT_TYPES 成員」的少數情形。故**不無條件繞過**：對 `isPlantumlUrl` 為真者，放行條件改為 `document.contentType.startsWith('text/') && document.contentType !== 'text/html'`（`text/html` 一律不注入，保留防線）。main.ts 現況 `if (!configData.enable || !CONTENT_TYPES.includes(document.contentType)) return` 為**合併判斷**，需重構為：

```ts
const isPuml = isPlantumlUrl(window.location.href)
if (!configData.enable) return
if (isPuml) {
  const ct = document.contentType
  if (!ct.startsWith('text/') || ct === 'text/html') return
} else if (!CONTENT_TYPES.includes(document.contentType)) {
  return
}
```

- 邊界：plantuml 源碼理論上不含 ```，wrap 安全；若含則該 fence 可能提前結束（罕見，非目標處理）。

## 三、關閉 PlantUML（或離線）時顯示：小提示 + 原始碼

使用者選「小提示 + 原始碼」。`src/plugins/plantuml.ts` 的 not-allowed 分支現為 `<div>PlantUML disabled</div><pre>source</pre>`（硬編英文）。改為：

- 一行淡色小提示（i18n，經 md env 傳入 localize 結果或固定多語——定案：透過 `opts` 多傳一個 `disabledHint: string`，由 main.ts 以 `localize('plantuml_disabled_render')` 算好傳入），文案如「PlantUML 已關閉——啟用插件並關閉離線模式即可算圖」。
- 下方原始碼以 `<pre class="md-reader__plantuml-source">` + `escapeHtml(code)` 顯示。**注意（審查 Minor）：`plantuml-source` class 為新增**——需在 `src/config/class-name.ts` 加 `PLANTUML_SOURCE = p\`plantuml-source\`` 常數、`src/style/index.less`加對應樣式（現況占位僅`<pre>` 無 class）。
- 三語系 locale key `plantuml_disabled_render`。

## 四、伺服器欄位旁的教學連結（GitHub 中英文件）

- 新增文件 `docs/plantuml-server-setup.md`（English）與 `docs/plantuml-server-setup.zh-TW.md`（繁中）——說明如何在**內網自架 PlantUML 伺服器**（Docker `plantuml/plantuml-server` 一鍵、`docker run -p 8080:8080 plantuml/plantuml-server:jetty`、伺服器 URL 填 `http://<內網IP>:8080`、`/svg/` 路徑說明、與公開 plantuml.com 的隱私差異）。兩檔互相連結對方語言版。
- `tab-plugins.svelte` PlantUML 伺服器 input 下方加兩個連結（`中文` / `English`），`href` 指向 GitHub blob URL（`https://github.com/swchen44/md-reader-lite/blob/main/docs/plantuml-server-setup.zh-TW.md` 與 `.../plantuml-server-setup.md`），`target="_blank" rel="noopener"`。locale key `label_plantuml-help`（如「內網自架教學」）。

## 五、language 修正 + app.svelte 清理

- `background.ts` actionMap 加 `language: 'reload'`（改語言即重整內容頁套用側欄標籤）。
- `tab-general.svelte` 語言 Select 改事件驅動：加 `on:MDCSelect:change={onLanguageChange}`，`onLanguageChange(e)` → `updateConfig('language', e.detail.value)`（比照 textFont）。
- `app.svelte`：`$: if (data.language) { updateConfig(...); changeLocale(...) }` 改為**純反應式再本地化、無 side effect**：`$: localize = i18n(data.language || i18n().locale)`（移除 updateConfig 副作用——持久化改由 tab-general 事件負責）。確認 app.svelte 不再有會重複寫 storage 的 `$:`。

## 六、全按鈕驗收（Playwright，controller）

逐一驗證**每個** popup 控件與浮動選單項：點/切/填 → 寫入正確 storage key → （即時類）對 DOM 生效或（reload/重渲染類）storage 正確。清單：一般 11 項（含恢復預設、language 現會 reload）、外觀 11 項、插件全開關/chips/Linkify×3/Alert/plantumlEnabled/plantumlServer、**PlantUML 伺服器教學連結 2 項（中/英，斷言 href 指向對應 GitHub blob URL、`target=_blank`、`rel=noopener`）**、浮動選單 5 項。每項一條斷言，全綠才算「每個按鈕都有實作」。另加 .puml/.plantuml 檔渲染（啟用+非離線 → 圖、離線/關閉 → 小提示+原碼）與 .mdc 檔渲染驗收。

## 資料模型 / 純函式

- 無新 storage key。
- `src/core/plantuml.ts` 加 `isPlantumlUrl`。
- 單元測試：`tests/plantuml.test.mjs` 加 isPlantumlUrl（`.puml`/`.plantuml`/大寫/`?q`/`.md`→false/非字串 →false）≥ 5 條。

## 零權限/上架

- 僅 manifest matches 擴充（.mdc/.puml/.plantuml，比照既有模式，無新 permission、無 host_permissions）。`git diff main -- src/manifest.json` 僅這些 matches 行。
- background 僅 actionMap 加 `language: 'reload'`。
- 隱私：`.puml`/`.plantuml` 獨立檔渲染受 offlineMode + plantumlEnabled 管制（離線/關閉時顯示原碼、不送遠端）——與 v1.4.0 隱私原則一致。README/PRIVACY 補一句 .puml/.plantuml 亦受離線管制。

## 非目標

- PlantUML 純前端渲染、`.puml` 含 ``` 的邊角、其餘副檔名（.mdc 之外）。

## Git

commit 依模組切、四段訊息 + trailers；完成後合入 main 併發 v1.5.0。Subagent 一律 sonnet；markdown 表格 cell 禁裸 `|`。
