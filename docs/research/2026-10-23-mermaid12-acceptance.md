# Mermaid 12 驗收與交接

日期：2026-10-23，Asia/Taipei。產品版號仍為 **1.8.2**；本輪未打 tag、未發布 release、未上傳商店。

## 結果

- Mermaid **12.2.0**、本機 ZenUML plugin **1.0.1**／core **3.50.1**，31 種共用 fixture 在 Original／Anthropic 皆可渲染。
- 預設 Mermaid 為 Anthropic blog style；明確儲存的 Original 不變。三個設定分頁與嵌入面板採同一個編輯風格。
- 新／缺少設定與重設的自訂寬度為 **85%**。已儲存的像素、百分比、null 關閉狀態不變；舊版沒有單位的數字仍視為 px，不在讀取時寫回。
- 最終回歸：**239 unit、146 e2e、33 confined probe、3 evidence helpers**，全部通過，零 fail／cancel／skip／TODO。型別檢查、正式建置、zip 完整性與格式檢查通過。
- 功能／風格／安全關卡接受；效能有明確增加，取捨與限制如下。這是固定環境與 fixture 的驗收，並非所有語法或瀏覽器版本的保證。

## 來源與環境

| 項目                      | 實際紀錄                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| 舊產品 baseline           | `3b785a27c669e45a08c2578afac3a7aced68d16f`，Mermaid 9.1.6；該 commit 的獨立 probe 不等於產品 renderer |
| 已驗證 runtime／benchmark | `4eea56a4bb86801f9fca1c19111504c5bdb99b25`，所有 benchmark 均在 clean worktree 執行                   |
| CI notices 補正           | `1065b21`，僅 CI／unit／文件，未更動上述瀏覽器 asset                                                  |
| 硬體                      | Apple M1，ARM64，8 GiB RAM，macOS                                                                     |
| 工具                      | Node 26.0.0、pnpm 11.25.0、webpack 5.74.0、TypeScript 5.0.4、Svelte 3                                 |
| 瀏覽器                    | Headed Chrome for Testing 147.0.7727.15；實際載入 MV3 擴充功能                                        |
| 網路與字型                | 本機 fixture server、bundled engine、本機字型；沒有新增權限、CDN、外部 renderer 或放寬 host CSP       |

Raw receipts 存在 [data/](data/)：三份 performance JSON、372-output matrix、audit comparison、verification fingerprints。大型截圖與完整執行 log 留在忽略追蹤的 `dist/`；換電腦後依永久測試重建，不能假設這些檔案會跟著 Git 搬移。

Probe receipt 的 `sourceCommit` 是提交前的 HEAD，**不能單靠它識別 dirty 修改**；verification 保存所有實際輸入／輸出 SHA-256，並已核對 shared policy 原始檔。benchmark 則記錄已提交的 clean `4eea56a` 與最終 asset digest。

## 永久 Test Plan

| 範圍                  | 證據與通過條件                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 單元                  | `tests/unit/*.test.mjs`：239 pass；包含 defaults、queue、資源政策、實際 plugin lifecycle 的邊界替身、notices／CI 順序與 benchmark helper                        |
| 完整 e2e              | `npm run test:e2e`：146 pass；固定 `--test-concurrency=1`，不平行開多個測試瀏覽器                                                                               |
| 圖表矩陣              | 31 × 2 styles × 2 light/dark × 1200/390/320px = **372**；另有 **62** 個別輸出。要求非零 SVG、標籤、初始 fit、無錯誤圖與外部請求                                 |
| 設定與寬度            | 新／legacy／saved Original、85%／900px／67%／null、無隱式寫回、重載與 Reset；五語 × 三尺寸 × 三分頁共 45 截圖，另有展開選單及 embedded panel                    |
| 作者設定              | YAML／init themes、font/color/class/linkStyle、C4 與 Sankey 原生色彩、特殊引號；下一張圖無設定污染                                                              |
| 互動與生命週期        | zoom／pan、原碼與搜尋、rapid redraw、停用／啟用、重整、延遲圖表閱讀還原、實際滑鼠重新定位、合成 pagehide/pageshow                                               |
| ZenUML 與來源         | aliases、nested branches/loops、invalid→valid、HTTP／file 的 `.md` 與 `.mmd`；DOT 分流及 PlantUML opt-in/offline 閘門不變                                       |
| Shared confined probe | **33 pass**；HTTP／file／strict host CSP、編碼與相對資源、State class/inline、C4 element/relationship、Swimlane、Sankey、source/edge limits、錯誤清理與後圖復原 |
| Receipt helpers       | **3 pass**；stale source/bundle、失敗關卡與 cleanup error 不得被隱藏                                                                                            |

