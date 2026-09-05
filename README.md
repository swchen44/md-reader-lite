# MD Reader Lite

> Forked from [md-reader](https://github.com/md-reader/md-reader) by Bener (MIT). Renamed and extended; not affiliated with the upstream project or its store listing.

A lightweight, **privacy-first** Chrome extension that renders local and online Markdown files as clean, readable pages. **Offline by default** — one switch blocks every outbound request the extension can make, including remote images and media referenced inside the document itself; no telemetry, no analytics, no tracking, no backend.

## Features

- CommonMark + GFM-style rendering (tables, task lists, footnotes, KaTeX, Mermaid, Graphviz); `.mmd` files render whole as one Mermaid diagram — client-side only, no server, unaffected by offline mode
- Obsidian syntax: `![[image|300]]` embeds, `[[wikilinks|alias]]`, `%%comments%%`, callouts, front matter table
- Outline (TOC) side panel, light/dark/auto themes, custom plugins toggle, per-plugin options
- Folder tree side panel for browsing sibling markdown files — **on by default** (http/https autoindex, `file://` via folder picker, GitHub raw pages); the listing itself is still lazy-loaded, only fetched when you open the Files tab
- PlantUML diagrams via a configurable server — **opt-in, off by default, and disabled whenever offline mode is on** (self-hostable; `.puml`/`.plantuml` files render whole as one diagram — [self-host guide](docs/plantuml-server-setup.md))
- Recognizes `.md` / `.markdown` / `.mkd` / `.mdx` / `.mdc` / `.txt` (opt-in) / `.puml` / `.plantuml` / `.mmd`
- Works on `file://`, intranet servers, and raw URLs

## Privacy — our defining feature

MD Reader Lite is built to record nothing and phone home to no one. Verify it yourself: the whole extension is open source and the network behavior below is exhaustive.

- **No data collection, ever.** No analytics, no telemetry, no error reporting, no usage stats. There is no backend server for the extension to talk to.
- **Nothing that identifies you.** No device ID, no install ID, no UUID, no fingerprinting; the extension never reads your user-agent, screen size, timezone, or IP to identify you. It has no server, so there is nothing that could log an IP or a session.
- **Offline mode — on by default.** One switch blocks every outbound request the extension itself can trigger, with one deliberate exception: auto-refresh re-fetching, the GitHub API folder tree, PlantUML diagram rendering, and — after the page renders — remote images, video, audio, `<iframe>`/`<embed>`/`<object>`/`<track>`, and SVG/`<input type="image">` references found _inside the document itself_ (this also stops tracking pixels) are all blocked. The exception: opening the Files tab on an http(s) page you're already viewing still lists that **same server's** folder even while offline — see "Zero network by default" below for why. Local `file://` features are unaffected while offline: the folder tree reads the browser's own native directory page via a hidden same-extension frame (falling back to a picked local folder only if that fails), charset compatibility, and local/relative/`data:` images all keep working. Verified end-to-end with a Playwright network-listener test suite (11/11 passing): with offline mode on and no same-server Files tab opened, zero outbound requests occur.
- **Zero network by default, feature by feature.** Turning offline mode off doesn't turn everything else on — auto-refresh, charset compatibility, and PlantUML are each still individually opt-in and off by default. The folder tree tab is on by default, but that's a visibility setting, not a network one — it doesn't fetch anything until you open the tab:
  - **Auto-refresh** (off by default): re-fetches the exact document you are viewing to detect edits — only the same URL you already opened.
  - **Folder tree** (Files tab visible by default; the fetch itself is opt-in by action, not by setting): opening the Files tab lists the folder of the document you are viewing (same server) — this works even with offline mode on, since loading the document itself already connected to that server and browsing its listing is a user-initiated extension of that trust. On `raw.githubusercontent.com` pages it instead calls GitHub's public API anonymously (no token, no account) — a different host, so this still respects offline mode and stays blocked while it's on. For `file://` documents, listing reads the browser's own native directory page via a hidden same-extension frame; no permission dialog is needed for this in the common case (falls back to the browser's File System Access folder picker only if that fails), and it's unrelated to and can't be bypassed by this extension's settings.
  - **Charset compatibility** (off by default, `file://` only): re-reads the same local file to force UTF-8; the bytes never leave your machine.
  - **PlantUML diagrams** (off by default, and force-disabled whenever offline mode is on): renders `plantuml` code fences by sending the diagram source — your content — to a PlantUML server (default `plantuml.com`; you can point it at your own self-hosted server instead). This is the **only** feature that sends document content to a third party, and it never runs while offline mode is on.
