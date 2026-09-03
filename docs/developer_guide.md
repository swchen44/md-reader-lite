# Developer Guide

## 隱私原則（Privacy by default）

零網路（zero network）是本專案最高指導原則，優先於功能便利性——但「零網路」指的是**頁面載入當下不發出任何請求**，不是「功能預設隱藏」。`folderTree` 與另外兩個會觸及網路的設定在 `src/core/data.ts` 的 `getDefaultData()` 中：

| 設定            | 預設值  | 觸發的網路行為                                                                                                                                                                                                                                                                                    |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `folderTree`    | `true`  | 只決定「檔案」頁籤**顯不顯示**；fetch 仍是懶載入，只在使用者主動點開該頁籤才觸發——列出目前文件所在資料夾（同伺服器），或於 raw.githubusercontent.com 頁面匿名呼叫 GitHub 公開 API。file:// 場景額外受瀏覽器原生 File System Access 權限把關（見下方「本機載入與驗收」），與此設定無關、也無法繞過 |
| `refresh`       | `false` | 定時重新抓取目前這份文件的同一 URL，偵測內容變更                                                                                                                                                                                                                                                  |
| `charsetCompat` | `false` | 僅 file://；由 background Service Worker 重新 fetch 同一本機檔並強制 UTF-8 解碼                                                                                                                                                                                                                   |

程式實際會發出的網路請求就只有以上三種，沒有第四種。**`folderTree` 2026-09-03 起預設 `true`**：先前預設 `false` 是把「檔案」頁籤的可見性也當成隱私閘門，但頁籤可見與否從不影響是否發出請求（`ensureFilesPanel()` 只在 `activateTab('files')`——也就是使用者真的點擊頁籤——時才呼叫 `initFilesContent()`），所以隱藏頁籤對隱私沒有保護作用，只是徒增摩擦（尤其 `file://` 場景：本機讀檔本就零網路，卡在「先去設定裡開開關」純屬多餘的一層阻礙，使用者已透過瀏覽器原生 FSA 授權把關過一次）。`refresh`／`charsetCompat` 兩者是「使用者尚未表態就會主動發出請求／重讀檔案」的行為，維持 opt-in 預設關閉。

擴充功能沒有任何後端伺服器、不做分析／遙測／錯誤回報、不產生或傳送裝置 ID 或任何識別碼。新增功能或修改預設值前，先確認是否會影響這張表；若某功能會發出網路請求，預設必須為關閉，並同步更新 README.md 的「Privacy — our defining feature」段與 PRIVACY.md。

### 離線模式（offlineMode）——五處 egress 閘門

`offlineMode`（`src/core/data.ts` `getDefaultData()`）**預設 `true`**，是凌駕上表個別開關之上的總開關：開啟時強制封鎖擴充自身可能發出的所有對外請求，不管上表三個設定個別是否被使用者打開。落點：

| #   | 站點              | 檔案                                                    | 閘門機制                                                                                                                                                                                                                                                                                                 |
| --- | ----------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 自動刷新          | `src/main.ts`（`polling`/`toggleRefresh`）              | `configData.refresh && isNetworkAllowed(configData.offlineMode)` 才 `polling()`                                                                                                                                                                                                                          |
| 2   | http/https 目錄樹 | `src/main.ts`（`initFilesContent`）                     | `fetchDirListing` probe 前守門，離線時不 fetch                                                                                                                                                                                                                                                           |
| 3   | GitHub API 目錄樹 | `src/main.ts`（`initFilesContent`）                     | `parseRawUrl` 分支前守門，離線時不呼叫 GitHub API                                                                                                                                                                                                                                                        |
| 4   | PlantUML img      | `src/core/plantuml.ts`（`canRenderPlantuml`）           | `!!enabled && !offlineMode && !!server`——唯一實作，`main.ts` 直接呼叫、不 inline 重寫條件；離線時不 emit `<img src=遠端>`                                                                                                                                                                                |
| 5   | 文件內遠端資源    | `src/plugins/remote-guard.ts`（`blockRemoteResources`） | `contentRendered` 後對渲染容器廣查 `img,video,audio,source,iframe,embed,track,object,image,input[type="image"]`，逐屬性（`src`/`srcset`/`poster`/`data`/`href`/`xlink:href`）以 `isRemoteUrl` 判定為遠端者，移除屬性、原值存 `data-blocked-<attr>`、加 `md-reader__blocked-remote` class（涵蓋追蹤像素） |

`isNetworkAllowed(offlineMode)`（`src/core/network.ts`）是站點 1-4 的共用純函式（`!offlineMode`）。站點 5 掃的是渲染後 DOM 而非 markdown 源，故同時涵蓋 image rule 產生的 `<img>` 與 raw HTML。**本機 `file://` 功能不受離線模式影響**（FSA 資料夾樹、`charsetCompat`、dir-fetch 的 `file://` XHR 分支）——讀本機磁碟本就是零 egress，離線模式故意不封鎖。`offlineMode` 屬 reload 類設定（`background.ts` actionMap 映射 `'applySetting'`，切換後 `main.ts` 重整頁面套用五處閘門）。

**誠實揭露的殘留缺口**：站點 5 的清掃鎖定元素屬性，不掃 CSS——inline `style="background-image:url(http)"`、`<style>`/`@import url()`、`<use xlink:href>`、legacy `background` 屬性不在涵蓋範圍（markdown 內容中極罕見）。對外文案（README/PRIVACY）措辭須為「封鎖文件內遠端圖片與媒體」，不可宣稱「封鎖一切遠端引用」。

