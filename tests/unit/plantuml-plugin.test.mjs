import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import encoder from 'plantuml-encoder'

const loadPlantuml = () => import('#core/plantuml')

// Mirrors src/plugins/plantuml.ts's fence-rule override (that file itself
// pulls in the `@/` alias, which plain `node --test` cannot resolve without
// a bundler — same constraint tests/graphviz.test.mjs works around).
function installPlantumlFence(md, opts) {
  const fallbackFence = md.renderer.rules.fence?.bind(md.renderer.rules)

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info.trim().toLowerCase()
    const code = token.content.trim()

    if (info === 'plantuml') {
      if (opts?.allowed) {
        const encoded = encoder.encode(code)
        return `<img class="md-reader__plantuml" src="${opts.buildUrl(
          opts.server ?? '',
          encoded,
        )}" alt="PlantUML diagram" loading="lazy">`
      }
      return `<div class="md-reader__plantuml-disabled">PlantUML disabled</div><pre>${escapeHtml(
        code,
      )}</pre>`
    }

    return fallbackFence
      ? fallbackFence(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)
  }
}

function escapeHtml(content) {
  return String(content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

test('allowed: renders an <img> pointing at the encoded server URL', async () => {
  const { buildPlantumlImageUrl } = await loadPlantuml()
  const md = new MarkdownIt()
  installPlantumlFence(md, {
    allowed: true,
    server: 'https://plantuml.example.com',
    buildUrl: buildPlantumlImageUrl,
  })

  const code = '@startuml\nAlice -> Bob\n@enduml'
  const html = md.render('```plantuml\n' + code + '\n```')

  assert.match(html, /<img class="md-reader__plantuml"/)
  assert.match(html, /loading="lazy"/)
  const expected = buildPlantumlImageUrl(
    'https://plantuml.example.com',
    encoder.encode(code),
  )
  assert.ok(html.includes(`src="${expected}"`))
  assert.doesNotMatch(html, /md-reader__plantuml-disabled/)
})

test('disallowed: renders the disabled placeholder with no remote src', async () => {
  const md = new MarkdownIt()
  installPlantumlFence(md, { allowed: false })

  const code = '@startuml\nAlice -> Bob\n@enduml'
  const html = md.render('```plantuml\n' + code + '\n```')

  assert.match(html, /md-reader__plantuml-disabled/)
  assert.doesNotMatch(html, /<img/)
  assert.doesNotMatch(html, /https?:\/\//)
  assert.match(html, /Alice -&gt; Bob/)
})

test('disallowed by default when opts are omitted', async () => {
  const md = new MarkdownIt()
  installPlantumlFence(md, undefined)

  const html = md.render('```plantuml\n@startuml\nA -> B\n@enduml\n```')

  assert.match(html, /md-reader__plantuml-disabled/)
  assert.doesNotMatch(html, /<img/)
})

test('non-plantuml fences fall through untouched', async () => {
  const md = new MarkdownIt()
  installPlantumlFence(md, { allowed: true })

  const html = md.render('```js\nconst a = 1\n```')

  assert.doesNotMatch(html, /md-reader__plantuml/)
  assert.match(html, /const a = 1/)
})

test('placeholder escapes HTML-special characters in the source', async () => {
  const md = new MarkdownIt()
  installPlantumlFence(md, { allowed: false })

  const html = md.render('```plantuml\n<script>a && b</script>\n```')

  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /a &amp;&amp; b/)
})
