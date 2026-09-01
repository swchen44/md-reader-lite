# 設計文件（v1.2.1）：字元集相容模式（charsetCompat，零權限）

日期：2026-09-01 ／ 分支：`feature/charset-compat` ／ 目標版本：v1.2.1

## 背景與 GATE 結果

四項擴充第二批（單獨一項）。商店版 3.6.28 的 charsetCompat：大型 CJK `file://` 檔 Chrome 頁面層編碼偵測可能誤判（UTF-8 被猜成 Big5/GBK 亂碼），開啟後改由 SW `fetch` + `Response.text()` 繞過頁面層編碼猜測、強制 UTF-8（拆解見 `docs/research/2026-08-31-store-crx-3628-local-unpack-notes.md` §7）。

**GATE 已通過（2026-09-01 實測，同 research §7 末）**：現行 Chrome MV3 的 SW `fetch('file:///…md')` 可行（`ok:true`，`TextDecoder('utf-8').decode(arrayBuffer)` 正確解繁中）；`file access` 授權與 content script 能注入 file:// 頁共用同一 grant，故 **charsetCompat 不需任何新權限**（無 host_permissions、無 tabs）。先前案 C/D「SW fetch file:// 被擋」的推定於現行 Chrome + 檔案 URL + file access 開啟下不成立。

## 範圍

- **僅 `file://`**（`location.protocol === 'file:'`）。http(s) 由伺服器 `Content-Type; charset` 決定、Chrome 正確解碼，不需此功能（比照商店版 `isLocal` 閘門）。
- 功能＝**強制 UTF-8**（非自選編碼）；`charset` 欄位不做（商店版亦為死欄位）。
- 零權限：不動 manifest、不加 host_permissions/tabs。**唯一結構性改動**：`src/background.ts` 新增一個 `bgFetch` 訊息 handler（SW 端 fetch）——這不是權限變更、不是 manifest 變更，但確實超出先前「background 僅 actionMap 增列」的慣例；charsetCompat 本質上需要 SW，屬合理必要。

## 資料模型（`src/core/data.ts`）

| key             | 型別    | 預設    | 生效類 |
| --------------- | ------- | ------- | ------ |
| `charsetCompat` | boolean | `false` | reload |

預設 false（保守：多數檔案 Chrome 解碼正確，僅誤判時使用者手動開）。

## 架構與資料流

```
content script（main.ts, file:// 頁）
  初始：mdRaw = rawContainer.textContent（Chrome 解碼，可能亂碼）→ 先正常渲染
  若 location.protocol==='file:' && configData.charsetCompat：
    chrome.runtime.sendMessage({action:'bgFetch', data:{url: location.href}}, resp => {
      if (resp?.ok && typeof resp.text==='string' && resp.text !== mdRaw) {
        mdRaw = resp.text; contentRender(mdRaw); renderSide();
        setTimeout(()=>{ rawContainer.textContent = mdRaw }, 0)   // 同 polling 既有重渲染模式
      }
    })
background service worker（background.ts）
  case 'bgFetch':
    安全檢查（見下）通過 → fetch(data.url) → arrayBuffer → TextDecoder('utf-8') → callback({ok:true, text})
    失敗/拒絕 → callback({ok:false})
```

先渲染 Chrome 版、再以 SW 版覆蓋——避免等待 SW 造成白屏；SW 回來若內容不同才重渲染（相同則零成本）。

### SW 必要性（GATE 補測確立）

