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

### 離線模式（offlineMode）——四處 egress 閘門

`offlineMode`（`src/core/data.ts` `getDefaultData()`）**預設 `true`**，是凌駕上表個別開關之上的總開關：開啟時強制封鎖擴充自身可能發出的所有對外請求，不管上表三個設定個別是否被使用者打開。落點：

| #   | 站點              | 檔案                                                    | 閘門機制                                                                                                                                                                                                                                                                                                 |
| --- | ----------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 自動刷新          | `src/main.ts`（`polling`/`toggleRefresh`）              | `configData.refresh && isNetworkAllowed(configData.offlineMode)` 才 `polling()`                                                                                                                                                                                                                          |
| 2   | GitHub API 目錄樹 | `src/main.ts`（`initFilesContent`）                     | `parseRawUrl` 分支前守門，離線時不呼叫 GitHub API（`raw.githubusercontent.com` → `api.github.com`，不同主機）                                                                                                                                                                                            |
| 3   | PlantUML img      | `src/core/plantuml.ts`（`canRenderPlantuml`）           | `!!enabled && !offlineMode && !!server`——唯一實作，`main.ts` 直接呼叫、不 inline 重寫條件；離線時不 emit `<img src=遠端>`                                                                                                                                                                                |
| 4   | 文件內遠端資源    | `src/plugins/remote-guard.ts`（`blockRemoteResources`） | `contentRendered` 後對渲染容器廣查 `img,video,audio,source,iframe,embed,track,object,image,input[type="image"]`，逐屬性（`src`/`srcset`/`poster`/`data`/`href`/`xlink:href`）以 `isRemoteUrl` 判定為遠端者，移除屬性、原值存 `data-blocked-<attr>`、加 `md-reader__blocked-remote` class（涵蓋追蹤像素） |

`isNetworkAllowed(offlineMode)`（`src/core/network.ts`）是站點 1-3 的共用純函式（`!offlineMode`）。站點 4 掃的是渲染後 DOM 而非 markdown 源，故同時涵蓋 image rule 產生的 `<img>` 與 raw HTML。**本機 `file://` 功能不受離線模式影響**（本機目錄列表 frame-probe／FSA 備援、`charsetCompat`、dir-fetch 的 `file://` XHR 分支）——讀本機磁碟本就是零 egress，離線模式故意不封鎖。`offlineMode` 屬 reload 類設定（`background.ts` actionMap 映射 `'applySetting'`，切換後 `main.ts` 重整頁面套用四處閘門）。**同伺服器 http(s) 目錄列表（`initFilesContent` 的非 GitHub、非 file:// 分支）2026-09-03 起不受離線模式限制**，因此不在本表：載入目前文件本身已是對該伺服器的一次請求，使用者主動瀏覽同伺服器目錄清單是既有信任關係的延伸，不是新增暴露面（見 `docs/superpowers/specs/2026-09-03-file-tree-browsing-design.md` 項目 4）。**`content_scripts` 的 file:// 目錄頁注入範圍（同日起）**：`manifest.json` 新增一則 `{ matches: ["file://*/*/","file:///"], all_frames: true }` 條目，讓我們的程式碼會被 Chrome 注入到**使用者瀏覽的任何本機 file:// 資料夾頁面**（不限含 markdown 檔的資料夾），供隱藏 iframe 探測 Chrome 原生目錄列表格式所用（取代 File System Access 授權彈窗）。這是「程式碼在哪裡執行」的實質擴大，但不是新增權限；既有的 `main()` content-type 閘門保證除了我們自己建立、帶特定 URL hash 標記的探測 iframe 外，一律 no-op（無 UI、無副作用）。**已知殘留風險（最終審查發現，2026-09-03）**：這個 `all_frames` 條目會在**任何**符合 pattern 的 file:// frame 內執行，不限本擴充自己建立的 iframe。不受信任的本機 HTML 檔可自建 iframe 指向使用者的任意資料夾（帶我們的探測 hash），我們的內容腳本會如常解析並 `postMessage` 回其 `window.parent`——若該 parent 是惡意頁面而非我們自己的頁面，等於替它取得目錄清單（檔名/大小/mtime，不含檔案內容，不經網路）。因 file:// 頁面的 `event.origin` 恆為 `"null"`，無法用 origin 做來源限制；random nonce 也無法解決，因為攻擊者頁面能直接複製我們公開原始碼裡的 hash 樣式自建 iframe，不需要猜任何祕密。目前僅能誠實揭露（已寫入 `PRIVACY.md`/`README.md`），無乾淨的技術修法；徹底解決需要另一種完全不同的機制（不用 `all_frames`），屬未來架構題目，不在本次範圍。

