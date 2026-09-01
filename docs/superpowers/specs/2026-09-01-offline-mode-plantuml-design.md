# 設計文件（v1.4.0）：離線總開關 + PlantUML

日期：2026-09-01 ／ 分支：`feature/offline-mode-plantuml` ／ 目標版本：v1.4.0

## 背景與決定

延續 v1.3.0「隱私優先、預設零網路」。使用者決定（2026-09-01）：

1. **離線（拆連）模式**：一鍵保證零網路的顯性總開關，**預設開**（最強隱私）。
2. **PlantUML**：現在就做，作為明確 opt-in 的網路功能——預設關、離線模式下強制停用、可設定伺服器（支援內網自架）、送出前警告。

兩者互相關聯：PlantUML 是網路功能，受離線模式管制。開箱狀態＝離線模式開 + PlantUML 關 → 零網路。

## 一、離線模式（`offlineMode`，預設 true）

### 語意（誠實且可行銷）

離線模式開啟時，**封鎖擴充的所有對外網路請求**（egress），但**本機 `file://` 功能照常運作**（讀本機磁碟＝零對外流量）。賣點：「離線模式：本機檔案完整可用，所有遠端請求一律封鎖。」

### 網路 egress 站點完整清單（binding——不可遺漏任何一處）

擴充**所有**對外網路請求都在 content script 端發出（background.ts 的 bgFetch 只 fetch `file://`＝本機，不受影響、不動）。共四處，離線模式各自封鎖：

| #   | 站點          | 檔案                                        | egress 目標                       | 離線模式行為                                        |
| --- | ------------- | ------------------------------------------- | --------------------------------- | --------------------------------------------------- |
| 1   | 自動刷新輪詢  | `main.ts` polling                           | 重抓目前文件 URL（http 時為遠端） | 不啟動 polling（`refresh && !offlineMode` 才 poll） |
| 2   | http 目錄樹   | `dir-fetch.ts` 的 http `fetch(dirUrl)`      | 同伺服器目錄索引                  | 不呼叫；Files 面板顯示離線訊息                      |
| 3   | GitHub 目錄樹 | `github-listing.ts` `fetch(api.github.com)` | GitHub 公開 API                   | 不呼叫；Files 面板顯示離線訊息                      |
| 4   | PlantUML 圖   | 新 `plantuml.ts`（`<img src=server>`）      | PlantUML 伺服器                   | 不 emit img src（見下）；顯示停用占位               |

**保持運作（本機、非 egress，離線模式不封鎖）**：FSA 資料夾樹（file://，讀本機磁碟）、字元集相容（bgFetch 讀 file://）、dir-fetch 的 file:// XHR 路徑、所有渲染。

### 落地

- **純函式** `src/core/network.ts`：`isNetworkAllowed(offlineMode: boolean): boolean` → `!offlineMode`（單一真理來源，SW 端無關）。
- **polling**（站點 1）：`toggleRefresh` 與初始啟動改為 `configData.refresh && isNetworkAllowed(configData.offlineMode)` 才 `polling()`。
- **目錄樹**（站點 2、3）：`initFilesContent` 在決定 lister 前，若 `!isNetworkAllowed && 目標為遠端`（http probe 或 GitHub raw）→ 不 fetch，直接 `buildTree(undefined)` 並在樹內顯示離線訊息 `offline_blocked`。判定順序：先 `parseRawUrl`（GitHub）→ 若離線則顯示離線訊息不呼叫 API；http probe（`fetchDirListing`）→ 離線則跳過 probe 顯示離線訊息；file:// FSA → **不受離線影響照常**。
- **generateffect**：offlineMode 為 **reload 類**（切換後重整，讓 main 重跑套用新閘門）。actionMap 加 `offlineMode: 'applySetting'`，applySetting 該 case → reload。

## 二、PlantUML（網路 opt-in）

### 資料模型

| key               | 型別    | 預設                                  | 說明                     |
| ----------------- | ------- | ------------------------------------- | ------------------------ |
| `plantumlEnabled` | boolean | `false`                               | 是否渲染 PlantUML 圖     |
| `plantumlServer`  | string  | `'https://www.plantuml.com/plantuml'` | 算圖伺服器；可改內網自架 |

不放進 `MD_PLUGINS` chip 清單（它是特殊網路功能，需伺服器與警告），改用 popup 專屬區塊。

### 渲染機制

