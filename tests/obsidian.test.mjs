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
