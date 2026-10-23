# 浮動欄 Anthropic 風格與搜尋歷史 Test Plan

## 設計與核准範圍

基底 `8ed448d`，工作區原本乾淨。使用者要求左側浮動欄也使用 Anthropic blog style，並釐清「搜尋歷史上限」、記錄時機與已有測試，回報按 Enter 後看不到紀錄。

視覺沿用設定面板：紙色 `#faf9f5`、表面 `#f1eadf`、文字 `#24231f`、次要文字 `#656259`、強調色 `#a34f37`、分隔線 `#d9d3c8`。頁籤及主要標題使用本機 Georgia／serif，操作與搜尋文字使用本機 sans-serif。導覽固定淺色，與文章 light／dark、CSS 客製化分開；包含大綱、檔案、搜尋、候選、FSA 說明、排序選單與 body portal。保留側欄尺寸、拖曳、層級、outside/Escape 與文章不重排的契約。

歷史存在本機 `chrome.storage.local`，全文件共用；預設保留 10 筆，最多 100，0 停用，清除按鈕刪除歷史。停用時不新增紀錄，也不因停用而刪除既有紀錄。按 Enter／數字鍵盤 Enter 或選取候選時記錄，單純輸入只即時搜尋，不儲存每個輸入片段。中文組字中的 Enter 只確認選字，完成組字後再按 Enter 才確認搜尋。紀錄去空白、大小寫不敏感去重，最新使用的詞在最前面。

空白搜尋開啟時顯示最近歷史，輸入後即時篩選；ArrowUp／ArrowDown 選取，Tab 補完，Shift+Tab 保留反向焦點。重載後沿用儲存紀錄；已開文件同步新增／清除／上限，避免舊陣列覆寫另一頁的紀錄。設定說明同步五種語言。

## Checklist

- [x] 讀取既有搜尋／持久化路徑及 settings unit、extension e2e。
- [x] 新增 browser RED：四種視覺情境及四項歷史缺陷；中文 IME 案例原本通過。
- [x] 套用 scoped 導覽 tokens，不污染文章／圖表或改動幾何。
- [x] 修正歷史記錄／呈現／跨分頁同步並補相關 unit。
- [x] 驗證鍵盤、兩個搜尋模式、上限／清除、跨頁與重載。
- [x] 1200／390／320 px 截圖與實際操作驗收。
- [x] 完整 unit／typecheck／build／serial e2e／zip／格式檢查。
- [x] 更新 developer guide、架構、lessons learned 與最後 receipt。
- [x] 本機 commit，含 Why／What／How／Boundary；不 push／tag／release。精確 SHA 以本節所在 commit 為準。

## 永久測試

既有 `tests/unit/settings.test.mjs` 驗證上限解析、去重／排序／裁切與候選比對。`tests/e2e/extension.e2e.mjs` 原本已驗證 Enter 儲存、Tab／點選補完、候選字型一致，以及設定清除。這些通過不能外推成所有鍵盤、空白重開與多文件情境都通過。

`tests/e2e/sidebar-theme-history.e2e.mjs` 檢查實際 CSS、DOM、鍵盤及 Chrome storage。測試各自用新頁面避免前例的搜尋／Files session 狀態污染；同一案例內保留真實 close/reopen/reload。保留既有浮層、Mermaid、安全與設定介面完整回歸。

```sh
npm run test:unit
npm run typecheck
npm run build
node --test tests/e2e/sidebar-theme-history.e2e.mjs
npm run test:e2e
git diff --check
```

瀏覽器測試序列執行，不 skip。截圖在 `dist/qa/sidebar-theme-history/`，log 在 `dist/sidebar-theme-history-*.log`；這些產物被 Git 忽略，換電腦後按命令重建。

## 執行紀錄

- 修正測試夾具後的 baseline：9 項中 8 RED、1 GREEN。四個視覺情境仍為舊藍灰／黑色；空白重開沒有候選、NumpadEnter 沒寫入、第二頁將 `['Alpha']` 覆寫成 `['Beta']`、外部清除後仍保留一個可見候選。IME 確認及其後 Enter 原本就通過。
- 第一版測試曾等候窄頁預設隱藏的 tabs，並受前例 Files／搜尋 session 影響。改為等待文章及操作真實展開按鈕、各案例使用新頁面後重新取得產品 RED，不將夾具錯誤當產品缺陷。
- 最終數字與 commit 以完成後的 receipt 為準；本輪不新增依賴／權限／網路行為，版本維持 1.8.2。
- Search panel／settings／background queue 的實際模組測試先 11 RED，再 69/69 GREEN；完整第一輪 293 unit，補 Shift+Tab 後 294。背景佇列也驗證併發提交及 clear／limit 的先後順序。一般 Enter、NumpadEnter、中文、空白、停用、候選點選／Tab／Enter、同步與 focus 皆有對應案例。
- 獨立唯讀 review 指出同步會清掉仍存在的鍵盤選取；補 Enter／Tab 兩個 unit 與 browser RED，再以候選值保留選取，包含大小寫變體。另以實際 tab message 重現舊 setting echo 蓋過新 native storage 值，修正後 history／limit 只以原生 storage 事件為準。這三項新增 browser RED 保留於 `sidebar-theme-history-sync-red.log`。
- 第一輪整合 11/11 browser 通過，已人工檢查 1200／390 搜尋截圖；補同步選取與過期回覆後，最終專項 14/14 通過。完整 gate 另記，不能把中間數字當最終結果。

## 最終驗收 receipt

- 296/296 unit、194/194 完整序列 headed e2e 通過，零 fail／cancel／skip／TODO。完整 e2e exit 0，619564 ms；其中本功能專項 14/14。保留既有浮層拖曳／幾何、31 圖種／372-output matrix、Mermaid 生命週期／沙盒、五語設定、CSS 與檔案樹回歸。
- typecheck、production build、zip integrity、變更檔案 Prettier 與 git diff --check 通過。人工檢查大綱、搜尋及排序 portal 截圖，含 1200 桌面與 390 窄頁／dark 文章；320 另有 browser palette／操作驗證與截圖。
- `sidebar-theme-history-unit.log`／`typecheck.log`／`build.log`／`focused.log`／`regression.log` 保留於 dist；baseline 與兩輪同步 RED log 同樣保留。截圖與 log 不隨 Git 傳遞，來源測試及本文件可永久重跑。
- 單純輸入或直接點文章搜尋結果仍不新增歷史；確認 query 或使用歷史候選才會記錄。兩種搜尋模式都可共用紀錄，重載保留。停用／再啟用保留原有詞，清除才刪除。
- 使用 Chrome for Testing 147.0.7727.15。本輪 IME 驗證為真實鍵盤操作加合成 composing 事件，未涵蓋所有實體輸入法。Hosted CI／商店未執行；未 push／release，版本保留 1.8.2，無新 dependency／permission／network 行為。
