# Floating Sidebar Test Plan

2026-10-24 視覺已統一為 Anthropic 紙色導覽；搜尋歷史的空白重開、數字鍵盤與跨頁同步修正見 [導覽風格與搜尋歷史 Test Plan](sidebar-theme-search-history.md)。本文件的拖曳、文章幾何、raw／print 與生命週期契約仍保留；下方舊測試數字屬各輪歷史 receipt。

## 核准範圍

使用者選擇 A：左側滑出浮層，取代原本推開文章的側欄。文章依完整閱讀區計算寬度，保留 85% 或使用者設定；開關、拖曳側欄不可改變文章寬度、換行、圖表大小或閱讀位置。不新增模式選單、獨立視窗或任意位置拖曳。

- 保留大綱、檔案、搜尋、側欄按鈕／快捷鍵與既有寬度設定。桌面沿用儲存的開關狀態；960px 以下首次載入仍預設收起，與原本行為一致。
- 點文章或按 Escape 收起，不加 backdrop、不鎖文章捲動、不吃掉文章連結原本的點擊。搜尋先處理自己的 Escape。
- **邊緣顯示標準 col-resize 左右箭頭游標，可拖曳；pointerdown／move／up 都不可被當成關閉浮層。** 使用 pointer capture，放開後儲存 `sideWidth`，下次開啟／重載沿用。
- 取消、失去 capture、window blur 或 pagehide 會復原拖曳前寬度並清掉選取／游標狀態，不寫入取消的預覽值。
- 保留桌面 180–560px 限制；窄 viewport 顯示寬度再限制為 viewport 減 112px，讓側欄開關、Menu 與外部點擊區都可用且不重疊。只縮小視窗不覆寫儲存值，放大後回復原寬度。
- 提供五語 label、aria-expanded、可聚焦的垂直 separator 與寬度值；方向鍵每次調整 10px，Home／End 到有效上下限。
- 原碼／列印／收合時不可留下看不見的把手攔截文章。
- 拖曳中 viewport 改變會取消預覽，依新 viewport 恢復儲存偏好。次要觸控指標的取消／放開不可結束主指拖曳。
- 非同步設定只更新原目標分頁；明確狀態回覆可重複套用，快捷鍵仍切換該頁實際開關。儲存不可用時，既有頁面的拖曳與 Escape 保持可用。

## 實作落點

