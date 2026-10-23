# Lessons Learned

一行格式：情境 → 教訓 → 對策。

本輪 Mermaid 12 的設計、進度與永久測試入口：[migration plan](superpowers/plans/2026-10-23-mermaid-modernization.md)。接手時以該文件 Current Checkpoint 與 Git 狀態為準，歷史失敗不得當成目前結果。

1. Chrome MV3 與 file://（2026-08-30）：SW fetch、content script fetch/XHR（含隔離世界）對 file:// 全被封鎖 → 擴充無法程式化讀本機檔 → 目錄樹在 file:// 降級為說明訊息；完整方案走 FSA API（案 C）。詳見 research/2026-08-30-chrome-mv3-file-url-access-restrictions.md
2. 伺服器缺 charset（2026-08-30）：text/markdown 未標 charset，Chrome 對 CJK 內容嗅探成 Big5/GBK，位元組級破壞（`]` 被併進雙位元組字）→ 部署一律 `charset=utf-8`；驗收伺服器已內建。
3. 全域 regex 動 raw source 的代價（2026-08-30）：`%%…%%` 全域移除毀了 Mermaid（%% 是其註解語法）與程式碼區塊 → 任何 pre-parse 文字改寫都必須 fence-aware（共用 fence 掃描器）；同教訓適用 callout 正規化。
4. pnpm build script 白名單隨版本遷移（2026-08-29/30）：package.json 的 pnpm 欄位（≤9）→ pnpm-workspace.yaml 的 onlyBuiltDependencies（10）→ allowBuilds 映射（11，`pnpm approve-builds --all` 會自動寫入）。CI 上 pnpm 11 只認 allowBuilds，缺了會 ERR_PNPM_IGNORED_BUILDS 直接失敗；pnpm 寫入的「set this to true or false」範本不是垃圾，是待填核准項。
5. Chrome 137+ stable 移除 --load-extension（2026-08-30）：自動化測試載入未封裝擴充要用 Chrome for Testing/Chromium。
6. node --test 目錄模式在本 repo 誤判失敗（2026-08-29）：一律指定測試檔案清單。
7. 單執行緒 HTTPServer 驗收假象（2026-08-30）：Chrome keep-alive 佔住唯一執行緒，之後所有請求逾時，看起來像功能壞掉 → 測試伺服器一律 ThreadingHTTPServer。
8. host_permissions 濫用（2026-08-30）：同源請求（重抓當前檔、同目錄 listing）由 content script 直接 fetch 即可，完全不需要 host 權限；background 代理的唯一價值是繞過頁面 CSP（如 raw.githubusercontent.com `default-src 'none'`），代價是要申請全站權限——除非產品必須支援嚴格 CSP 網站，否則不值得。
   8.5 補充（2026-08-30，第三次踩）：Markdown 表格儲存格內的原始 `|`（如 TS 聯集型別）會被 prettier 連鎖破壞表格結構 → 表格內一律用 code span 包裹或改寫成「或」；spec/計畫寫完 commit 後要回看 prettier 產物。