**誠實揭露的殘留缺口**：站點 4 的清掃鎖定元素屬性，不掃 CSS——inline `style="background-image:url(http)"`、`<style>`/`@import url()`、`<use xlink:href>`、legacy `background` 屬性不在涵蓋範圍（markdown 內容中極罕見）。對外文案（README/PRIVACY）措辭須為「封鎖文件內遠端圖片與媒體」，不可宣稱「封鎖一切遠端引用」。

### PlantUML——唯一的網路 opt-in 內容外送功能

`plantumlEnabled`（預設 `false`）與 `plantumlServer`（預設 `https://www.plantuml.com/plantuml`，可自架）在 `src/core/data.ts`。`src/plugins/plantuml.ts` 在 `canRenderPlantuml(...)` 為真時才 emit `<img src="<server>/svg/<plantuml-encoder.encode(源碼)>">`——emit `img src` 本身即是網路請求（瀏覽器載入圖片時發出），故必須只在 allowed 時 emit。PlantUML 是本專案**唯一**會把文件內容（圖表原始碼）送到第三方伺服器的功能：需使用者主動開啟，且 `offlineMode` 開啟時無論 `plantumlEnabled` 為何一律強制停用。修改此邏輯前務必意識到它是「內容外送」而非單純「metadata 請求」，風險層級高於折疊上表三項。

## 環境需求

- Node ≥ 22.12.0（本 repo 以 Node 26 驗證；測試直接 import .ts，依賴 type stripping）
- pnpm：不需全域安裝，用 `corepack pnpm <cmd>`
- macOS 註：本 repo 的圖示轉檔流程用 Chrome for Testing + sips

## 安裝

    corepack pnpm install

（postinstall 白名單在 pnpm-workspace.yaml 的 onlyBuiltDependencies）

## 建置與打包

    export npm_package_version=<version> npm_package_name=md-reader-lite
    node ./scripts/manifest.mjs
    node_modules/.bin/webpack --config ./build/webpack.prod.js
    node ./scripts/notices.mjs    # 從已安裝的 production inventory 收集原始授權文本
    node ./scripts/zip.mjs        # 產出 dist/md-reader-lite-<version>.zip

未壓縮輸出在 extension/。
坑：`corepack pnpm build` 的 deps 檢查在部分環境會失敗，直接用上面四步。`npm run build` 與 `.github/workflows/release.yml` 都包含 notices；zip 需包含 `THIRD_PARTY_NOTICES.txt` 與 `third-party-licenses.json`，不能只保留 minifier 的短版 legal comments。notices 是 production inventory 的授權文件集合，部分套件會被 tree-shake；這不是法律認證。缺少文件會使 build 失敗，勿跳過。`tests/unit/notices.test.mjs` 使用既有 lint-staged 工具鏈的 YAML parser 驗證 release 指令順序；本機建置／zip 已驗證，GitHub hosted workflow 本輪未觸發。

## 測試

測試分兩層，目錄即分類：

