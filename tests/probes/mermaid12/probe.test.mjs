import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import MarkdownIt from 'markdown-it'
import evidence from './evidence.cjs'

const root = new URL('../../../', import.meta.url)
const artifacts = new URL('dist/probes/mermaid12/', root)
const extension = fileURLToPath(new URL('extension/', artifacts))
const fixtures = []
const markdown = await readFile(
  new URL('example/mermaid-compatibility.md', root),
  'utf8',
)
const tokens = new MarkdownIt().parse(markdown, {})
let name
for (let i = 0; i < tokens.length; i++) {
  if (tokens[i].type === 'heading_open' && tokens[i].tag === 'h2')
    name = tokens[i + 1].content.replace(/^\d+\. /, '')
  if (tokens[i].type === 'fence' && tokens[i].info.trim() === 'mermaid')
    fixtures.push({ name, source: tokens[i].content })
}
const core = fixtures.filter(item => item.name !== 'ZenUML')
const sentinel = {
  name: 'Recovery sentinel',
  source: 'flowchart LR\n A[Still readable] --> B[Recovered]',
}
const report = {
  started: new Date().toISOString(),
  node: process.version,
  mermaid: '12.2.0',
  zenuml: '1.0.1',
  policy: process.env.MERMAID_PROBE_POLICY || 'raw',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim(),
  fixtureSha256: createHash('sha256').update(markdown).digest('hex'),
  testSha256: createHash('sha256')
    .update(await readFile(new URL(import.meta.url)))
    .digest('hex'),
  gates: [],
  runs: [],
}
const payloads = new Map()
let server, context, profile, base, extensionId

function html(payload) {
  return (
    '<!doctype html><meta charset="utf-8"><script type="application/json" id="md-reader-probe-input">' +
    JSON.stringify(payload).replace(/</g, '\\u003c') +
    '</script>'
  )
}

async function setup() {
  assert.equal(core.length, 30)
  assert.equal(fixtures.length, 31)
  for (const [name, version] of [
    ['mermaid', report.mermaid],
    ['@mermaid-js/mermaid-zenuml', report.zenuml],
  ]) {
    const metadata = JSON.parse(
      await readFile(
        new URL(`node_modules/${name}/package.json`, import.meta.url),
        'utf8',
      ),
    )
    assert.equal(metadata.version, version)
  }
  await mkdir(artifacts, { recursive: true })
  report.build = JSON.parse(
    await readFile(new URL('build.json', artifacts), 'utf8'),
  )
  evidence.verifyFingerprint(
    report.build,
    await evidence.fingerprint(extension),
  )
  server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    if (request.url.startsWith('/strict'))
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'",
      )
    const key = new URL(request.url, 'http://fixture').searchParams.get('case')
    const payload = payloads.get(key)
    response.end(payload ? html(payload) : 'Probe fixture not found')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  profile = await mkdtemp(join(tmpdir(), 'md-reader-mermaid12-'))
  context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1200, height: 900 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--no-first-run',
    ],
  })
  report.browser = context.browser().version()
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent('serviceworker', { timeout: 15000 }))
  extensionId = new URL(worker.url()).hostname
}

before(async () => {
  try {
    await setup()
    report.setupStatus = 'pass'
  } catch (error) {
    report.setupStatus = 'fail'
    report.setupError = error.message
    throw error
  }
})

after(async () => {
  await evidence.finishReport(
    report,
    [
      () => context?.close(),
      () => server && new Promise(resolve => server.close(resolve)),
      () => profile && rm(profile, { recursive: true, force: true }),
    ],
    async result => {
      await mkdir(artifacts, { recursive: true })
      await writeFile(
        new URL('results.json', artifacts),
        JSON.stringify(result, null, 2),
      )
    },
  )
  assert.deepEqual(report.cleanupErrors, [])
})

function gate(name, task) {
  report.gates.push({ name, status: 'pending' })
  test(name, () => evidence.runGate(report, name, task))
}