9. Webpack alias 與 node --test 的 import 三方衝突（2026-08-30）：core 檔互相 import 時 @/ 別名在 node 測試下無法解析、.ts 副檔名被 TS4.8 拒絕 → 解法是 package.json subpath imports（#core/\*）+ tsconfig paths 雙映射，node/tsc/webpack 三方通吃；shell 檔維持 @/。
10. content script 的 fetch 豁免頁面 CSP（2026-08-31 實測）：在 default-src 'none' 的 raw.githubusercontent 頁上，content script 同源 fetch 8/8 成功、跨域（CORS 允許的）API fetch 也通——narrow-permissions 案「嚴格 CSP 網站失去自動刷新/目錄樹」的推定錯誤；背景代理唯一不可替代的用途只剩需要 host 權限的非 CORS 端點。
11. 無效 manifest 讓瀏覽器「假死」（2026-09-03）：`web_accessible_resources` 的 match pattern 驗證比 content_scripts 嚴格——含 `?` 的查詢變體（`*://*/*.md?*`）與 `file://*/…`（file scheme 帶 `*` host）在 WAR 皆判 Invalid，整個擴充載入失敗，Chrome/Playwright/agent-browser 一 launch 就 hang（`waitForEvent('serviceworker')` 卡死），表象酷似「環境壞掉」→ 自動化瀏覽器無故卡住時先驗 `extension/manifest.json`（手動 chrome://extensions 載入會跳出真正的 "Invalid match pattern" 對話框），別急著怪環境或重裝。連帶結論：要按副檔名收窄 file:// 的 WAR matches 走不通（合法 file:// pattern 無法過濾副檔名）。
12. Mermaid strict 仍可能在產生 SVG 前載入資源（2026-10-23）：四個有效 raw fixture 觸發請求，插入後清理太晚 → 本機 renderer 專用 CSP 加上結構化 preflight；永久保留 raw 反例，守門測試連「被攔截的嘗試」都算失敗。見 `tests/probes/mermaid12/` 與 migration plan。
13. ZenUML wrapper parser 是 no-op（2026-10-23）：缺右括號也產生 SVG，不能把非空圖當語法驗收 → 固定 plugin/core 版本，以 core 公開且 stateless 的 parse method 補驗證；升版重跑 syntax、混合頁與 invalid→valid recovery。
14. SVG foreignObject 的 HTML 仍會吃到文章 CSS（2026-10-23）：Developer 的 `p !important` 蓋過 Mermaid 字型、顏色與大小，單加 inherit 沒用 → SVG 通過安全檢查後，在隔離 renderer 讀取 HTML label 的 computed typography，再用 inline important 保留；不複製資源屬性。作者 Courier New／文字色與下一張 Georgia 的 e2e 已通過。
15. 非同步重繪提早還原閱讀位置（2026-10-23）：早期 RAF 後圖表仍改變高度 → 等 active generation 的 diagramsRendered，再還原錨點；新一輪重繪、wheel／touch／捲動鍵取消舊還原。永久案例關掉瀏覽器原生 scroll anchoring，避免測到瀏覽器補償而誤判。
16. headed 瀏覽器測試同時啟動會卡住（2026-10-23）：兩個 concurrent suite 未產生有效 receipt → 只終止自己的程序後序列重跑；`test:e2e` 固定 `--test-concurrency=1`。卡住／中斷的 log 不算通過；使用者可能操作測試視窗時，重跑受影響的焦點／鍵盤案例，不將原因未明的失敗直接歸咎產品或使用者。
17. 修改預設值會影響內部 fallback（2026-10-23）：原本以 undefined 表示「作者主題不套 preset」，改預設後會重新套 Anthropic → 作者主題路徑明確傳 `original`；default、legacy、explicit Original、Reset 和 authored YAML 都要各自測。設計、checklist、測試 receipt 與未完成項目存檔，不能只留在聊天。
18. 原生圖種的 style metadata 介面不同（2026-10-23）：只檢查 Flowchart 會漏掉 State class／inline styles，C4 element 檢查也不含 relationship paint；State 負例在舊路徑確實出現被測試攔截的請求嘗試 → 所有圖種先取得 parsed diagram，掃描固定版本的 classes／nodes／edges／C4 relationships，再進 render。測試加入 `preflightPassed`，避免把「render 後 SVG 清理拒絕」誤當前置防護。
19. pagehide 不代表 DOM 斷線（2026-10-23）：保留頁面仍 isConnected，舊佇列會重建 renderer、把首圖變 error → suspended + page epoch 使舊工作失效；pageshow 只重試未完成來源，重複 pageshow 不重做。純 unit 與瀏覽器合成 PageTransitionEvent 已驗證；這不等於實際 BFCache 命中率驗證。
20. 取消閱讀還原不能只看 wheel（2026-10-23）：使用者用滑鼠跳到另一處仍被舊錨點拉回 → 也監聽 pointerdown／mousedown／hashchange／pagehide，清掉對應 generation 的還原；實際滑鼠點擊後重新定位的 e2e 先紅後綠。
21. benchmark 必須驗證真的重繪（2026-10-23）：SW 對自己送 runtime message 沒觸發背景 handler；無 tabs 權限時 query 的 URL 也不可用 → 固定 active tab ID，使用既有允許的 storage + tab message；每次要求首個 SVG 物件已更換且所有圖已 ready。保留失敗 receipt，樣本不足不得產生通過的 median/max。
22. dev --no-watch 仍可能留 reloader server（2026-10-23）：兩個 compiler 已完成，ExtReloader 仍占 9090 → 僅停止自己啟動的 CLI，記錄 intentional SIGINT，不把 exit 130 宣稱 exit 0；再建 production，確認 dev source map 已清除且只剩四個預期 JS。
23. 寬度與單位必須一起解析預設（2026-10-23）：單獨把單位改 percent 會把舊版 900px 當百分比 → 只有兩欄都缺少才用新預設 85%；舊數字無單位仍視為 px，null 仍關閉，不在讀取時寫回。新安裝、舊像素、百分比、關閉與 Reset 各自有永久測試。
24. legal comments 不等於完整 notices（2026-10-23）：bundle 的短版授權註記不能代替 ELK 等套件完整文本 → build 在 zip 前從已安裝 production inventory 收集原始 LICENSE／COPYING／NOTICE，沒有獨立檔時保留原始 README；缺檔就失敗。保留來源與版本，不把本機路徑打包。
25. 新預設展開控制列會改變測試座標（2026-10-23）：85% 寬度列讓 CSS 開關落在可捲動面板可視範圍外，舊固定座標點擊沒有切換 storage → 點擊前先用真實控制項 scrollIntoViewIfNeeded，再量座標與實際滑鼠點擊；保留原本開關／草稿／套用斷言，不以放寬檢查掩蓋失敗。
26. npm build 與 CI 有兩套打包入口（2026-10-23）：本機加了 notices，但 release workflow 直接執行 manifest／webpack／zip，會漏掉新步驟 → 同步 CI，使用現有工具鏈的 YAML parser 寫順序 regression，先紅後綠；本機打包通過仍不能宣稱 hosted release 已跑過。
