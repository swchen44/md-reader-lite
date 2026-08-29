import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'

const md = async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  return new MarkdownIt({ html: true }).use(ObsidianPlugin)
}

test('renders image embeds with spaces and width', async () => {
  const m = await md()
  const html = m.render('![[Pasted image 20260829.png]]')
  assert.match(html, /<img src="Pasted%20image%2020260829\.png"/)
  const sized = m.render('![[chart.PNG|300]]')
  assert.match(sized, /<img src="chart\.PNG" width="300"/)
})

test('renders wikilinks, appending .md when extension missing', async () => {
  const m = await md()
  assert.match(
    m.render('[[Meeting Notes]]'),
    /<a href="Meeting%20Notes\.md">Meeting Notes<\/a>/,
  )
  assert.match(
    m.render('[[guide.md|安裝指南]]'),
    /<a href="guide\.md">安裝指南<\/a>/,
  )
})

test('note embeds degrade to links', async () => {
  const m = await md()
  assert.match(
    m.render('![[Other Note]]'),
    /<a href="Other%20Note\.md"[^>]*>Other Note<\/a>/,
  )
})

test('strips %% comments %%', async () => {
  const m = await md()
  const html = m.render('before %%hidden\nlines%% after')
  assert.ok(!html.includes('hidden'))
  assert.match(html, /before\s+after/)
})

test('escapes html in wikilink text', async () => {
  const m = await md()
  const html = m.render('[[a<b]]')
  assert.ok(!html.includes('<b]]'))
  assert.match(html, /a&lt;b/)
})

test('normalizes obsidian callouts to alert-compatible form', async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  // 未知型別 → NOTE；摺疊記號去除；自訂標題移到粗體行
  const html = m.render('> [!hint]- My Title\n> body')
  assert.match(html, /\[!TIP\]|markdown-alert|blockquote/i)
  assert.match(html, /<strong>My Title<\/strong>/)
})

test('renders front matter as collapsed details table', async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('---\ntitle: Hello\ntags: a, b\n---\n\n# Doc')
  assert.match(html, /<details class="md-reader__frontmatter">/)
  assert.match(html, /<td>title<\/td>\s*<td>Hello<\/td>/)
  assert.match(html, /<h1[^>]*>Doc<\/h1>/)
})

test('front matter requires document start', async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('# Doc\n\n---\nnot: frontmatter\n---')
  assert.ok(!html.includes('md-reader__frontmatter'))
})
