# 檔案樹瀏覽正式化設計

**日期：** 2026-09-03
**分支（預定）：** `feature/file-tree-browsing`
**狀態：** 設計已與使用者確認，待寫實作計畫

## 背景

使用者回報本機 `file://` md 檔開啟後,「檔案」頁籤要先跳 File System Access（FSA）的「選擇資料夾」授權按鈕才能瀏覽同層檔案,體感像多一道權限關卡。追查後在本 session 已用 Playwright 對照真實授權情境完成兩項原型驗證（皆已在 `main` 分支未提交、`extension/` 已建置可試用）：

- **原型 A**：隔離世界（content script isolated world）對 `file://` **目錄**網址發 XHR，即使已授予「允許存取檔案網址」也在網路層被 Chrome 拒絕（`readyState:4` + `onerror`，非空回應那種失敗）——這與「讀單一已知檔案」（`charsetCompat` 依賴的機制）不同，Chrome 把「列舉目錄」與「讀已知檔案」視為不同風險等級。改用**隱藏 iframe + `content_scripts` 新增一則 `all_frames:true` 條目**讀取 Chrome 原生產生的目錄列表頁（`addRow(...)` 格式）：iframe 導覽後，我們自己的程式碼被注入進**那個 iframe 裡**（讀自己的頁面，非跨 frame 讀別人的），用 `postMessage` 把解析結果傳回外層頁面。根目錄與子資料夾展開皆已實測成功，不再顯示 FSA 授權面板、分頁不離開。
- **原型 B**：檔案樹排序/篩選/摺疊全部工具列（參照使用者提供的商店版 CRX 截圖）。Chrome 原生 `addRow()` 格式本身即含 `size`／`date_modified`（epoch 秒）欄位，`src/core/dir-listing.ts` 的 `parseChromeListing` 已擴充解析出 `sizeBytes`／`mtimeMs`。已用真實情境測試驗證：依名稱/大小/日期排序（含降冪）、資料夾置頂、隱藏檔案顯示/隱藏、摺疊全部，邏輯全數正確。

使用者試用兩個原型後提出四項回饋，本設計將原型正式化並納入這四項修正。

## 範圍（六項）

1. 本機 `file://` 免跳過 FSA（原型 A 正式化 + 安全/相容性收尾）
2. 排序/篩選/摺疊全部工具列（原型 B 正式化 + 視覺精簡）
3. 點檔案連結後不切回大綱頁籤（連續瀏覽多個檔案）
4. 離線/隱私模式開啟時，同伺服器 http(s) 目錄列表仍可用（範圍已與使用者確認：**不含** GitHub 目錄樹）
5. 對應的 `tests/e2e/` 正式測試
6. `docs/developer_guide.md` / `PRIVACY.md` / `README.md` 隱私措辭同步

**非範圍**：排序設定不做跨頁/跨分頁持久化（沿用原型行為，每次重整回預設「名稱昇序」）；GitHub 目錄樹的離線封鎖行為不變。

## 全域約束

- **零權限鐵律**：`permissions` 僅 `["activeTab","storage"]`，不得新增 `host_permissions`。原型 A 的新 `content_scripts` 條目（`all_frames:true`）不是權限、不涉及 host_permissions，但**擴大了程式碼注入的頁面範圍**（見下），須誠實揭露。
- 既有測試（191 條單元 + 8 條 e2e）不得回歸。
- commit 訊息 Why/What/How/Boundary 四段。

---

## 項目 1：本機 file:// 免跳過 FSA

**檔案：** `src/manifest.json`、`src/main.ts`、`src/core/dir-fetch.ts`

### 架構

- `manifest.json` 的 `content_scripts` 新增一則：`{ "js": ["js/content.js"], "matches": ["file://*/*/", "file:///"], "all_frames": true }`（原型已驗證此寫法可行）。
- `main.ts` 頂部（`storage.get().then(main)` 之前）保留原型的 frame-probe 回應分支：以 URL hash 標記 `#md-reader-dir-probe` 判斷「這是我們自己建立的探測 iframe」，避免誤觸發於使用者真的手動瀏覽到的 file:// 目錄頁（那種情況沒有此 hash，會照常落入 `main()` 的既有 content-type 閘門，直接 no-op）。
- `initFilesContent()` 的 file:// 分支：**移除**現有「先嘗試 `fetchDirListing`（內部對目錄網址發 XHR）」這一步，直接呼叫 frame-probe（`probeDirViaFrame`）。原因：實測 XHR-to-directory 在隔離世界必定失敗且瀏覽器會在 devtools console 印出無法被 JS 攔截的網路層錯誤（`Access to XMLHttpRequest ... blocked by CORS policy`）——這不是我們能 catch 抑制的，唯一乾淨的做法是不發這個必敗的請求。
- frame-probe 失敗（極端環境限制、逾時）時，維持原有 FSA `showDirectoryPicker()` 邏輯作為**最後一層備援**——FSA 是瀏覽器原生 API，不需要「允許存取檔案網址」權限，任何環境都能用，適合當保底。