受防護負例在 render 前應拒絕，receipt 要求 `preflightPassed: false`；不把 SVG 清理後才拒絕當成前置防護。Sankey 原生 sanitizer 已移除的 URL paint 則驗證本機正常輸出，另以不安全 caller config 驗證前置拒絕。Raw strict 反例**刻意**保留被測試攔截的請求嘗試；它們不是守門版本的無請求證據。

人工檢視全部 62 個別圖的八張 contact sheets，以及窄版 CJK、dark/Developer、zh-TW／ja 320px 設定面板。這些 fixture 未見空白或不合理重疊。Gantt／Packet／C4 等寬圖初始會縮小，需 viewer 放大閱讀細節；不宣稱任意長圖在手機初始尺寸都可直接讀清。

### 重跑

```sh
COREPACK_ENABLE_AUTO_PIN=0 corepack pnpm install --frozen-lockfile
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
npm ci --ignore-scripts --prefix tests/probes/mermaid12
node tests/probes/mermaid12/build.cjs
node --test tests/probes/mermaid12/evidence.test.mjs
MERMAID_PROBE_POLICY=confined node --test tests/probes/mermaid12/probe.test.mjs
git diff --check
git status --short
```

瀏覽器缺少／無法啟動／skip 都不能算 runtime 通過。舊有少數 suite 的 unavailable 會 skip，新增 Mermaid/settings 關卡會失敗；最終 receipt 必須同時核對 counts 與 exit code。

效能重測依 [tests/perf/README.md](../../tests/perf/README.md) 建立獨立 baseline worktree，再執行 shared-11／gallery-31／zenuml 三種 scope。不要把舊產物蓋到目前的 `extension/`。

## 效能與體積

相同 1200×900 viewport、760px 內容寬、light、CSS customization off；每個 variant/style 各 **5 次 fresh-profile cold + 10 次 warm redraw**。合計 40 cold／80 warm。單位 ms，表內為 median／max：

| Fixture / 版本       |   Original cold | Original warm |  Anthropic cold | Anthropic warm |
| -------------------- | --------------: | ------------: | --------------: | -------------: |
| 舊 11 圖，Mermaid 9  |   438.5 / 531.4 |   67.3 / 86.1 |   432.0 / 623.5 |   86.6 / 104.5 |
| 同 11 圖，Mermaid 12 | 1337.8 / 1635.1 | 294.2 / 313.3 | 1344.5 / 1368.9 |  312.2 / 353.3 |
| 新版完整 31 圖       | 1953.3 / 2073.7 | 674.1 / 714.2 | 2012.1 / 2259.6 |  715.2 / 759.9 |
| 新版單獨 ZenUML      |  768.3 / 1055.5 |   20.2 / 26.6 |  738.8 / 1060.8 |    25.2 / 32.0 |

相同舊 11 圖的 cold median 為 **3.05×／3.11×**，warm 為 **4.37×／3.60×**。全部正常 benchmark 的外部 HTTP request 紀錄為空。

| Asset            | baseline bytes | candidate bytes |
| ---------------- | -------------: | --------------: |
| content.js       |      4,369,101 |       3,258,761 |
| Mermaid frame    |             無 |       9,263,059 |
| content + engine |      4,369,101 |      12,521,820 |
| zip              |      1,706,477 |       3,973,064 |

聚合 JS 為 **2.87×**，zip **2.33×**。先前歷史 baseline 的 4,369,082／1,706,468 B 保留在原報告；本表使用本輪重新建置的實際值與 digest，不混用歷史 artifact。

**>2× review 決策：** 保留這個本機 eager/frame 方案，滿足 31 圖種與 pre-render 資源邊界；接受已量測的渲染／包體成本，不宣稱效能不變。沒有 Mermaid 的文章不建立 engine frame；正文與原碼可在圖表完成前使用。未量測一般文章速度，不能外推它變快。日後分包／精簡 engine 需另跑 CSP、WAR、首次載入和完整圖種關卡，不能在這次收尾偷偷換架構。

Cold 指 fresh browser profile，未清 OS disk cache，也未含整個瀏覽器程序啟動時間。Warm 包含 storage/tab messaging 與 polling。小樣本只報 median/max，沒有 p95、CPU profile 或因果歸屬。單獨 ZenUML 與 gallery 是絕對成本，不能相減宣稱 ZenUML 的純增量。

最終 zip SHA-256：`4ef56204d29f9d36f639fe8c982d70ae172bf3cbafc06407bf128176d4d7a115`。完整 content/frame digests、raw samples 與硬體資料在三份 performance JSON，重跑會有不同時間戳與數值。

