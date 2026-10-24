# MD Reader Lite

> Forked from [md-reader](https://github.com/md-reader/md-reader) by Bener (MIT). Renamed and extended; not affiliated with the upstream project or its store listing.

A lightweight, **privacy-first** Chrome extension that renders local and online Markdown files as clean, readable pages. **Offline by default** — one switch blocks every outbound request the extension can make, including remote images and media referenced inside the document itself; no telemetry, no analytics, no tracking, no backend.

## Features

- CommonMark + GFM-style rendering (tables, task lists, footnotes, KaTeX, Mermaid, Graphviz); `.mmd` files render whole as one Mermaid diagram — client-side only, no server, unaffected by offline mode
- Obsidian syntax: `![[image|300]]` embeds, `[[wikilinks|alias]]`, `%%comments%%`, callouts, front matter table
- Outline (TOC) side panel, light/dark/auto themes, custom plugins toggle, per-plugin options
- Floating sidebar overlays the article without reflow; drag its resize edge to adjust the locally remembered width. [Permanent test plan](docs/testing/floating-sidebar.md)
- The navigation drawer uses the same Anthropic paper palette and local typography as settings, including Outline, Files, search and sorting menus, independently of article light/dark and custom CSS.
- Folder tree side panel for browsing sibling markdown files — **on by default** (http/https autoindex, `file://` via folder picker, GitHub raw pages); the listing itself is still lazy-loaded, only fetched when you open the Files tab
- CSS customization: Developer styling is applied by default on new installs; choose the read-only Developer or Editorial presets, or edit either of two local user slots, then explicitly Apply
- Custom content width defaults to 85% on new/reset settings; saved pixel/percent widths and disabled choices are preserved
- Persistent navigation-search history stored locally: configurable limit (default 10), keyboard selection, Tab completion and a clear control. Enter/keypad Enter or history selection records a term; typing only searches. Empty focus shows recents, open documents share updates, Shift+Tab retains backward focus, and 0 disables history without erasing saved terms. [Behavior and tests](docs/testing/sidebar-theme-search-history.md)
- Mermaid styles: choose Original or Anthropic blog style in Settings > Plugins. Anthropic is the default for new or missing preferences; saved Original choices are preserved. The Anthropic preset uses local fonts and a light paper surface independently of custom page CSS. All three settings tabs share the editorial appearance
- Mermaid 12.2.0 with locally bundled ZenUML: all [31 diagram fixtures](example/mermaid-compatibility.md) render in both styles. External diagram resources are rejected; [test plan and limits](docs/superpowers/plans/2026-10-23-mermaid-modernization.md)
- GitHub raw sandbox pages render Mermaid in an extension-owned hidden document using the `offscreen` permission (Chrome 109+), with the same local engine and resource checks. No website access permission, CDN or rendering server is added. [Sandbox test plan](docs/testing/mermaid-sandbox.md)
- PlantUML diagrams via a configurable server — **opt-in, off by default, and disabled whenever offline mode is on** (self-hostable; `.puml`/`.plantuml` files render whole as one diagram — [self-host guide](docs/plantuml-server-setup.md))
- Recognizes `.md` / `.markdown` / `.mkd` / `.mdx` / `.mdc` / `.txt` (opt-in) / `.puml` / `.plantuml` / `.mmd`
- Works on `file://`, intranet servers, and raw URLs

## Privacy — our defining feature

MD Reader Lite has no tracking backend. Preferences and confirmed search terms stay on your device. The extension is open source; network behavior and known limits are documented below.

- **No data collection, ever.** No analytics, no telemetry, no error reporting, no usage stats. There is no backend server for the extension to talk to.
- **Nothing that identifies you.** No device ID, no install ID, no UUID, no fingerprinting; the extension never reads your user-agent, screen size, timezone, or IP to identify you. It has no server, so there is nothing that could log an IP or a session.
- **Offline mode — on by default.** Blocks auto-refresh, GitHub API folder browsing and PlantUML. After rendering, it removes supported absolute HTTP(S) and protocol-relative media attributes from the document. Same-server Files-tab requests remain allowed. Local `file://` features keep working. The network-listener fixtures verify covered cases; they do not establish a guarantee for arbitrary document resources. Relative media URLs on web pages and document CSS are outside this sweep, as detailed below.
- **Zero network by default, feature by feature.** Turning offline mode off doesn't turn everything else on — auto-refresh, charset compatibility, and PlantUML are each still individually opt-in and off by default. The folder tree tab is on by default, but that's a visibility setting, not a network one — it doesn't fetch anything until you open the tab:
  - **Auto-refresh** (off by default): re-fetches the exact document you are viewing to detect edits — only the same URL you already opened.
  - **Folder tree** (Files tab visible by default; the fetch itself is opt-in by action, not by setting): opening the Files tab lists the folder of the document you are viewing (same server) — this works even with offline mode on, since loading the document itself already connected to that server and browsing its listing is a user-initiated extension of that trust. On `raw.githubusercontent.com` pages it instead calls GitHub's public API anonymously (no token, no account) — a different host, so this still respects offline mode and stays blocked while it's on. For `file://` documents, listing reads the browser's own native directory page via a hidden same-extension frame; no permission dialog is needed for this in the common case (falls back to the browser's File System Access folder picker only if that fails), and it's unrelated to and can't be bypassed by this extension's settings.
  - **Charset compatibility** (off by default, `file://` only): re-reads the same local file to force UTF-8; the bytes never leave your machine.
  - **PlantUML diagrams** (off by default, and force-disabled whenever offline mode is on): renders `plantuml` code fences by sending the diagram source — your content — to a PlantUML server (default `plantuml.com`; you can point it at your own self-hosted server instead). This is the **only** feature that sends document content to a third party, and it never runs while offline mode is on.