| 目錄          | 類型                 | 執行                | CI    | 依賴                          |
| ------------- | -------------------- | ------------------- | ----- | ----------------------------- |
| `tests/unit/` | 單元（純函式）       | `npm run test:unit` | ✅ 有 | 無（Node 內建 `node --test`） |
| `tests/e2e/`  | 端對端（真實瀏覽器） | `npm run test:e2e`  | ❌ 無 | Playwright + headed Chromium  |

指令：

    npm test            # = test:unit，跑 tests/unit/ 全部
    npm run test:unit   # node --test tests/unit/*.test.mjs
    npm run test:e2e    # 需先 npm run build；載入 extension/ 進真實瀏覽器
    npm run typecheck   # tsc --noEmit

### 單元測試（tests/unit/）

純函式測試，直接 `import` .ts（依賴 Node type stripping）。import 用 `#core/*`（package.json `imports` 映射）或相對 `../../src/...`。**CI（release.yml）跑 `tests/unit/*.test.mjs` 全部**——新增測試檔放進 `tests/unit/` 即自動納入 CI，不需改 workflow。

坑：`node --test tests/unit/`（目錄模式）在本 repo 會誤判失敗；用 `tests/unit/*.test.mjs`（glob 展開為檔案清單）才對。

當一個模組的 `@/` 別名依賴鏈太深（例如同時拉進 `@/config/*`、多層 core 互 import），不值得為了測一兩個純函式而改動 production import 佈線時，改**在測試檔內鏡射（mirror）那段純邏輯**（見 `graphviz.test.mjs`／`plantuml-plugin.test.mjs`／`file-tree.test.mjs` 開頭註解）——鏡射範圍務必極小、逐字對照來源，且註解寫明「鏡射自何處」以防日後漂移。`commands.test.mjs` 與 `background-routing.test.mjs` 已改為轉譯真正模組，只替換 Chrome／storage 邊界；用可控制的 Promise 延遲驗證訊息仍回到原分頁，不鏡射路由程式。`tests/unit/manifest.test.mjs` 額外驗證 `src/manifest.json` 的 match pattern 結構合法性與零權限姿態（`permissions` 不得多出 `host_permissions`）——這是 2026-09-03 事故（見 lesson_learn.md #11）的迴歸守衛，但**此測試只驗證 Chrome 官方文件描述的通用 match-pattern 文法，不保證 `web_accessible_resources` 會接受**（實測發現 WAR 驗證比 content_scripts 更嚴格、且確切額外限制未完全隔離出來）；日後要再收窄 WAR matches，測試通過後仍須以 Chrome 實際載入驗證。

### 端對端測試（tests/e2e/）

把**建置後的**未封裝擴充（`extension/`）載入真實 Chromium，用真實滑鼠點擊驅動——能抓到單元測試測不到的 CSS／點擊 bug（例如 v1.5.1 的 SMUI 開關點不動、設定浮層 iframe 內控件是否真的可操作）。共用夾具在 `tests/e2e/_harness.mjs`（起 md http server、launch 帶擴充的瀏覽器、storage helper）；驗收流程在 `tests/e2e/*.e2e.mjs`。

**不進 CI**：載入 MV3 擴充需 headed／new-headless 瀏覽器，CI 的純 headless runner 不支援（要進 CI 需自備 xvfb 或 new-headless + service worker 就緒等待）。**Playwright 刻意不列入 `package.json` devDependencies**，以免破壞 CI 的 `pnpm install --frozen-lockfile`；本機自行安裝：

    pnpm add -D playwright   # 或全域安裝；本 repo 上層 node_modules 已有時亦可直接跑
    npm run build && npm run test:e2e

部分舊 e2e 在瀏覽器或 Playwright 不可用時會在 `before` 掛鉤捕捉並整組 **skip**；新增的 Mermaid／settings 驗收會明確失敗。skip 不能算驗收通過。`test:e2e` 固定 `--test-concurrency=1`，避免多個 headed 擴充測試瀏覽器同時啟動而卡住。

