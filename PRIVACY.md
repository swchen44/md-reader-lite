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
