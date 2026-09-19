const EDITORIAL_CSS = `/*
 * 「Little Might」編輯風格範例
 * 參考網站：https://littlemight.com/fable-prompts-for-people-who-dont-code/
 * （米色背景、大型 serif 標題、灰階內文、圓潤白色卡片與表格、橘色強調色）
 *
 * 字體說明：範例網站用的是需要連網下載的 Google Fonts（Instrument Serif /
 * Geist / Geist Mono）。本擴充功能預設離線、零連線是核心賣點，所以這裡
 * 刻意不用 @import 抓外部字型，改用本機就有的字體堆疊做最接近的近似。
 */

body.md-reader {
  background: #f5f4ed !important;
}

.md-reader__markdown-content {
  color: #0b0d0b !important;
}

.md-reader__markdown-content h1,
.md-reader__markdown-content h2,
.md-reader__markdown-content h3 {
  font-family: Georgia, 'Times New Roman', 'Noto Serif TC', serif !important;
  font-weight: 400 !important;
  letter-spacing: -0.02em !important;
  color: #0b0d0b !important;
}

.md-reader__markdown-content h1 {
  font-size: 2.6em !important;
  line-height: 1.1 !important;
}

.md-reader__markdown-content h2 {
  font-size: 1.7em !important;
  font-weight: 700 !important;
  padding-bottom: 0.3em !important;
  border-bottom: 1px solid rgba(11, 13, 11, 0.12) !important;
}

.md-reader__markdown-content h3 {
  font-family: -apple-system, 'Segoe UI', system-ui, sans-serif !important;
  font-weight: 600 !important;
  font-size: 1.15em !important;
}

.md-reader__markdown-content p,
.md-reader__markdown-content li {
  font-family: -apple-system, 'Segoe UI', system-ui, sans-serif !important;
  font-size: 1.05em !important;
  line-height: 1.6 !important;
  color: #52534e !important;
}

.md-reader__markdown-content a,
.md-reader__markdown-content a:link,
.md-reader__markdown-content a:visited {
  color: #0b0d0b !important;
  text-decoration: underline !important;
  text-decoration-color: rgba(11, 13, 11, 0.18) !important;
  text-underline-offset: 2px !important;
}

.md-reader__markdown-content blockquote {
  margin: 1.2em 0 !important;
  border: 1px solid rgba(135, 139, 134, 0.22) !important;
  border-left: 4px solid #f7591f !important;
  border-radius: 8px !important;
  background: #fcfbf7 !important;
  color: #52534e !important;
  font-style: italic !important;
  padding: 0.8em 1em !important;
}

.md-reader__markdown-content blockquote > :first-child {
  margin-top: 0 !important;
}

.md-reader__markdown-content blockquote > :last-child {
  margin-bottom: 0 !important;
}

.md-reader__markdown-content blockquote.info,
.md-reader__markdown-content blockquote.note,
.md-reader__markdown-content blockquote.tip,
.md-reader__markdown-content blockquote.tips,
.md-reader__markdown-content blockquote.success,
.md-reader__markdown-content blockquote.warning,
.md-reader__markdown-content blockquote.danger {
  border-radius: 8px !important;
  font-style: normal !important;
}

.md-reader__markdown-content blockquote.info,
.md-reader__markdown-content blockquote.note,
.md-reader__markdown-content blockquote.tip,
.md-reader__markdown-content blockquote.tips {
  background: #fff7f0 !important;
  border-left-color: #f7591f !important;
}

.md-reader__markdown-content blockquote.success {
  background: #f3f8ef !important;
  border-left-color: #6c8d5f !important;
}

.md-reader__markdown-content blockquote.warning {
  background: #fff9e9 !important;
  border-left-color: #bd8827 !important;
}

.md-reader__markdown-content blockquote.danger {
  background: #fff0eb !important;
  border-left-color: #bd5a49 !important;
}

.md-reader__markdown-content blockquote.info::before,
.md-reader__markdown-content blockquote.note::before,
.md-reader__markdown-content blockquote.tip::before,
.md-reader__markdown-content blockquote.tips::before,
.md-reader__markdown-content blockquote.success::before,
.md-reader__markdown-content blockquote.warning::before,
.md-reader__markdown-content blockquote.danger::before {
  content: none !important;
  display: none !important;
}

.md-reader__markdown-content details {
  margin: 1.2em 0 !important;
  border: 1px solid rgba(135, 139, 134, 0.22) !important;
  border-radius: 8px !important;
  background: #fcfbf7 !important;
  padding: 0.8em 1em !important;
}

.md-reader__markdown-content details[open] summary {
  margin-bottom: 0.8em !important;
  padding-bottom: 0.7em !important;
  border-bottom: 1px solid rgba(135, 139, 134, 0.22) !important;
}

.md-reader__markdown-content table {
  display: table !important;
  width: 100% !important;
  max-width: 100% !important;
  border: 1px solid rgba(135, 139, 134, 0.22) !important;
  border-radius: 8px !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
  color: #52534e !important;
  font-family: -apple-system, 'Segoe UI', system-ui, sans-serif !important;
  font-size: 0.94em !important;
}

@media (max-width: 700px) {
  .md-reader__markdown-content table {
    display: block !important;
    overflow-x: auto !important;
  }

  .md-reader__markdown-content table > thead,
  .md-reader__markdown-content table > tbody {
    display: table !important;
    min-width: 560px !important;
    width: 100% !important;
  }
}

.md-reader__markdown-content th,
.md-reader__markdown-content td {
  border: 0 !important;
  border-bottom: 1px solid rgba(135, 139, 134, 0.16) !important;
  padding: 0.75em 0.9em !important;
  vertical-align: middle !important;
}

.md-reader__markdown-content th {
  background: #f1f0e9 !important;
  color: #6f706b !important;
  font-size: 0.78em !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: uppercase !important;
}

.md-reader__markdown-content th:not(:first-child),
.md-reader__markdown-content td:not(:first-child) {
  text-align: center !important;
}

.md-reader__markdown-content tbody tr:nth-child(even) td {
  background: #faf9f4 !important;
}

.md-reader__markdown-content tbody tr:last-child td {
  border-bottom: 0 !important;
}

.md-reader__markdown-content pre.md-reader__code-block {
  background: rgba(255, 255, 255, 0.72) !important;
  border: 1px solid rgba(135, 139, 134, 0.18) !important;
  border-radius: 12px !important;
  padding: 20px 22px 21px !important;
  box-shadow: none !important;
}

.md-reader__markdown-content pre.md-reader__code-block code.hljs,
.md-reader__markdown-content pre.md-reader__code-block code.hljs * {
  background: transparent !important;
  color: #0b0d0b !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', monospace !important;
  font-size: 0.95em !important;
}

.md-reader__markdown-content .md-reader__btn--copy {
  background: rgba(17, 17, 17, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 999px !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

.md-reader__markdown-content code:not(pre code) {
  background: rgba(11, 13, 11, 0.06) !important;
  color: #0b0d0b !important;
  border-radius: 4px !important;
  padding: 0.1em 0.35em !important;
}
`