坑：headed 瀏覽器偶爾啟動卡住——**若自動化瀏覽器無故 hang，先懷疑 `extension/manifest.json` 無效**（無效的 `web_accessible_resources` match pattern 會讓擴充載入失敗、Chrome 一開就卡，表象像環境壞掉）。手動 `chrome://extensions → 載入未封裝項目` 會跳出真正的錯誤對話框（見 lesson_learn.md）。

> **新增功能時**：碰網路/隱私的邏輯補 `tests/unit/`（可 CI 把關）；碰 popup／頁內 UI／點擊行為的補 `tests/e2e/`（本機驗收）。

## Mermaid 風格

「設定 → 插件 → 插件子選項 → Mermaid → Mermaid 風格」提供 Original 與 Anthropic blog style。儲存欄位為 `mdPluginOptions.Mermaid.style`，值為 `original` 或 `anthropic-blog`；新安裝、缺少此設定的舊版、未知值及 Reset to Defaults 皆採 Anthropic，明確儲存的 Original 保留不變。Original 隨頁面 light／dark／auto 使用既有 Mermaid 主題。Anthropic blog style 是本專案的編輯風格詮釋，固定使用淺色紙面與本機 serif fallback，即使頁面為 dark 也維持淺色圖表；不載入網路字型，也不代表 Anthropic 官方整合。

設定面板的 General／Appearance／Plugins 固定沿用同一個編輯風格，與圖表的風格切換及文章 CSS 客製化分開。tokens 在 `src/popup/index.css`；標題使用本機 serif、控制項使用本機 sans-serif、CSS editor 保留 monospace。SMUI 使用 `--mdc-theme-*` 和有範圍的 selector，不能縮小 switch 的 native checkbox。popup 與文章內 iframe 共用相同 UI；根節點 `lang` 隨設定語言更新。永久案例為 `tests/e2e/settings-theme.e2e.mjs`，截圖在 `dist/qa/settings-theme/`，涵蓋五語、320／360／390 px、三分頁、展開選單、新舊設定、重載與嵌入浮層。

選取後立即儲存並重繪目前分頁，保留閱讀錨點，圖表縮放回到初始狀態。其他已開文件於下次載入採用已儲存的選擇。此設定獨立於 CSS 客製化開關與 Developer／Editorial／User slots；文件作者的 `classDef`、`style`、`linkStyle` 與 Mermaid 支援的 init 指令保留優先順序。Markdown fences 與 `.mmd` 使用同一路徑，DOT 仍分流 Graphviz，PlantUML 的隱私閘門不變。

純設定解析在 `src/core/mermaid-style.ts`。`src/plugins/mermaid-block.ts` 同步產生安全跳脫的原碼 placeholder；`src/plugins/mermaid-renderer.ts` 逐圖非同步渲染，在 active generation 完成後發出 `diagramsRendered` 並重建搜尋。過期工作在佇列開始與回傳時檢查，錯誤保留原碼，不阻塞後圖。每張圖重新初始化設定；圓角只套用一般矩形，保留膠囊與明確圓角形狀。popup 的新選單以不可變更新避開 `app.svelte` 的物件身分去重；SMUI plugin chips 則在使用者選取綁定完成後複製陣列再儲存。請勿以原地修改巢狀設定或陣列的方式觸發這兩個儲存流程。

Mermaid 本體只載入本機 `mermaid-frame.html`。它和主程式使用獨立 webpack compilation，避免跨執行世界共用 chunk；production 與 dev 都要建置兩者。renderer-only CSP、結構化 HTML/CSS/config/flowchart metadata preflight、DOMPurify 與 SVG/CSS 清理共同限制資源。外部圖片、image nodes、資源 CSS 或不支援的 CSS 會拒絕並保留原碼；不新增權限、不下載字型、不降低 strict。這個政策適用 Mermaid，不代表文件中任意 raw HTML/CSS 的既有隱私缺口已消失。