### PlantUML——唯一的網路 opt-in 內容外送功能

`plantumlEnabled`（預設 `false`）與 `plantumlServer`（預設 `https://www.plantuml.com/plantuml`，可自架）在 `src/core/data.ts`。`src/plugins/plantuml.ts` 在 `canRenderPlantuml(...)` 為真時才 emit `<img src="<server>/svg/<plantuml-encoder.encode(源碼)>">`——emit `img src` 本身即是網路請求（瀏覽器載入圖片時發出），故必須只在 allowed 時 emit。PlantUML 是本專案**唯一**會把文件內容（圖表原始碼）送到第三方伺服器的功能：需使用者主動開啟，且 `offlineMode` 開啟時無論 `plantumlEnabled` 為何一律強制停用。修改此邏輯前務必意識到它是「內容外送」而非單純「metadata 請求」，風險層級高於折疊上表三項。

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

測試分兩層，目錄即分類：

| 目錄          | 類型                 | 執行                | CI    | 依賴                          |
| ------------- | -------------------- | ------------------- | ----- | ----------------------------- |
| `tests/unit/` | 單元（純函式）       | `npm run test:unit` | ✅ 有 | 無（Node 內建 `node --test`） |
| `tests/e2e/`  | 端對端（真實瀏覽器） | `npm run test:e2e`  | ❌ 無 | Playwright + headed Chromium  |

指令：

    npm test            # = test:unit，跑 tests/unit/ 全部（190 條）
    npm run test:unit   # node --test tests/unit/*.test.mjs
    npm run test:e2e    # 需先 npm run build；載入 extension/ 進真實瀏覽器
    npm run typecheck   # tsc --noEmit

### 單元測試（tests/unit/）

純函式測試，直接 `import` .ts（依賴 Node type stripping）。import 用 `#core/*`（package.json `imports` 映射）或相對 `../../src/...`。**CI（release.yml）跑 `tests/unit/*.test.mjs` 全部**——新增測試檔放進 `tests/unit/` 即自動納入 CI，不需改 workflow。

坑：`node --test tests/unit/`（目錄模式）在本 repo 會誤判失敗；用 `tests/unit/*.test.mjs`（glob 展開為檔案清單）才對。

當一個模組的 `@/` 別名依賴鏈太深（例如同時拉進 `@/config/*`、多層 core 互 import），不值得為了測一兩個純函式而改動 production import 佈線時，改**在測試檔內鏡射（mirror）那段純邏輯**（見 `graphviz.test.mjs`／`plantuml-plugin.test.mjs`／`file-tree.test.mjs`／`commands.test.mjs` 開頭註解）——鏡射範圍務必極小、逐字對照來源，且註解寫明「鏡射自何處」以防日後漂移。`tests/unit/manifest.test.mjs` 額外驗證 `src/manifest.json` 的 match pattern 結構合法性與零權限姿態（`permissions` 不得多出 `host_permissions`）——這是 2026-09-03 事故（見 lesson_learn.md #11）的迴歸守衛，但**此測試只驗證 Chrome 官方文件描述的通用 match-pattern 文法，不保證 `web_accessible_resources` 會接受**（實測發現 WAR 驗證比 content_scripts 更嚴格、且確切額外限制未完全隔離出來）；日後要再收窄 WAR matches，測試通過後仍須以 Chrome 實際載入驗證。

### 端對端測試（tests/e2e/）

把**建置後的**未封裝擴充（`extension/`）載入真實 Chromium，用真實滑鼠點擊驅動——能抓到單元測試測不到的 CSS／點擊 bug（例如 v1.5.1 的 SMUI 開關點不動、設定浮層 iframe 內控件是否真的可操作）。共用夾具在 `tests/e2e/_harness.mjs`（起 md http server、launch 帶擴充的瀏覽器、storage helper）；驗收流程在 `tests/e2e/*.e2e.mjs`。

**不進 CI**：載入 MV3 擴充需 headed／new-headless 瀏覽器，CI 的純 headless runner 不支援（要進 CI 需自備 xvfb 或 new-headless + service worker 就緒等待）。**Playwright 刻意不列入 `package.json` devDependencies**，以免破壞 CI 的 `pnpm install --frozen-lockfile`；本機自行安裝：

    pnpm add -D playwright   # 或全域安裝；本 repo 上層 node_modules 已有時亦可直接跑
    npm run build && npm run test:e2e

瀏覽器或 Playwright 不可用時，e2e 會在 `before` 掛鉤捕捉並整組 **skip**（不硬性失敗）。

坑：headed 瀏覽器偶爾啟動卡住——**若自動化瀏覽器無故 hang，先懷疑 `extension/manifest.json` 無效**（無效的 `web_accessible_resources` match pattern 會讓擴充載入失敗、Chrome 一開就卡，表象像環境壞掉）。手動 `chrome://extensions → 載入未封裝項目` 會跳出真正的錯誤對話框（見 lesson_learn.md）。

> **新增功能時**：碰網路/隱私的邏輯補 `tests/unit/`（可 CI 把關）；碰 popup／頁內 UI／點擊行為的補 `tests/e2e/`（本機驗收）。

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