設計審查質疑「SW 可能不必要，content-script 直接 fetch 即可」。2026-09-01 補測（research §7 末）：**content-script 隔離世界 fetch(file://) 亦失敗**（`TypeError: Failed to fetch`），只有 SW 能 fetch file://。故 SW/bgFetch 架構是必要的、非可繞過。連帶結論：Lite 現有 content-script polling 在 file:// 恆失敗 →inert，與 charsetCompat bgFetch **無競態**（設計審查的 polling 競態疑點消解）。

### 安全檢查（bgFetch handler，關鍵——設計審查 Critical 修正）

SW 能 fetch file:// 是敏感能力，必須嚴格限縮，防止惡意頁面借 SW 讀任意本機檔。

**設計審查 Critical**：實測 Chromium 的 `new URL('file:///任何路徑').origin` **恆為常數字串 `"file://"`**（與路徑無關，非規格的 opaque 值）——故「同源檢查」對 file⇄file 完全沒有區辨力，等於 no-op。若只靠同源檢查，一旦 `data.url` 被污染成別的本機檔（如 `file:///etc/passwd`）即成任意檔案外洩原語。**修正：改用精確 URL 比對**。

`canBgFetch(senderUrl, targetUrl, extensionId, senderId): boolean`（core 可測，SW handler 只呼叫它）四條：

1. `senderUrl`、`targetUrl` 皆為非空字串且可 `new URL()` parse（parse 失敗 → false）。
2. **精確比對 `senderUrl === targetUrl`**（非同源）——SW 只重抓「content script 自己所在的那個頁面」，永遠不抓別的檔。content script 只送自己的 `location.href`，故正常恆通過；任何 `data.url ≠ 頁面 URL` 一律拒絕。這在結構上強制了「只讀自己」不變量，堵死 file-disclosure。
3. `new URL(targetUrl).protocol === 'file:'`（file:// 限縮，縱深防禦；http 頁面自己就能 fetch 自身，SW 不代勞）。
4. `senderId === extensionId`（`sender.id === chrome.runtime.id`，免權限；擋其他擴充直接 `sendMessage` 探測本擴充 onMessage）。

`sender.url` 缺失（非 content script 來源）→ 第 1 條 false。用 `sender.url`（content-script 頁面 URL，`onMessage` 恆帶、免權限），不用 `sender.tab?.url`（url 欄位受 tabs/host 權限影響）。

**兩條不變量須在測試明列並斷言**：(a) content script 送的 `data.url` 只能來自自身 `location.href`（不受 DOM/訊息/頁面內容影響）；(b) 僅在 `location.protocol === 'file:'` 時才送 bgFetch。

## 生效機制

`charsetCompat` 為 **reload 類**（比照 breaks/txtAsMd）：`background.ts` actionMap 加 `charsetCompat: 'applySetting'`；`main.ts` applySetting 該 case → `window.location.reload()`（reload 後 main 重跑，file:// + charsetCompat 觸發 bgFetch 重渲染）。popup 標示 `hint_reload`。

不走「即時 bgFetch 重渲染」的理由：reload 更簡單、與既有 reload 類一致、避免在 applySetting 內重複 bgFetch 邏輯；且 charsetCompat 切換頻率極低。

## 純函式（core 可測）

`src/core/charset.ts`（零 chrome 依賴）：

- `needsCharsetCompat(protocol: string, charsetCompat: boolean): boolean` → `protocol === 'file:' && charsetCompat`
- `canBgFetch(senderUrl: unknown, targetUrl: unknown, extensionId: unknown, senderId: unknown): boolean` → 四條安全檢查（見上：可 parse、精確比對 senderUrl===targetUrl、target 為 file:、senderId===extensionId）

TextDecoder 解碼與 fetch 在 SW（shell）；content-script 重渲染在 main.ts（shell）。

## popup UI

一般頁籤加「字元集相容模式」Switch（`charsetCompat`），下方 hint：「僅 file:// 大型檔案；開啟後強制以 UTF-8 重新解碼，切換將重新整理頁面」（reload 類，標 `hint_reload`）。走既有 `updateConfig('charsetCompat', v)`。

## 測試

1. 單元（`tests/charset.test.mjs`）：
   - `needsCharsetCompat`（file:+true→true、file:+false→false、http:+true→false、非字串防禦）。
   - `canBgFetch`（精確比對模型）：senderUrl===targetUrl 且 file: 且 id 相符 →true；**file 頁面請求「別的」file（senderUrl≠targetUrl）→false**（本案核心：堵 file-disclosure）；http 頁面請求 file://（≠）→false；同一 http URL（senderUrl===targetUrl 但 protocol 非 file:）→false（限 file:）；senderId≠extensionId →false；senderUrl 缺/壞 →false；targetUrl 壞 →false ≥ 8 條。
2. Playwright 驗收（file:// 真檔）：
   - 造一個「Chrome 會誤判」的檔難以穩定重現，改以**行為等價驗收**：charsetCompat=false 時 mdRaw 來自 `<pre>`；charsetCompat=true 時 content script 確有送 bgFetch 且 SW 回 UTF-8 文字、頁面渲染出正確中文（以 UTF-8 檔驗證 SW 路徑端到端；bgFetch 訊息與 SW fetch 成功即證機制）。
   - 安全：從 http 頁面（http://localhost:8123）呼叫 bgFetch 請求 file:// → SW 拒絕（canBgFetch false）。
   - md 頁全功能迴歸（v1.2.0 不回歸）。
3. `tsc --noEmit`、build、zip。

## 非目標

- 自選編碼（charset 下拉）——強制 UTF-8 即可。
- http(s) charset 處理（伺服器負責）。
- 商店版的「auto-refresh 走 bgFetch fetch-diff-rerender」重構——Lite 維持現行 content-script `fetch(location.href)` polling（http 用；file:// 的 auto-refresh 本就受限，不在本案範圍）。

## Git

commit 依模組切、四段訊息 + trailers；完成後合入 main 併發 v1.2.1。Subagent 一律 sonnet；markdown 表格 cell 禁裸 `|`。