- **Honest caveat on the remote-resource sweep.** Offline mode blocks remote images and media referenced in the document, but the sweep targets element attributes, not CSS: inline `style="background-image:url(...)"`, `<style>`/`@import url()`, `<use xlink:href>`, and the legacy `background` attribute are not swept. These are vanishingly rare in Markdown, but we're not claiming the sweep is absolute.
- **On-device settings only.** Preferences live in `chrome.storage.local` on this device and are **never** synced to your Google account. Optional local-folder access (the FSA fallback) is stored only in this browser's IndexedDB and is revoked by clearing site data.
- **Local directory-listing exposure, honestly disclosed.** The `file://` folder-tree mechanism runs in _any_ matching frame, not only ones this extension creates. A malicious local HTML file you separately open could, in principle, embed an iframe pointing at one of your folders and receive its file names, sizes, and modified times back via `postMessage` — this requires you to first open an untrusted local HTML file yourself, never reaches the network, and can't read file contents, only listings. See [PRIVACY.md](PRIVACY.md) for details.
- **Honest caveat.** When you open the folder tree on a web page, or opt into auto-refresh, that request — like any request your browser makes for the document itself — reveals your IP to _that server_ (or to GitHub for the public API); and when you opt into PlantUML with offline mode off, diagram source is sent to whichever PlantUML server you configure. This is a property of HTTP, not something the extension adds or records: MD Reader Lite attaches no identifiers and keeps no log. For guaranteed zero network, keep offline mode on (the default) or use local `file://` documents.

Full policy: [PRIVACY.md](PRIVACY.md).

## Install (unpacked / intranet)

1. Build or download `dist/md-reader-lite-<version>.zip`, unzip to a fixed folder
2. Open `chrome://extensions`, enable Developer mode, Load unpacked → select the folder
3. For local files, enable "Allow access to file URLs" in the extension's details

## 隱私——我們最大的特色

MD Reader Lite 的設計原則是：不記錄任何事、不回傳給任何人。你可以自行驗證——整個擴充皆為開源，下列網路行為即為全部。

