# Privacy Policy — MD Reader Lite

_Last updated: 2026-08-31_

MD Reader Lite renders Markdown files locally in your browser.

- **No data collection.** The extension does not collect, transmit, store remotely, or sell any user data. No analytics, no telemetry, no error reporting.
- **No external requests, with one documented exception.** All rendering libraries are bundled. The extension requests no host permissions. Network requests are limited to the same-origin requests your browser's page context makes (reloading the Markdown file you opened for auto-refresh, and, when the folder tree is enabled, the directory listing of that file's own folder from the same server), plus one cross-origin exception: on raw.githubusercontent.com pages, an anonymous, tokenless call to GitHub's public API to list a folder when the file tree is used — see "GitHub directory listing" below.
- **Local settings only.** Preferences (theme, plugins, panel state) are stored in `chrome.storage.local` on your device and never leave it.
- **Optional folder access.** For local (file://) documents you may grant read-only access to a folder of your choice via the browser's folder picker; the grant is stored only in this browser's local IndexedDB and can be revoked by clearing site data.
- **GitHub directory listing.** On raw.githubusercontent.com pages the Files tab lists the folder via GitHub's public API (anonymous, read-only, no token); no other data is sent.
- **Permissions.** No host permission is requested; `storage` keeps your settings; `activeTab` lets the extension apply setting changes to the current tab; file URL access (optional, off by default in Chrome) lets the extension render local files you open.

Questions: https://github.com/swchen44/md-reader-lite/issues

---

中文摘要：本擴充零資料蒐集、零遙測；所有渲染在本機完成，設定僅存於裝置上的 chrome.storage.local。不申請任何主機權限——網路請求僅限同源請求（重新讀取你開啟的 Markdown 檔以自動刷新，以及啟用目錄樹時其所在資料夾的列表），加上一項跨域例外：於 GitHub raw 頁面使用檔案樹時，會匿名呼叫 GitHub 公開 API 列目錄，無 token、無其他資料傳輸。本機文件可選擇性授權唯讀資料夾存取（瀏覽器原生選擇器），授權僅存於本機瀏覽器，清除網站資料即可撤銷。
