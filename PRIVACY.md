# Privacy Policy — MD Reader Lite

_Last updated: 2026-08-30_

MD Reader Lite renders Markdown files locally in your browser.

- **No data collection.** The extension does not collect, transmit, store remotely, or sell any user data. No analytics, no telemetry, no error reporting.
- **No external requests.** All rendering libraries are bundled. The extension requests no host permissions. The only network requests are the same-origin requests your browser's page context makes: reloading the Markdown file you opened (auto-refresh) and, when the folder tree is enabled, the directory listing of that file's own folder from the same server.
- **Local settings only.** Preferences (theme, plugins, panel state) are stored in `chrome.storage.local` on your device and never leave it.
- **Permissions.** No host permission is requested; `storage` keeps your settings; `activeTab` lets the extension apply setting changes to the current tab; file URL access (optional, off by default in Chrome) lets the extension render local files you open.

Questions: https://github.com/swchen44/md-reader-lite/issues

---

中文摘要：本擴充零資料蒐集、零遙測、零外部請求；所有渲染在本機完成，設定僅存於裝置上的 chrome.storage.local。不申請任何主機權限——僅有的網路請求是頁面情境本身發出的同源請求：重新讀取你開啟的 Markdown 檔（自動刷新）與（啟用目錄樹時）其所在資料夾的列表。
