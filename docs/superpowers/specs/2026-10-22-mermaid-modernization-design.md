# Mermaid 12 升級與 31 圖種支援提案

狀態：**2026-10-23 使用者授權開始分階段執行。** 四項 review 修正已納入；依賴與 runtime 的實際進度以 [實作計畫與續接 checklist](../plans/2026-10-23-mermaid-modernization.md) 為準。先通過 PoC 關卡，再替換產品 renderer。

2026-10-23 checkpoint：A–E 已完成固定環境 runtime 驗收：239 unit、146 e2e、33 confined probe，31 圖種／372 outputs，包含 Anthropic 預設、整體設定面板與 85% 寬度。完整效能、包體取捨、audit 與未驗證範圍見 [驗收與交接](../../research/2026-10-23-mermaid12-acceptance.md)；push receipt 及續接位置以計畫 ledger 為準。原始 strict 四個資源失敗保留在 probe report，不因後續成功被改成通過。版號仍為 1.8.2，未 release。

## 目標

### 2026-10-23 核准追加：預設與設定面板

使用者確認 Mermaid 預設採 `anthropic-blog`，整個設定面板也使用同一個編輯風格。這是既有三分頁的視覺調整，不新增另一套主題設定，不更動文章的 CSS 客製化選擇。

- 新安裝、缺少 Mermaid 選項的舊資料及 Reset to Defaults 採 Anthropic；明確儲存的 `original` 必須保留。未知值採目前預設。
- 設定面板固定淺色紙面 `#faf9f5`、深灰文字 `#24231f`、陶土重點 `#a34f37`、灰褐框線 `#8a8074`、淡綠輔色 `#e7ede5`；不是 Anthropic 官方整合，也不下載字型。
- 標題使用本機 Georgia／Times New Roman／Noto Serif TC fallback；控制項使用本機易讀 sans-serif，CSS editor 保留 monospace。
- 保留 General／Appearance／Plugins、既有 SMUI 控制項、鍵盤操作、disabled／focus／error 狀態。分頁與工具維持緊湊尺寸；不增加行銷區塊、巢狀卡片或裝飾圖片。
- 所有下拉選單、選取項目、開關、按鈕、輸入框、提示及標頭使用一致 tokens。popup 與文章內 iframe 共用外觀，切圖表 Original 不影響設定面板。
- 驗收涵蓋新舊設定、Reset、三分頁、下拉選單展開、五種語言、320／360／390 px 與文章內浮層；檢查水平溢出、長文字、鍵盤焦點及網路請求。永久案例與實際計數記在 plan，教訓記在 `docs/lesson_learn.md`。

使用最新正式版 Mermaid，盡量支援使用者指定的全部 31 種圖。優先確保既有文件可讀、離線本機渲染、設定相容及 Original／Anthropic blog style 切換，不以「核心有註冊圖種」取代擴充功能內的實際驗證。

目標為 **30 種核心圖種 + ZenUML = 31/31**。C 已達成圖種可渲染驗收；全矩陣、風格、效能與最終回歸仍依計畫分開判定。若有 MV3、CSP、安全或原生圖種問題，逐項揭露並保留可讀原碼，不為湊數使用遠端服務或不受控 fork。

## 已核對的事實

截至本次查核：