async function probe(
  label,
  cases,
  {
    zen = false,
    strict = false,
    file = false,
    config = {},
    transport = false,
    policy = report.policy,
  } = {},
) {
  const page = await context.newPage()
  const requests = []
  const allRequests = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    const url = new URL(request.url())
    allRequests.push({ url: request.url(), type: request.resourceType() })
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !(request.isNavigationRequest() && url.origin === base)
    )
      requests.push(request.url())
  })
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, route =>
    route.abort(),
  )
  const payload = { cases, zen, config, transport, policy }
  try {
    if (file) {
      const fixture = new URL('local.md', artifacts)
      await writeFile(fixture, JSON.stringify(payload))
      await page.goto(pathToFileURL(fileURLToPath(fixture)).href)
    } else {
      payloads.set(label, payload)
      await page.goto(
        `${base}/${strict ? 'strict' : 'probe'}.md?case=${encodeURIComponent(
          label,
        )}`,
      )
    }
    await page.waitForSelector('html[data-probe-done="1"]', { timeout: 90000 })
    const fatal = await page.getAttribute('html', 'data-probe-fatal')
    const diagrams = await page
      .locator('.probe-diagram')
      .evaluateAll(elements =>
        elements.map(element => {
          const svg = element.querySelector('.probe-output svg')
          const box = svg?.getBoundingClientRect()
          return {
            name: element.dataset.name,
            status: element.dataset.status,
            error: element.dataset.error,
            duration: Number(element.dataset.duration),
            width: box?.width || 0,
            height: box?.height || 0,
            labels: svg?.querySelectorAll('text, foreignObject').length || 0,
            errorDiagram: !!svg?.querySelector('.error-icon, .error-text'),
            source: element.querySelector('pre')?.textContent,
            securityLevel: element.dataset.securityLevel,
            syntax: element.dataset.syntax,
            violations: JSON.parse(element.dataset.violations || '[]'),
            frameResiduals: Number(element.dataset.frameResiduals || 0),
            nodeFills: svg
              ? [...svg.querySelectorAll('.node rect')].map(
                  node => getComputedStyle(node).fill,
                )
              : [],
          }
        }),
      )
    const residuals = await page.locator('body > :not(#probe-results)').count()
    const result = {
      label,
      fatal,
      diagrams,
      requests,
      allRequests,
      errors,
      residuals,
      transport: await page.getAttribute('html', 'data-probe-transport'),
      bodyColor: await page.evaluate(
        () => getComputedStyle(document.body).color,
      ),
    }
    report.runs.push(result)
    await page.screenshot({
      path: fileURLToPath(new URL(`${label}.png`, artifacts)),
      fullPage: false,
    })
    assert.equal(fatal, null)
    assert.deepEqual(errors, [])
    assert.equal(
      residuals,
      0,
      'Rendering left temporary DOM outside its result container',
    )
    return result
  } catch (error) {
    report.runs.push({
      label,
      error: error.message,
      requests,
      allRequests,
      errors,
    })
    throw error
  } finally {
    await page.close()
  }
}

function assertRenders(result, expected) {
  assert.equal(result.diagrams.length, expected)
  const failures = result.diagrams.filter(
    item =>
      item.status !== 'ready' ||
      item.width <= 0 ||
      item.height <= 0 ||
      item.errorDiagram ||
      !item.labels ||
      item.frameResiduals,
  )
  assert.deepEqual(failures, [], JSON.stringify(failures))
  assert.deepEqual(result.requests, [], 'Unexpected outbound attempts')
}

gate(
  'all 30 core types render in an isolated-world MV3 content script',
  async () => {
    assertRenders(await probe('core-30', core), 30)
  },
)

gate('local renderer frame can connect under strict host CSP', async () => {
  const result = await probe('frame-transport-csp', [], {
    strict: true,
    transport: true,
  })
  assert.equal(result.transport, 'ready')
  assert.deepEqual(result.requests, [])
})

gate('ZenUML renders in the unfiltered 31-type gallery', async () => {
  assertRenders(await probe('zen-gallery-31', fixtures, { zen: true }), 31)
})

gate('all 31 types render under strict host-page CSP', async () => {
  assertRenders(
    await probe('strict-csp-31', fixtures, { zen: true, strict: true }),
    31,
  )
})

