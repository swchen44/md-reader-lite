import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'

const md = async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
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

test('comments inside mermaid fences are preserved', async () => {
  const m = await md()
  const src =
    '```mermaid\ngraph TD\n%% first comment\nA --> B\n%% second comment\n```\n'
  const html = m.render(src)
  assert.ok(html.includes('A --&gt; B') || html.includes('A --> B'))
  assert.ok(html.includes('first comment'))
})

test('comments inside inline code are preserved', async () => {
  const m = await md()
  const html = m.render('Use `a %% b` and `c %% d` here.')
  assert.ok(html.includes('a %% b'))
  assert.ok(html.includes('c %% d'))
})

test('multi-line comments outside fences are stripped', async () => {
  const m = await md()
  const html = m.render('before\n\n%%\nhidden line\n%%\n\nafter')
  assert.ok(!html.includes('hidden line'))
  assert.ok(html.includes('before') && html.includes('after'))
})

test('escapes html in wikilink text', async () => {
  const m = await md()
  const html = m.render('[[a<b]]')
  assert.ok(!html.includes('<b]]'))
  assert.match(html, /a&lt;b/)
})

test('normalizes obsidian callouts to alert-compatible form', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  // 未知型別 → NOTE；摺疊記號去除；自訂標題移到粗體行
  const html = m.render('> [!hint]- My Title\n> body')
  assert.match(html, /\[!TIP\]|markdown-alert|blockquote/i)
  assert.match(html, /<strong>My Title<\/strong>/)
})

test('renders front matter as collapsed details table', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('---\ntitle: Hello\ntags: a, b\n---\n\n# Doc')
  assert.match(html, /<details class="md-reader__frontmatter">/)
  assert.match(html, /<td>title<\/td>\s*<td>Hello<\/td>/)
  assert.match(html, /<h1[^>]*>Doc<\/h1>/)
})

test('front matter requires document start', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('# Doc\n\n---\nnot: frontmatter\n---')
  assert.ok(!html.includes('md-reader__frontmatter'))
})

test('does not leak frontmatterHtml across renders when env is reused', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const env = {}
  const html1 = m.render('---\ntitle: Hello\n---\n\n# Doc', env)
  assert.match(html1, /md-reader__frontmatter/)
  const html2 = m.render('# Doc2', env)
  assert.ok(!html2.includes('md-reader__frontmatter'))
})

test('applying the plugin twice does not double-render front matter', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true })
    .use(ObsidianPlugin)
    .use(ObsidianPlugin)
  const html = m.render('---\ntitle: Hello\n---\n\n# Doc')
  assert.equal(html.split('md-reader__frontmatter').length, 2)
})

test('callout normalization does not touch fenced code blocks', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('```\n> [!note] Title\n```')
  assert.match(html, /<code>[\s\S]*\[!note\][\s\S]*<\/code>/)
  assert.ok(!html.includes('[!NOTE]'))
})

test('normalizes nested blockquote callouts', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('> > [!hint] Deep\n> > body')
  assert.match(html, /<strong>Deep<\/strong>/)
  assert.ok(!html.includes('[!hint]'))
})

test('same-line pseudo-fence does not desync fence tracking', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  // ```js``` is not a real fence opener (backtick info strings may not
  // contain a backtick); normalization must still apply afterwards.
  const html = m.render('```js```\n\n> [!note] After\n> body')
  assert.ok(!html.includes('[!note]'))
})

test('shorter marker nested inside a longer fence is not a closer', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('````\n```\n> [!note] Trapped\n````')
  assert.ok(html.includes('[!note] Trapped'))
})

test('fences hidden behind blockquote markers are tracked', async () => {
  const { default: ObsidianPlugin } = await import(
    '../../src/plugins/obsidian.ts'
  )
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('> ```\n> [!note] QuotedInFence\n> ```')
  assert.ok(html.includes('[!note] QuotedInFence'))
})
