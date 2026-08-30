# 設計文件（案 A）：改名 md-reader-lite、上架準備、Roadmap 與架構邊界

日期：2026-08-30
基底：本地 main（已含資料夾目錄樹 + Obsidian 語法，2026-08-30 合併）
分支：`feature/rebrand-lite`

## 背景與動機

本專案 fork 自開源 md-reader 2.12.12 並已加入自製功能。計畫上架 Chrome Web Store，須避免與原作（商店現有 Markdown Reader 3.x）名稱與品牌衝突；同時為後續兩案（規格對齊、FSA 目錄樹）與未來 PWA 衍生專案奠定文件與架構基礎。

本輪整體拆為三案：**案 A（本文件）** → 案 B（GitHub/Obsidian markers 規格對齊 + conformance 測試）→ 案 C（File System Access API 的 file:// 完整目錄樹）。案 B、C 屆時各自出 spec。

## 需求

1. 全套品牌替換為 **MD Reader Lite**（package 名 `md-reader-lite`），可上架 Chrome Web Store。
2. 上架材料一併產出（隱私權政策、商店描述、權限理由、截圖）。
3. 輕量架構邊界整理：圈出無 `chrome.*` 依賴的可攜渲染核心，為 PWA 衍生留路；不拆 package、不換 build 工具。
4. Roadmap 文件涵蓋案 B、案 C 與 PWA 願景。
5. `docs/` 標準文件組：`developer_guide.md`、`plans.md`、`designs.md`、`lesson_learn.md`、`research/` 子目錄（研究型文章置此、檔名達意）。
6. Git 紀律：每一筆邏輯改動獨立 commit，訊息含 **Why / What / How / Boundary（影響範圍）** 四段。

## 1. 品牌替換