- **Remote-resource sweep limits.** The sweep checks raw element attributes for absolute HTTP(S) or protocol-relative URLs. Relative URLs such as `images/chart.png` or `/image.png` are retained and can load over the network on HTTP(S) pages, even in Offline Mode. It also does not sweep inline `style="background-image:url(...)"`, `<style>`/`@import url()`, `<use xlink:href>` or legacy `background` attributes. This document-media boundary is separate from the confined, local Mermaid renderer.
- **On-device settings only.** Preferences live in `chrome.storage.local` on this device and are **never** synced to your Google account. Optional local-folder access (the FSA fallback) is stored only in this browser's IndexedDB and is revoked by clearing site data.
- **Local directory-listing exposure, honestly disclosed.** The `file://` folder-tree mechanism runs in _any_ matching frame, not only ones this extension creates. A malicious local HTML file you separately open could, in principle, embed an iframe pointing at one of your folders and receive its file names, sizes, and modified times back via `postMessage` — this requires you to first open an untrusted local HTML file yourself, never reaches the network, and can't read file contents, only listings. See [PRIVACY.md](PRIVACY.md) for details.
- **Network visibility.** Document loads, media, folder listings and auto-refresh can reveal your IP to the requested server; optional PlantUML sends diagram source to the configured server. MD Reader Lite adds no tracking identifiers and maintains no server log. Offline Mode is not a browser-level network firewall; disconnected operation requires a network-isolated environment and local resources.

Full policy: [PRIVACY.md](PRIVACY.md).

## Install