### 安全與相容性收尾（新增於原型之上）

- **postMessage 驗證加強**：接收端（父頁）除了現有的 `e.data.__mdReaderDirProbe === true` 格式檢查，額外驗證 `e.source === iframe.contentWindow`（確認訊息真的來自我們剛建立的那個 iframe，不是頁面上其他來源的訊息）。file:// 頁面的 `event.origin` 通常是字串 `"null"`，對 origin 做字串比對意義有限，改用 `source` 引用比對更可靠。
- **`content_scripts` 注入範圍擴大的誠實揭露**：這則新條目讓我們的程式碼會被 Chrome 注入到**使用者瀏覽的任何 `file://` 目錄頁**（不限含 markdown 檔的資料夾），雖然目前的 `main()` 既有 content-type 閘門會讓它在真實使用者瀏覽情境下完全 no-op（無 UI、無副作用），但這仍是「我們的程式碼在哪裡執行」的實質擴大，需寫入 `PRIVACY.md`（見項目 6）。

### 驗收

- Playwright：真實授權情境（`newAllowFileAccess:true`，模擬 unpacked 擴充預設狀態）下開本機 `.md` 檔，點「檔案」頁籤，斷言**不出現** FSA 授權面板、樹狀清單正確顯示同層檔案+子資料夾；展開子資料夾同樣正確。
- Playwright：手動建立一個真實的（無 hash 標記的）file:// 目錄頁直接導覽，斷言頁面**無任何我們注入的 UI**（no-op 確認）。
- Playwright：故意讓 frame-probe 逾時／失敗（例如導覽到不存在的路徑），斷言正確降級到 FSA 面板。

---

## 項目 2：排序/篩選/摺疊全部工具列

**檔案：** `src/core/file-tree.ts`、`src/core/dir-listing.ts`（已完成，沿用原型）、`src/config/class-name.ts`、`src/config/i18n/locale.json`、`src/style/index.less`、`src/images/icon_tree_settings.svg`（新增）

### 沿用原型的邏輯

`sortBy`（name/size/date）× `sortDesc` × `foldersFirst` × `showHidden` 四個狀態，`sortAndFilter()` 純函式套用；`collapseAll()` 以 DOM 查詢 `TREE_DIR_OPEN` 節點關閉；設定變更後 `rerenderRoot()` 用既有 `cache` 重繪（不重新 fetch）。狀態不持久化，重整頁面回預設。

### 視覺精簡（回應使用者「字型太大、要視覺化」）

- 觸發鈕從文字齒輪符號 `⚙` 改為 SVG 圖示（新建 `src/images/icon_tree_settings.svg`，比照既有 `icon_code.svg`／`icon_side.svg` 走 `svg()` helper 慣例），視覺上與側欄其他按鈕（`SIDE_EXPAND_BTN`／`CODE_TOGGLE_BTN`）一致。
- 下拉選單字級由目前繼承頁面字級（14–16px）縮小為 **11px**；選項按鈕 padding 同步收斂（`5px 8px` → `3px 6px`），排序列（名稱/大小/日期、昇序/降序）維持橫向三/二等分按鈕但整體高度降低，視覺上更貼近截圖中商店版的精簡選單密度。
- 選中狀態沿用原型已有的 `TREE_SETTINGS_OPTION_ACTIVE`（背景色標示），不額外做勾選圖示（YAGNI：背景色已足夠清楚，避免為此再引入新圖示資源）。

### 驗收

- Playwright（沿用原型驗證腳本正式化）：依大小排序（含降冪）、隱藏檔案顯示/隱藏、摺疊全部，逐項斷言渲染順序與展開狀態正確。
- 目視/截圖確認新版下拉選單字級與間距（不寫成自動化斷言，人工過一次即可，避免為單純視覺尺寸寫脆弱的像素級測試）。

