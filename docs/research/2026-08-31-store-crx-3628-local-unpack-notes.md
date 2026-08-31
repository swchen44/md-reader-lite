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
`skipGuide:false`（新手導覽）、`charset:"utf-8"`（搭配 `charsetCompat`）、
`customCSS` 編輯器支援 Tab 縮排與 Cmd/Ctrl+S 套用。