| 項目           | 內容                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 顯示名稱       | `MD Reader Lite`（各語系 locale 的 `ext_name`；`_locales/*/messages.json` 全部更新，`ext_desc` 同步重寫）                                                                        |
| package.json   | `name: md-reader-lite`、`version: 1.0.0`、`author: swchen44`、`repository/homepage/bugs` 改指 `https://github.com/swchen44/md-reader-lite`                                       |
| manifest       | `version` / `version_name` 由 manifest 建置腳本自 package.json 帶入（重置 1.0.0）；name/description 走 i18n key                                                                  |
| 圖示           | 新設計 logo（與原作視覺區隔：不同配色與字符構圖），SVG 原稿產出 16/32/48/128/512 PNG，取代 `src/images/logo-stroke.png` 全部引用點                                               |
| 移除原作者外連 | `background.ts` 的 `setUninstallURL(...)` 整段移除；popup `Header` 的 homepage 連結改指新 repo；README 重寫（保留 attribution，移除微信群/原官網/原商店徽章）                    |
| 授權合規       | 保留原 `LICENSE`（MIT）與原作者版權行，其上追加 `Copyright (c) 2026 swchen44`；README 開頭註明「Forked from [md-reader](https://github.com/md-reader/md-reader) by Bener (MIT)」 |
| 內部識別       | CSS class 前綴 `md-reader__`、storage key 等內部識別**不改**（無對外可見性，避免無謂 churn 與設定遺失）                                                                          |

## 2. 自有 repo 與上架材料

- 建立 GitHub repo `swchen44/md-reader-lite`（public）。本地 remote 調整：`origin` → 新 repo，原上游改名 `upstream`。推送 main。
  - 前置注意：目前本地 main 已領先上游 22+ commits，改 remote 前不得對舊 origin push。
- `PRIVACY.md`（英文為主、附中文摘要）：零資料蒐集——渲染全在本地、設定僅存 `chrome.storage.local`、無遙測、無外部請求；隱私權政策 URL 用該檔的 GitHub 網址。
- `docs/store-listing.md`：
  - 中英文商店描述（短述 + 詳述）
  - 單一用途聲明：Render local and online Markdown files as readable pages
  - 權限理由書（審核重點）：`host_permissions *://*/*`（讀取使用者開啟的 md 檔與同目錄列表）、`storage`（設定）、file URL 存取（本地 md 檔）、`activeTab`
- 截圖：以 agent-browser 對 `example/obsidian-demo.md` 等頁面產出 1280×800 PNG ≥3 張（亮/暗主題、目錄樹、popup），存 `docs/store-assets/`。
- 上架動作本身（付 $5 開發者註冊費、送審）由使用者手動執行；本案交付到「材料齊備可送審」。

## 3. 輕量架構邊界（core / shell）

- 動作 (a)：`src/core/dir-listing.ts` 拆為兩檔——純解析（`parseDirListing`/`isMarkdownFile`/`DirEntry`，零 chrome 依賴）留原檔；`fetchDirListing`（chrome.runtime 訊息 + XHR fallback）移到新檔 `src/core/dir-fetch.ts`。引用點（`file-tree.ts`）與測試 import 路徑同步修正。
- 動作 (b)：`docs/ARCHITECTURE.md` 定義兩層：
  - **core（可攜層，未來 PWA 直接複用）**：`core/markdown.ts`、`core/graphviz.ts`、`plugins/obsidian.ts`、`plugins/alert.ts`、`plugins/graphviz-block.ts`、`config/md-plugins.ts`、`core/dir-listing.ts`（純解析）、主題（`@md-reader/theme`）
  - **shell（extension 專屬）**：manifest、background、content script 掛載（main.ts）、popup、`core/dir-fetch.ts`、`core/file-tree.ts`、storage
  - 約定：core 層檔案不得 import `chrome`（在 ARCHITECTURE.md 明文，並以 `grep -rn "chrome" <core 檔案清單>` 作為驗收檢查；不引入 lint 工具鏈變更）
- 明確非目標：不拆 monorepo/package、不改 webpack、不重寫任何渲染邏輯。

## 4. 文件組

```
docs/
  developer_guide.md   # 環境需求、corepack pnpm 安裝、建置/測試/打包指令（含本 repo 的坑：
                       #   node --test 需指定檔案、pnpm build 勿用、npm_package_version 環境變數）、
                       #   載入未封裝擴充與 agent-browser 驗收流程
  plans.md             # 實作計畫索引：連結 docs/superpowers/plans/*（案別、狀態、日期）
  designs.md           # 設計文件索引：連結 docs/superpowers/specs/*（案別、狀態、日期）
  ARCHITECTURE.md      # core/shell 邊界（見上節）
  ROADMAP.md           # 見下節
  lesson_learn.md      # 教訓紀錄，先收錄：Chrome MV3 禁 file:// 程式化讀取（SW fetch/CS XHR 皆擋）、
                       #   伺服器缺 charset 導致 Big5/GBK 誤判、%% 全域 regex 破壞 Mermaid 的修復始末、
                       #   pnpm 11 onlyBuiltDependencies 位置、Chrome 137+ stable 移除 --load-extension（改用 Chrome for Testing）
  store-listing.md     # 上架材料（見第 2 節）
  store-assets/        # 商店截圖
  research/            # 研究型文章；本案先放：
    2026-08-30-chrome-mv3-file-url-access-restrictions.md   # file:// spike 結論整理（自驗收報告抽出）
  superpowers/         # 既有 specs/plans 目錄維持不動（由 plans.md/designs.md 索引）
```

- `plans.md`/`designs.md` 為**索引檔**：一列一案（名稱、日期、狀態、連結），詳文仍在 `docs/superpowers/` 下，避免搬移破壞既有連結。
- 未來研究型產出（如案 C 的 FSA spike 報告）一律進 `docs/research/`，檔名格式 `YYYY-MM-DD-<主題-達意-kebab>.md`。

## 5. Roadmap（docs/ROADMAP.md 內容大綱）

1. **v1.0（案 A）**：改名上架準備 ✅（本案）
2. **v1.1（案 B）**：規格對齊——依 2026-08-30 規格研究文件的兩份 checklist 補齊 GitHub/Obsidian markers（wikilink 標題/區塊連結、行內腳註、`#tag`、可摺疊 callout、自訂任務狀態等，屆時 spec 定案）；引入 CommonMark/GFM spec.txt conformance 測試 harness 與 Obsidian fixture 對照
3. **v1.2（案 C）**：File System Access API 的 file:// 完整目錄樹（先 spike：content script 於 file:// 頁的 `showDirectoryPicker` 可用性、handle 於 IndexedDB 的持久化與重授權流程）
4. **v2.x（衍生專案）**：PWA/Web 版免安裝閱讀器——複用 core 層（產品形態參考 [md-viewer-pwa](https://github.com/TriptoAfsin/md-viewer-pwa)：drop zone、分頁、離線 PWA），技術棧屆時另定；上架後維護策略（版號、上游 sync 政策）

## Git 紀律（本案起全案適用）

- 一筆邏輯改動 = 一個 commit（品牌名稱、圖示、README、repo/remote、隱私政策、dir-listing 拆檔、各文件……各自獨立）。
- Commit message 格式：

  ```
  <type>: <subject>

  Why: <動機>
  What: <改了什麼>
  How: <關鍵作法（非顯而易見時）>
  Boundary: <影響範圍/不影響什麼>
  ```

  結尾維持 Co-Authored-By 與 Claude-Session trailers。

## 錯誤處理與風險

- 商店名稱可用性：送審時若 `MD Reader Lite` 撞名，備援名 `MD Lite Reader`、`Markdown Lite Viewer`（僅改 locale 的 `ext_name`，一個 commit 可換）。
- 版號重置後，若未來想 sync 上游，以 `upstream` remote cherry-pick，版號策略記在 ROADMAP。
- 圖示替換遺漏點：以 `grep -rn "logo" src build scripts` 全面盤點引用。

## 測試與驗收

1. 全測試綠（30 條）+ `tsc --noEmit` + 完整建置打包出 `dist/md-reader-lite-1.0.0.zip`（zip 腳本檔名隨 package name 變）。
2. dir-listing 拆檔後：既有 6 條解析測試改 import 路徑後照過；`grep` 驗證 core 清單零 chrome 引用。
3. 瀏覽器實測（Chrome for Testing + agent-browser）：新名稱與新圖示顯示、popup 連結指新 repo、解除安裝不再開啟原作者頁面、功能無回歸（渲染/目錄樹/設定）。
4. 文件驗收：docs 六件套 + PRIVACY.md + store-listing 齊備，plans.md/designs.md 索引涵蓋既有兩案與本案。

## 非目標（YAGNI）

- 不實際執行商店送審（使用者手動）。
- 不拆 package/monorepo、不動 build 工具鏈、不改內部 class 前綴與 storage key。
- 不在本案做案 B/C 的任何功能實作。