| 檔案                                        | 責任                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/style/index.less`                      | 移除文章側欄預留 padding；浮層、tabs、把手、關閉／raw／print hit-testing            |
| `src/main.ts`                               | 共用開關狀態、outside/Escape、pointer capture/cleanup、寬度持久化與 keyboard resize |
| `src/core/settings.ts`                      | viewport-aware `clampSideWidth`，保留未提供 viewport 時的舊契約                     |
| `src/background.ts`、`src/core/commands.ts` | 設定／快捷鍵在非同步工作前固定目標分頁，區別明確狀態與 toggle 意圖                  |
| `src/config/i18n/locale.json`               | 五語側欄開關／調整寬度標籤                                                          |
| `tests/e2e/floating-sidebar.e2e.mjs`        | 真正的 headed MV3 滑鼠拖曳與幾何／儲存驗證                                          |
| `tests/unit/settings.test.mjs`              | 320／390／1200／極窄 viewport 的上下限與預設                                        |
| `tests/unit/background-routing.test.mjs`    | 轉譯真正 background／commands，控制 storage 讀寫延遲與 active tab 切換              |

沒有新依賴、權限、後端、網路請求或 Mermaid renderer 變更。既有 `hiddenSide`／`sideWidth` 沿用 `chrome.storage.local`，無 schema migration。

## 永久驗收

| 情境                          | 觀察結果                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1200／390／320px 開關與拖寬   | 比對 article／paragraph／table／Mermaid frame 的 x、document top、width、height，誤差 <1px；段落 Range 行數與 scrollY 完全不變     |
| 真正滑鼠拖過原邊界／放開      | 浮層始終開啟，游標為 col-resize；寬度寫入 storage，重開與重載相同                                                                  |
| Escape／outside click         | 其他按鍵不移除 Escape listener；收合仍讓文章連結正常作用                                                                           |
| viewport 暫時變窄             | 480px 偏好在 320px 顯示為 208px，storage 仍為 480，回桌面恢復 480                                                                  |
| pointercancel                 | 真正拖曳加合成取消事件，復原 260px、不關閉、不儲存預覽值，清掉 selection lock                                                      |
| 五語／鍵盤                    | 真正操作 separator ArrowRight／Home／End，觀察 270／180／560 與儲存值                                                              |
| 原碼／列印                    | 把手不可見、不占有效 hit area；正常頁面無新增外部請求                                                                              |
| 搜尋／檔案樹回歸              | 完整既有 suite；不能假設前一個測試點過文章後側欄仍開啟，測試需先用實際按鈕開啟                                                     |
| Mermaid／CSS 回歸             | 全部既有 styles、lifecycle、31 圖種／372-output matrix 與 CSS preset／settings 案例                                                |
| IME／動畫                     | composing Escape 不關閉，搜尋先處理一般 Escape；等待動畫結束再判斷。收合立即 inert，滑出後才隱藏                                   |
| Portal／快捷鍵                | Escape 同時清掉 body 上的樹狀子選單；拖曳中的 background toggle 保持畫面與儲存狀態一致                                             |
| 無變化／取消                  | 窄頁只點把手不覆寫 480px；真正 lost capture、合成 blur/pagehide 復原寬度後仍可再次拖曳                                             |
| 分頁切換競態                  | 延遲 background 寫入 callback：A 要求收合後切到 B，A 收合、B 維持原狀，hiddenSide 不反寫；unit 另涵蓋 popup／shortcut 與無目標分頁 |
| 多指觸控                      | CDP 兩個 contact，結束次要 contact，主指仍可從 300 拖到 340px 並儲存；這是瀏覽器觸控模擬，未使用實體觸控螢幕                       |
| 拖曳中改 viewport             | 1200→320 與 320→1200 均取消預覽，恢復 208／480px；儲存維持 480，下一次拖曳可用                                                     |
| 窄頁 Menu dropdown            | 320px 文字區與 resize edge 上方均命中選單項目，可真的切換 raw                                                                      |
| 原碼鍵盤輸入                  | 原生 Tab 不聚焦 separator，合成方向鍵也不寫寬度；返回閱讀頁可再次鍵盤調寬                                                          |
| 鍵盤無變化                    | 窄頁 208px 按 ArrowRight 不覆寫 480px 偏好，回桌面仍為 480                                                                         |
| 明確狀態／快捷鍵              | 重複收合回覆不開啟側欄；窄頁首次收合時，toggleSide 可切換真實可見狀態                                                              |
| Extension context invalidated | 最後一例真正 chrome.runtime.reload，既有頁面可拖兩次並 Escape 收合，沒有 pageerror；不承諾失效腳本仍可儲存設定                     |

新 suite 遇到缺少瀏覽器直接失敗，不 skip。Pointercancel 的合成測試不等於每一種 OS／觸控中斷都已實測；完整 suite 也不代表 hosted CI 或商店驗收。

```sh
npm run test:unit
npm run typecheck
npm run build
node --test tests/unit/background-routing.test.mjs tests/unit/commands.test.mjs
node --test tests/e2e/floating-sidebar.e2e.mjs
npm run test:e2e
git diff --check
```

瀏覽器測試必須序列執行。截圖在忽略追蹤的 `dist/qa/floating-sidebar/`，log 在 `dist/sidebar-*.log`；這些檔案不會隨 Git 搬到另一台電腦，應按以上命令重建。

## 執行紀錄

- Baseline `fbe3d16`，worktree 乾淨，239 unit pass。
- 先寫測試觀察 RED：viewport unit 560≠256；桌面文章 x 329.375≠88.875；手機缺少可見把手；Escape、取消、ARIA、viewport、print 不符合新契約。既有寬度 persistence 本來就能通過。
- 第一版 GREEN：240 unit、typecheck/build 通過，新增 9/9 headed e2e 通過，零 skip/TODO。Raw 案例原本點到被選單遮住的 legacy raw 按鈕，改用既有可見的 Raw View 選單，不放寬原碼／print 斷言。
- 第一輪完整回歸 152/155，僅三項舊 extension fixture 依賴「側欄一直開啟」而失敗；已加實際按鈕開啟步驟，保留全部原斷言。其餘 Mermaid／file tree／settings 通過。
- 窄頁 viewport-64 使側欄開關與 Menu 重疊，改為 viewport-112；關閉 visibility 延到滑出後，inert 仍立即生效。兩項 browser RED→GREEN 已完成。
- 獨立 read-only review 的四個 P2 都接受：IME Escape、portaled tree submenu、窄頁只按放把手覆寫桌面偏好、拖曳中背景 toggle 儲存狀態不一致。均有實際瀏覽器 RED，再修前置 guard、closeMenus、無變化不寫回與實際開關狀態同步；不做第二輪 reviewer。
- 補 lostpointercapture 真正 release capture，以及合成 blur／pagehide，驗證復原與後續拖曳可用。IME 測試等待動畫結束，避免幾何在動畫起點造成 false green；這不代表已測所有 OS 輸入法。
- Final receipt：240/240 unit、164/164 完整 serial e2e、35/35 focused e2e 全數通過，零 fail/cancel/skip/TODO；其中 18 個為新的 floating-sidebar 案例。typecheck、production build、zip 與 diff 檢查通過，Chrome for Testing 147.0.7727.15。
- 完整回歸涵蓋既有 31 圖種／372-output matrix、Mermaid style/lifecycle/ZenUML、settings、CSS presets、搜尋歷史與 HTTP/file tree；人工檢查 1200／390／320px 浮層截圖。所有四項 reviewer P2 已以 browser RED→GREEN 修正，沒有延後的審查項目。
- 核准短設計、程式、測試與文件會一起存於本功能 commit；精確 SHA 以 git log 為準。基底為 fbe3d16，本輪不改 package version 1.8.2，不 push／tag／release。
- 沒有新 dependency／manifest permission／network 行為，已核對 PRIVACY 無須改寫。Hosted CI、商店載入、真實 OS 輸入法及 BFCache 命中率未驗證；合成 blur/pagehide/IME 僅是對應事件邊界的 regression。

### 2026-10-23：七項低機率缺陷修正

- 基底 `cc185ec`，原工作區乾淨，240/240 unit 通過。新增測試後、產品修改前，4/4 路由 unit 與 8/8 browser regression 均觀察到預期 RED；viewport 的兩個方向分別計一例。
- 修正清單：儲存例外解鎖、非同步目標分頁、多指 ownership、拖曳中 viewport／取消復原、Menu dropdown 層級、raw Tab 順序與鍵盤無變化寫回。另補明確狀態的重複回覆與窄頁快捷鍵契約。
- 接手入口：先看本節最終 receipt，再執行上列永久命令；不要把前一輪 240／164 的歷史數字當成這輪結果。
- 本輪維持 1.8.2，僅本機 commit，不 push／tag／release。無新依賴、權限或網路行為，PRIVACY 不需修改。

交接 checklist：

- [x] 先以永久測試重現七項缺陷。
- [x] 修正七項產品行為，244 unit、typecheck、production build 通過。
- [x] Astra 子代理唯讀複查：指定修正範圍無剩餘 actionable finding；它未執行 runtime 測試。
- [x] 完整序列 headed e2e 通過並記錄 receipt。
- [x] 檢查格式、zip 與 diff，更新本節結果；與修正一起本機 commit，SHA 以本節所在 Git commit 為準。

中間結果保留：第一輪 focused 25/27；觸控移動需等待 DOM 寬度更新，CDP 清理已結束的手勢不能掩蓋原始斷言。調整測試後，觸控與 lostcapture 兩項單獨重跑 2/2 通過；完整回歸結果另記，不把這次重跑當全套驗收。

最終 receipt：244/244 unit、173/173 完整序列 headed e2e 通過，零 fail/cancel/skip/TODO；其中 floating-sidebar 27/27。完整 e2e exit 0，408824 ms，包含 31 圖種／372-output matrix、Mermaid lifecycle／styles／ZenUML、CSS、settings、搜尋與 file tree。typecheck、production build、zip integrity、變更檔案 Prettier 與 git diff --check 均通過。

本機重建紀錄為 `dist/sidebar-fixes-{red-routing,red-browser,unit,typecheck,build,focused,regression}.log`；RED 與 focused 的中間失敗保留，最終完整結果以 `sidebar-fixes-regression.log` 為準。log 與截圖不隨 Git 傳遞，可依永久命令重建。實體多指觸控、hosted CI、商店與真實 BFCache 命中仍未驗證。
