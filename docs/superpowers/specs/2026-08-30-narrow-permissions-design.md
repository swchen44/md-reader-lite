# 設計＋計畫（合併文件）：移除 host_permissions，改同源 fetch

日期：2026-08-30 ／ 分支：`feature/narrow-permissions` ／ 狀態：使用者已核可方向（選項：全部拿掉）

## 背景

Chrome Web Store 對 `host_permissions: *://*/*` 觸發深入審查警告。盤點後，host 權限僅供 background 代理兩種**同源**請求（自動刷新重抓目前 md 檔、目錄樹抓同目錄 listing）。content script 在頁面 origin 內可直接同源 fetch，無需任何 host 權限；background 代理唯一的附加價值是繞過極少數網站的頁面 CSP（如 raw.githubusercontent.com 的 `default-src 'none'`）。

## 決策

移除 `host_permissions`，permissions 縮為 `["activeTab", "storage"]`。接受的降級：嚴格 CSP 網站上自動刷新（預設關閉）與目錄樹（該類 CDN 本無 autoindex）失效；渲染不受影響（內容來自 DOM）。file:// 現況維持（XHR 嘗試 + 訊息降級，現代 Chrome 本已封鎖）。

## 變更清單

1. `src/manifest.json`：刪除 `host_permissions`。
2. `src/core/dir-fetch.ts`：`fetchDirListing` 改為 content script 直接抓——http(s) 用 `fetch(dirUrl, { signal: AbortSignal.timeout(5000), cache: 'no-store' })`，`!res.ok` 即 throw；`file:` 維持走 `xhrGet`。移除 background 訊息與 lastError 處理；簽名 `Promise<DirEntry[]>` 不變；註解同步改寫。
3. `src/main.ts` `polling()`：`chrome.runtime.sendMessage({action:'fetch'})` 改為 `fetch(window.location.href, { cache: 'no-store' })` 取 text；失敗（含 file://、CSP 擋）視同 `res === undefined` 的既有分支，繼續下一輪 polling。原有比較/重渲染/rawContainer 更新邏輯不動。
4. `src/background.ts`：移除 `fetch`、`fetchDir` 兩個 case 與 `fetchData`、`fetchDirHtml`、origin 檢查 helper、逾時常數；保留 storage case、commands、actionMap。
5. 文件同步：`docs/store-listing.md` 權限表刪 host_permissions 列並註明 permissions 僅 activeTab+storage；`PRIVACY.md` 權限段改寫（無 host 權限；僅頁面情境的同源請求）；`docs/ARCHITECTURE.md` background 職責改「storage 訊息與 actionMap 轉發」；`docs/lesson_learn.md` 追加第 8 條（同源請求走 content script 免 host 權限；background 代理只為繞頁面 CSP，代價是全站權限）。

## 驗收

- 30 條測試、tsc、建置打包全綠；zip 內 manifest 無 host_permissions。
- Playwright 實測（http）：目錄樹載入/展開正常（走 content-script fetch）；開啟自動刷新後修改檔案內容 2 秒內畫面更新。
- grep：src/ 無 `fetchDir`、background 無 fetch 代理殘留。

## Commit 切分

1. `perm: drop host permissions in favor of same-origin page fetches`（manifest + dir-fetch + main + background）
2. `docs: align store listing, privacy and architecture with narrowed permissions`（四份文件）
   （皆四段訊息 + trailers。）

## 非目標

optional_host_permissions 授權 UI（未來若使用者回報 CSP 網站需求再議）；file:// 行為變更；版號調整（發版時處理）。