---

## 項目 3：點檔案連結後不切回大綱頁籤

**檔案：** `src/main.ts`

### 現況與根因

`renderFileNode`（`file-tree.ts`）渲染的是一般 `<a href>`，點擊即觸發**真實頁面導覽**（非 SPA 內容替換）。`main.ts:310` 的 `let activeTab: 'outline' | 'files' = 'outline'` 是每次頁面重新載入都會重置的記憶體變數，故導覽到下一個檔案後永遠從「大綱」頁籤開始，即使使用者剛才明明在「檔案」頁籤瀏覽。

### 做法

- 改用 `sessionStorage`（同分頁存活、分頁關閉即清除、不寫入 `chrome.storage` 全域設定、不污染網址）記住目前 active 頁籤：`key = 'md-reader:activeTab'`，值為 `'outline' | 'files'`。
- `activateTab(tab)` 呼叫時同步寫入 `sessionStorage.setItem(...)`；初始化 `activeTab` 時改讀 `sessionStorage.getItem(...) as 'outline'|'files' ?? 'outline'`（讀不到或值非法時退回預設 `'outline'`，防禦寫壞的值）。
- `folderTree` 設定為 `false`（使用者手動關閉檔案功能）時，維持既有 `setFolderTree` 邏輯強制切回 `'outline'` 且**不寫入** sessionStorage 這次的強制切換（避免使用者之後重新打開 `folderTree` 卻发現頁籤記憶被覆蓋成大綱）。

### 驗收

- Playwright：開檔案 A → 點「檔案」頁籤 → 點清單中的檔案 B → 斷言導覽到 B 後，「檔案」頁籤仍是 active 狀態（不是大綱）。
- Playwright：`folderTree` 關閉時開檔案，斷言強制顯示大綱且不影響下次 `folderTree` 開啟後的頁籤記憶（若 sessionStorage 先前記的是 `'files'`）。

---

## 項目 4：離線模式下同伺服器 http(s) 目錄列表解封

**檔案：** `src/main.ts`（`initFilesContent`）

### 範圍（已與使用者確認）

**只解封同伺服器的 http(s) 目錄列表**（`initFilesContent` 中非 GitHub 分支的 `fetchDirListing(rootDir)`）。GitHub 目錄樹（`raw.githubusercontent.com` 頁呼叫 `api.github.com`，不同主機）**維持離線封鎖不變**，因為那是對一個全新第三方主機的請求，不是「已建立信任關係的同一伺服器」。

### 理由（使用者原話）

「已經對那網站做 md 請求了，使用者主動點擊列表再抓取是沒問題的」——載入目前這份 md 檔本身就已經是對這台伺服器的一次網路請求，該伺服器已經知道使用者的存在；點開「檔案」頁籤瀏覽同一伺服器的目錄清單，是對**同一個既有信任關係**的延伸，不是新增暴露面。

### 做法

`initFilesContent()` 現有判斷：

```ts
if (!isFile && !isNetworkAllowed(configData.offlineMode)) {
  buildTree(undefined, 'default', null, localize('offline_blocked'))
  return
}
```

改為：僅在 **GitHub 分支**（`gh` 不為 null）套用 `isNetworkAllowed` 檢查；同伺服器 http(s) 分支移除此檢查，直接嘗試 `fetchDirListing(rootDir)`。

### 與項目 3 的交互（設計推論，已在確認設計時向使用者明講）

項目 3 讓「檔案」頁籤的 active 狀態跨頁導覽記住。若使用者在檔案 A 的「檔案」頁籤點了檔案 B，導覽到 B 後（依項目 3）自動還原顯示「檔案」頁籤——此時若 B 也是同伺服器 http(s) 頁面，目錄列表的 fetch 也應該直接發生，不需要使用者在 B 頁面上再點一次「檔案」頁籤才觸發。理由：**這個瀏覽階段（session）使用者已經表達過「我要瀏覽這個資料夾」的意圖**，讓每一頁都要求重新點擊才抓，會讓項目 3 的連續瀏覽體驗變得沒有意義。實作上這自然發生——因為項目 3 讓 `activateTab('files')` 在頁面初始化時就被呼叫（不是等使用者點擊），而 `ensureFilesPanel()`／`initFilesContent()` 是掛在 `activateTab('files')` 底下、不分是被點擊觸發還是初始化時還原觸發，兩者共用同一段程式碼路徑，不需要額外分支。

