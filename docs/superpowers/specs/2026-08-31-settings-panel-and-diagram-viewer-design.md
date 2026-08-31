# 設計文件（案 B+F）：設定面板對齊 + 頁內浮動選單 + 圖表檢視器

日期：2026-08-31 ／ 分支：`feature/settings-viewer` ／ Roadmap：案 B（批次 1+2）+ 案 F ／ 目標版本：v1.1.0

## 背景與範圍定案

依 `docs/research/2026-08-31-store-36-settings-menu-and-panel-teardown.md`（商店版 3.6.28 CRX 拆解）。使用者核可：**批次 1+2 全做 + 浮動選單納入 + 案 F**；不做帳戶/Pro/訂閱、不做反饋 in-page modal、不重構 storage 為巢狀（維持 flat key）。

研究文件更正：其第 5 節稱「manifest content_scripts 有比對 `.txt`」——實查 `src/manifest.json` matches 僅含 md/mdx/mkd/markdown 變體，**沒有** `.txt`。`.txt` 渲染功能需要擴充 matches（見下）。

## 一、設定資料模型（`src/core/data.ts` 擴充，全部 flat key）

| key                   | 型別                  | 預設                         | 說明                                                                                                                                               |
| --------------------- | --------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refreshInterval`     | number                | `0.5`                        | 自動刷新輪詢間隔（秒），範圍 0.5–600；現行硬編碼 500ms（`main.ts` pollingTimer）改讀此值                                                           |
| `codeWrap`            | boolean               | `false`                      | 代碼區塊自動換行（純 CSS class）                                                                                                                   |
| `pageTheme`           | 既有                  | **`'auto'`**（原 `'light'`） | 僅改預設值；既有使用者已存值不受影響                                                                                                               |
| `codeBlockDayTheme`   | `'light'` 或 `'dark'` | `'light'`                    | 頁面淺色時代碼區塊主題                                                                                                                             |
| `codeBlockNightTheme` | `'light'` 或 `'dark'` | `'dark'`                     | 頁面深色時代碼區塊主題                                                                                                                             |
| `textSize`            | number                | `16`                         | 內容字級 px，六級 12/14/16/18/20/24（slider）                                                                                                      |
| `textFont`            | string                | `'default'`                  | `'default'`／`'sans'`／`'serif'`／`'mono'`——僅系統字族 CSS stack，**不打包字型檔**（零體積，商店版打包 9 種字型不移植）                            |
| `txtAsMd`             | boolean               | **`false`**                  | 將 `.txt` 當 Markdown 渲染；需 manifest matches 擴充，故預設關閉（保守，商店版預設開）                                                             |
| `outlineCollapse`     | boolean               | `false`                      | 大綱標題可摺疊（h 系列子層收合）                                                                                                                   |
| `breaks`              | boolean               | `false`                      | 換行風格：開=保留換行；關=CommonMark（映射 markdown-it `breaks` option，`markdown.ts:68` 現值 false）。獨立 boolean，不學商店版借用 mdPlugins 陣列 |
| `customWidth`         | number 或 null        | `null`                       | 自訂內容最大寬度 px（500–3000）；`null`=停用（沿用現行寬度）。僅 `centered=true` 時 UI 顯示。**只支援 px**，不做 % 單位（YAGNI）                   |
| `customCss`           | string                | `''`                         | 自訂 CSS；空字串=停用。套用=文件尾注入 `<style>`；popup 內 textarea + 「套用」按鈕兩段式（不即時注入）                                             |
| `zenMode`             | boolean               | `false`                      | 禪模式：隱藏側欄、側欄切換鈕、搜尋鈕；浮動選單保留（半透明）作為退出入口                                                                           |

恢復預設：popup「恢復預設設定」按鈕（二次確認）→ `storage` 全清後寫回 `getDefaultData()`，並通知 content script reload 設定。

遷移：無需 migration——`getDefaultData()` merge 機制對缺 key 自動補預設；唯 `pageTheme` 預設改 `auto` 只影響從未儲存過該值的安裝。

## 二、popup 改版（`src/popup/`）

現況單頁（330px，SMUI）改**三頁籤**：一般／外觀／插件（不做「關於」頁籤——popup 底部保留現有 Header 的 homepage 連結即可）。

- **一般**：啟用、自動刷新＋間隔（number input，0.5–600，失焦 clamp）、換行風格、`.txt` 渲染、目錄樹（既有 folderTree）、大綱摺疊、語言、恢復預設。
- **外觀**：字級 slider（六級）、字體下拉（4 系統字族）、主題三選（既有）、淺色代碼主題二選、深色代碼主題二選、代碼換行、內容居中（既有）、自訂寬度（開關＋ number input，居中時顯示）、自訂 CSS（textarea ＋套用）、禪模式。
- **插件**：**總開關**（checkbox，狀態=`mdPlugins.length === MD_PLUGINS.length`，切換=全選/全不選）＋既有 chips。

頁籤為純 Svelte 元件切換（不引新路由庫）；每項設定沿用現行 `updateConfig(key, value)` 逐 key 寫 storage 的機制。

## 三、頁內浮動選單（content script）

右上角固定 `≡` 按鈕（class `FLOAT_MENU`），點開下拉：

| 項目         | 行為                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 切換原始內容 | 呼叫既有 `lifecycle.toggleRaw`（與鍵盤指令同一路徑）                 |
| 切換全螢幕   | `document.documentElement.requestFullscreen()` ／ `exitFullscreen()` |
| 列印         | `window.print()`（列印樣式：隱藏側欄/浮動元件）                      |
| 禪模式       | 切換 `zenMode` 並寫回 storage（與外觀頁開關同一 key）                |
| 關於         | 開新頁籤到 repo GitHub（`package.json` homepage）                    |

不做「設置」項（MV3 無法從頁面可靠開 extension popup；使用者用工具列圖示）、不做帳戶/反饋。選單樣式沿用側欄現有 CSS 慣例；`hiddenSide`/禪模式下仍顯示。

## 四、案 F：圖表檢視器

- 對象：Mermaid（`@md-reader/markdown-it-mermaid` 輸出容器）與 Graphviz（`src/plugins/graphviz-renderer.ts` 輸出容器）渲染出的 SVG 圖表。
- 互動：hover 圖表時右下角顯示控制列（＋、－、重設）；滾輪縮放；拖曳平移；重設回 1:1。
- 實作：`@panzoom/panzoom`（商店版同款，CRX 指紋已證實）；每個圖表容器 lazy 初始化（首次 hover 才 attach），不影響無圖表頁面。
- 邊界：PlantUML 本版不做（Lite 無 PlantUML 管線）；圖片（img-viewer 既有）不納入 panzoom。

## 五、manifest 變更（唯一一處，需標註上架影響）

`content_scripts.matches` 增加 `*://*/*.txt`、`file://*/*.txt`（含大寫與 `?*` 變體，共 8 條，比照既有 md 模式）。**無新權限**（matches 非 permission；現有模式本就涵蓋任意網域）。`txtAsMd=false` 時 content script 在 `.txt` 頁面直接 return，不渲染。store-listing 文案同步補充。