- `pnpm add plantuml-encoder`（純 JS 編碼庫，v1.4.0；確認無 postinstall build script）。
- 新 `src/plugins/plantuml.ts`：markdown-it fence 插件，攔截 ` ```plantuml ` 區塊（比照 `graphviz-block.ts` 的 fence rule pattern）：
  - **可渲染條件（allowed）**：`plantumlEnabled && isNetworkAllowed(offlineMode) && plantumlServer` 三者皆真。
  - allowed → emit `<img class="md-reader__plantuml" src="<server>/svg/<plantuml-encoder.encode(源碼)>" alt="PlantUML diagram" loading="lazy">`（`<server>` 尾端斜線正規化）。**注意（binding）**：emit `<img src=外部>` 本身就是網路請求（瀏覽器載入圖片時發出）——故必須**只在 allowed 時 emit img src**；這是離線模式對站點 4 的封鎖點。
  - not allowed → emit 占位 `<div class="md-reader__plantuml-disabled">` 顯示 i18n 訊息（依原因：離線模式開 / 未啟用 / 未設伺服器）＋原始碼以 `<pre>` 保留（不遺失內容）。
- 透傳：`MdOptions` 加 `plantuml?: { enabled: boolean; server: string; allowed: boolean }`；`initRender` 內 `md.use(plantumlPlugin, mdOpts.plantuml)`（比照 always-on 的 `mMultimdTable`，但讀 config 決定行為）。`main.ts` 的 `mdRenderer` 計算 `allowed = plantumlEnabled && isNetworkAllowed(offlineMode) && !!plantumlServer` 傳入。
- **reload 類**：`plantumlEnabled`、`plantumlServer` 改變走重渲染（同 mdPlugins：`contentRender(mdRaw); renderSide()`）；actionMap 各加 `'applySetting'`。

### 純函式（core 可測）

`src/core/plantuml.ts`：

- `normalizePlantumlServer(server: unknown): string`（去尾斜線、非字串回預設、trim）
- `buildPlantumlImageUrl(server: string, encoded: string): string` → `${normalized}/svg/${encoded}`
- `canRenderPlantuml(enabled: boolean, offlineMode: boolean, server: string): boolean` → `enabled && !offlineMode && !!server.trim()`

（實際 deflate 編碼用 `plantuml-encoder`，屬 shell；純函式只管 URL 組裝與可渲染判定。）

## 三、popup UI

### 一般頁籤

- **離線模式**（`offlineMode`）Switch，放**顯眼位置**（一般頁籤頂部、啟用之後），預設開；hint `hint_offline`（比 hint_reload 具體：封鎖所有遠端請求、本機檔照常、切換將重整）。
- 當 `offlineMode` 為真時，**將受管制的網路功能開關變灰（disabled）並標示原因**：目錄樹（folderTree）、自動刷新（refresh）、PlantUML（plantumlEnabled）三者 `disabled`＋ hint「離線模式已停用」。字元集相容（charsetCompat）為本機讀取、**不變灰**。

### 插件頁籤（或一般頁籤）新增 PlantUML 區塊

- PlantUML 啟用 Switch（`plantumlEnabled`），預設關；`disabled={offlineMode}`。
- 伺服器 URL 輸入框（`plantumlServer`），失焦 `normalizePlantumlServer` 回寫；`disabled={offlineMode || !plantumlEnabled}`。
- **警告文字** `warn_plantuml`：「PlantUML 會將你的圖表原始碼傳送到上述伺服器算圖；需關閉離線模式才能使用。」

## 四、資料模型總覽（`src/core/data.ts`）

| key               | 型別    | 預設                                  | 生效   |
| ----------------- | ------- | ------------------------------------- | ------ |
| `offlineMode`     | boolean | **`true`**                            | reload |
| `plantumlEnabled` | boolean | `false`                               | 重渲染 |
| `plantumlServer`  | string  | `'https://www.plantuml.com/plantuml'` | 重渲染 |

## 五、零權限/上架

- 無新 permission、無 host_permissions；PlantUML 的網路是 `<img src>`（瀏覽器層，非擴充 fetch），不需 host 權限。無 manifest 變更（`.txt` 等 matches 不動）。`git diff main -- src/manifest.json` 須為空。
- background.ts **不動**（所有 egress 在 content script）。
- 隱私文案更新：README/PRIVACY 加離線模式（一鍵封鎖遠端）與 PlantUML（唯一會把內容送第三方的功能、預設關、離線模式下停用）。這維持「無過度宣稱」——PlantUML 是誠實揭露的網路功能。

## 六、測試

1. 單元：
   - `tests/network.test.mjs`：`isNetworkAllowed`（true/false）。
   - `tests/plantuml.test.mjs`：`normalizePlantumlServer`（去尾斜線/非字串 → 預設/trim/空 → 預設）、`buildPlantumlImageUrl`、`canRenderPlantuml`（enabled+online+server→true；offline→false；未啟用 →false；空 server→false）≥ 10 條。
2. Playwright 驗收（延續 v1.3.0 網路監聽）：
   - **離線模式開（預設）**：http .md 頁啟用 folderTree+refresh、開 GitHub raw 頁 → 網路監聽確認**零遠端請求**（無 dir fetch、無 api.github、無 polling）；Files 面板顯示離線訊息；PlantUML 區塊顯示停用占位、**無 img 請求到 plantuml 伺服器**。
   - **離線模式關 + 各功能開**：dir fetch / GitHub API / polling / PlantUML img 各自恢復（PlantUML 用可攔截的假伺服器或監聽 img 請求 URL 確認 encode 正確、送對 server）。
   - **本機不受離線影響**：file:// + charsetCompat 在離線模式下仍運作（讀本機）。
   - v1.3.0 隱私迴歸（預設零網路）＋ v1.2.x 全功能迴歸。
3. `tsc --noEmit`、build、zip。

## 七、非目標

- PlantUML 純前端渲染（無實用方案；維持伺服器算圖）。
- 離線模式封鎖 `file://` 本機讀取（本機非 egress，不封鎖）。
- 其餘插件子選項（TOC/Katex/Mermaid…）——另案增量。
- `.mdc` 副檔名、字型打包、帳戶/Pro。

## Git

commit 依模組切、四段訊息 + trailers；完成後合入 main 併發 v1.4.0。Subagent 一律 sonnet；markdown 表格 cell 禁裸 `|`。
