# 商店版 3.6.28 本機解包補充筆記（manifest 快捷鍵、權限邊界、插件子選項預設值）

> 本文補充 `2026-08-31-store-36-settings-menu-and-panel-teardown.md` 未展開的事實。
> 設定面板四頁籤、19 插件、Pro gate 機制、浮動選單七項等主體內容請看該文件，
> 此處不重複。
>
> 素材：`~/Library/Application Support/Google/Chrome/Default/Extensions/medapdbncneneejhbgcjceippjlfkmkg/3.6.28_0/`（本機已安裝解包版，2026-08-31 分析）。

## 1. manifest commands —— 四個鍵盤快捷鍵（teardown 僅提及關鍵字，未列綁定）

| command 名        | 綁定        | 對應設定 key                |
| ----------------- | ----------- | --------------------------- |
| `toggleCentered`  | Alt+Shift+C | `preferences.centered`      |
| `togglePageTheme` | Alt+Shift+T | `preferences.pageTheme`     |
| `toggleRefresh`   | Alt+Shift+R | `preferences.refresh`       |
| `toggleSide`      | Alt+Shift+B | `preferences.sideCollapsed` |

移植對應（Lite）：manifest 加 `commands` 區塊 + `background.ts` 掛
`chrome.commands.onCommand`，把切換後的值走既有
`{action:'storage', data:{key, value}}` 訊息路徑回流，即可重用現有生效機制，
不需新權限（`commands` 不是 permission）。

## 2. 權限與帳戶系統邊界（Lite 不移植帳戶，此節供劃界參考）

- **permissions**：`storage`、`tabs`（Lite 僅 `activeTab` + `storage`，不需擴權）。
- **host_permissions**：`https://mdreaderapi.bener.cc/*` —— 帳戶/訂閱後端 API，
  整個帳戶系統唯一的網路面。
- 第二個 content script `dist/auth-bridge/index.global.js` 只注入
  `https://md-reader.github.io/extension-auth/start*`，是 OAuth 登入橋接頁。
- 結論：帳戶/Pro 功能的 manifest 足跡就是上述兩條；Lite 維持零 host 權限即等於
  完整排除該子系統。

## 3. content script 注入範圍

- 主腳本 `dist/content/index.global.js` + `style.css`，`run_at: document_start`。
- 副檔名 matches（含大小寫與 `?query` 變體）：`.md` `.mdx` `.mdc` `.mkd` `.txt`
  `.markdown`，涵蓋 `*://*/*` 與 `file://*/*`。
- 另含 `file://*/*/` 與 `file:///` —— 本機資料夾目錄瀏覽（enableFolderUrl）
  的注入點。
- Lite 對照：`.txt` matches 已於案 B+F Task 2 加入；`.mdx`/`.mdc`/`.mkd` 尚未
  支援（未列入任何計畫，需求出現再議）。

## 4. `mdPluginOptions` 完整預設值（teardown 列了選項名，此處補齊確切預設）

```js
{
  Linkify:      { fuzzyLink: false, fuzzyIP: false, fuzzyEmail: true },
  TOC:          { includeLevel: [1, 2], containerClass: 'table-of-contents',
                  markerPattern: /^\[\[toc\]\]/im, omitTag: '<!-- omit from toc -->',
                  listType: 'ul' },
  Katex:        { enableBareBlocks: false, enableMathBlockInHtml: false,
                  enableMathInlineInHtml: false, enableFencedBlocks: false,
                  throwOnError: false, errorColor: '#cc0000' },
  Mermaid:      { theme: 'auto', json: { theme: 'auto', startOnLoad: false } },
  FrontMatter:  { showMetadata: false },
  MultimdTable: { multiline: false, rowspan: false, headerless: false,
                  multibody: false, autolabel: false },
  TaskLists:    { enabled: false, label: false, labelAfter: false },
  Alert:        { alertNames: ['important', 'note', 'tip', 'warning', 'caution'],
                  deep: false, infoContainer: true, tipContainer: true,
                  successContainer: true, warningContainer: true,
                  dangerContainer: true },
}
```

## 5. 字型檔實體位置（評估 bundle size 用）

- `dist/assets/`：Inter、Saans、Poppins、AtkinsonHyperlegibleNext（UI 無障礙字體）
  等 .woff/.woff2。
- `assets/fonts/`：Roboto、Merriweather、MerriweatherSans、NotoSans、SourceSans3、
  NotoSerifSC、GeistMono 等 .woff。
- 整包 crx 解包後約 17MB，字型占大宗 —— 佐證 Lite「不打包字型、改用系統
  font stack」的決策（見案 B+F spec）。

## 6. 其餘雜項 storage key（teardown 主表以外）

`sideCollapsed:false`（側欄收合）、`popupMenu:"General"`（popup 記住所在頁籤）、
`skipGuide:false`（新手導覽）、`charset:"utf-8"`（死欄位，見 §7）、
`customCSS` 編輯器支援 Tab 縮排與 Cmd/Ctrl+S 套用。

## 7. 字元集相容模式（charsetCompat）實作拆解（2026-09-01 補）

