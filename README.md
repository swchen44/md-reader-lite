# MD Reader Lite

> Forked from [md-reader](https://github.com/md-reader/md-reader) by Bener (MIT). Renamed and extended; not affiliated with the upstream project or its store listing.

A lightweight, **privacy-first** Chrome extension that renders local and online Markdown files as clean, readable pages. **Zero network by default** — no telemetry, no analytics, no tracking, no backend.

## Features

- CommonMark + GFM-style rendering (tables, task lists, footnotes, KaTeX, Mermaid, Graphviz)
- Obsidian syntax: `![[image|300]]` embeds, `[[wikilinks|alias]]`, `%%comments%%`, callouts, front matter table
- Outline (TOC) side panel, light/dark/auto themes, custom plugins toggle, per-plugin options
- Folder tree side panel for browsing sibling markdown files — **opt-in, off by default** (http/https autoindex, `file://` via folder picker, GitHub raw pages)
- Works on `file://`, intranet servers, and raw URLs

## Privacy — our defining feature

MD Reader Lite is built to record nothing and phone home to no one. Verify it yourself: the whole extension is open source and the network behavior below is exhaustive.

- **No data collection, ever.** No analytics, no telemetry, no error reporting, no usage stats. There is no backend server for the extension to talk to.
- **Nothing that identifies you.** No device ID, no install ID, no UUID, no fingerprinting; the extension never reads your user-agent, screen size, timezone, or IP to identify you. It has no server, so there is nothing that could log an IP or a session.
- **Zero network by default.** Out of the box the extension makes **no** network request. All three network-touching features are **off by default** and each is individually optional:
  - **Auto-refresh** (off by default): re-fetches the exact document you are viewing to detect edits — only the same URL you already opened.
  - **Folder tree** (off by default): when you turn it on and open the Files tab, it lists the folder of the document you are viewing (same server), or — on `raw.githubusercontent.com` pages — calls GitHub's public API anonymously (no token, no account).
  - **Charset compatibility** (off by default, `file://` only): re-reads the same local file to force UTF-8; the bytes never leave your machine.
- **On-device settings only.** Preferences live in `chrome.storage.local` on this device and are **never** synced to your Google account. Optional local-folder access is stored only in this browser's IndexedDB and is revoked by clearing site data.
- **Honest caveat.** When you opt into the folder tree or auto-refresh on a web page, that request — like any request your browser makes for the document itself — reveals your IP to _that server_ (or to GitHub for the public API). This is a property of HTTP, not something the extension adds or records: MD Reader Lite attaches no identifiers and keeps no log. For guaranteed zero network, keep these features off (the default) or use local `file://` documents.

Full policy: [PRIVACY.md](PRIVACY.md).

## Install (unpacked / intranet)

1. Build or download `dist/md-reader-lite-<version>.zip`, unzip to a fixed folder
2. Open `chrome://extensions`, enable Developer mode, Load unpacked → select the folder
3. For local files, enable "Allow access to file URLs" in the extension's details

## 隱私——我們最大的特色

MD Reader Lite 的設計原則是：不記錄任何事、不回傳給任何人。你可以自行驗證——整個擴充皆為開源，下列網路行為即為全部。

- **零資料蒐集。** 無分析、無遙測、無錯誤回報、無使用統計；擴充功能沒有任何後端伺服器可供傳輸。
- **無任何可辨識身份的資訊。** 無裝置 ID、安裝 ID、UUID、指紋；不讀取 user-agent／螢幕尺寸／時區／IP 來識別你。因為沒有伺服器，也就沒有任何東西能記錄 IP 或工作階段。
- **預設零網路。** 開箱即用時擴充**不發出任何**網路請求。三個會觸及網路的功能**預設全部關閉**，且各自可獨立開關：
  - **自動刷新**（預設關）：重抓你正在看的那份文件以偵測變更——只連你已開啟的同一網址。
  - **目錄樹**（預設關）：開啟並切到「檔案」頁籤時，列出你正在看的文件所在資料夾（同一伺服器）；於 `raw.githubusercontent.com` 頁面則匿名呼叫 GitHub 公開 API（無 token、無帳號）。
  - **字元集相容模式**（預設關，僅 `file://`）：重讀同一份本機檔以強制 UTF-8；位元組不離開你的電腦。
- **設定僅存於裝置。** 偏好設定存在本機的 `chrome.storage.local`，**永不**同步到你的 Google 帳號。選擇性的本機資料夾授權僅存於本瀏覽器的 IndexedDB，清除網站資料即可撤銷。
- **誠實揭露。** 當你主動開啟網頁上的目錄樹或自動刷新，該請求——如同瀏覽器抓取文件本身的任何請求——會讓「那台伺服器」（或 GitHub 公開 API）看到你的 IP。這是 HTTP 的固有性質，不是擴充功能額外加上或記錄的：MD Reader Lite 不附帶任何識別碼、不保留任何紀錄。若要保證零網路，讓這些功能維持關閉（預設）或使用本機 `file://` 文件。

完整政策：[PRIVACY.md](PRIVACY.md)。

## Development

See [docs/developer_guide.md](docs/developer_guide.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

[MIT](LICENSE). Original work © 2018-present Bener; modifications © 2026 swchen44.