gate('local file injection renders all 31 types', async () => {
  const settings = await context.newPage()
  try {
    await settings.goto(`chrome://extensions/?id=${extensionId}`)
    const toggle = settings.locator('#allow-on-file-urls cr-toggle')
    await toggle.waitFor()
    if ((await toggle.getAttribute('aria-pressed')) !== 'true')
      await toggle.click()
    await settings
      .locator('#allow-on-file-urls cr-toggle[aria-pressed="true"]')
      .waitFor()
  } finally {
    await settings.close()
  }
  assertRenders(
    await probe('local-file-31', fixtures, { zen: true, file: true }),
    31,
  )
})

gate(
  'malformed input preserves source and later diagrams recover',
  async () => {
    const result = await probe('recovery', [
      { name: 'Broken', source: 'flowchart TD\n A[unterminated' },
      { name: 'Unknown', source: 'unknownDiagram\n text' },
      sentinel,
    ])
    assert.equal(result.diagrams[0].status, 'error')
    assert.match(result.diagrams[0].source, /unterminated/)
    assert.equal(result.diagrams[1].status, 'error')
    assertRenders({ ...result, diagrams: result.diagrams.slice(2) }, 1)
  },
)

for (const stage of ['stylesheet', 'serialization']) {
  gate(`cleanup and recovery after ${stage} failure`, async () => {
    const result = await probe(`failure-${stage}`, [
      {
        name: 'Injected failure',
        source:
          'flowchart LR\n A --> B\n classDef colored fill:red\n class A colored',
        failAt: stage,
      },
      sentinel,
    ])
    assert.equal(result.diagrams[0].syntax, 'valid')
    assert.equal(result.diagrams[0].status, 'error')
    assert.match(
      result.diagrams[0].error,
      new RegExp(`injected ${stage} failure`),
    )
    assert.match(result.diagrams[0].source, /flowchart/)
    assertRenders({ ...result, diagrams: result.diagrams.slice(1) }, 1)
  })
}

const negatives = [
  {
    name: 'html-image',
    source:
      'flowchart LR\n A["<img src=\'https://mermaid-probe.invalid/html.png\' />"] --> B[Safe]',
  },
  {
    name: 'image-node',
    source:
      'flowchart LR\n A@{ img: "https://mermaid-probe.invalid/node.png", label: "Remote image", h: 60 } --> B[Safe]',
  },
  {
    name: 'theme-css',
    source:
      '%%{init: {"themeCSS":"@import url(https://mermaid-probe.invalid/import.css); .node { fill: url(https://mermaid-probe.invalid/fill.svg); }"}}%%\nflowchart LR\n A --> B',
  },
  {
    name: 'security-directive',
    source:
      '%%{init: {"securityLevel":"loose","secure":[],"themeCSS":"@import url(https://mermaid-probe.invalid/directive.css);"}}%%\nflowchart LR\n A["<img src=\'https://mermaid-probe.invalid/directive.png\' />"] --> B[Safe]',
  },
]
for (const item of negatives) {
  gate(`strict rendering makes no remote attempt: ${item.name}`, async () => {
    if (report.policy === 'confined') {
      const raw = await probe(`counterexample-${item.name}`, [item, sentinel], {
        policy: 'raw',
      })
      assert.equal(raw.diagrams[0].syntax, 'valid')
      assert.ok(
        raw.requests.length > 0,
        'Raw counterexample must still expose the resource attempt',
      )
      assert.equal(raw.diagrams[1].status, 'ready')
    }
    const result = await probe(`privacy-${item.name}`, [item, sentinel])
    assert.ok(
      result.diagrams.every(diagram => diagram.securityLevel === 'strict'),
    )
    assert.deepEqual(
      result.requests,
      [],
      `Remote attempt before/after SVG insertion: ${JSON.stringify(
        result.requests,
      )}`,
    )
    if (report.policy === 'confined') {
      assert.equal(result.diagrams[0].status, 'blocked')
      assert.match(result.diagrams[0].error, /^Blocked resource policy:/)
      assert.equal(result.diagrams[0].source, item.source)
      assert.deepEqual(
        result.diagrams[0].violations,
        [],
        'Known resource input must be rejected before CSP is needed',
      )
    } else {
      assert.equal(result.diagrams[0].syntax, 'valid')
      assert.equal(result.diagrams[0].status, 'ready')
    }
    assertRenders({ ...result, diagrams: result.diagrams.slice(1) }, 1)
  })
}