### 機制（content script `dist/content/index.global.js` + `dist/background/index.mjs`）

1. **預設讀取路徑**：content script 以 `document.body.querySelector('pre')` 取
   `textContent` —— 即 Chrome 自己渲染 file:// 純文字時的解碼結果。大型 CJK 檔
   Chrome 的編碼偵測可能誤判（如 UTF-8 被猜成 Big5/GBK），這是本功能要解的問題。
2. **相容模式路徑**：`Wt.isLocal && on.value.charsetCompat` 時
   （`isLocal = location.protocol === 'file:'`），改送 `bg-fetch` 訊息給
   background service worker：

   ```js
   // content：async function xxe(t){ return H1('bg-fetch', {url:t}, 'background') }
   // background handler（去混淆重排）：
   async function px({ data, sender }) {
     if (!Dc(sender))
       return { ok: false, msg: 'Error: Invalid Endpoint', res: null }
     const tab = await chrome.tabs.get(sender.tabId) // 需 tabs 權限
     if (new URL(tab.url).origin !== new URL(data.url).origin)
       return {
         ok: false,
         msg: 'Error: Cross-origin request not allowed',
         res: null,
       }
     const r = await fetch(data.url)
     return {
       ok: r.ok,
       msg: r.statusText,
       res: (await r.text()) || '',
       status: r.status,
     }
   }
   ```

3. **解碼原理**：`Response.text()` 在 Content-Type 無 charset 時一律以 UTF-8 解碼
   （spec 行為），而 file:// 回應沒有 charset —— 所以此路徑等於
   **繞過 Chrome 頁面層的編碼猜測、強制 UTF-8**。這就是功能全部：沒有任何
   TextDecoder 或 charset 參數參與。
4. **`charset:"utf-8"` 是死欄位**：整包程式碼只有 `value.charsetCompat` 一個設定
   讀取點，popup 也只有 toggle、無 charset 下拉。屬預留欄位，功能實為
   「強制 UTF-8」而非「自選編碼」。
5. **順帶發現**：自動刷新輪詢走同一條 `bg-fetch`（抓全文比對，變更才重渲染，
   間隔 `refreshInterval*1000`）——商店版 refresh 不是 reload 頁面，而是
   fetch-diff-rerender。

### 移植到 Lite 的關鍵風險（動工前必須先驗證）

- **MV3 SW 能否 fetch file://**：先前案 C/D 實測記錄「SW fetch 與 content script
  XHR 讀 file:// 皆被新版 Chrome 擋」，但商店版 3.6.28 明明依賴 SW fetch file://
  出貨。差異可能在：當時測的是**目錄** URL、或 Chrome 版本行為變動、或
  「允許存取檔案網址」開關狀態。移植前先用最小 SW `fetch('file:///...md')`
  smoke test 確認，結果決定方案成立與否。
- 商店版靠 `tabs` 權限做 `tabs.get(sender.tabId)` 同源檢查；Lite 零擴權下可改用
  `sender.tab?.url`（`onMessage` 的 sender 本身就帶 tab 資訊，不需 `tabs` 權限）。
- 若 SW fetch file:// 不可行，替代路徑：content script 端
  `fetch(location.href)` + `arrayBuffer()` + `TextDecoder('utf-8')`（同 origin
  file:// 在 content script 可否 fetch 亦需一併實測）。

### GATE 實測結果（2026-09-01，Playwright + 載入 unpacked 擴充）

**SW fetch file:// 可行——零權限 charsetCompat 成立。** 實測（`scratchpad/pw/spike-charset.mjs`，Chromium via Playwright，file access 授權下）：

- `chrome.extension.isAllowedFileSchemeAccess()` = `true`（Playwright `--load-extension` 預設授權；與 content script 能注入 file:// 頁一致——兩者共用同一 file-access 授權，**charsetCompat 不需任何新權限**，riding on 既有 file-access grant）。
- **SW `fetch('file:///…md')` → `{ok:true, status:200}`**，`await r.text()` 與 `new TextDecoder('utf-8').decode(await r.arrayBuffer())` 皆正確解出繁中（`# 字元集測試 — 繁體中文`）。先前案 C/D「SW fetch file:// 被擋」的推定，於現行 Chrome + 檔案 URL（非目錄）+ file access 開啟下**不成立**。
- 主世界（page.evaluate）`fetch(location.href)` → `TypeError: Failed to fetch`（預期：一般頁面無 file:// fetch 特權）。content-script 隔離世界的 fetch 未在此 spike 直接測（Playwright 不易注入隔離世界），實作時可一併驗證；但 **SW 路徑已足夠、且與商店版一致**。
- 結論方案：content script 偵測 `file://` + `charsetCompat` on → 送訊息給 SW → SW `fetch` + `arrayBuffer` + `TextDecoder('utf-8')` → 回傳強制 UTF-8 文字 → content script 重渲染；SW 同源檢查用 `sender.tab?.url`（免 `tabs` 權限）。charset 欄位維持死欄位（功能=強制 UTF-8）。
