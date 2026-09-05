const EDITORIAL_CSS = `/*
 * 「Little Might」編輯風格範例
 * 參考網站：https://littlemight.com/fable-prompts-for-people-who-dont-code/
 * （米色背景、大型 serif 標題、灰階內文、卡片式程式碼區塊、橘色強調色）
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
  border-left: 3px solid #f7591f !important;
  background: rgba(255, 255, 255, 0.5) !important;
  color: #52534e !important;
  font-style: italic !important;
  padding: 0.6em 1.2em !important;
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
 * 參考網站：https://freightapis.dev/
 * （米色背景、粗黑無襯線大標題、深色終端機風程式碼區塊、赤陶橘強調色）
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
  letter-spacing: -0.02em !important;
  color: #141413 !important;
}

.md-reader__markdown-content h1 {
  font-size: 2.6em !important;
  line-height: 1.1 !important;
}

.md-reader__markdown-content h2 {
  font-size: 1.6em !important;
}

.md-reader__markdown-content h3 {
  font-size: 1.15em !important;
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
  border-left: 3px solid #cc785c !important;
  background: rgba(20, 20, 19, 0.03) !important;
  color: #3d3d3a !important;
  font-style: italic !important;
  padding: 0.6em 1.2em !important;
}

.md-reader__markdown-content pre.md-reader__code-block {
  position: relative !important;
  background: #181715 !important;
  border: none !important;
  border-radius: 8px !important;
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
  border-radius: 6px !important;
  color: rgba(250, 249, 245, 0.8) !important;
}

.md-reader__markdown-content code:not(pre code) {
  background: rgba(20, 20, 19, 0.06) !important;
  color: #141413 !important;
  border-radius: 4px !important;
  padding: 0.1em 0.35em !important;
}
`

export const CUSTOM_CSS_PRESETS = [
  { id: 'editorial', css: EDITORIAL_CSS },
  { id: 'developer', css: DEVELOPER_CSS },
] as const

export type CustomCssPresetId = typeof CUSTOM_CSS_PRESETS[number]['id']