## Audit 與授權

Production audit 的 exit code 為 **1**，因為仍有 advisories；不能列為「安全掃描全綠」。固定本次 registry snapshot 比較：

| 版本      | critical | high | moderate | low | 總數 |
| --------- | -------: | ---: | -------: | --: | ---: |
| baseline  |        1 |   10 |       36 |   8 |   55 |
| candidate |        0 |    4 |       15 |   2 |   21 |

新增 advisory ID **0**，移除 **34**。既有 Svelte／KaTeX／MarkdownIt／Linkify 問題仍在，本輪不擴大為整套工具鏈升級。四個 high：Svelte [textarea bind:value](https://github.com/advisories/GHSA-gw32-9rmw-qwww)、Linkify [scan loop](https://github.com/advisories/GHSA-22p9-wv53-3rq4)／[mailto validator](https://github.com/advisories/GHSA-v245-v573-v5vm)、MarkdownIt [smartquotes](https://github.com/advisories/GHSA-r7fv-28h4-cvq7)。這是 dependency inventory，不等於每條 advisory 的可利用性已被動態驗證；未來 release 仍應重查。

`build:notices` 在 webpack 後、zip 前收集已安裝 production 套件的完整 LICENSE／COPYING／NOTICE；缺少獨立檔時保留原始 README，沒有任何文件則 build 失敗。此 macOS inventory 有 **240 個 package versions**、**4 個 README fallbacks**；Linux optional dependencies 可能不同。`THIRD_PARTY_NOTICES.txt` 為 709,898 B，zip 同時含去除本機路徑的 `third-party-licenses.json`。

ELK 0.9.3 的 EPL-2.0 文本、DOMPurify 的 MPL-2.0／Apache-2.0 文本與原始 copyright 都保留。Khroma 2.1.0 的 package metadata 是 Unknown，但已安裝 `license`／README 明示 MIT；notices 不擅改 metadata。Inventory 是 superset，可能含 tree-shaken 套件，不構成法律認證。

CI 另有直接執行腳本的打包入口，已補 notices 並以 YAML-parsed unit test RED→GREEN。**Hosted GitHub Actions 未觸發**，只驗證本機相同步驟及 workflow 結構。

## 失敗紀錄與限制

- 早期 raw strict 的四個資源反例失敗，阻擋 B，完成 A4 後才遷移；歷史失敗未刪除。
- D 最初的 HTML label inheritance 無法勝過文章 `p !important`，改為安全檢查後於隔離 frame 保留 computed typography。作者字型與下一張圖的隔離有 e2e。
- 最終 reviewer 找到 State/C4 metadata、retained-DOM pagehide 與 pointer reading restore 三項實質缺口，均以先紅後綠修正；State 的舊路徑確有被攔截的請求嘗試。
- 第一輪寬度回歸 145/146；固定座標點到面板可視範圍外。僅加點擊前 scrollIntoViewIfNeeded，保留真正滑鼠與原斷言，重跑 146/146。
- Benchmark 的 SW self-message、無 tabs 權限查 URL 兩條初始路徑失敗，不列入樣本。最終固定 active tab ID，確認實際 SVG 更換及所有圖 ready。
- dev 兩個 compiler 編譯成功，但 reloader 即使 `--no-watch` 仍占 9090；關閉自己的 CLI 得 intentional exit 130，不記成 exit 0。之後 production rebuild 已清除 source map，僅有四個預期 JS。
- ZenUML 原生 renderer 不實作所有 Mermaid 主題變數；明確作者 theme 跳過我們的 SVG preset，保留其原生行為，不保證 forest／neo 成為 ZenUML 主題。
- 合成 pagehide/pageshow 與保留 DOM 已測，**實際 BFCache 命中率、其他 Chrome 版本、native scrollbar dragging、hosted CI、商店載入與 release 均未驗證**。
- Mermaid 專用資源政策不代表任意 Markdown raw HTML/CSS 的既有缺口已關閉；file directory probe 的既有隱私邊界仍依 README／PRIVACY 揭露。

## 接手入口

讀 [developer guide](../developer_guide.md)、[設計](../superpowers/specs/2026-10-22-mermaid-modernization-design.md)、[計畫 Current Checkpoint](../superpowers/plans/2026-10-23-mermaid-modernization.md)、本報告與 [lessons learned](../lesson_learn.md)，再核對 `git status`／`git log`／remote SHA。不要從聊天猜進度或重做 A–C。未來若要 release，另取得版號／tag／發布授權，重查 audit 並執行永久測試。
