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

## 更正（2026-08-31）

在 default-src 'none' 的 raw.githubusercontent 頁上實測：content script 同源 fetch 8/8 成功、跨域（CORS 允許的）API fetch 也通——narrow-permissions 案「嚴格 CSP 網站失去自動刷新/目錄樹」的推定錯誤；背景代理唯一不可替代的用途只剩需要 host 權限的非 CORS 端點。詳見 lesson_learn.md 第 10 條。