if (report.policy === 'confined') {
  const graph = 'flowchart LR\n A --> B'
  const themed = css =>
    '%%{init: ' + JSON.stringify({ themeCSS: css }) + '}%%\n' + graph
  gate('returned SVG styles cannot select the host body', async () => {
    const result = await probe('host-style-isolation', [
      {
        name: 'Scoped selectors',
        source: themed('body:has(&){color:rgb(251,1,2)!important}'),
      },
      sentinel,
    ])
    assertRenders(result, 2)
    assert.notEqual(result.bodyColor, 'rgb(251, 1, 2)')
    assert.deepEqual(result.requests, [])
  })
  gate('safe authored class styles survive the resource policy', async () => {
    const result = await probe('authored-class-style', [
      {
        name: 'Authored class',
        source:
          graph +
          '\n classDef authored fill:#123456,stroke:#654321\n class A authored',
      },
      sentinel,
    ])
    assertRenders(result, 2)
    assert.ok(result.diagrams[0].nodeFills.includes('rgb(18, 52, 86)'))
    assert.deepEqual(result.requests, [])
  })
  const attacks = [
    {
      name: 'entity-image',
      source:
        'flowchart LR\n A["&lt;img src=\'https://mermaid-probe.invalid/entity.png\'&gt;"] --> B',
    },
    {
      name: 'mermaid-entity-image',
      source:
        'flowchart LR\n A["#60;img src=#quot;https://mermaid-probe.invalid/entity.png#quot;#62;"] --> B',
    },
    {
      name: 'relative-image',
      source:
        'flowchart LR\n A@{img: "private.png",label: "Private",h:60} --> B',
    },
    {
      name: 'svg-image',
      source:
        'flowchart LR\n A["<svg><image href=\'https://mermaid-probe.invalid/nested.svg\'/></svg>"] --> B',
    },
    {
      name: 'svg-use',
      source:
        'flowchart LR\n A["<svg><use href=\'https://mermaid-probe.invalid/nested.svg#x\'/></svg>"] --> B',
    },
    {
      name: 'inline-css',
      source:
        'flowchart LR\n A["<span style=\'background-image:url(https://mermaid-probe.invalid/inline.png)\'>Private</span>"] --> B',
    },
    {
      name: 'escaped-css',
      source: themed(
        '.node{fill:u\\72l(https://mermaid-probe.invalid/escaped.svg)}',
      ),
    },
    {
      name: 'image-set',
      source: themed(
        '.node{background:image-set("https://mermaid-probe.invalid/set.png" 1x)}',
      ),
    },
    {
      name: 'variable-url',
      source: themed(
        '.node{--remote:url(https://mermaid-probe.invalid/variable.svg);fill:var(--remote)}',
      ),
    },
    {
      name: 'yaml-relative-css',
      source:
        '---\nconfig:\n  themeCSS: |\n    .node {fill:url(../private.svg)}\n---\n' +
        graph,
    },
    {
      name: 'yaml-font',
      source:
        '---\nconfig:\n  themeCSS: |\n    @font-face{font-family:remote;src:url(https://mermaid-probe.invalid/font.woff2)}\n---\n' +
        graph,
    },
  ]
  for (const attack of attacks) {
    gate(
      `preflight blocks encoded or structured resources: ${attack.name}`,
      async () => {
        const raw = await probe(`syntax-${attack.name}`, [attack, sentinel], {
          policy: 'raw',
        })
        assert.equal(
          raw.diagrams[0].syntax,
          'valid',
          'Fixture must be valid Mermaid before policy rejection',
        )
        const result = await probe(`guarded-${attack.name}`, [attack, sentinel])
        assert.deepEqual(result.requests, [])
        assert.equal(result.diagrams[0].status, 'blocked')
        assert.match(result.diagrams[0].error, /^Blocked resource policy:/)
        assert.equal(result.diagrams[0].source, attack.source)
        assert.deepEqual(result.diagrams[0].violations, [])
        assertRenders({ ...result, diagrams: result.diagrams.slice(1) }, 1)
      },
    )
  }
}
