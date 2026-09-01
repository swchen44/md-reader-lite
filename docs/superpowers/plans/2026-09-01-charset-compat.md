# v1.2.1 實作計畫：字元集相容模式（charsetCompat，零權限）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依核可 spec（`docs/superpowers/specs/2026-09-01-charset-compat-design.md`）落地 file:// 強制 UTF-8 重解碼（SW bgFetch + 精確比對安全模型），發版 v1.2.1。

**Architecture:** content script 偵測 file:// + charsetCompat → 送 bgFetch 訊息 → SW `fetch` + `TextDecoder('utf-8')` → 回傳 UTF-8 文字 → content script 重渲染。SW 安全用純函式 `canBgFetch`（精確 URL 比對，SW 端自足不信任 content script）。core 純函式 charset.ts；charsetCompat reload 類生效。

**Tech Stack:** TS 4.8.2、webpack、Svelte 3 + SMUI（popup）、chrome.runtime messaging、TextDecoder、node --test、Playwright（驗收）。

## Global Constraints

- 零 host 權限；**無 manifest 變更**；**無新 permission**。唯一結構性 background 改動：新增 `bgFetch` 訊息 case（本質必要，非權限變更）。`git diff main -- src/manifest.json` 須為空。
- 既有 100 條測試不得回歸；測試指定檔名跑：`node --test tests/github-url.test.mjs tests/fsa-path.test.mjs tests/doc-search.test.mjs tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs tests/settings.test.mjs tests/plugin-options.test.mjs tests/charset.test.mjs`（Task 1 起含 charset）。
- 新 core 檔用 `#core/*` subpath import 供測試；shell 用 `@/` alias。
- 每 task 結尾：測試綠 + `tsc --noEmit` 乾淨 + commit（四段 Why/What/How/Boundary 中文 + trailers：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR`）。
- i18n 新 key 僅 en/zh-CN/zh-TW 三語系。
- spec 的「精確比對 senderUrl===targetUrl 安全模型」「SW 必要（CS fetch file:// 失敗）」「兩條不變量」為 binding。

---

### Task 1: core charset.ts + data.ts 擴充 + 單元測試

**Files:**

- Create: `src/core/charset.ts`、`tests/charset.test.mjs`
- Modify: `src/core/data.ts`

**Interfaces（Produces）:**

- `Data` 新欄位：`charsetCompat?: boolean`；`getDefaultData()` 新預設：`charsetCompat: false`
- `src/core/charset.ts`（零 chrome 依賴）：

```ts
export function needsCharsetCompat(
  protocol: string,
  charsetCompat: boolean,
): boolean {
  return protocol === 'file:' && !!charsetCompat
}