### 驗收

- Playwright：開啟同伺服器 http(s) md 檔、`offlineMode:true`，點「檔案」頁籤，斷言目錄列表正確 fetch 且顯示（不再是 `offline_blocked` 訊息）。
- Playwright：`offlineMode:true` 下開啟 `raw.githubusercontent.com` 頁面，斷言 GitHub 目錄樹**仍然**顯示 `offline_blocked`（迴歸鎖定：確保這次改動沒有連帶解封 GitHub 分支）。
- Playwright：串接項目 3 情境——A 頁「檔案」頁籤點 B（同伺服器）→ B 頁面初始化時自動顯示已 fetch 好的目錄列表，不需要在 B 頁面上再次點擊。

---

## 項目 5：正式 e2e 測試

**檔案：** `tests/e2e/file-tree-browsing.e2e.mjs`（新增）

彙整上述項目 1–4 各自列出的 Playwright 驗收案例，寫成 `tests/e2e/` 下的正式測試檔（沿用 `tests/e2e/_harness.mjs` 共用夾具），取代目前 scratchpad 裡的丟棄式驗證腳本。需要建立一個本機測試用資料夾夾具（含至少一個子資料夾、一個隱藏檔、多個不同大小/時間的 md 檔，比照本 session 使用的 `fsa-probe-dir/` 結構）與一個假想的多頁同伺服器 http 測試夾具（供項目 3+4 串接情境使用）。

## 項目 6：隱私文件同步

**檔案：** `docs/developer_guide.md`、`PRIVACY.md`、`README.md`

- `developer_guide.md` 的「離線模式——五處 egress 閘門」表格：站點 2（http/https 目錄樹）的閘門機制欄位改為「僅 GitHub 分支受 `isNetworkAllowed` 把關；同伺服器分支不受離線模式限制（同伺服器信任關係已建立，使用者主動瀏覽）」。
- 新增一段揭露 `content_scripts` 的 `all_frames:true` file:// 目錄頁條目：程式碼會被注入到使用者瀏覽的任何本機 file:// 資料夾頁面（含未開啟任何 markdown 功能的資料夾），但既有 content-type 閘門保證除了我們自己建立的探測 iframe 外一律 no-op。
- `PRIVACY.md`／`README.md`：措辭從「離線模式封鎖 http/https 目錄樹」調整為「離線模式封鎖跨主機／背景性質的請求（GitHub API 目錄樹、自動刷新、PlantUML 等）；使用者主動瀏覽**同一伺服器**檔案清單不在此限，因為讀取當前文件本身即已建立與該伺服器的連線」——需同步中英文兩處。

---

## 測試總覽

- **單元測試**：`sortAndFilter`／`collapseAll` 邏輯的純函式部分（若拆得出不依賴 DOM 的部分）補單元測試；`initFilesContent` 的 GitHub vs 同伺服器分支判斷邏輯若可抽成純函式（例如 `shouldBlockDirListing(gh, offlineMode)`），一併補單元測試涵蓋四種組合（GitHub× 開/關離線、同伺服器 × 開/關離線）。
- **e2e**：項目 1–4 逐項列出的案例彙整進 `tests/e2e/file-tree-browsing.e2e.mjs`，加上既有 `folder-tree.e2e.mjs`／`extension.e2e.mjs` 全數重跑確認不回歸。

## 風險與注意

- **postMessage 來源比對**（項目 1）：`e.source === iframe.contentWindow` 需在 iframe `onload` 之後才能可靠取得，時序需注意（探測 iframe 建立與訊息監聽器註冊的先後順序，避免競態漏收第一則訊息）。
- **sessionStorage 與現有 `hiddenSide`／`folderTree` 等 `chrome.storage` 設定分屬不同持久化層**（項目 3）：需在文件裡講清楚兩者差異，避免日後誤以為頁籤狀態也存在 `chrome.storage.local`。
- **項目 4 的措辭改動是隱私宣稱的實質變更**，上線前建議在 release note／commit 訊息裡明確標註這是使用者確認過範圍的刻意決策，附上本設計文件連結，避免日後被誤認為隱私倒退。