metadata preflight 不限 Flowchart：固定版本的 classes／states／entities／requirements／blocks／nodes／edges，以及 C4 shapes／boundaries／relationships 都須檢查。所有圖種先取得 parsed diagram 再呼叫 render；探測 receipt 的 `preflightPassed` 可區分前置拒絕與輸出清理。HTML label 的 computed typography 在安全檢查後、隔離文件內保留，避免文章 `p !important` 改寫作者字型。Architecture 只重著色內建 80×80 圖示底板，保留白色圖案與 Original，作者 themeCSS 不被這個補色規則蓋掉。

pagehide 使用 suspended/page epoch 使保留 DOM 的工作失效並清除 frame；pageshow 重試仍有來源的未完成圖，不重畫已完成圖。`tests/unit/mermaid-plugin-lifecycle.test.mjs` 轉譯真正的 plugin 並替換瀏覽器邊界依賴，沒有鏡射 production 邏輯；瀏覽器案例另測合成的 page transition。實際 BFCache 命中與舊版 Chrome 仍是另行驗證的範圍。

永久情境與截圖規格見 [Mermaid Style Test Plan](superpowers/plans/2026-10-22-mermaid-styles.md#permanent-test-plan)。執行：

    node --test tests/unit/mermaid-style.test.mjs tests/unit/plugin-options.test.mjs
    npm run build
    node --test tests/e2e/mermaid-styles.e2e.mjs

截圖保存在忽略追蹤的 `dist/qa/mermaid-styles/`。瀏覽器不可用或測試被 skip 時，不能將 UI／視覺驗收記為通過。

升級的完整矩陣、安全、生命週期與效能規格以 [modernization plan](superpowers/plans/2026-10-23-mermaid-modernization.md) 為準。可重跑的 benchmark 與 baseline 建置方式在 [tests/perf/README.md](../tests/perf/README.md)，會保留原始樣本與 asset digest；五次冷啟動／十次暖重繪只報 median/max，不外推 p95。

### 圖種相容性

產品已移除舊 wrapper，固定 **Mermaid 12.2.0**，本機 ZenUML plugin **1.0.1**／core **3.50.1**。全部 **31 種**在兩種風格可渲染，372-output matrix 與最終回歸已完成；效能／體積增加、audit、原始樣本與限制在 [驗收與交接](research/2026-10-23-mermaid12-acceptance.md)。永久命令見 [migration plan/checklist](superpowers/plans/2026-10-23-mermaid-modernization.md)。歷史 9.1.6 的 11/31 實測保留於 [Mermaid 圖種相容性測試](research/mermaid-diagram-compatibility.md)，不可當作目前版本的支援清單。檢查頁為 `example/mermaid-compatibility.md`。

ZenUML 外掛本身的 parser 是 no-op。`src/core/mermaid/zenuml.js` 以固定版 core 的 stateless public parse method 補上語法錯誤檢查，不建立 React UI。升級 core 必須重跑 `tests/unit/zenuml.test.mjs` 與 `tests/e2e/mermaid-zenuml.e2e.mjs`；不能只用「產生了 SVG」當作語法正確。

    npm run build
    node --test tests/e2e/mermaid-compatibility.e2e.mjs

相容性測試直接核對已安裝版本與各圖支援清單，並等待 active generation 完成，不能只等待第一張 SVG。錯誤保留原碼；C4／ZenUML 的可渲染與完整風格驗收分開記錄。升級 Mermaid 必須同步 parser、資源政策、lifecycle 與期待結果。

[MV3 probe report](research/mermaid12-probe.md) 保留 raw strict 四個失敗及 A4 confined 25/25 通過證據。Probe 與產品共用 `src/core/mermaid/` 政策，仍保有獨立 lockfile 與 raw 對照。永久重測指令位於 probe README。TypeScript 固定 5.0.4 以解析新增 d3 const type parameters；`ignoreDeprecations: '5.0'` 僅相容既有 Svelte 3 base config，不代表已遷移整個工具鏈。

## 浮動側欄

側欄改為 overlay，文章不保留 sidebar padding；文章 `customWidth` 與側欄 `sideWidth` 互不影響。`setSideOpen` 統一桌面／手機開關、aria-expanded 與 inert，沿用 hiddenSide；窄頁首次載入仍收合。outside click 保留原事件，Escape 由搜尋先處理，不能在非 Escape 按鍵後遺失監聽。

把手使用 pointer capture、col-resize 游標及 touch-action:none，放開且寬度確實改變才記錄 sideWidth；只按放、拖曳及緊接的 click 不得觸發 dismiss 或覆寫桌面偏好。取消／失去 capture／blur／pagehide 復原原寬度及 selection/cursor。clampSideWidth 接受可選 viewport，實際顯示保留 112px 外部空間，避免側欄開關與 Menu 重疊；視窗縮小不改寫偏好。raw／print／收合必須關閉把手 hit area。五語 separator 支援方向鍵／Home／End，IME/defaultPrevented Escape 不關閉側欄。

FileTreeHandle.closeMenus 由側欄收起及 raw 切換呼叫，確保 portal 到 body 的排序子選單也移除；不能只對原側欄加 inert。背景快捷鍵於拖曳中到達時不切換浮層，並回存真正的開關狀態，避免畫面與下次載入不一致。

完整核准行為、永久 Test Plan、RED/GREEN／回歸 receipt 與交接位置見 [Floating Sidebar Test Plan](testing/floating-sidebar.md)。

## CSS 客製化與搜尋歷史

自訂寬度的新／缺少設定與 Reset 預設為 **85%**。`resolveCustomWidthDefaults` 將 `customWidth`／`customWidthUnit` 一起解析：已儲存的百分比、像素與 null 關閉狀態保留；舊版只有數值而沒有單位時視為 px，避免 900px 變成百分比。讀取不寫回 storage；`settings.test.mjs`、`settings-theme.e2e.mjs` 與 Mermaid reset 案例共同把關。

CSS 客製化與導覽搜尋歷史皆只存於 `chrome.storage.local`，不會增加網路請求。CSS 有兩個唯讀 preset（`editorial`、`developer`）與兩個可編輯欄位（`user1`、`user2`）。`customCssEnabled` 是實際注入 CSS 的開關；切換 preset 或編輯草稿本身不改變頁面，使用者按「套用」後才寫入 `customCss` 並生效。

新安裝由 `src/background.ts` 的 `chrome.runtime.onInstalled` 寫入 `customCssDefaultPreset: 'developer'`，因此預設啟用並套用 Developer CSS。既有安裝若還沒有這個 marker，則寫入 `'legacy'`；`src/core/settings.ts` 依 marker 保留舊版的 CSS、選擇與開關狀態，避免升級時改變既有頁面外觀。`src/core/data.ts` 中 `searchHistory` 的預設為空陣列，`searchHistoryLimit` 預設為 `10`。

這些行為由 `tests/unit/settings.test.mjs` 的預設／舊版相容測試，以及 `tests/e2e/extension.e2e.mjs` 的新設定檔、preset、啟用開關、套用與搜尋建議流程持續驗證；完整情境見 `docs/superpowers/plans/2026-09-06-css-slots-search-history.md` 的 Test Plan。

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

打 tag 前在本機執行完整 release gate：

    npm run lint
    npm run test:unit
    npm run typecheck
    npm run build
    npm run test:e2e
    git diff --check
    git status --short

最後一項必須沒有輸出；版本調整、文件更新與 release commit 均應先提交，再建立 tag。GitHub Actions 會重跑 unit test 與 typecheck，但不跑 lint 或 headed e2e，兩者須由本機 gate 保證。