| 項目                | 結果                                                      | 證據／邊界                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 專案 baseline       | `@md-reader/markdown-it-mermaid@0.5.1 → mermaid@9.1.6`    | 實際本機解析依賴；既有 [31 種圖報告](../../research/mermaid-diagram-compatibility.md) 為 11 支援、20 不支援                                                                                                                  |
| 最新正式核心        | **`mermaid@12.2.0`**                                      | npm registry `dist-tags.latest`；2026-10-13 發布；[官方 release](https://github.com/mermaid-js/mermaid/releases/tag/mermaid@12.2.0)                                                                                          |
| 核心圖種            | 指定 31 種中，除 ZenUML 外均有對應核心註冊                | [12.2.0 固定 tag 的註冊程式](https://github.com/mermaid-js/mermaid/blob/mermaid%4012.2.0/packages/mermaid/src/diagram-api/diagram-orchestration.ts)；完整版包含 mindmap／architecture 等 large features，不能誤用 tiny build |
| ZenUML 候選         | **`@mermaid-js/mermaid-zenuml@1.0.1`**                    | npm registry；peer range 含 `mermaid ^12`，但這只證明套件宣告相容，尚無本專案 runtime 證據                                                                                                                                   |
| ZenUML 整合方式     | 註冊外部圖種套件                                          | [官方整合文件](https://mermaid.js.org/syntax/zenuml.html#integrating-with-your-library-website)；文件範例中的舊版號不可直接當本次選型                                                                                        |
| 新版 API            | `await mermaid.render(...)` 回傳 SVG 與可選的綁定函式     | [官方 API usage](https://mermaid.js.org/config/usage.html#api-usage)；目前 wrapper 使用同步 callback，不可原樣套用                                                                                                           |
| 布局改變            | v12 完整版內含 ELK，預設布局有改變                        | [官方 layout 文件](https://mermaid.js.org/config/layouts.html)；升級可能改變既有圖的位置與尺寸                                                                                                                               |
| 執行環境            | 套件要求 Node >=22.12.0；v12 bundles 目標 ES2024          | [官方環境說明](https://mermaid.js.org/config/usage.html#installing-and-hosting-mermaid-on-a-webpage)；repo 的 CI Node 22 須用符合要求的 patch，不能宣稱任意 Node 22 都可                                                     |
| 舊 wrapper 最新 tag | npm 的 `latest` 為 `0.6.0-beta.0`，依賴 Mermaid `^11.3.0` | 無法達成本次「最新正式核心」目標，不建議拿 beta wrapper 當捷徑                                                                                                                                                               |

查核使用 npm registry 的 `https://registry.npmjs.org/<package>` JSON，未執行安裝。實作時仍須重查是否有新的正式修補版；若更換本提案的版本，記錄原因並重跑關卡。正式依賴固定確切版本與 lockfile，不使用浮動 `latest`、prerelease、CDN 或 `pnpm.overrides` 強行跨 major。

目前建置檔量測：`extension/js/content.js` 為 **4,369,082 bytes**，`dist/md-reader-lite-1.8.2.zip` 為 **1,706,468 bytes**。這是現有本機 artifact 的大小，不是已發布商店包大小；本輪未重新建置，也沒有新版體積或效能量測。

## 支援分組

| 階段           | 圖種                                                                                                                                                                           | 目標                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 保留既有 11 種 | Flowchart、Sequence、Class、State、ER、User Journey、Gantt、Pie、Requirement、GitGraph、C4                                                                                     | 遷移後全部可渲染，不倒退                               |
| 新增 19 種核心 | Swimlanes、Quadrant、Use Case、Mindmaps、Timeline、Sankey、XY、Block、Packet、Kanban、Architecture、Radar、Event Modeling、Treemap、Venn、Ishikawa、Wardley、Cynefin、TreeView | 逐項在真實擴充功能通過；核心目標 30/30                 |
| 新增外掛       | ZenUML                                                                                                                                                                         | 本機封裝並註冊，目標 31/31；語法支援與風格整合分開驗收 |

同一份 `example/mermaid-compatibility.md` 作為單一範例來源。新版本若改語法，保留舊案例作為回歸 fixture，另記錄新版寫法與遷移原因，不能刪除失敗案例或任意改標 unsupported 讓測試通過。

## 方案比較

| 方案                                               | 代價與限制                                                                         | 決策                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| 直接 override 舊 wrapper 的 Mermaid                | 同步 API 與新版不相容；beta wrapper 也不是 12.x 路線                               | 不採用                                |
| 保留 9.x 與 12.x 兩套 renderer                     | 包體、設定隔離、兩份安全更新與測試成本增加；容易出現同文件不同規則                 | 不作正式架構；只在試驗時對照 baseline |
| **直接使用官方 12.2.0 + 本專案非同步圖表 adapter** | 需調整圖表產生時機，但可沿用現有 Graphviz placeholder 模式，明確控制本機資源與狀態 | **建議採用**                          |

不加入 Mermaid 版本選單，不重做其他 Markdown plugins，也不開啟任意 icon pack 下載、外部 ELK CDN 或遠端渲染。v12 完整版已內含 ELK，先不額外加入 `@mermaid-js/layout-elk`。

## 主要風險與控制

| 風險                                               | 等級 | 處理與必要證據                                                                                                                                                         |
| -------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同步改非同步造成舊結果覆蓋新內容                   | 高   | 每次文件渲染有 generation；過期工作不可寫回。測試快速切主題、切文件、停用 Mermaid、重整與卸載                                                                          |
| Mermaid 共用設定在並行圖表間污染                   | 高   | 使用本專案佇列涵蓋「初始化設定 → 等待 render → 清理」，逐圖新設定。不能只依賴 Mermaid 內部 render queue，因為外部 initialize 仍可能先改掉共用狀態                      |
| 延後插入 SVG 繞過目前 remote-guard 時機            | 高   | 安全檢查必須涵蓋非同步渲染的資源與插入流程。只在 SVG 插入後掃 DOM 不足以證明沒有先發出請求；用遠端 image／HTML／CSS 負例與網路觀察驗證                                 |
| MV3／CSP／ESM／lazy chunks／ELK 或外掛資源載入失敗 | 高   | 先以最小 MV3 候選驗證。本機 eager bundling 為首選；若需 chunks，URL 必須明確指向擴充資源，逐一驗證 WAR。不得以新增 host permissions、放寬 unsafe-eval 或遠端 JS 解決   |
| 主題、字型、預設布局改變                           | 中高 | 原有圖種先明確採相容的 classic/default-dark 與舊布局策略；新圖種保留必要的原生布局，例如 Swimlanes 不強制改成 Dagre。作者合法主題／布局仍優先；不保證 9.x 像素完全相同 |
| ZenUML 第三方依賴與安全限制                        | 中高 | 檢查依賴、license、CSP、資源與註冊行為；peer range 通過不算驗收。若必須外送、eval 或放寬安全才可運作，該階段不通過                                                     |
| 新版輸出更大、布局更慢                             | 中   | 記錄 bundle／zip 增量、冷啟動、連續重繪與長文件時間。不得把 npm 的 unpackedSize 當作實際 extension／zip 增量                                                           |
| 瀏覽器最低版本要求改變                             | 中   | v12 輸出目標需檢查。先盤點並實測擬支援的 Chrome 範圍；只在一版 Chrome for Testing 通過不可外推。若需提高最低 Chrome，提出明確決策，不能默默改 manifest                 |
| 舊語法不再接受                                     | 中   | 保留舊 11 圖種、原碼、init 指令與現有 `.mmd` fixture；新舊案例都測。出錯保留原碼與本地化訊息，不顯示 `undefined`                                                       |

預設 `securityLevel: strict`，文件不得降低安全設定或解除大小／連線限制。保留作者配色與主題的前提是安全設定不可被 directive／frontmatter 覆蓋。延續既有隱私揭露，不把本次修正誇大成「任意文件的所有 CSS 遠端引用都已封鎖」。

## 建議架構

1. **Markdown 階段維持同步。** `src/core/markdown.ts` 只替 Mermaid fence 產生可讀原碼 placeholder 與唯一識別；DOT 仍先分流 Graphviz。避免把整個 Markdown／搜尋／大綱流程一起改成 async。
2. **獨立非同步圖表階段。** 新增 `src/core/mermaid-renderer.ts` 與 `src/plugins/mermaid-renderer.ts`。前者封裝載入、外掛註冊、設定隔離及逐圖佇列；後者連接現有 plugin lifecycle，管理容器與 generation。
   A4 採用本機 extension frame 執行 Mermaid，獨立編譯成單一 eager bundle。renderer 專用 CSP 禁止外部圖片、字型、連線及巢狀 frame；不改 host CSP。先檢查結構化設定、HTML、CSS 與固定版本 flowchart metadata，再渲染並清理 SVG。回傳 SVG 的 selector 限制在圖內、動畫名稱獨立、CSS 變數有展開總量限制。private MessagePort 只從實際 parent 接受首次握手，不透過 host window 廣播 SVG。
3. **明確完成通知。** 保留 `contentRendered` 的既有語意，再提供有 generation 的圖表工作完成通知／promise，供閱讀位置、布局及搜尋索引處理使用。有效工作完成後重建搜尋索引與 highlight，避免 placeholder 被換掉後殘留搜尋結果；過期工作不可影響新文件。成功、錯誤與過期工作都必須完成收尾；不能整份文件永久 loading。
4. **狀態與復原。** 每張圖有 pending/rendering/ready/error；渲染失敗保留原碼與安全錯誤訊息，其後圖表照常處理。局部錯誤不應攔住搜尋、原碼切換或大綱。
5. **檢視器與閱讀位置。** 以既有 MutationObserver 方案接非同步 SVG，補上錯誤／失效容器的 observer 清理。恢復錨點須等本次有效圖表工作完成；若使用者已自行捲動，不再強制拉回。
6. **風格與作者設定。** 繼續使用 `mdPluginOptions.Mermaid.style`，不改儲存 schema。更新 v12 的 theme／look 與設定解析，納入合法 directive 及圖內 YAML frontmatter；使用 Mermaid 公開能力或結構化 parser，不用簡單 regex 假裝解析完整 YAML。C4／ZenUML 的可渲染與風格完成分開記錄。
   使用者已確認新增圖種也須能切換 Anthropic blog style；驗收涵蓋所有 31 種的配色、字型、框線與標題，保留有語意的原生圖形。

單純 Promise timeout 不會終止正在主執行緒計算的布局，故不把它宣稱為 CPU 中止機制。先以受保護的來源大小／edge 限制及丟棄過期工作控制負載；若實測仍卡住，再評估獨立 worker 或渲染隔離，不能假稱已可取消任意任務。

## 分階段試驗計畫

下列是建議順序，**目前各階段均未開始**。每階段保留 Why／What／How／Boundary 與實測 receipt。先試驗，再遷移；隱私／CSP 關卡失敗時停止擴大改動。

### A. 可行性 PoC

- 在版本控制內的 `tests/probes/mermaid12/` 保存 probe 原始碼、manifest、建置／執行指令與獨立 lockfile，不更動主專案 lockfile。只有依賴安裝目錄、bundle、截圖與執行紀錄存入忽略追蹤的目錄。
- 固定 Mermaid 12.2.0；先驗證完整核心 30 圖，再加入 ZenUML 1.0.1 驗證第 31 圖。
- 用與本專案相同的 webpack 工具及 Chrome for Testing，以 manifest content script 的 isolated world 注入 HTTP 與 `file://` 文件，檢查 ESM、本機 lazy/eager、ELK、嚴格頁面 CSP、網路與完整頁第一次載入。extension popup／普通 HTTP script 成功不能代替此關卡。
- 記錄有無新增 worker／font／image／chunk 請求；不在標準圖中使用遠端資源。
- A 階段同時加入遠端 image／HTML label／CSS 與惡意設定負例，觀察從開始渲染到插入完成的請求；測試攔截到的外送嘗試也算失敗，不能以最終 DOM 已清除資源當成通過。
- **通過條件：** 30 核心有非空圖、無執行錯誤或對外請求；ZenUML 有獨立 pass/fail receipt；正常與安全負例、HTTP／file 與 CSP 結果均明列。這只證明候選架構可行，不等於正式整合通過。
- **失敗策略：** 保留現行版本與報告，說明是語法、套件、工具鏈或 MV3 問題。不能把一般 HTTP demo 成功當成擴充功能成功。

### B. 替換同步 wrapper

- 範圍：`package.json`、`pnpm-lock.yaml`、`src/core/markdown.ts`、新 renderer modules、`src/plugins/index.ts`，必要的 `build/webpack.common.js`／`src/manifest.json` 調整。
- 加入固定版本 `mermaid`，移除舊 wrapper，避免留下兩套核心。Node engine 與文件需求同步核對；不順便更新其他無關依賴。
- 先寫佇列、錯誤復原、generation 與 placeholder 的失敗測試，再接 adapter。
- 同步更新相容性測試的依賴解析、版本 guard 與核心 30 圖預期，保留 9.1.6 歷史報告。B 的 commit 必須可獨立通過；ZenUML 在 C 加入正向驗證。
- 修正 loading／done 時機、圖表檢視器、remote-guard 與搜尋索引連接；主文件文字不等待圖表才能顯示。測試搜尋中圖表完成、失敗保留原碼與快速切文件。
- **通過條件：** 舊 11 圖無倒退、30 核心能在正式建置的擴充功能渲染；快速切換與非同步錯誤不破壞正文。
- **建議 commit：** `refactor: migrate Mermaid to a local async renderer`。

### C. 接入 ZenUML

- 加入固定版本 `@mermaid-js/mermaid-zenuml`，套件本機封裝且每個 renderer 實例只註冊一次；預設總覽也必須能載入，不能只讓單圖測試成功。
- 驗證 alias、巢狀呼叫、分支、迴圈及錯誤後復原；檢查 `.md` 與獨立 `.mmd`。
- **通過條件：** 31/31 圖種都經實際渲染；不需遠端、eval、權限擴張。風格若受套件限制，另列部分支援，不能宣稱主題完整。
- **建議 commit：** `feat: support locally bundled ZenUML diagrams`。

### D. 補齊風格與操作

- 範圍：`src/core/mermaid-style.ts`、`src/style/index.less`、`src/main.ts`、`src/plugins/diagram-viewer.ts` 及受影響 locale。
- 保持 Original／Anthropic 選項及舊設定相容，優先修正已知 Original GitGraph 窄螢幕超寬與 C4 風格缺口。
- 針對新圖種的表格／框線、標題、註記、中文、長標籤、對比與原生形狀檢查；CSS 不以廣泛覆寫 SVG shape 的方式破壞圖形語意或作者配色。
- loading／失敗文字須涵蓋全部既有語言；不在這一階段加入額外主題選單。
- **通過條件：** 既有 20 條 Mermaid 風格 e2e 全過；無過期圖表／控制鈕、閱讀位置跳動或主題污染。C4／ZenUML 若未完整風格化，列出具體限制並交付截圖。
- **建議 commit：** `fix: preserve Mermaid styling and reading behavior after upgrade`。

### D3. 2026-10-23 核准追加：自訂寬度 85%

- 使用者核准新安裝與 Reset to Defaults 使用 `customWidth: 85`、`customWidthUnit: 'percent'`。
- 已儲存的像素、百分比或關閉狀態不變；舊版只有數字而沒有單位時仍視為 px，不能把 `900px` 解讀成 `900%`。
- 只在讀取時解析預設，不因開啟文件或設定面板就覆寫舊資料；只有重設會主動寫入新預設。
- 寬度控制列須在五語及 320px 面板下不溢出，數字欄有本地化 accessible label；保留 SMUI 原生 radio hitbox。
- 永久測試：`tests/unit/settings.test.mjs`、`tests/e2e/settings-theme.e2e.mjs` 的新舊寬度案例，以及 `tests/e2e/mermaid-styles.e2e.mjs` 的 Reset 案例。

### E. 永久測試、文件與候選驗收

- 擴充 B／C 已同步遷移的 `tests/e2e/mermaid-compatibility.e2e.mjs` 為完整矩陣與候選驗收；仍保留真正未知／損壞語法的負向測試。不得把測試遷移延到此階段而留下必然失敗的中間 commit。
- 只有 GitGraph 問題確實修好且重現測試通過，才移除原 TODO；不把新失敗改成 TODO 作為完成方式。
- 更新 `example/mermaid-compatibility.md`、相容性報告、`docs/developer_guide.md`、`docs/ARCHITECTURE.md`、相關設計／計畫索引及版本對應的 changelog。README／PRIVACY 若提及同步流程、圖種或依賴行為，須一併核對。
- **通過條件：** 下列 Test Plan、Regression Plan 與隱私關卡全部有 receipt；真實 runtime 未過的圖種不得標支援。
- **建議 commit：** `test: verify Mermaid 12 diagram coverage and document migration`。
- 此階段不自動 push、改產品版號、打 tag 或 release；保留獨立發佈授權。

## 永久 Test Plan

### 自動驗證

| 測試群組       | 規模／內容                                                                                                 | 通過條件                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 圖種主矩陣     | 31 圖 × 2 styles × 2 light/dark × 3 viewports：1200、390、320，共 372 次圖表量測                           | 有正常非零 SVG 或套件明確約定的圖表 DOM、可見標籤、無錯誤圖、初始框內可查看且不被遮蔽 |
| auto 主題      | 系統 light/dark 切換兩次；Original 隨系統、Anthropic 維持淺紙面                                            | 不遺失選項、不產生過期結果、不沿用上張圖設定                                          |
| CSS 客製化     | off、Developer、Editorial、User1、User2；Flowchart／Sequence／Requirement／GitGraph／C4／ZenUML 各兩種風格 | 獨立於 CSS 開關，套用與草稿語意不變                                                   |
| 作者優先與隔離 | classDef、style、linkStyle、init／initialize、合法 YAML frontmatter、特殊引號、前後不同主題                | 作者安全設定保留；安全／資源上限不可被文件降低；後圖不污染                            |
| 生命週期       | 連續切主題／文件、停用／啟用、重整、原碼檢視、失效容器                                                     | 舊 promise 不寫回、無未處理 rejection、observer 可收尾、讀取位置穩定                  |
| 故障與負載     | unknown、broken、超過大小／連線限制、很多連續圖、重複來源／ID                                              | 正文可讀、原碼保留、錯誤本地化、後圖可繼續；不宣稱軟 timeout 等於中止 CPU             |
| 隱私與安全     | 完整 31 圖首次載入／重繪、ZenUML、ELK、遠端 image／label／CSS 負例、惡意 HTML／連結、CSP 嚴格頁            | 沒有為新增功能而增加的對外請求、遠端程式碼或安全放寬；不能只檢查最終 DOM              |
| 來源類型       | HTTP fixture、`file://`、Markdown fence、`.mmd`、DOT、PlantUML                                             | 本機資源可用、無外送；DOT 分流與 PlantUML opt-in／offline 閘門不變                    |

ZenUML 若輸出 HTML 包住 SVG，應依公開輸出契約測試實際圖表而非任意放寬為「有文字就通過」。自動化成功也不等於視覺風格已核准。

### 視覺與效能

- 保留兩種風格各 31 張桌面裁圖，另有 dark／mobile／320px 完整頁與已知問題局部圖；逐項檢查中文、長標籤、C4 表格、標題、連線文字與節點形狀。
- 同一台機器、相同 fixture 與 viewport，比較舊 11 圖種的 baseline 與升級版；記錄至少 5 次冷啟動、10 次暖重繪的中位數與最大值、測試環境及原始數值。不以這個小樣本宣稱可靠的長尾 p95。
- 分開記錄 31 圖完整頁與 ZenUML 新增成本、最終 content bundle／分包與 zip 大小。若體積或舊 11 圖渲染中位數超過 baseline 兩倍，先 review 取捨，不能忽略再直接發佈。
- 確認沒有為讀文字而等待重型圖表載入、長時間全頁遮罩或新增額外 font 下載。若新版不能保持可用性，該階段不算通過。

## Regression Plan

```sh
corepack pnpm install --frozen-lockfile
npm run test:unit
npm run typecheck
npm run build
node --test tests/e2e/mermaid-compatibility.e2e.mjs
node --test tests/e2e/mermaid-styles.e2e.mjs
npm run test:e2e
git diff --check
git status --short
```

格式檢查針對變更檔案執行 Prettier；另審查 production dependency audit 與新增 license。新引入且未處理的 high／critical 警示不得直接忽略；若有既有警示，分開記錄與評估，不冒稱完整依賴已無漏洞。

測試新增在既有 `tests/unit/` 與 `tests/e2e/` 規則下，Playwright 不寫進產品依賴。e2e 被 skip、TODO 未解決或只做 source review 的項目不可列為 runtime acceptance。最終回報包含實際支援數、樣式限制、測試摘要、網路紀錄、bundle／效能量測與 worktree／commit receipt。

## 停止與回退

- A 階段未過：保留版本控制內的 probe 與報告，記下失敗命令及 blocker；忽略追蹤的 artifact 僅作補充，不改主專案依賴。
- B–E 階段未過：不推送或發佈，保留明確 checkpoint。不要引入自動切回 9.x 的第二套正式 renderer。
- 需要撤回已提交改動時，用該階段的 `git revert`；保留使用者其他修改，禁止 `reset --hard`。尚未提交的變更只針對本任務處理並記錄。
- 若核心 30 種通過而 ZenUML 無法在安全限制內運作，交付 30/31 的真實結果與 blocker，由使用者決定是否接受部分支援；不得宣稱 31/31 或改用遠端渲染。

## 本輪驗證邊界

提案建立時，Mermaid 12.2.0、ZenUML 1.0.1 的本專案 runtime 為 **not-performed**。2026-10-23 的執行、測試及續接位置記錄在實作計畫，9.1.6 結果僅作 baseline，不能當成新版已通過。
