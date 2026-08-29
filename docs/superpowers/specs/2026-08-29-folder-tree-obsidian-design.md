# 設計文件：資料夾目錄樹 + Obsidian 語法支援

日期：2026-08-29
基底版本：md-reader 2.12.12（開源 MIT 版）
分支：`feature/folder-tree-obsidian`

## 背景與動機

閉源的商店版 3.x 將「文件夾目錄」（folder directory）列為 Pro 付費功能。本專案基於開源 2.12.12 自行實作等價功能，供公司內網（離線環境）使用。同時因團隊文件多由 Obsidian 產出，一併加入 Obsidian 擴充語法的渲染支援。

## 需求

1. **資料夾目錄樹**：在側邊欄顯示目前 Markdown 檔所在資料夾的檔案樹，可導覽至其他文件。
   - 來源同時支援 `file://`（本機/網路磁碟）與 `http(s)://` 內網伺服器（有 autoindex）。
   - 懶加載可展開樹：初始只列目前資料夾一層 + `../` 上層導覽；子資料夾點擊展開時才抓取。
   - 只列資料夾與 Markdown 檔（`.md/.mdx/.mkd/.markdown`，大小寫不拘，與 manifest 比對清單一致）。
2. **Obsidian 語法**：見下方支援清單。
3. 全程離線可用，不得引入任何外部網路依賴。
4. Git 流程：開 feature branch，按模組切 commit，每個 commit message 說明動機（why）與變更內容。

## 架構

新增三個模組，盡量不動既有程式：

### 1. `background.ts`：新增 `fetchDir` action

收到 `{action: 'fetchDir', data: {url}}` 時 fetch 該目錄 URL 並回傳原始 HTML 文字（失敗回傳 `{error}`）。與既有 `fetch` action 並列。設 5 秒逾時。

### 2. `src/core/dir-listing.ts`（新檔）：目錄頁解析器

- 輸入：HTML 字串 + 來源目錄 URL。輸出：`{ name: string, isDir: boolean, url: string }[]`。
- 兩種解析策略，依內容自動判別：
  - **Chrome `file://` 目錄頁**：解析 `addRow("name", "encodedName", isDir, ...)` 腳本行。
  - **伺服器 autoindex**（nginx/Apache/IIS）：`DOMParser` 抽 `<a href>`，href 以 `/` 結尾視為資料夾；過濾排序連結（`?C=N;O=D` 等）與 `../`。
- 過濾規則集中於此模組：只保留資料夾與 Markdown 副檔名。
- 認不得的格式回傳空清單（上層顯示說明訊息）。

### 3. `src/core/file-tree.ts`（新檔）：樹狀 UI 元件

- 渲染樹、懶加載展開/收合、目前檔案高亮、`../` 上層導覽。
- 展開節點：發 `fetchDir` 訊息 → 解析 → 渲染子層 `<ul>`；同一節點的結果做記憶體快取。
- 展開狀態只存記憶體，換頁重建（不持久化）。
- 點 `.md` 檔為普通 `<a>` 整頁導航，維持既有頁面模型，不做 SPA 局部更新。

### 4. `src/plugins/obsidian.ts`（新檔）：Obsidian 語法 markdown-it 插件

作為 `mdPlugins` 清單中可開關的一項。

## 資料流

`main.ts` 啟動 → 由 `location.href` 計算目前資料夾 URL → file-tree 以該資料夾為根渲染第一層（附 `../`）→ 使用者展開子資料夾時逐層抓取。

**Spike（實作第一步）**：驗證 MV3 service worker fetch `file:///.../`（目錄）與 `http://.../dir/` 實際回傳內容，確認解析器面對的真實格式。若 `file://` 在 service worker 不可行，fallback：由 content script 直接 `fetch` 相對路徑（`file://` 頁面 + 「允許存取檔案網址」權限下驗證可行性）。Spike 結論記入 commit message。

## Obsidian 語法支援清單

| 語法                                | 行為                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `![[img.png]]`、`![[img.png\|300]]` | 渲染為 `<img>`；`\|300` 作為寬度；路徑 URL 編碼、相對於目前檔案                                                                                     |
| `[[note]]`、`[[note\|別名]]`        | 轉為指向 `note.md` 的連結（無副檔名自動補 `.md`）                                                                                                   |
| `![[note]]`（筆記嵌入）             | 不做轉引用（transclusion），退化為醒目連結；未來可再議                                                                                              |
| `%%註解%%`                          | 渲染時移除（行內與跨行）                                                                                                                            |
| `> [!note]` 等 callout              | 型別映射到既有 `@mdit/plugin-alert`（NOTE/TIP/IMPORTANT/WARNING/CAUTION）；未知型別退化為 note 樣式；若使用者停用 Alert 插件則退化為一般 blockquote |
| `==螢光==`                          | 既有 markdown-it-mark 已支援，不需實作                                                                                                              |
| YAML front matter                   | 文件開頭 `---` 區塊渲染為摺疊的中繼資料表格（對齊商店版 3.6.23 行為）                                                                               |

判斷嵌入目標為圖片的依據：副檔名 `.png/.jpg/.jpeg/.gif/.svg/.webp/.bmp`（大小寫不拘）。

## UI 與設定

- 側邊欄頂部新增「大綱 / 檔案」頁籤切換；沿用既有側邊欄收合/展開機制與 RWD 行為。
- popup 設定頁新增兩個開關：「資料夾目錄」「Obsidian 語法」，預設皆開啟。
- 設定經 `chrome.storage` 走既有機制；「Obsidian 語法」掛在 `mdPlugins` 上，沿用 `updateMdPlugins` 即時重渲染；「資料夾目錄」開關即時顯示/隱藏檔案頁籤。

## 錯誤處理

- 目錄抓取失敗（403/404、無 autoindex、file:// 不可讀、逾時）：檔案頁籤顯示一行說明文字（如「此伺服器未開放目錄列表」），不顯示壞掉的樹。
- 解析器回空清單時走同一條說明訊息。
- 展開單一節點失敗只影響該節點（顯示重試），不拖垮整棵樹。

## 測試

1. **單元測試**：`dir-listing` 解析器——nginx/Apache/IIS/Chrome file 四種真實樣本 HTML 作 fixture。
2. **快照測試**：obsidian 插件各語法輸入 → HTML 輸出。
3. **手動驗收**：`example/` 資料夾分別以 `python3 -m http.server`（autoindex）與 `file://` 開啟實測：樹的初始渲染、懶加載展開、`../` 導覽、目前檔案高亮、Obsidian 各語法渲染、popup 開關即時生效、離線（斷網）環境全功能可用。

## Git 流程

- 分支：`feature/folder-tree-obsidian`。
- Commit 粒度（依序）：spike 結論 → dir-listing 解析器 + 測試 → file-tree UI → 側邊欄頁籤整合 → obsidian 插件 + 測試 → popup 設定 → 收尾（文件、版本）。
- 每個 commit message 包含：動機（why）、變更摘要、影響範圍。

## 非目標（YAGNI）

- 不做筆記轉引用（transclusion）、不做 `#tag`、不做 Obsidian graph。
- 不做樹狀態持久化、不做全站遞迴預抓。
- 不支援無 autoindex 伺服器的目錄探索（顯示說明訊息即可）。
- 不做 SPA 式無刷新切換文件。
