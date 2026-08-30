# 案 A：md-reader-lite 改名上架 + 文件組 + 架構邊界 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 fork 全套改名為 MD Reader Lite（md-reader-lite 1.0.0）、備齊 Chrome Web Store 上架材料與自有 repo、建立 docs 標準文件組，並以 dir-listing 拆檔完成 core/shell 邊界。

**Architecture:** 純改名與文件工程，唯一程式結構改動是把 `src/core/dir-listing.ts` 的 chrome 相依部分（`fetchDirListing` + XHR fallback）搬到新檔 `src/core/dir-fetch.ts`，使 core 層零 chrome 依賴。圖示沿用既有檔名（`logo-stroke.svg/png`）只換內容，避免改引用點。

**Tech Stack:** 既有 webpack/TS/Svelte 工具鏈；圖示轉檔用 Chrome for Testing headless 截圖 + macOS `sips` 縮放。

## Global Constraints

- 分支：`feature/rebrand-lite`（已存在，spec 在上面）。
- 顯示名稱 `MD Reader Lite`；package 名 `md-reader-lite`；版號重置 `1.0.0`；新 repo `https://github.com/swchen44/md-reader-lite`。
- 內部識別**不改**：CSS class 前綴 `md-reader__`、storage key、i18n key 名稱維持原樣。
- 保留原作者 MIT 版權行；一切對外文件含 attribution「Forked from md-reader by Bener (MIT)」。
- 建置命令：`export npm_package_version=1.0.0` 後 `node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js && node ./scripts/zip.mjs`（勿用 `corepack pnpm build`）。
- 測試命令：`node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs`（30 條，勿用目錄模式）；型別 `node_modules/.bin/tsc --noEmit`。
- **每一筆邏輯改動獨立 commit**，訊息格式四段 `Why:` / `What:` / `How:` / `Boundary:`，結尾兩行 trailers：
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR`（各 Task 的 commit 步驟只寫 subject 與四段內容，trailers 一律附加，不再重複註明）。
- 不動 build 工具鏈、不拆 package、不做案 B/C 功能。

## File Structure

| 檔案                                                                                      | 動作     | 職責                                                    |
| ----------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| `package.json`                                                                            | 修改     | name/version/author/repository/homepage/bugs            |
| `src/manifest.json`                                                                       | 修改     | version/version_name 基底值 1.0.0                       |
| `src/_locales/{en,en_GB,en_US,ko,uk,zh_CN,zh_TW}/messages.json`                           | 修改     | ext_name / ext_desc                                     |
| `scripts/zip.mjs`                                                                         | 修改     | zip 檔名改讀 package name                               |
| `src/popup/components/header.svelte`                                                      | 修改     | 標題文字 MD READER LITE（homepage 自 pkg 帶入，不需改） |
| `src/images/logo-stroke.svg` `src/images/logo-stroke.png`                                 | 內容替換 | 新 logo（檔名不變）                                     |
| `src/background.ts`                                                                       | 修改     | 移除 setUninstallURL                                    |
| `README.md`                                                                               | 重寫     | 新品牌 + attribution（README-cn/ko 刪除，避免維護三份） |
| `LICENSE`                                                                                 | 修改     | 追加 swchen44 版權行                                    |
| `src/core/dir-fetch.ts`                                                                   | 新增     | `fetchDirListing`（自 dir-listing.ts 搬出）             |
| `src/core/dir-listing.ts`                                                                 | 修改     | 僅剩純解析                                              |
| `src/core/file-tree.ts`                                                                   | 修改     | import 改自 dir-fetch                                   |
| `docs/{developer_guide,plans,designs,lesson_learn,ARCHITECTURE,ROADMAP,store-listing}.md` | 新增     | 文件組                                                  |
| `docs/research/2026-08-30-chrome-mv3-file-url-access-restrictions.md`                     | 新增     | file:// 限制研究                                        |
| `PRIVACY.md`                                                                              | 新增     | 隱私權政策                                              |
| `docs/store-assets/`                                                                      | 新增     | 商店截圖（Task 9，controller 執行）                     |

---

### Task 1: 文字層改名（package / manifest / locales / zip 檔名 / popup 標題）

**Files:**

- Modify: `package.json`、`src/manifest.json`、`src/_locales/*/messages.json`（7 個）、`scripts/zip.mjs`、`src/popup/components/header.svelte`

**Interfaces:**

- Produces: `pkg.name === 'md-reader-lite'`、`pkg.homepage === 'https://github.com/swchen44/md-reader-lite'`（Task 3 README、Task 7 remote 依賴此值）；zip 產物名 `md-reader-lite-1.0.0.zip`（Task 8 驗收依賴）

- [ ] **Step 1: package.json 欄位**

改：

```json
  "name": "md-reader-lite",
  "version": "1.0.0",
  "author": "swchen44",
  "license": "MIT",
  "description": "A lightweight markdown reader extension for Chrome (fork of md-reader)",
  "homepage": "https://github.com/swchen44/md-reader-lite",
  "repository": { "type": "git", "url": "git+https://github.com/swchen44/md-reader-lite.git" },
  "bugs": { "url": "https://github.com/swchen44/md-reader-lite/issues" },
```

`keywords` 陣列加入 `"md-reader-lite"`（保留原有項目）。

- [ ] **Step 2: src/manifest.json 版號**

`"version": "1.0.0"`、`"version_name": "1.0.0"`（其餘不動；name/description 走 `__MSG_*`）。

- [ ] **Step 3: locales**

7 個 `src/_locales/<lc>/messages.json` 的 `ext_name.message` 全改 `MD Reader Lite`。`ext_desc.message`：

- en / en_GB / en_US: `A lightweight markdown reader extension for Chrome.`
- zh_CN: `轻量级 Markdown 阅读器扩展，本地与在线 .md 文件即开即读。`
- zh_TW: `輕量級 Markdown 閱讀器擴充，本地與線上 .md 檔案即開即讀。`
- ko: `크롬용 경량 마크다운 리더 확장 프로그램.`
- uk: `Легке розширення для читання markdown для Chrome.`

- [ ] **Step 4: zip 檔名改讀 package name**

`scripts/zip.mjs` 第 7 行改為：

```js
const extName = `${
  process.env.npm_package_name || 'md-reader-lite'
}-${newVersion}.zip`
```

（`scripts/utils.mjs` 不動；建置命令需同時 export `npm_package_name=md-reader-lite`——把 Global Constraints 的建置命令改成 `export npm_package_version=1.0.0 npm_package_name=md-reader-lite` 開頭，本 Task 起適用。）

- [ ] **Step 5: popup 標題**

`src/popup/components/header.svelte` 的 `<a href={homepage} target="__blank">MD-READER</a>` 文字改 `MD READER LITE`。

- [ ] **Step 6: 驗證**

```bash
export npm_package_version=1.0.0 npm_package_name=md-reader-lite
node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js 2>&1 | tail -2 && node ./scripts/zip.mjs
python3 -c "import json;[json.load(open(f'src/_locales/{l}/messages.json')) for l in ['en','en_GB','en_US','ko','uk','zh_CN','zh_TW']];print('locales ok')"
ls dist/ | grep md-reader-lite-1.0.0.zip
node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: 建置成功、`md-reader-lite-1.0.0.zip` 存在、locales JSON 皆合法、30 pass / 0 fail。

- [ ] **Step 7: Commit**

```
rebrand: rename to MD Reader Lite 1.0.0 across package, manifest, locales

Why: the fork will be published to Chrome Web Store and must not
collide with the upstream author's store listing or brand.
What: package.json identity fields, manifest version reset to 1.0.0,
ext_name/ext_desc in all seven locales, zip artifact name now derived
from the package name, popup header title.
How: display name flows through the existing __MSG_ext_name__ i18n
path; no key renames.
Boundary: no internal identifiers changed (CSS prefix, storage keys,
i18n keys); no behavior change.
```

---

### Task 2: 新 logo（同檔名內容替換）

**Files:**

- Modify(內容替換): `src/images/logo-stroke.svg`、`src/images/logo-stroke.png`

**Interfaces:**

- Consumes: manifest 五尺寸與 popup header 均引用這兩個檔名 — 檔名不變即全站生效

- [ ] **Step 1: 寫入新 SVG**

以下完整內容覆寫 `src/images/logo-stroke.svg`（圓角方塊 + 「M」+ 下箭頭讀取隱喻，配色 teal，與原作黑白描邊風格區隔）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="16" y="16" width="480" height="480" rx="96" fill="#0d9488"/>
  <path d="M116 356V156h56l84 108 84-108h56v200h-52V244l-88 112-88-112v112z" fill="#ffffff"/>
  <path d="M256 380l-64-72h40v-40h48v40h40z" fill="#99f6e4"/>
</svg>
```

- [ ] **Step 2: 轉出 512px PNG**

無法直接用 CLI 轉 SVG→PNG（無 ImageMagick/rsvg 前提），用 Chrome for Testing headless：

```bash
CFT="/Users/swchen.tw/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
"$CFT" --headless --disable-gpu --screenshot=/tmp/logo512.png --window-size=512,512 --default-background-color=00000000 "file:///Users/swchen.tw/git/md-reader/src/images/logo-stroke.svg"
sips -g pixelWidth /tmp/logo512.png   # 512
cp /tmp/logo512.png src/images/logo-stroke.png
```

（`--default-background-color=00000000` 保留透明背景；SVG viewBox 512 剛好滿版。）

- [ ] **Step 3: 驗證引用完整**

```bash
grep -rn "logo-stroke" src build scripts | grep -v node_modules
file src/images/logo-stroke.png   # PNG image data, 512 x 512
export npm_package_version=1.0.0 npm_package_name=md-reader-lite
node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js 2>&1 | tail -2
```

Expected: 引用點只有 manifest 與 header.svelte（原樣）、PNG 512×512、建置成功。

- [ ] **Step 4: Commit**

```
rebrand: replace logo with distinct MD Reader Lite mark

Why: publishing with the upstream author's logo would confuse users
and reads as brand impersonation on the store.
What: new teal rounded-square "M" mark; logo-stroke.svg replaced and
logo-stroke.png regenerated at 512px.
How: same filenames kept so every existing reference (manifest icon
sizes, popup header) picks the new art without code changes; PNG
rasterized via headless Chrome screenshot of the SVG.
Boundary: images only; no code or manifest structure change.
```

---

### Task 3: 移除原作者外連 + README 重寫 + LICENSE（三個 commit）

**Files:**

- Modify: `src/background.ts`、`LICENSE`
- Rewrite: `README.md`；Delete: `README-cn.md`、`README-ko.md`

**Interfaces:**

- Consumes: Task 1 的 pkg.homepage

- [ ] **Step 1: background.ts 移除 uninstall URL**

刪除檔尾整段：

```ts
chrome.runtime.setUninstallURL(
  'https://github.com/orgs/md-reader/discussions/51',
)
```

驗證：`node_modules/.bin/tsc --noEmit` 無新錯。

- [ ] **Step 2: Commit（background）**

```
rebrand: stop opening upstream feedback page on uninstall

Why: uninstall feedback should not route users to the upstream
project's discussion board for a renamed fork.
What: removed chrome.runtime.setUninstallURL call entirely.
How: no replacement URL set; uninstalling now opens nothing.
Boundary: background service worker only; no other messaging changes.
```

- [ ] **Step 3: README.md 重寫**

以下完整內容覆寫 `README.md`；並 `git rm README-cn.md README-ko.md`：

```markdown
# MD Reader Lite

> Forked from [md-reader](https://github.com/md-reader/md-reader) by Bener (MIT). Renamed and extended; not affiliated with the upstream project or its store listing.

A lightweight Chrome extension that renders local and online Markdown files as clean, readable pages. Fully offline — no external requests, no telemetry.

## Features

- CommonMark + GFM-style rendering (tables, task lists, footnotes, KaTeX, Mermaid, Graphviz)
- Obsidian syntax: `![[image|300]]` embeds, `[[wikilinks|alias]]`, `%%comments%%`, callouts, front matter table
- Folder tree side panel for browsing sibling markdown files (http/https autoindex)
- Outline (TOC) side panel, light/dark/auto themes, custom plugins toggle
- Works on `file://`, intranet servers, and raw URLs

## Install (unpacked / intranet)

1. Build or download `dist/md-reader-lite-<version>.zip`, unzip to a fixed folder
2. Open `chrome://extensions`, enable Developer mode, Load unpacked → select the folder
3. For local files, enable "Allow access to file URLs" in the extension's details

## Development

See [docs/developer_guide.md](docs/developer_guide.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Privacy

Zero data collection — see [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE). Original work © 2018-present Bener; modifications © 2026 swchen44.
```

- [ ] **Step 4: Commit（README）**

```
rebrand: rewrite README for MD Reader Lite

Why: the README described the upstream product, linked its store
badges, WeChat group and homepage — all wrong for the fork.
What: new English README with attribution, feature list reflecting
this fork's additions, unpacked-install steps for intranet use, links
into the docs/ set; removed the cn/ko README variants.
How: single-language README to avoid maintaining three copies.
Boundary: documentation only.
```

- [ ] **Step 5: LICENSE 追加版權行**

`Copyright (c) 2018-present Bener` 下一行加：
`Copyright (c) 2026 swchen44 (modifications)`

- [ ] **Step 6: Commit（LICENSE）**

```
rebrand: add fork copyright line to LICENSE

Why: MIT requires preserving the original notice; modifications carry
their own copyright.
What: added swchen44 modifications line under the original.
How: original notice untouched.
Boundary: license text only.
```

---

### Task 4: core/shell 邊界 — dir-listing 拆檔

**Files:**

- Create: `src/core/dir-fetch.ts`
- Modify: `src/core/dir-listing.ts`（移除 fetch 段）、`src/core/file-tree.ts:3`
- Test: 既有 `tests/dir-listing.test.mjs`（不需改：只 import 純函式）

**Interfaces:**

- Produces: `src/core/dir-fetch.ts` export `fetchDirListing(dirUrl: string): Promise<DirEntry[]>`（簽名不變，`file-tree.ts` 唯一使用者）；`dir-listing.ts` 僅剩 `DirEntry`/`MD_EXT_RE`/`isMarkdownFile`/`parseDirListing`

- [ ] **Step 1: 建 dir-fetch.ts**

把 `dir-listing.ts` 中 `fetchDirListing` 與其私有 helper（`xhrGet`）整段剪下貼入新檔 `src/core/dir-fetch.ts`，檔頭：

```ts
import { parseDirListing, type DirEntry } from '@/core/dir-listing'
```

並 re-export type 供呼叫端一站取用：

```ts
export type { DirEntry } from '@/core/dir-listing'
```

（函式本體一字不改。）

- [ ] **Step 2: dir-listing.ts 清理**

移除搬走的程式與其專屬 import；確認檔內不再出現 `chrome`、`XMLHttpRequest`。

- [ ] **Step 3: file-tree.ts import 改路徑**

`import { fetchDirListing, type DirEntry } from '@/core/dir-listing'` → `from '@/core/dir-fetch'`。

- [ ] **Step 4: 驗證（含 core 零 chrome 檢查）**

```bash
node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"
node_modules/.bin/tsc --noEmit
grep -n "chrome" src/core/markdown.ts src/core/graphviz.ts src/core/dir-listing.ts src/plugins/obsidian.ts src/plugins/alert.ts src/plugins/graphviz-block.ts src/config/md-plugins.ts && echo "FAIL: chrome found in core" || echo "core clean"
export npm_package_version=1.0.0 npm_package_name=md-reader-lite
node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js 2>&1 | tail -2
```

Expected: 30 pass、tsc 乾淨、`core clean`、建置成功。

- [ ] **Step 5: Commit**

```
refactor: split chrome-dependent fetch out of dir-listing into dir-fetch

Why: the portable core layer (future PWA reuse) must be free of
chrome.* references; dir-listing mixed pure parsing with the
extension messaging/XHR fallback.
What: fetchDirListing and its XHR helper moved verbatim to
src/core/dir-fetch.ts; dir-listing.ts now exports only the pure
parser surface; file-tree imports from dir-fetch.
How: function bodies unchanged; DirEntry re-exported from dir-fetch
so callers keep a single import site.
Boundary: no behavior change; test import paths untouched (they only
use the pure functions).
```

---

### Task 5: 文件組（核心六件）

**Files:**

- Create: `docs/developer_guide.md`、`docs/ARCHITECTURE.md`、`docs/ROADMAP.md`、`docs/lesson_learn.md`、`docs/plans.md`、`docs/designs.md`

以下每檔給出完整內容（實作者照寫，允許把日期/清單依 repo 現況微調補全——`plans.md`/`designs.md` 需列出 `docs/superpowers/{plans,specs}/` 下實際存在的所有檔案）。

- [ ] **Step 1: docs/developer_guide.md**

```markdown
# Developer Guide

## 環境需求

- Node ≥ 22（本 repo 以 Node 26 驗證；測試直接 import .ts，依賴 type stripping）
- pnpm：不需全域安裝，用 `corepack pnpm <cmd>`
- macOS 註：本 repo 的圖示轉檔流程用 Chrome for Testing + sips

## 安裝

    corepack pnpm install

（postinstall 白名單在 pnpm-workspace.yaml 的 onlyBuiltDependencies）

## 建置與打包

    export npm_package_version=<version> npm_package_name=md-reader-lite
    node ./scripts/manifest.mjs
    node_modules/.bin/webpack --config ./build/webpack.prod.js
    node ./scripts/zip.mjs        # 產出 dist/md-reader-lite-<version>.zip

未壓縮輸出在 extension/。
坑：`corepack pnpm build` 的 deps 檢查在部分環境會失敗，直接用上面三步。

## 測試

    node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs
    node_modules/.bin/tsc --noEmit

坑：`node --test tests/`（目錄模式）在本 repo 會誤判失敗，一律指定檔案。

## 本機載入與驗收

1. Chrome 137+ stable 已移除 --load-extension；自動化驗收用 Chrome for Testing：
   "<CfT path>" --user-data-dir=/tmp/prof --load-extension=$PWD/extension --remote-debugging-port=9333
2. 手動：chrome://extensions → 開發人員模式 → 載入未封裝項目 → extension/
3. file:// 測試需開「允許存取檔案網址」
4. 內網/驗收伺服器務必送 charset=utf-8（見 lesson_learn.md）

## 文件地圖

- 設計文件索引：designs.md ／ 實作計畫索引：plans.md
- 架構邊界：ARCHITECTURE.md ／ 路線圖：ROADMAP.md
- 教訓：lesson_learn.md ／ 研究文章：research/
- Commit 訊息格式：Why / What / How / Boundary 四段（見 git log 範例）
```

- [ ] **Step 2: docs/ARCHITECTURE.md**

```markdown
# Architecture — core / shell 邊界

目的：渲染核心可攜（未來 PWA/Web 版直接複用），extension 專屬邏輯隔離在 shell。

## core（可攜層）— 禁止 import chrome

| 模組                                    | 職責                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| src/core/markdown.ts                    | markdown-it 組裝、mdRender、front matter gating           |
| src/core/graphviz.ts                    | graphviz 判定與 placeholder                               |
| src/plugins/obsidian.ts                 | Obsidian 語法（wikilink/embed/註解/callout/front matter） |
| src/plugins/alert.ts、graphviz-block.ts | markdown-it 層插件                                        |
| src/config/md-plugins.ts                | 插件清單                                                  |
| src/core/dir-listing.ts                 | 目錄頁 HTML → DirEntry[] 純解析                           |
| @md-reader/theme                        | 主題樣式                                                  |

## shell（extension 專屬）

| 模組                                 | 職責                                             |
| ------------------------------------ | ------------------------------------------------ |
| src/manifest.json、src/background.ts | MV3 宣告與訊息代理（fetch/fetchDir/actionMap）   |
| src/main.ts                          | content script 掛載、側邊欄/頁籤/raw 狀態機      |
| src/core/dir-fetch.ts                | fetchDirListing（chrome.runtime + XHR fallback） |
| src/core/file-tree.ts                | 樹 UI（DOM/Ele）                                 |
| src/popup/\* 、src/core/storage.ts   | 設定 UI 與持久化                                 |

## 驗收檢查

    grep -n "chrome" <core 檔案清單>   # 必須零命中

## 約定

- core 新增檔案一律零 chrome/DOM-extension 依賴；需要瀏覽器 API 時放 shell 並以參數注入。
- PWA 衍生時：core 原樣搬走，shell 以 Web 檔案 API/URL 重寫。
```

- [ ] **Step 3: docs/ROADMAP.md**

```markdown
# Roadmap

| 版本 | 案  | 內容                                                                                                                                                                                                   | 狀態   |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1.0  | A   | 改名 MD Reader Lite、上架材料、docs 文件組、core/shell 邊界                                                                                                                                            | 進行中 |
| 1.1  | B   | 規格對齊：GitHub/Obsidian markers 補齊（wikilink #標題/#^block、行內腳註、#tag、可摺疊 callout、自訂任務狀態…以案 B spec 定案）＋ CommonMark/GFM spec.txt conformance harness ＋ Obsidian fixture 對照 | 規劃中 |
| 1.2  | C   | file:// 完整目錄樹（File System Access API；先 spike：file:// 頁 showDirectoryPicker 可用性、handle 持久化/重授權）                                                                                    | 規劃中 |
| 2.x  | —   | PWA/Web 衍生專案：免安裝閱讀器，複用 core 層（產品形態參考 TriptoAfsin/md-viewer-pwa：drop zone、多分頁、離線 PWA）；技術棧屆時另定                                                                    | 願景   |

## 維護策略

- 上游 sync：上游 remote 名 upstream，僅挑選性 cherry-pick；版號與上游脫鉤（本 fork 自 1.0.0 起算）。
- 商店版本：送審一次一版，store 材料在 docs/store-listing.md。
- 依據研究：docs/research/ 與 swchen44/personal-knowledge-base-from-ai 的 2026-08-30 Markdown 規格研究。
```

- [ ] **Step 4: docs/lesson_learn.md**

```markdown
# Lessons Learned

一行格式：情境 → 教訓 → 對策。

1. Chrome MV3 與 file://（2026-08-30）：SW fetch、content script fetch/XHR（含隔離世界）對 file:// 全被封鎖 → 擴充無法程式化讀本機檔 → 目錄樹在 file:// 降級為說明訊息；完整方案走 FSA API（案 C）。詳見 research/2026-08-30-chrome-mv3-file-url-access-restrictions.md
2. 伺服器缺 charset（2026-08-30）：text/markdown 未標 charset，Chrome 對 CJK 內容嗅探成 Big5/GBK，位元組級破壞（`]` 被併進雙位元組字）→ 部署一律 `charset=utf-8`；驗收伺服器已內建。
3. 全域 regex 動 raw source 的代價（2026-08-30）：`%%…%%` 全域移除毀了 Mermaid（%% 是其註解語法）與程式碼區塊 → 任何 pre-parse 文字改寫都必須 fence-aware（共用 fence 掃描器）；同教訓適用 callout 正規化。
4. pnpm ≥10 的 build script 白名單（2026-08-29）：package.json 的 pnpm 欄位已不被讀取 → onlyBuiltDependencies 要放 pnpm-workspace.yaml；否則 esbuild 缺二進位。
5. Chrome 137+ stable 移除 --load-extension（2026-08-30）：自動化測試載入未封裝擴充要用 Chrome for Testing/Chromium。
6. node --test 目錄模式在本 repo 誤判失敗（2026-08-29）：一律指定測試檔案清單。
7. 單執行緒 HTTPServer 驗收假象（2026-08-30）：Chrome keep-alive 佔住唯一執行緒，之後所有請求逾時，看起來像功能壞掉 → 測試伺服器一律 ThreadingHTTPServer。
```

- [ ] **Step 5: docs/plans.md 與 docs/designs.md（索引）**

`docs/plans.md`：

```markdown
# 實作計畫索引

| 日期       | 案                           | 計畫                                                                                                         | 狀態                |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------- |
| 2026-08-29 | 資料夾目錄樹 + Obsidian 語法 | [superpowers/plans/2026-08-29-folder-tree-obsidian.md](superpowers/plans/2026-08-29-folder-tree-obsidian.md) | 完成（已合併 main） |
| 2026-08-30 | 案 A：改名上架               | [superpowers/plans/2026-08-30-rebrand-lite.md](superpowers/plans/2026-08-30-rebrand-lite.md)                 | 進行中              |

新計畫請放 docs/superpowers/plans/ 並在此登錄。
```

`docs/designs.md`：

```markdown
# 設計文件索引

| 日期       | 案                           | 設計                                                                                                                       | 狀態   |
| ---------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-08-29 | 資料夾目錄樹 + Obsidian 語法 | [superpowers/specs/2026-08-29-folder-tree-obsidian-design.md](superpowers/specs/2026-08-29-folder-tree-obsidian-design.md) | 已實作 |
| 2026-08-30 | 案 A：改名上架 + Roadmap     | [superpowers/specs/2026-08-30-rebrand-lite-roadmap-design.md](superpowers/specs/2026-08-30-rebrand-lite-roadmap-design.md) | 進行中 |

新設計請放 docs/superpowers/specs/ 並在此登錄。
```

- [ ] **Step 6: Commit（一個 commit，文件組屬同一邏輯改動）**

```
docs: establish standard docs set (guide, architecture, roadmap, lessons, indexes)

Why: the project now spans multiple planned sub-projects and a future
PWA derivative; contributors need a stable entry point for build
steps, layer boundaries, plans and accumulated pitfalls.
What: developer_guide, ARCHITECTURE (core/shell contract),
ROADMAP (A/B/C + PWA), lesson_learn (7 recorded pitfalls), plans.md
and designs.md as indexes over docs/superpowers/.
How: indexes link to existing superpowers docs instead of moving
them, so historical links stay valid.
Boundary: documentation only.
```

---

### Task 6: 研究文章 + PRIVACY + store-listing

**Files:**

- Create: `docs/research/2026-08-30-chrome-mv3-file-url-access-restrictions.md`、`PRIVACY.md`、`docs/store-listing.md`

- [ ] **Step 1: research 文章**

來源素材：`.superpowers/sdd/task-9-report.md` 的「Controller manual acceptance」B 節（spike 結論）。寫成獨立文章：

```markdown
# Chrome MV3 對 file:// 的程式化讀取限制（實測紀錄）

日期：2026-08-30 ／ 環境：Chrome for Testing 151、md-reader-lite 分支 feature/folder-tree-obsidian

## 問題

資料夾目錄樹需要讀取 file:// 目錄列表。「允許存取檔案網址」已開啟、content script 正常注入渲染。

## 實測矩陣（全部失敗）

| 途徑                                                       | 結果                                    |
| ---------------------------------------------------------- | --------------------------------------- |
| MV3 service worker fetch('file:///…/')                     | rejects（Fetch API 不支援 file scheme） |
| content script（隔離世界）fetch                            | Failed to fetch                         |
| content script（隔離世界）XMLHttpRequest（檔案與目錄皆試） | onerror, status=0                       |
| 頁面主世界 fetch/XHR                                       | 同樣被擋                                |

驗證方法：CDP Runtime.evaluate 直接在擴充的隔離世界 context 執行探測，排除「測錯世界」的可能。

## 結論

1. 現代 Chrome 已全面封鎖擴充對 file:// 的程式化讀取（歷史上 content script XHR 可行，已被移除）。
2. 連上游 2.12.x 的 file:// 自動刷新功能在新版 Chrome 其實也是壞的（同一限制）。
3. 「允許存取檔案網址」如今只控制 content script 能否注入 file:// 頁面，不再授予讀取能力。
4. 可行替代：File System Access API（showDirectoryPicker + IndexedDB 持久化 handle，需使用者手勢與重授權流程）→ 案 C。

## 現行降級行為

file:// 頁的檔案頁籤顯示「無法取得目錄列表」；`../` 仍可導覽到 Chrome 原生目錄頁。XHR fallback 保留（老版本 Chromium 分支仍可用）。
```

- [ ] **Step 2: PRIVACY.md**

```markdown
# Privacy Policy — MD Reader Lite

_Last updated: 2026-08-30_

MD Reader Lite renders Markdown files locally in your browser.

- **No data collection.** The extension does not collect, transmit, store remotely, or sell any user data. No analytics, no telemetry, no error reporting.
- **No external requests.** All rendering libraries are bundled. The only network requests are the ones your browser makes to load the Markdown file you opened and, when the folder tree is enabled, the directory listing of that file's own folder from the same server.
- **Local settings only.** Preferences (theme, plugins, panel state) are stored in `chrome.storage.local` on your device and never leave it.
- **Permissions.** Host permission is used solely to read the Markdown file you navigate to and its folder listing; `storage` keeps your settings; file URL access (optional, off by default in Chrome) lets the extension render local files you open.

Questions: https://github.com/swchen44/md-reader-lite/issues

---

中文摘要：本擴充零資料蒐集、零遙測、零外部請求；所有渲染在本機完成，設定僅存於裝置上的 chrome.storage.local。主機權限只用於讀取你開啟的 Markdown 檔與其所在資料夾的列表。
```

- [ ] **Step 3: docs/store-listing.md**

```markdown
# Chrome Web Store 上架材料

## 基本

- 名稱：MD Reader Lite（備援：MD Lite Reader、Markdown Lite Viewer——僅改 locales ext_name 一個 commit 可換）
- 類別：Productivity / Tools ；語言：en, zh-TW, zh-CN
- 隱私權政策 URL：https://github.com/swchen44/md-reader-lite/blob/main/PRIVACY.md

## 單一用途聲明（Single purpose）

Render local and online Markdown files as clean, readable pages in the browser.

## 短述（132 字內）

EN: Read local & online Markdown beautifully — offline, zero tracking. Obsidian syntax, folder tree, Mermaid, KaTeX.
ZH: 離線零追蹤的 Markdown 閱讀器：Obsidian 語法、資料夾目錄樹、Mermaid、KaTeX。

## 詳述

EN:
MD Reader Lite turns .md files into clean, readable pages. Open a local file or any URL ending in .md and it renders instantly — fully offline, with zero data collection.
• GFM-style rendering: tables, task lists, footnotes, KaTeX math, Mermaid & Graphviz diagrams
• Obsidian syntax: ![[image|300]] embeds, [[wikilinks|alias]], %%comments%%, callouts, front matter table
• Folder tree side panel to browse sibling documents on http servers
• Outline panel, light/dark/auto themes, per-plugin toggles
• Works on intranets and air-gapped machines — nothing ever leaves your browser
Forked from the open-source md-reader (MIT) with new features; not affiliated with the original store listing.
ZH:（同結構中文版，實作時翻譯）

## 權限理由（審核申報用）

| 權限                              | 理由                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| host_permissions _://_/\*         | 讀取使用者導覽到的 .md 檔內容（自動刷新）與該檔所在資料夾的目錄列表（檔案樹）。不主動存取任何未開啟的網站。 |
| storage                           | 儲存主題、插件開關等設定於本機。                                                                            |
| activeTab                         | 設定變更時通知目前分頁即時套用。                                                                            |
| file URL access（使用者自行開啟） | 渲染本機 .md 檔。                                                                                           |

## 資料使用申報（Data usage disclosure）

全部項目勾「不蒐集」。

## 素材

- 圖示 128×128：自 src/images/logo-stroke.png 縮出（sips -z 128 128）
- 截圖 1280×800 ×3+：存 docs/store-assets/（亮色渲染、目錄樹、popup 設定；Task 9 產出）

## 送審前檢查清單

- [ ] dist zip 以正式建置產出（非 dev）
- [ ] manifest version 與 store 表單一致
- [ ] 隱私政策 URL 可公開存取（repo 需 public）
- [ ] 權限理由填入表單
```

- [ ] **Step 4: 三個 commit（research / privacy / store-listing 各一）**

Research：

```
docs: record MV3 file:// access restriction research

Why: the folder-tree file:// degradation decision rests on platform
behavior that took a full test matrix to establish; future work
(FSA API, upstream sync) needs the evidence, not just the conclusion.
What: research article with the tested matrix (SW fetch, content
script fetch/XHR in isolated world, main world), method (CDP into the
isolated context), conclusions and the FSA path forward.
How: distilled from the acceptance report in .superpowers/sdd/.
Boundary: documentation only.
```

Privacy：

```
docs: add zero-collection privacy policy

Why: Chrome Web Store review requires a public privacy policy URL.
What: PRIVACY.md stating no collection/telemetry/external requests,
local-only storage, permission usage; Chinese summary included.
How: hosted via the public GitHub repo URL.
Boundary: documentation only; makes no product behavior claims beyond
what the network audit verified.
```

Store listing：

```
docs: add store listing copy, permission justifications and checklist

Why: store submission needs single-purpose statement, descriptions,
per-permission justifications and a data-usage disclosure prepared in
advance — permission justification is the most common rejection cause.
What: docs/store-listing.md with names (plus fallbacks), short/full
descriptions (EN/ZH), permission rationale table, submission
checklist and asset requirements.
How: submission itself stays manual per spec.
Boundary: documentation only.
```

---

### Task 7: 自有 repo 與 remote 重整

**Files:** 無程式檔（git remote / GitHub 操作）

**Interfaces:**

- Consumes: 使用者的 gh 授權（帳號 swchen44）
- Produces: `origin` → `https://github.com/swchen44/md-reader-lite.git`、`upstream` → 原 md-reader/md-reader；main 與 feature/rebrand-lite 已推送

- [ ] **Step 1: 檢查授權**

```bash
gh auth status
```

若未登入或帳號不是 swchen44 → 回報 BLOCKED（controller 會請使用者以 `! gh auth login` 處理），不得繼續。

- [ ] **Step 2: 建 repo + remote 重整**

```bash
cd /Users/swchen.tw/git/md-reader
git remote rename origin upstream
gh repo create swchen44/md-reader-lite --public --description "Lightweight Markdown reader Chrome extension (md-reader fork): Obsidian syntax, folder tree, offline-first" --source . --remote origin
git push -u origin main
git push -u origin feature/rebrand-lite
git remote -v   # origin=swchen44/md-reader-lite, upstream=md-reader/md-reader
```

注意：絕不對 upstream push。

- [ ] **Step 3: 驗證**

```bash
gh repo view swchen44/md-reader-lite --json url,visibility --jq '{url,visibility}'
curl -s -o /dev/null -w "%{http_code}" https://github.com/swchen44/md-reader-lite/blob/feature/rebrand-lite/PRIVACY.md   # 200
```

（此 Task 無 commit——皆為 remote 操作。）

---

### Task 8: 全量驗證 + 打包

- [ ] **Step 1: 全檢**

```bash
cd /Users/swchen.tw/git/md-reader
node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"
node_modules/.bin/tsc --noEmit
export npm_package_version=1.0.0 npm_package_name=md-reader-lite
node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js 2>&1 | tail -2 && node ./scripts/zip.mjs
python3 - <<'EOF'
import json,zipfile
z=zipfile.ZipFile('dist/md-reader-lite-1.0.0.zip')
m=json.loads(z.read('manifest.json'))
assert m['version']=='1.0.0', m['version']
print('zip manifest ok', m['version'])
EOF
grep -rn "md-reader.github.io\|orgs/md-reader\|Heroor" src/ README.md package.json | grep -v "_locales" || echo "no upstream links in shipped surfaces"
```

Expected: 30 pass、tsc 乾淨、zip 內 manifest 1.0.0、無殘留上游連結。

- [ ] **Step 2: Commit（若上一步發現殘留而修正，才有 commit；否則本 Task 無 commit）**

---

### Task 9: 商店截圖與瀏覽器實測（controller 執行）

此 Task 由 controller 以 agent-browser + Chrome for Testing 執行（subagent 無瀏覽器）：

- [ ] 啟動 CfT 載入 `extension/`，確認：擴充名稱顯示 MD Reader Lite、新圖示、popup 標題與連結指新 repo
- [ ] 功能無回歸 smoke：渲染 obsidian-demo、檔案頁籤樹、popup 開關
- [ ] 產出 1280×800 截圖 ≥3 張（亮色渲染頁、目錄樹展開、popup），`--window-size=1280,800` 截圖後存 `docs/store-assets/screenshot-{render,tree,popup}.png`；另 `sips -z 128 128 src/images/logo-stroke.png --out docs/store-assets/icon-128.png`
- [ ] Commit：

```
docs: add store screenshots and 128px icon asset

Why: store submission requires at least one 1280x800 screenshot and a
128px icon upload.
What: three screenshots (render page, folder tree, popup) captured
from the built extension, plus the 128px icon derived from the logo.
How: captured via Chrome for Testing with the extension loaded.
Boundary: docs/store-assets only.
```

---

## Self-Review 紀錄

- **Spec coverage**：品牌替換（T1-T3）、repo/上架材料（T6/T7/T9）、core/shell 邊界（T4 + ARCHITECTURE in T5）、docs 六件套與 research/（T5/T6）、roadmap（T5）、Git 四段紀律（Global Constraints + 各 commit 範本）、驗收（T8/T9）——皆有對應。內部識別不改：T1 僅動顯示層。
- **Placeholder scan**：`store-listing.md` 的「ZH:（同結構中文版，實作時翻譯）」是明確交付指示（實作者翻譯 EN 詳述），非未定案；其餘無 TBD。
- **Type consistency**：`fetchDirListing` 簽名在 T4 前後一致；zip 名 `md-reader-lite-1.0.0.zip` 在 T1/T8 一致；`npm_package_name` 環境變數 T1 引入後全計畫沿用。