[Install MD Reader Lite from the Chrome Web Store](https://chromewebstore.google.com/detail/md-reader-lite/dllkoapplbnpedjjhodcaogiegbhdkdj?authuser=0&hl=zh-TW)

Maintainers: [update the existing Chrome Web Store item](docs/chrome-web-store-upload.md).

### Unpacked / intranet

1. Build or download `dist/md-reader-lite-<version>.zip`, unzip to a fixed folder
2. Open `chrome://extensions`, enable Developer mode, Load unpacked → select the folder
3. For local files, enable "Allow access to file URLs" in the extension's details

## 隱私——我們最大的特色

MD Reader Lite 沒有追蹤後端。設定與確認的搜尋詞只存裝置本機。整個擴充皆為開源；網路行為與已知限制列於下方。

- **零資料蒐集。** 無分析、無遙測、無錯誤回報、無使用統計；擴充功能沒有任何後端伺服器可供傳輸。
- **無任何可辨識身份的資訊。** 無裝置 ID、安裝 ID、UUID、指紋；不讀取 user-agent／螢幕尺寸／時區／IP 來識別你。因為沒有伺服器，也就沒有任何東西能記錄 IP 或工作階段。
- **離線模式——預設開。** 封鎖自動刷新、GitHub API 目錄與 PlantUML，並於渲染後移除支援的絕對 HTTP(S)／protocol-relative 媒體屬性。同伺服器「檔案」頁籤請求仍允許，本機 `file://` 功能照常運作。網路監聽測試只驗證涵蓋的案例，不代表任意文件資源皆零請求；網頁中的相對媒體網址及文件 CSS 不在此清掃範圍，詳見下方。
- **預設零網路，逐項也是。** 關掉離線模式並不會把其他功能一併打開——自動刷新、字元集相容模式、PlantUML 仍各自獨立、預設關閉。「檔案」頁籤預設可見，但那只是可見性設定、非網路設定——不點開頁籤就不會發出任何請求：
  - **自動刷新**（預設關）：重抓你正在看的那份文件以偵測變更——只連你已開啟的同一網址。
  - **目錄樹**（「檔案」頁籤預設可見；實際發請求仍取決於你有沒有點開，而非設定值）：點開「檔案」頁籤會列出你正在看的文件所在資料夾（同一伺服器）——即使離線模式開啟也能使用，因為載入文件本身已經連線過該伺服器，瀏覽其目錄清單是延伸這個既有信任關係的使用者主動行為；於 `raw.githubusercontent.com` 頁面則匿名呼叫 GitHub 公開 API（無 token、無帳號）——這是不同主機，仍受離線模式封鎖。若是 `file://` 本機文件，一般情況下讀取瀏覽器原生目錄頁即可、不需要授權對話框（僅在這條路徑失敗時才退回瀏覽器的 File System Access 資料夾選擇器）——這與本擴充的任何設定無關，也無法被繞過。
  - **字元集相容模式**（預設關，僅 `file://`）：重讀同一份本機檔以強制 UTF-8；位元組不離開你的電腦。
  - **PlantUML 圖表**（預設關，且離線模式開啟時強制停用）：渲染 `plantuml` 程式碼區塊時會把圖表原始碼——也就是你的內容——送到 PlantUML 伺服器（預設 `plantuml.com`；可自行改指向你自架的伺服器）。這是**唯一**會把文件內容送到第三方的功能，且離線模式開啟時絕不會執行。
- **遠端資源清掃限制。** 清掃以原始元素屬性判斷絕對 HTTP(S)／protocol-relative 網址；`images/chart.png`、`/image.png` 等相對網址會保留，在 HTTP(S) 文件中即使開啟離線模式仍可能連網。inline `style="background-image:url(...)"`、`<style>`／`@import`、`<use xlink:href>`、legacy `background` 屬性也不在涵蓋範圍。這是文件媒體的邊界，與受隔離的本機 Mermaid renderer 分開判斷。
- **設定僅存於裝置。** 偏好設定存在本機的 `chrome.storage.local`，**永不**同步到你的 Google 帳號。選擇性的本機資料夾授權（FSA 備援機制）僅存於本瀏覽器的 IndexedDB，清除網站資料即可撤銷。
- **誠實揭露：本機目錄列表機制的殘留風險。** `file://` 檔案樹機制會在**任何**符合的 frame 內執行，不限本擴充自己建立的——若你另外開啟一個不受信任的本機 HTML 檔，該頁面理論上可以自建 iframe 指向你的某個資料夾，透過 `postMessage` 取得檔名/大小/修改時間（不含檔案內容、不經網路）。這需要你先主動開啟不受信任的本機 HTML 檔案。詳見 [PRIVACY.md](PRIVACY.md)。
- **網路可見性。** 文件載入、媒體、目錄列表及自動刷新可能讓目標伺服器看到 IP；選用的 PlantUML 會把圖表原碼送往指定伺服器。MD Reader Lite 不附加追蹤識別碼，也沒有伺服器日誌。離線模式不是瀏覽器層級的網路防火牆；完全斷網運作需使用隔離環境及本機資源。

完整政策：[PRIVACY.md](PRIVACY.md)。

## Development

See [docs/developer_guide.md](docs/developer_guide.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

[MIT](LICENSE). Original work © 2018-present Bener; modifications © 2026 swchen44.
