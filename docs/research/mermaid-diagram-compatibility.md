# Mermaid 圖種相容性測試

## 結論

以目前 md-reader、內含的 **Mermaid 9.1.6** 與真實 headed Chromium 擴充功能實測。Original 與 Anthropic blog style 的結果相同：**11/31 種可以產生圖表，20/31 種目前不支援**。不支援的圖之後仍能正常渲染其他圖表。

這是圖種支援範圍測試，不代表所有圖表已完成視覺驗收，也沒有升級 Mermaid。可直接開啟 [31 種圖檢查頁](../../example/mermaid-compatibility.md) 比較；只看正常圖表的風格請使用 [風格檢查頁](../../example/mermaid-styles.md)。

## 來源與方法

- 清單來源：[Mermaid 官方文件側欄](https://mermaid.js.org/ecosystem/integrations-community.html)，涵蓋使用者指定的全部 31 種圖。
- 語法來源：檢查頁每節連到對應的官方文件。本專案自行撰寫閱讀器情境的簡短範例，未直接複製整份官方範例。
- 查閱的官方原始文件固定點：[mermaid-js/mermaid `6d8921f94f9a12b76586eddcf45a566080d4767e`](https://github.com/mermaid-js/mermaid/tree/6d8921f94f9a12b76586eddcf45a566080d4767e/packages/mermaid/src/docs/syntax)。線上文件會持續更新，不等於本專案安裝的版本。
- 本機依賴鏈：`@md-reader/markdown-it-mermaid@0.5.1 → mermaid@9.1.6`。wrapper 目前使用同步 `mermaidAPI.render`。
- 執行 `npm run build` 後，以 `tests/e2e/_harness.mjs` 載入真正的 `extension/`，逐張測試兩種風格，共 62 次圖種探測。
- 每張圖後附正常流程圖，確認遇到不支援語法不會阻斷後續內容。另在 1200×900 與 390×844 跑完整混合頁。
- 渲染成功須有非零大小的 SVG、可見標籤且沒有 Mermaid error SVG。這不等於文字、配色與連線布局已經人工驗收。
- 測試開啟離線模式；被測分頁沒有發出非 loopback 的 HTTP(S) 請求。此檢查不外推為所有瀏覽器背景活動的網路稽核。

## 逐項結果

「可渲染」指本次範例有正常 SVG；「不支援」指目前的擴充功能無法渲染，並非沒有測試。兩種風格均逐項執行，未略過不支援項目。

| 圖種                        | Original | Anthropic blog style | 備註                                            |
| --------------------------- | -------- | -------------------- | ----------------------------------------------- |
| Flowchart                   | 可渲染   | 可渲染               | 包含中文標籤與判斷分支                          |
| Swimlanes Diagram           | 不支援   | 不支援               | 官方標示 11.16.0+                               |
| Sequence Diagram            | 可渲染   | 可渲染               | 包含角色、註記與回應                            |
| Class Diagram               | 可渲染   | 可渲染               | 包含屬性、方法與組合關聯                        |
| State Diagram               | 可渲染   | 可渲染               | 包含起點、終點與轉移                            |
| Entity Relationship Diagram | 可渲染   | 可渲染               | 包含欄位與關聯                                  |
| User Journey                | 可渲染   | 可渲染               | 包含階段與分數                                  |
| Gantt                       | 可渲染   | 可渲染               | 使用固定日期                                    |
| Pie Chart                   | 可渲染   | 可渲染               | 包含標題與分類                                  |
| Quadrant Chart              | 不支援   | 不支援               | 目前版本沒有此圖種                              |
| Requirement Diagram         | 可渲染   | 可渲染               | `type` 使用 `browser`，避開保留字 `test`        |
| Use Case Diagram            | 不支援   | 不支援               | 官方標示 12.0.0+                                |
| GitGraph (Git) Diagram      | 可渲染   | 可渲染               | Original 窄螢幕有已知超寬問題，見下節           |
| C4 Diagram                  | 可渲染   | 可渲染               | Anthropic 下仍有原生藍色節點；視覺整合未完成    |
| Mindmaps                    | 不支援   | 不支援               | 官方說明 9.3 外掛方式、9.4 起內含；目前僅 9.1.6 |
| Timeline                    | 不支援   | 不支援               | 目前版本沒有此圖種                              |
| ZenUML                      | 不支援   | 不支援               | 官方整合須註冊額外套件；本專案尚未加入          |
| Sankey                      | 不支援   | 不支援               | 官方標示 10.3.0+                                |
| XY Chart                    | 不支援   | 不支援               | 目前版本沒有此圖種                              |
| Block Diagram               | 不支援   | 不支援               | 目前版本沒有此圖種                              |
| Packet                      | 不支援   | 不支援               | 官方標示 11.0.0+                                |
| Kanban                      | 不支援   | 不支援               | 目前版本沒有此圖種                              |
| Architecture                | 不支援   | 不支援               | 官方標示 11.1.0+                                |
| Radar                       | 不支援   | 不支援               | 官方標示 11.6.0+                                |
| Event Modeling              | 不支援   | 不支援               | 官方標示 11.15.0+                               |
| Treemap                     | 不支援   | 不支援               | 目前版本沒有此圖種                              |
| Venn                        | 不支援   | 不支援               | 官方標示 11.12.3+                               |
| Ishikawa                    | 不支援   | 不支援               | 官方標示 11.12.3+                               |
| Wardley                     | 不支援   | 不支援               | 官方標示 11.14.0+                               |
| Cynefin                     | 不支援   | 不支援               | 官方標示 11.16.0+                               |
| TreeView                    | 不支援   | 不支援               | 官方標示 11.14.0+                               |

未用另一個新版 renderer 執行目前不支援的 20 份範例，因此不能把「參考新版文件撰寫」宣稱為「新版執行驗證通過」。升級時須逐一確認語法、套件可用性與本機載入方式。

## 發現與邊界

1. **Original GitGraph 窄螢幕超寬。** 在 390px viewport、預設側欄配置下，圖框可用寬度 235px，SVG 約 304px。Anthropic 相同案例能縮進圖框。永久測試另有實際執行且目前失敗的 TODO，保留這個缺口；沒有把它當成窄螢幕通過，也沒有在本次稽核修改產品 CSS。
2. **C4 只有渲染通過，風格整合不完整。** 人工檢查 `anthropic-blog-14.png`，紙面外框已改變，但節點仍為 C4 原生藍色、內部文字仍呈現原生風格，連線標籤也靠近節點邊界。不可宣稱所有內部元素都採 Anthropic 風格。
3. **不支援項目目前顯示 `undefined`。** 舊 wrapper 捕捉 Mermaid 丟出的物件後取 `error.message`，該物件不一定有 message。這是錯誤呈現缺口；後面的正常圖仍能渲染。本次只記錄，未改動產品錯誤處理。
4. **單改版本號不足以完成升級。** 現有 wrapper 是同步 API，較新的 Mermaid 與外掛涉及非同步渲染／註冊，還要驗證 MV3、本機封裝、CSP、離線零外送、主題隔離及圖表檢視器。ZenUML 官方範例使用 `registerExternalDiagrams`，不能只新增選單就宣稱支援。

## 永久 Test Plan

測試檔：[`tests/e2e/mermaid-compatibility.e2e.mjs`](../../tests/e2e/mermaid-compatibility.e2e.mjs)。直接解析 Markdown 範例作為 fixture，避免測試與使用者看的圖表分成兩份。新增檔案符合既有 `test:e2e` glob，會自動納入本機全套 e2e；不新增 Playwright 依賴，不改 CI。

```sh
npm run build
node --test tests/e2e/mermaid-compatibility.e2e.mjs
```

驗證項目：

- 31 個圖種的名稱、順序與非空範例必須齊全；版本須仍為已稽核的 9.1.6。
- 11 個支援項目 × 2 種風格：非空 SVG、標籤、尺寸與錯誤圖檢查。
- 20 個不支援項目 × 2 種風格：確認目前仍不支援且不會消失；後續正常流程圖必須可渲染。
- 完整 31 圖混合頁 × 2 種風格 × 2 種 viewport：驗證前後圖表隔離與支援項目的初始寬度。Original 窄螢幕 GitGraph 的已知缺口由獨立 TODO 執行。
- 被測分頁不得對非 loopback 的 HTTP(S) 位址發出請求。
- 升級 Mermaid 時須重新稽核 baseline，移除已解決的 TODO，將新增支援項目改為正向 SVG 驗證。不得只改 expected 數量讓測試變綠。

本次結果：**67 pass、0 fail、1 todo、0 skipped**。TODO 是已重現的 Original 窄螢幕 GitGraph 問題；Node 將這個預先標記的失敗算入 todo，不能視為已修好。其餘 40 個不支援案例的測試通過，代表符合已記錄的限制與復原行為，**不代表那些圖已可渲染**。

產物保存在忽略追蹤的 `dist/qa/mermaid-compatibility/`：`results.json` 含 62 次探測與 44 次布局量測，另有 22 張支援圖種截圖、4 張完整頁截圖與 1 張 GitGraph 問題截圖。只人工抽查 C4、Requirement 與 GitGraph 問題圖，完整視覺驗收仍由使用者檢查。

## Regression Plan

```sh
npm run test:unit
npm run typecheck
node --test tests/e2e/mermaid-styles.e2e.mjs
git diff --check
```

既有 Mermaid 風格測試持續涵蓋設定選單、亮暗主題、CSS preset、作者配色／主題優先、閱讀位置、圖形保留、DOT 分流及行動版。此稽核沒有修改產品程式、依賴、版本號或發佈設定，不取代完整 release gate。

本次迴歸結果：213/213 unit tests、20/20 既有 Mermaid e2e、typecheck、Prettier 與 `git diff --check` 通過。Production build 成功，仍有既有的 webpack bundle-size 警告；沒有執行其他非 Mermaid e2e suites。