export function canBgFetch(
  senderUrl: unknown,
  targetUrl: unknown,
  extensionId: unknown,
  senderId: unknown,
): boolean {
  if (typeof senderUrl !== 'string' || !senderUrl) return false
  if (typeof targetUrl !== 'string' || !targetUrl) return false
  if (typeof extensionId !== 'string' || senderId !== extensionId) return false
  let t: URL
  try {
    // parse both; sender parse guards malformed sender
    // eslint-disable-next-line no-new
    new URL(senderUrl)
    t = new URL(targetUrl)
  } catch {
    return false
  }
  if (senderUrl !== targetUrl) return false // 精確比對：只重抓自己這頁
  if (t.protocol !== 'file:') return false // file: 限縮
  return true
}
```

**Steps:**

- [ ] 寫 `tests/charset.test.mjs`（`import ... from '#core/charset'`）：
  - `needsCharsetCompat`：`('file:', true)`→true、`('file:', false)`→false、`('http:', true)`→false、`('https:', true)`→false、非字串 protocol 防禦。
  - `canBgFetch`（精確比對，extensionId 固定如 `'abc'`）：同一 file URL + id 相符 →true；file 頁請求「別的」file（senderUrl≠targetUrl）→false（核心 file-disclosure 防護）；http 頁（senderUrl http）請求 file（≠）→false；同一 http URL（senderUrl===targetUrl 但 protocol http）→false（限 file:）；senderId≠extensionId→false；senderUrl 空/非字串 →false；targetUrl 壞（`'not a url'`）→false；extensionId 非字串 →false。
  - ≥ 10 個 test block。
- [ ] 跑 `node --test tests/charset.test.mjs` 確認 FAIL。
- [ ] 實作 `src/core/charset.ts`（如上）。
- [ ] 改 `src/core/data.ts`：介面加 `charsetCompat?: boolean`、`getDefaultData` 加 `charsetCompat: false`。
- [ ] 全測試（9 檔）綠、`tsc --noEmit` 乾淨、commit。

---

### Task 2: SW bgFetch handler + content-script 佈線 + 生效

**Files:**

- Modify: `src/background.ts`、`src/main.ts`

**Interfaces:**

- Consumes：Task 1 的 `needsCharsetCompat`、`canBgFetch`、`Data.charsetCompat`。
- Produces：SW `bgFetch` 訊息協定 `{action:'bgFetch', data:{url}}` → resp `{ok:boolean, text?:string}`。

**Steps:**

- [ ] **background.ts bgFetch handler**：`messageHandler` switch 加 case（與 `storage` 並列）：

```ts
case 'bgFetch': {
  const allowed = canBgFetch(
    sender.url,
    data?.url,
    chrome.runtime.id,
    sender.id,
  )
  if (!allowed) {
    callback?.({ ok: false })
    break
  }
  try {
    const r = await fetch(data.url)
    if (!r.ok) {
      callback?.({ ok: false })
      break
    }
    const buf = await r.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(buf)
    callback?.({ ok: true, text })
  } catch {
    callback?.({ ok: false })
  }
  break
}
```

import `canBgFetch` 自 `@/core/charset`。注意既有 `onMessage` listener 已 `return true`（保持非同步 callback 通道開啟）——確認 messageHandler 為 async 且此 case await fetch 不破壞 callback 時序。

- [ ] **main.ts actionMap**：`background.ts` 的 actionMap 加 `charsetCompat: 'applySetting'`（與其他 reload 類並列）。
- [ ] **main.ts applySetting**：switch 的 `case 'breaks': case 'txtAsMd': case 'outlineCollapse':` 群組加 `case 'charsetCompat':`（同走 `window.location.reload()`）。
- [ ] **main.ts bgFetch 送出**：在初始 `renderSide()` 呼叫之後（約 505 行，此時 `contentRender`/`renderSide`/`rawContainer`/`mdRaw` 皆可用）插入：

```ts
if (needsCharsetCompat(window.location.protocol, configData.charsetCompat)) {
  chrome.runtime.sendMessage(
    { action: 'bgFetch', data: { url: window.location.href } },
    resp => {
      if (chrome.runtime.lastError) return
      if (resp?.ok && typeof resp.text === 'string' && resp.text !== mdRaw) {
        mdRaw = resp.text
        contentRender(mdRaw)
        renderSide()
        setTimeout(() => {
          if (rawContainer) rawContainer.textContent = mdRaw
        }, 0)
      }
    },
  )
}
```

import `needsCharsetCompat` 自 `@/core/charset`。`chrome.runtime.lastError` 檢查避免無 callback 時的 console 警告。

- [ ] 手動 smoke：build，開 file:// UTF-8 檔（charsetCompat 預設 false，不送 bgFetch）；storage 設 charsetCompat=true reload → 送 bgFetch、SW 回 UTF-8、頁面顯示正確中文。
- [ ] 全測試綠、tsc 乾淨、`git diff main -- src/manifest.json` 為空、commit。

---

### Task 3: popup toggle + i18n

**Files:**

- Modify: `src/popup/components/tab-general.svelte`、`src/config/i18n/locale.json`

**Interfaces:**

- Consumes：`data.charsetCompat`。

**Steps:**

- [ ] **tab-general.svelte**：在既有 reload 類控件（換行風格/.txt 渲染/大綱摺疊，都有 `hint_reload`）附近加「字元集相容模式」Switch：`bind:checked={data.charsetCompat}` + `on:change={() => updateConfig('charsetCompat', data.charsetCompat)}`（沿用同檔既有 Switch 慣例）；下方加 `hint_charset`（比 `hint_reload` 更具體：僅 file://、強制 UTF-8、切換將重整）。先讀 tab-general.svelte 現況確認 Switch 與 hint 寫法。
- [ ] **locale.json 新 key**（en/zh-CN/zh-TW ×3）：`label_charset-compat`、`hint_charset`。台灣用語：「字元集相容模式」／「僅 file:// 檔案；強制以 UTF-8 重新解碼，切換將重新整理頁面」。en/zh-CN 對應。
- [ ] build 後手動開 popup 檢查 toggle 寫入 charsetCompat。
- [ ] 全測試綠、tsc 乾淨、commit。

---

### Task 4: 驗收 + 文件 + 合併發版 v1.2.1（controller）

- [ ] Playwright 驗收（真瀏覽器、unpacked extension、file access 授權）：
  - charsetCompat=false + file:// UTF-8 檔 → 正常渲染（不送 bgFetch，或 SW 未被呼叫）。
  - charsetCompat=true + file:// UTF-8 檔 → content script 送 bgFetch、SW 回 `{ok:true}` UTF-8、頁面渲染正確中文（監聽 SW 或以渲染結果佐證端到端）。
  - **安全**：從 http 頁面 context 直接 `chrome.runtime.sendMessage({action:'bgFetch', data:{url:'file:///etc/hosts'}})` → SW 回 `{ok:false}`（canBgFetch 精確比對/protocol 拒絕）；再測 file:// 頁請求「別的」file URL → `{ok:false}`。
  - md 頁全功能迴歸（v1.2.0 設定/插件子選項/寬度單位不回歸）。
- [ ] `docs/plans.md`/`designs.md` 本案列；`docs/ROADMAP.md` 四項擴充第 3（字元集相容模式）→ 完成（v1.2.1）——四項全數完成；`docs/developer_guide.md` 或 store-listing 補 charsetCompat 說明（file:// 強制 UTF-8、需 file access）。
- [ ] 最終整分支審查（sonnet 或 opus，因涉安全）→ fix batch → 合入 main（--no-ff）→ bump 1.2.1（package.json + src/manifest.json）→ 檢查無繼承舊 tag → tag v1.2.1 → CI release 監控。

## Self-Review 紀錄

- **Spec coverage**：charsetCompat 資料模型（T1）＋ needsCharsetCompat/canBgFetch 純函式與安全模型（T1）＋ SW bgFetch handler/content-script 重渲染/reload 生效（T2）＋ popup toggle（T3）＋驗收含安全負向測試（T4）。精確比對安全模型 binding 落在 T1 純函式 + T2 SW handler + T4 負向驗收三處。
- **Placeholder scan**：無 TBD；bgFetch 送出插入點於 T2 明確（初始 renderSide 後）。
- **Type consistency**：`canBgFetch(senderUrl, targetUrl, extensionId, senderId)` 四參簽名 T1 定義、T2 SW handler 呼叫一致；bgFetch 訊息協定 `{ok, text}` T2 兩端一致。