## 六、架構切分（core 可測 / shell）

新增 `src/core/settings.ts`（純函式，node 可測）：

- `clampRefreshInterval(v: unknown): number`（非數字/越界 → clamp 至 0.5–600）
- `clampCustomWidth(v: unknown): number | null`（500–3000 或 null）
- `TEXT_SIZES`、`textSizeIndex(px)`（slider 映射）
- `FONT_STACKS: Record<string, string>`（4 字族 → CSS font-family 值）
- `resolveCodeTheme(pageThemeResolved: 'light' | 'dark', day, night): 'light' | 'dark'`
- `isTxtUrl(url: string): boolean`（`.txt` 判定，比照 `isMarkdownFile` 慣例）

主題/CSS 注入、panzoom、浮動選單、popup UI 為 shell（Playwright 驗收）。

## 七、錯誤處理與邊界

- `customCss` 注入僅限本頁 `<style>` 元素，不經 eval；使用者自傷（壞 CSS）自負，「恢復預設」可救。
- `refreshInterval`/`customWidth` 輸入非法值一律 clamp，不彈錯誤。
- 全螢幕 API 被拒（iframe 等）→ 靜默忽略。
- panzoom 初始化失敗（SVG 缺尺寸）→ 該圖表不掛控制列，不影響其他圖表。
- 62 條既有測試不得回歸；`git diff main -- src/background.ts` 必為空；manifest 僅 matches 差異。

## 八、測試

1. 單元（`tests/settings.test.mjs`）：clamp 兩函式（邊界/NaN/字串）、textSize 映射、resolveCodeTheme 四組合、isTxtUrl（含 query/大寫/非 txt）≥ 12 條。
2. Playwright 驗收：popup 三頁籤切換與各設定寫入 storage；refreshInterval 生效（改輪詢間隔）；codeWrap/textSize/textFont/customWidth/customCss 對 DOM 的效果；浮動選單五項；zen 模式進出；mermaid+graphviz 圖表縮放平移重設；`.txt` 開關（含 manifest 後的 txt 頁注入）；md 頁全功能迴歸。
3. `tsc --noEmit`、build、zip。

## 九、非目標

帳戶/Pro/訂閱、反饋 modal、WeChat QR、字型檔打包、% 寬度單位、插件 ⚙ 子設定（Linkify/Alert/FrontMatter 等——留待下一輪）、字元集相容模式、巢狀 storage 重構、PlantUML。

## Git

commit 依模組切、四段訊息 + trailers；完成後合入 main 併發 v1.1.0。Subagent 一律 sonnet；markdown 表格 cell 禁裸 `|`。
