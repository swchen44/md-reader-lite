# Lessons Learned

一行格式：情境 → 教訓 → 對策。

1. Chrome MV3 與 file://（2026-08-30）：SW fetch、content script fetch/XHR（含隔離世界）對 file:// 全被封鎖 → 擴充無法程式化讀本機檔 → 目錄樹在 file:// 降級為說明訊息；完整方案走 FSA API（案 C）。詳見 research/2026-08-30-chrome-mv3-file-url-access-restrictions.md
2. 伺服器缺 charset（2026-08-30）：text/markdown 未標 charset，Chrome 對 CJK 內容嗅探成 Big5/GBK，位元組級破壞（`]` 被併進雙位元組字）→ 部署一律 `charset=utf-8`；驗收伺服器已內建。
3. 全域 regex 動 raw source 的代價（2026-08-30）：`%%…%%` 全域移除毀了 Mermaid（%% 是其註解語法）與程式碼區塊 → 任何 pre-parse 文字改寫都必須 fence-aware（共用 fence 掃描器）；同教訓適用 callout 正規化。
4. pnpm build script 白名單隨版本遷移（2026-08-29/30）：package.json 的 pnpm 欄位（≤9）→ pnpm-workspace.yaml 的 onlyBuiltDependencies（10）→ allowBuilds 映射（11，`pnpm approve-builds --all` 會自動寫入）。CI 上 pnpm 11 只認 allowBuilds，缺了會 ERR_PNPM_IGNORED_BUILDS 直接失敗；pnpm 寫入的「set this to true or false」範本不是垃圾，是待填核准項。
5. Chrome 137+ stable 移除 --load-extension（2026-08-30）：自動化測試載入未封裝擴充要用 Chrome for Testing/Chromium。
6. node --test 目錄模式在本 repo 誤判失敗（2026-08-29）：一律指定測試檔案清單。
7. 單執行緒 HTTPServer 驗收假象（2026-08-30）：Chrome keep-alive 佔住唯一執行緒，之後所有請求逾時，看起來像功能壞掉 → 測試伺服器一律 ThreadingHTTPServer。
8. host_permissions 濫用（2026-08-30）：同源請求（重抓當前檔、同目錄 listing）由 content script 直接 fetch 即可，完全不需要 host 權限；background 代理的唯一價值是繞過頁面 CSP（如 raw.githubusercontent.com `default-src 'none'`），代價是要申請全站權限——除非產品必須支援嚴格 CSP 網站，否則不值得。
