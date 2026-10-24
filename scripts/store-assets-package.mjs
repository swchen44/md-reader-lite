// Assemble screenshot artwork and permission copy. Promo video fields stay empty.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'docs/store-assets/v1.9.0')
const copy = JSON.parse(
  await readFile(path.join(root, 'docs/store-assets/source/copy.json')),
)
const receiptPath = path.join(dir, 'receipt.json')
const receipt = JSON.parse(await readFile(receiptPath))
const shots = ['reading', 'diagrams', 'navigation', 'search', 'settings']
const permission =
  'Creates a bundled offscreen document to parse and sanitize Mermaid SVG when a page’s CSP sandbox blocks the embedded renderer. All renderer code is packaged with the extension. Diagram source is processed locally, is not sent to a server or persisted, and the document closes after idle.'
const permissionZh =
  '網站的 CSP sandbox 阻止嵌入式 renderer 執行時，以插件內建的隱藏文件在本機解析、清理並繪製 Mermaid SVG。所有繪圖程式均隨插件封裝，不外送或儲存圖表原碼，工作閒置後關閉隱藏文件。'
const escape = value =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const plain = value => value.replaceAll('<br>', ' ').replaceAll(/<[^>]+>/g, '')
await writeFile(
  path.join(dir, 'offscreen-permission-en.txt'),
  permission + '\n',
)
await writeFile(
  path.join(dir, 'offscreen-permission-zh-TW.txt'),
  permissionZh + '\n',
)
delete receipt.videos
delete receipt.acceptance
receipt.promoVideoFields = {
  localized: 'leave empty',
  global: 'leave empty',
  reason: 'User requested screenshots only.',
}
for (const item of receipt.files) {
  const bytes = await readFile(path.join(root, item.path))
  item.bytes = bytes.length
  item.sha256 = createHash('sha256').update(bytes).digest('hex')
  assert.equal(bytes.readUInt32BE(16), 1280)
  assert.equal(bytes.readUInt32BE(20), 800)
  assert.equal(bytes[24], 8)
  assert.equal(bytes[25], 2)
}
receipt.youtubeUpload = 'not performed; video fields intentionally empty'
receipt.storeUpload = 'not performed'
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
const groups = [
  ['zh-TW', '繁體中文：在地化資產'],
  ['common', 'English：通用資產'],
]
  .map(([folder, label]) => {
    const lang = folder === 'common' ? 'en' : 'zh-TW'
    const images = shots
      .map(
        shot =>
          `<a class="shot" href="${folder}/${
            copy[lang][shot].file
          }" download><img src="${folder}/${
            copy[lang][shot].file
          }" alt="${escape(
            plain(copy[lang][shot].title),
          )}" loading="lazy"><span>${
            copy[lang][shot].file
          } · 1280 × 800 · RGB PNG</span></a>`,
      )
      .join('\n')
    return `<section id="${folder}"><h2>${label}</h2><p>依序上傳下方 5 張 PNG。點圖片可取得原始檔。宣傳影片欄位留空。</p><div class="grid">${images}</div></section>`
  })
  .join('\n')
await writeFile(
  path.join(dir, 'index.html'),
  `<!doctype html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MD Reader Lite · 商店圖片</title><style>*{box-sizing:border-box}body{margin:0;background:#faf9f5;color:#141413;font:17px/1.7 'Helvetica Neue','PingFang TC',sans-serif}main{max-width:1280px;margin:auto;padding:44px 28px}h1,h2{font-family:Georgia,'Songti TC',serif;font-weight:400}h1{font-size:48px;line-height:1.2;margin:10px 0 20px}h2{font-size:32px;margin-top:64px}nav{display:flex;flex-wrap:wrap;gap:24px}a{color:#a94f34;text-underline-offset:4px}a:focus-visible{outline:2px solid #a94f34;outline-offset:5px}pre{white-space:pre-wrap;background:#eeeae0;padding:22px;border-radius:10px;font:15px/1.7 ui-monospace,monospace}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.shot{text-decoration:none;min-width:0}.shot img{display:block;width:100%;border:1px solid #dedbd2}.shot span{font-size:14px;display:block;margin-top:8px}footer{border-top:1px solid #dedbd2;margin-top:48px;padding-top:20px;color:#68665e}@media(max-width:720px){main{padding:24px 16px}h1{font-size:36px}.grid{grid-template-columns:1fr}}</style></head><body><main><p>MD Reader Lite · 1.9.0</p><h1>讓 Markdown，回到閱讀。</h1><p>以現有產品的 Anthropic 編輯風格，呈現五個值得安裝的理由。每張圖都含 1.9.0 插件的真實畫面。</p><nav><a href="#zh-TW">繁中在地化</a><a href="#common">英文通用</a><a href="#permission">offscreen 權限理由</a><a href="receipt.json">規格與驗證紀錄</a></nav>${groups}<section id="permission"><h2>offscreen 權限理由</h2><p>後台可直接貼上英文；中文供確認用途。</p><pre>${escape(
    permission,
  )}</pre><p>${permissionZh}</p><p><a href="offscreen-permission-en.txt" download>下載英文純文字</a></p></section><footer>圖片均為 1280 × 800、24 位元 RGB PNG，無 alpha。依本次需求，兩個宣傳影片欄位都留空。Google 商店尚未上傳。</footer></main></body></html>\n`,
)
console.log(
  'Created image gallery, permission copy and screenshot checksums. Promo video fields stay empty.',
)