- **零資料蒐集。** 無分析、無遙測、無錯誤回報、無使用統計；擴充功能沒有任何後端伺服器可供傳輸。
- **無任何可辨識身份的資訊。** 無裝置 ID、安裝 ID、UUID、指紋；不讀取 user-agent／螢幕尺寸／時區／IP 來識別你。因為沒有伺服器，也就沒有任何東西能記錄 IP 或工作階段。
- **離線模式——預設開。** 一個開關即可封鎖擴充自身可能觸發的所有對外請求，只有一項刻意例外：自動刷新重抓、GitHub API 目錄樹、PlantUML 圖表渲染，以及頁面渲染完成後——**文件內容本身**引用的遠端圖片、影片、音訊、`<iframe>`/`<embed>`/`<object>`/`<track>`、SVG／`<input type="image">`（連追蹤像素也一併擋下）皆封鎖。例外：在你正在看的 http(s) 頁面點開「檔案」頁籤，即使離線也仍會列出**同一伺服器**的目錄——原因見下方「預設零網路，逐項也是」。離線時本機 `file://` 功能不受影響：目錄樹改讀瀏覽器原生目錄頁（透過同擴充的隱藏 iframe，失敗才退回資料夾選擇器）、字元集相容模式、本機／相對／`data:` 圖片皆照常運作。以 Playwright 網路監聽測試套件端到端驗證（11/11 通過）：離線模式開啟且未在同伺服器頁面點開「檔案」頁籤時，零對外請求。
- **預設零網路，逐項也是。** 關掉離線模式並不會把其他功能一併打開——自動刷新、字元集相容模式、PlantUML 仍各自獨立、預設關閉。「檔案」頁籤預設可見，但那只是可見性設定、非網路設定——不點開頁籤就不會發出任何請求：
  - **自動刷新**（預設關）：重抓你正在看的那份文件以偵測變更——只連你已開啟的同一網址。
  - **目錄樹**（「檔案」頁籤預設可見；實際發請求仍取決於你有沒有點開，而非設定值）：點開「檔案」頁籤會列出你正在看的文件所在資料夾（同一伺服器）——即使離線模式開啟也能使用，因為載入文件本身已經連線過該伺服器，瀏覽其目錄清單是延伸這個既有信任關係的使用者主動行為；於 `raw.githubusercontent.com` 頁面則匿名呼叫 GitHub 公開 API（無 token、無帳號）——這是不同主機，仍受離線模式封鎖。若是 `file://` 本機文件，一般情況下讀取瀏覽器原生目錄頁即可、不需要授權對話框（僅在這條路徑失敗時才退回瀏覽器的 File System Access 資料夾選擇器）——這與本擴充的任何設定無關，也無法被繞過。
  - **字元集相容模式**（預設關，僅 `file://`）：重讀同一份本機檔以強制 UTF-8；位元組不離開你的電腦。
  - **PlantUML 圖表**（預設關，且離線模式開啟時強制停用）：渲染 `plantuml` 程式碼區塊時會把圖表原始碼——也就是你的內容——送到 PlantUML 伺服器（預設 `plantuml.com`；可自行改指向你自架的伺服器）。這是**唯一**會把文件內容送到第三方的功能，且離線模式開啟時絕不會執行。
- **關於遠端資源清掃的誠實揭露。** 離線模式會封鎖文件內遠端圖片與媒體，但清掃鎖定的是元素屬性，非 CSS：inline `style="background-image:url(...)"`、`<style>`／`@import url()`、`<use xlink:href>`、legacy `background` 屬性不在清掃範圍。這些寫法在 Markdown 中極為罕見，但我們不宣稱清掃絕對涵蓋一切。
- **設定僅存於裝置。** 偏好設定存在本機的 `chrome.storage.local`，**永不**同步到你的 Google 帳號。選擇性的本機資料夾授權（FSA 備援機制）僅存於本瀏覽器的 IndexedDB，清除網站資料即可撤銷。
- **誠實揭露：本機目錄列表機制的殘留風險。** `file://` 檔案樹機制會在**任何**符合的 frame 內執行，不限本擴充自己建立的——若你另外開啟一個不受信任的本機 HTML 檔，該頁面理論上可以自建 iframe 指向你的某個資料夾，透過 `postMessage` 取得檔名/大小/修改時間（不含檔案內容、不經網路）。這需要你先主動開啟不受信任的本機 HTML 檔案。詳見 [PRIVACY.md](PRIVACY.md)。
- **誠實揭露。** 當你在網頁上點開目錄樹頁籤，或主動開啟自動刷新，該請求——如同瀏覽器抓取文件本身的任何請求——會讓「那台伺服器」（或 GitHub 公開 API）看到你的 IP；若你在關閉離線模式的情況下啟用 PlantUML，圖表原始碼會送到你所設定的 PlantUML 伺服器。這是 HTTP 的固有性質，不是擴充功能額外加上或記錄的：MD Reader Lite 不附帶任何識別碼、不保留任何紀錄。若要保證零網路，讓離線模式維持開啟（預設）或使用本機 `file://` 文件。

完整政策：[PRIVACY.md](PRIVACY.md)。

## Development

See [docs/developer_guide.md](docs/developer_guide.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

[MIT](LICENSE). Original work © 2018-present Bener; modifications © 2026 swchen44.
