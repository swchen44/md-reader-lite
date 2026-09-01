# Developer Guide

## 隱私原則（Privacy by default）

零網路（zero network）是本專案最高指導原則，優先於功能便利性。全部三個會觸及網路的設定，預設值皆在 `src/core/data.ts` 的 `getDefaultData()` 中定為關閉：

| 設定            | 預設值  | 觸發的網路行為                                                                                                                    |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `folderTree`    | `false` | 開啟且切到「檔案」頁籤時才懶載入：列出目前文件所在資料夾（同伺服器），或於 raw.githubusercontent.com 頁面匿名呼叫 GitHub 公開 API |
| `refresh`       | `false` | 定時重新抓取目前這份文件的同一 URL，偵測內容變更                                                                                  |
| `charsetCompat` | `false` | 僅 file://；由 background Service Worker 重新 fetch 同一本機檔並強制 UTF-8 解碼                                                   |

程式實際會發出的網路請求就只有以上三種，沒有第四種。頁面載入當下（預設設定）不會發出任何請求——目錄樹的 fetch 是懶載入，只在使用者主動點開「檔案」頁籤才觸發；`folderTree` 預設 `false` 時該頁籤根本不會顯示。三者皆為 opt-in，使用者需自行在設定中開啟。

擴充功能沒有任何後端伺服器、不做分析／遙測／錯誤回報、不產生或傳送裝置 ID 或任何識別碼。新增功能或修改預設值前，先確認是否會影響這張表；若某功能會發出網路請求，預設必須為關閉，並同步更新 README.md 的「Privacy — our defining feature」段與 PRIVACY.md。

## 環境需求

- Node ≥ 22（本 repo 以 Node 26 驗證；測試直接 import .ts，依賴 type stripping）
- pnpm：不需全域安裝，用 `corepack pnpm <cmd>`
- macOS 註：本 repo 的圖示轉檔流程用 Chrome for Testing + sips

## 安裝

    corepack pnpm install

（postinstall 白名單在 pnpm-workspace.yaml 的 onlyBuiltDependencies）

## 建置與打包

    export npm_package_version=<version> npm_package_name=md-reader-lite
    node ./scripts/manifest.mjs
    node_modules/.bin/webpack --config ./build/webpack.prod.js
    node ./scripts/zip.mjs        # 產出 dist/md-reader-lite-<version>.zip

未壓縮輸出在 extension/。
坑：`corepack pnpm build` 的 deps 檢查在部分環境會失敗，直接用上面三步。

## 測試

    node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs
    node_modules/.bin/tsc --noEmit

坑：`node --test tests/`（目錄模式）在本 repo 會誤判失敗，一律指定檔案。

## 本機載入與驗收

1. Chrome 137+ stable 已移除 --load-extension；自動化驗收用 Chrome for Testing：
   "<CfT path>" --user-data-dir=/tmp/prof --load-extension=$PWD/extension --remote-debugging-port=9333
2. 手動：chrome://extensions → 開發人員模式 → 載入未封裝項目 → extension/
3. file:// 測試需開「允許存取檔案網址」
4. 內網/驗收伺服器務必送 charset=utf-8（見 lesson_learn.md）

## 鍵盤快捷鍵

`src/manifest.json` 的 `commands` 四項，經 `src/background.ts` 掛 `chrome.commands.onCommand` 呼叫 `src/core/commands.ts` 對應處理函式：

| 快捷鍵      | 功能                                         |
| ----------- | -------------------------------------------- |
| Alt+Shift+B | 側欄顯示/隱藏                                |
| Alt+Shift+C | 內容居中切換                                 |
| Alt+Shift+R | 自動刷新切換                                 |
| Alt+Shift+T | 主題三態循環（`auto → light → dark → auto`） |

## 字元集相容模式

僅影響 file:// 頁面（`charsetCompat`）。開啟後由 background Service Worker 以 `fetch()` 重新抓取當前檔案並強制以 UTF-8 重新解碼，解決 Chrome 頁面層對大型 CJK 純文字檔的編碼誤判（無 BOM 時常被啟發式猜成 Big5/GBK 等而亂碼）。

需求：瀏覽器擴充功能設定需先開啟「允許存取檔案網址」授權（同「本機載入與驗收」步驟 3），否則 SW 無法對 file:// URL 發出 fetch。安全模型採精確 URL 比對（`senderUrl === targetUrl`）：SW 只重新抓取請求方當前所在的同一份檔案，不比對同源（file:// 的 origin 恆為常數字串、無區辨力），藉此擋下任意 file:// 路徑被讀取（file-disclosure）。

`charsetCompat` 屬 reload 類設定，切換後會重新整理頁面以套用新的解碼模式。

## 文件地圖

- 設計文件索引：designs.md ／ 實作計畫索引：plans.md
- 架構邊界：ARCHITECTURE.md ／ 路線圖：ROADMAP.md
- 教訓：lesson_learn.md ／ 研究文章：research/
- Commit 訊息格式：Why / What / How / Boundary 四段（見 git log 範例）

## 發佈（Release）

打 tag 即自動發佈：`git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z` → GitHub Actions（.github/workflows/release.yml）建置、跑測試、打包並建立附 zip 的 Release。手動觸發（workflow_dispatch）為乾跑：只建置與上傳 artifact，不發佈。tag 版本號（去掉 v）會寫入 manifest；打 tag 前記得同步 package.json 的 version。
