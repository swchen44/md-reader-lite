# Mermaid 12 MV3 可行性實測

日期：2026-10-23。此報告記錄獨立 probe，產品仍使用 Mermaid 9.1.6。

最新 A4 結果：**confined 候選 25/25 browser gates、15/15 helper tests 通過，可進入產品整合。** 下方原始 strict 失敗證據保留；它不會因新增隔離政策而變成通過。產品與 Anthropic 風格遷移尚未驗收。

## 關卡結果

**正常範例已能渲染 31/31；直接以 strict 模式替換產品 renderer 的安全關卡未通過。** HTML 圖片、image node 與 CSS URL 仍會產生遠端載入嘗試。Playwright 已攔截請求，沒有把負例資料送往該遠端站點。這是候選架構的失敗證據，不能把它記成升級完成。

| 檢查                         | 已驗證結果                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Mermaid 核心                 | 12.2.0；30/30 核心 fixture 有非空 SVG、標籤與正尺寸                                     |
| ZenUML                       | 外掛 1.0.1，lockfile 解析到 `@zenuml/core` 3.50.1；未篩選總覽 31/31                     |
| 執行位置                     | 真正 MV3 manifest content script，預設 isolated world；單一 eager bundle                |
| HTTP                         | 完整圖表頁通過；正常 fixture 無額外 HTTP(S) 請求                                        |
| 嚴格頁面 CSP                 | 完整 31 圖通過；頁面 `script-src 'none'`，沒有放寬 host CSP                             |
| 本機檔                       | `file://` 完整 31 圖通過；由 Chrome 原生 extension settings 確認 file access            |
| 錯誤復原                     | unknown／broken 保留來源，後續正常圖仍可渲染                                            |
| strict HTML image            | 嘗試載入 `https://mermaid-probe.invalid/html.png`；未通過                               |
| strict image node            | 嘗試載入 `https://mermaid-probe.invalid/node.png`；未通過                               |
| strict theme CSS             | 嘗試載入 `https://mermaid-probe.invalid/fill.svg`；未通過                               |
| 嘗試降低安全設定的 directive | 實際設定仍為 strict，但仍嘗試載入 `https://mermaid-probe.invalid/directive.png`；未通過 |

所有安全負例都附正常流程圖，確保外部圖片被攔截後不會讓後續工作永久等待。負例保留真正失敗的 assertions，沒有改成 TODO 或 skip。

## 重現方式

從 repo root 執行：

```sh
npm ci --ignore-scripts --prefix tests/probes/mermaid12
node tests/probes/mermaid12/build.cjs
node --test tests/probes/mermaid12/evidence.test.mjs
node --test tests/probes/mermaid12/probe.test.mjs
```

來源位於 [tests/probes/mermaid12](../../tests/probes/mermaid12/README.md)。需要 root 開發依賴、本機 Playwright、Node >=22.12.0 與 headed Chrome for Testing。安裝瀏覽器或 probe 的錯誤應記為失敗／unavailable，不能當成通過。

圖表直接解析 [31 種共用 fixture](../../example/mermaid-compatibility.md)；未另外複製成另一套範例。首次執行的 file settings selector 與實際 Chrome UI 不符，已用真實 UI 確認並修正為 `#allow-on-file-urls`，重跑後本機檔通過。

## 證據與驗證邊界

- 首次完整重跑的來源 commit：`5b71970a408852e9b8c454731031f08785924e52`；9 個 runtime gates 為 5 pass、4 fail、0 skip、0 TODO，exit 1。
- 環境：macOS ARM64、Node 26.0.0、webpack 5.74.0、Chrome for Testing 147.0.7727.15，viewport 1200×900。
- 共用 fixture SHA-256：`2621e1a07de3571baebe2b800c7ea07eccb131c76651723ebaf3d6e749401b5e`。
- Probe 的獨立 lockfile SHA-256：`b1b9afbff156574be776dd2d8bc1afc80d8c88924d0f6d0e82b1f75ff63b2817`。Root pnpm lockfile 沒有變更。
- `npm audit --json --prefix tests/probes/mermaid12`：本次 0 個已知漏洞。此結果僅涵蓋候選 dependency tree 與當時 advisory 資料。
- 套件 metadata 含 MIT、Apache-2.0、BSD、ISC、ELK 的 EPL-2.0 等授權。`khroma` 缺少 package metadata license，但附帶的 `license` 文件為 MIT；正式封裝的 notices 尚須在產品整合階段驗證。
- 正常圖表採 Mermaid 12 原生預設，不代表 Original／Anthropic 兩種風格已完成遷移，也沒有完成 dark/mobile 的 372 次矩陣、全部視覺審查或可靠效能比較。
- Probe bundle 未壓縮；不可直接拿它和產品壓縮後的 `content.js` 比較效能或體積。
- 只驗證這一版 Chrome，不能推論所有支援中的 Chrome 版本。

Artifacts 保存於忽略追蹤的 `dist/probes/mermaid12/`：`extension/`、`build.json`、`results.json`、本機 fixture 與 screenshots。可追蹤的重現程式、lockfile 與本報告在 Git 中；另一台機器可以重建，不依賴 chat history。

## Review 後的證據修正

獨立 review 找出五項測試缺口，已在 `405cb02` 修正，追加最終 runtime 重跑：