const DEVELOPER_CSS = `/*
 * 「Developer」開發者風格範例
 * 參考網站：https://freightapis.dev/pricing
 * （暖白底、粗黑無襯線標題、圓潤資訊框與表格、深色終端機程式碼區塊、赤陶橘強調色）
 *
 * 字體說明：範例網站用的是 Inter（標題/內文）與 JetBrains Mono（程式碼），
 * 都需要連網下載。本擴充功能預設離線、零連線是核心賣點，這裡改用本機
 * 就有的字體堆疊做最接近的近似，不使用 @import 抓外部字型。
 */

body.md-reader {
  background: #faf9f5 !important;
}

.md-reader__markdown-content {
  color: #3d3d3a !important;
}

.md-reader__markdown-content h1,
.md-reader__markdown-content h2,
.md-reader__markdown-content h3 {
  font-family: -apple-system, 'Segoe UI', system-ui, sans-serif !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  color: #141413 !important;
}

.md-reader__markdown-content h1 {
  font-size: 2.5em !important;
  line-height: 1.12 !important;
  margin-bottom: 0.45em !important;
}

.md-reader__markdown-content h2 {
  font-size: 1.6em !important;
  line-height: 1.25 !important;
  margin-top: 2em !important;
  padding-bottom: 0.45em !important;
  border-bottom: 1px solid #e4ddd2 !important;
}

.md-reader__markdown-content h3 {
  font-size: 1.15em !important;
  line-height: 1.35 !important;
  margin-top: 1.6em !important;
}

.md-reader__markdown-content p,
.md-reader__markdown-content li {
  font-family: -apple-system, 'Segoe UI', system-ui, sans-serif !important;
  font-size: 1.05em !important;
  line-height: 1.6 !important;
  color: #3d3d3a !important;
}

.md-reader__markdown-content a,
.md-reader__markdown-content a:link,
.md-reader__markdown-content a:visited {
  color: #cc785c !important;
  text-decoration: underline !important;
  text-underline-offset: 2px !important;
}

.md-reader__markdown-content blockquote {
  margin: 1.2em 0 !important;
  border: 1px solid #e4ddd2 !important;
  border-left: 4px solid #cc785c !important;
  border-radius: 8px !important;
  background: #f4eee5 !important;
  color: #3d3d3a !important;
  font-style: normal !important;
  padding: 0.8em 1em !important;
}

.md-reader__markdown-content blockquote > :first-child {
  margin-top: 0 !important;
}

.md-reader__markdown-content blockquote > :last-child {
  margin-bottom: 0 !important;
}

.md-reader__markdown-content blockquote.info,
.md-reader__markdown-content blockquote.note,
.md-reader__markdown-content blockquote.tip,
.md-reader__markdown-content blockquote.tips,
.md-reader__markdown-content blockquote.success,
.md-reader__markdown-content blockquote.warning,
.md-reader__markdown-content blockquote.danger {
  border-radius: 8px !important;
}

.md-reader__markdown-content blockquote.info,
.md-reader__markdown-content blockquote.note,
.md-reader__markdown-content blockquote.tip,
.md-reader__markdown-content blockquote.tips {
  background: #f8f1ea !important;
  border-left-color: #cc785c !important;
}

.md-reader__markdown-content blockquote.success {
  background: #eef5eb !important;
  border-left-color: #638a54 !important;
}

.md-reader__markdown-content blockquote.warning {
  background: #fbf3df !important;
  border-left-color: #c48a25 !important;
}

.md-reader__markdown-content blockquote.danger {
  background: #faeae5 !important;
  border-left-color: #bd5a49 !important;
}

.md-reader__markdown-content blockquote.info::before,
.md-reader__markdown-content blockquote.note::before,
.md-reader__markdown-content blockquote.tip::before,
.md-reader__markdown-content blockquote.tips::before,
.md-reader__markdown-content blockquote.success::before,
.md-reader__markdown-content blockquote.warning::before,
.md-reader__markdown-content blockquote.danger::before {
  content: none !important;
  display: none !important;
}

.md-reader__markdown-content details {
  margin: 1.2em 0 !important;
  border: 1px solid #e4ddd2 !important;
  border-radius: 8px !important;
  background: #fdfcf9 !important;
  padding: 0.8em 1em !important;
}

.md-reader__markdown-content details[open] summary {
  margin-bottom: 0.8em !important;
  padding-bottom: 0.7em !important;
  border-bottom: 1px solid #e4ddd2 !important;
}

.md-reader__markdown-content table {
  display: table !important;
  width: 100% !important;
  max-width: 100% !important;
  border: 1px solid #e4ddd2 !important;
  border-radius: 8px !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
  color: #3d3d3a !important;
  font-size: 0.94em !important;
}

@media (max-width: 700px) {
  .md-reader__markdown-content table {
    display: block !important;
    overflow-x: auto !important;
  }

  .md-reader__markdown-content table > thead,
  .md-reader__markdown-content table > tbody {
    display: table !important;
    min-width: 560px !important;
    width: 100% !important;
  }
}

.md-reader__markdown-content th,
.md-reader__markdown-content td {
  border: 0 !important;
  border-bottom: 1px solid #eae3d8 !important;
  padding: 0.75em 0.9em !important;
  vertical-align: middle !important;
}

.md-reader__markdown-content th {
  background: #f1eadf !important;
  color: #6d6a64 !important;
  font-size: 0.78em !important;
  font-weight: 700 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
}

.md-reader__markdown-content th:not(:first-child),
.md-reader__markdown-content td:not(:first-child) {
  text-align: center !important;
}

.md-reader__markdown-content tbody tr:nth-child(even) td {
  background: #f7f2e9 !important;
}

.md-reader__markdown-content tbody tr:last-child td {
  border-bottom: 0 !important;
}

.md-reader__markdown-content pre.md-reader__code-block {
  position: relative !important;
  background: #181715 !important;
  border: none !important;
  border-radius: 10px !important;
  padding: 2.4em 22px 21px !important;
  box-shadow: none !important;
}

.md-reader__markdown-content pre.md-reader__code-block::before {
  content: '' !important;
  position: absolute !important;
  top: 14px !important;
  left: 18px !important;
  width: 10px !important;
  height: 10px !important;
  border-radius: 50% !important;
  background: #ff5f56 !important;
  box-shadow:
    18px 0 0 #ffbd2e,
    36px 0 0 #27c93f !important;
}

.md-reader__markdown-content pre.md-reader__code-block code.hljs,
.md-reader__markdown-content pre.md-reader__code-block code.hljs * {
  background: transparent !important;
  color: #faf9f5 !important;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, 'Liberation Mono', monospace !important;
  font-size: 0.95em !important;
}

.md-reader__markdown-content .md-reader__btn--copy {
  background: rgba(250, 249, 245, 0.12) !important;
  border: 1px solid rgba(250, 249, 245, 0.2) !important;
  border-radius: 8px !important;
  color: rgba(250, 249, 245, 0.8) !important;
}

.md-reader__markdown-content code:not(pre code) {
  background: rgba(20, 20, 19, 0.06) !important;
  color: #141413 !important;
  border-radius: 6px !important;
  padding: 0.1em 0.35em !important;
}
`

export const CUSTOM_CSS_PRESETS = [
  { id: 'editorial', css: EDITORIAL_CSS },
  { id: 'developer', css: DEVELOPER_CSS },
] as const

export type CustomCssPresetId = typeof CUSTOM_CSS_PRESETS[number]['id']
export type CustomCssChoice = CustomCssPresetId | 'user1' | 'user2'