- 先驗證負例語法可解析；一般 parser／renderer 錯誤不能被算成資源政策成功。
- 每個 gate 保存 pass／fail／unavailable 與原因，file settings 失敗也有紀錄。
- 建置輸入與 bundle／manifest／background 輸出保存 SHA-256；重跑前核對，拒絕舊 artifact 冒充目前程式。
- 每張圖使用自己擁有的暫存容器並在 finally 移除；加入 stylesheet／serialization 故障注入與殘留 DOM 檢查。
- 清理 browser、server 或 profile 任一失敗，仍嘗試其他收尾並保存本輪 receipt。

對應 helper tests 已由缺少實作的失敗轉為 3/3 通過。最終 runtime 結果記在下方與 [續接 checklist](../superpowers/plans/2026-10-23-mermaid-modernization.md)，不得拿較早的 5/4 結果取代新增測試的驗證。

最終重跑來源為 `405cb02ff99821793fbbaf4dcdaad562c69574da`：**11 個 runtime gates：7 pass、4 fail、0 unavailable／skip／TODO，exit 1**。新增的 stylesheet 與 serialization 故障注入皆通過，無殘留暫存 DOM；browser／server／profile 清理錯誤為空。四個負例皆通過語法檢查，且有效設定仍為 strict，失敗原因為確實攔截到的遠端請求。

- 最終 probe bundle：14,126,428 bytes，SHA-256 `cff0ce4f105c98908ed73f1e0168460c89f9b15ce1d77b7f3c5933faee5040e6`。
- 最終 `results.json` SHA-256：`e184895c5e1899cc2d77936dfbae74c6a53398e362ac000f248b4aebd273d5dc`。此值識別這次紀錄；重跑時時間戳及數值會改變。
- 測試原始檔 SHA-256：`264c7bf2d6e93b97ac940b03252fed546ab77f82f3a93cbb8afb34b48256a9f9`。
- 人工抽看 strict-CSP 截圖的 Flowchart／Swimlanes／Sequence 首屏，確認有可見內容。其餘圖表仍以 SVG／標籤／尺寸檢查為主，沒有完成 31 圖完整視覺核准。

## 後續處理

進入計畫 A4，先建立可在 Mermaid 渲染前生效的資源政策。新版 image shape 會在產生最終 SVG 前建立 `Image` 並設定來源，所以只在 `contentRendered` 後掃 DOM 無法阻止這條路徑。相關固定版來源：[imageSquare.ts](https://github.com/mermaid-js/mermaid/blob/mermaid%4012.2.0/packages/mermaid/src/rendering-util/rendering-elements/shapes/imageSquare.ts)。現有 [remote guard](../../src/plugins/remote-guard.ts) 只處理已插入 DOM，不能直接沿用為非同步安全保證。

候選方案必須同時驗證設定／HTML／CSS 與 image node，納入編碼 URL 與相對 URL；若需隔離 renderer，另驗證嚴格 host CSP、WAR、傳訊來源與回傳 SVG 的資源處理。不得用覆寫全域 `fetch`／`Image`、放寬 CSP、遠端服務或只在測試中攔截網路來宣稱產品已安全。

**產品 B–E 尚未開始。** 這份 probe 證明新版的圖種可行性，也具體指出目前安全架構的阻塞；資源政策通過前保留現行產品依賴。

## A4 本機隔離政策驗證

`MERMAID_PROBE_POLICY=confined node --test tests/probes/mermaid12/probe.test.mjs`：**25 pass、0 fail／unavailable／skip／TODO，exit 0**。環境仍為 Node 26.0.0、CfT 147.0.7727.15。來源為 `6c92d3f` 上的本次 A4 修改，receipt 含完整 build/test 指紋；cleanupErrors 為空。

- Mermaid 在本機 extension iframe 執行。兩個 eager bundle 分開編譯，無共用跨執行世界 chunk；不放寬 host CSP、不新增權限。
- renderer-only CSP 阻止外部資源，渲染前用 htmlparser2／entities／css-tree 解析設定、HTML、CSS 與固定版本 flowchart metadata。輸出以 DOMPurify 及結構化 CSS/SVG 政策清理後才插入 host。
- 原始四個有效負例仍先以 raw 模式重現請求；confined 模式拒絕並保留原碼，**零 request events、零 CSP violations**，後續正常圖可繼續。
- 額外 11 個有效負例涵蓋 HTML／Mermaid entities、相對圖片、SVG image/use、inline CSS、CSS escape、image-set、CSS variables、YAML CSS／字型。全部在 renderer CSP 介入前拒絕。
- 31 圖總覽、嚴格 host CSP、本機檔、故障復原、作者 class 色彩與 host selector 隔離皆通過。15 個 helper tests 包含 review 找出的展開總量、selector 與 dispose 回歸。
- 原生 renderer 的無效 CSS 被捨棄；不存在的本機 filter 轉為 `none`。圖片節點、資源 CSS、未支援函式／at-rule、相互衝突的 scoped variables 採拒絕政策，可能比 Mermaid 原生功能保守。
- 嘗試的 classDef URL fixture 不符合固定版語法，未算作安全通過，改驗證合法 class 顏色；policy 的 metadata 測試與有效 themeCSS 資源案例仍保留。

本輪 `results.json` SHA-256：`30b6d56ee0bbab04353f8efdec027c6bcbca42d82cabfcc8bb8a10faa9fe6741`；frame bundle SHA-256：`51829adb7437e03580ee2b6fa74eee749bb021830587f598ccefc0a1e0ab1394`。重現指令以 probe README 為準。此關卡允許進入 B，不等於正式產品、所有語法、安全全面性或 31 圖視覺驗收已完成。
