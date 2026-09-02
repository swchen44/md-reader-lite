// Structural validation of src/manifest.json's match patterns — a
// regression guard for the 2026-09-03 incident where an invalid
// web_accessible_resources match pattern made the whole extension fail to
// load in Chrome, hanging every automated browser tool that tried to launch
// it (see docs/lesson_learn.md #11).
//
// IMPORTANT CAVEAT: this checks the documented Chrome match-pattern grammar
// (https://developer.chrome.com/docs/extensions/mv3/match_patterns/), which
// covers content_scripts. During the incident we confirmed
// web_accessible_resources enforces additional, undocumented restrictions
// beyond this grammar (a file://*/... pattern that is valid for
// content_scripts was still rejected there after removing the one cause we
// could pin down). A pattern passing this test is NOT proof Chrome will
// accept it in web_accessible_resources — only that it isn't grossly
// malformed. Before narrowing web_accessible_resources matches away from
// <all_urls> again, verify live by loading the built extension in Chrome
// (chrome://extensions → load unpacked), not just by this test passing.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(here, '..', '..', 'src', 'manifest.json')

function loadManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

// Chrome's documented match-pattern grammar:
//   <url-pattern> := '<all_urls>' | <scheme>://<host><path>
//   <scheme>      := '*' | 'http' | 'https' | 'file' | 'ftp' | 'urn'
//   <host>        := '*' | '*.' <chars except '/' and '*'>+ | <chars except '/' and '*'>+
//                    (host is OPTIONAL only for the file:// scheme)
//   <path>        := '/' <any chars>
export function isValidMatchPattern(pattern) {
  if (pattern === '<all_urls>') return true
  const m = /^(\*|https?|file|ftp|urn):\/\/([^/]*)(\/.*)$/.exec(pattern)
  if (!m) return false
  const [, scheme, host, path] = m
  if (scheme !== 'file' && host === '') return false // host required except for file://
  if (host !== '' && host !== '*') {
    // host must not contain '*' except a single leading '*.' wildcard
    if (host.includes('*') && !host.startsWith('*.')) return false
    if ((host.match(/\*/g) || []).length > 1) return false
  }
  if (!path.startsWith('/')) return false
  return true
}

test('isValidMatchPattern: accepts Chrome docs’ official valid examples', () => {
  for (const p of [
    '<all_urls>',
    'http://*/*',
    'http://*/foo*',
    'https://*.google.com/foo*bar',
    'http://example.org/foo/bar.html',
    'file:///foo*',
    'http://127.0.0.1/*',
    '*://mail.google.com/*',
  ]) {
    assert.ok(isValidMatchPattern(p), `expected valid: ${p}`)
  }
})

test('isValidMatchPattern: rejects Chrome docs’ official invalid examples', () => {
  for (const p of [
    'http://www.google.com', // no path
    'http://*foo/bar', // wildcard not at start of host
    'http://foo.*.bar/baz', // wildcard not at start, and mid-host
    'http:/bar', // missing a slash
    'foo://*', // unsupported scheme
  ]) {
    assert.ok(!isValidMatchPattern(p), `expected invalid: ${p}`)
  }
})

test('isValidMatchPattern: accepts our file:// content-script patterns', () => {
  // These are the exact shapes used in content_scripts.matches — confirmed
  // accepted by Chrome (the extension loads and these pages activate).
  for (const p of ['file://*/*.md', 'file://*/*.md?*', 'file:///*.md']) {
    assert.ok(isValidMatchPattern(p), `expected valid: ${p}`)
  }
})

test('manifest: every content_scripts match pattern is structurally valid', () => {
  const manifest = loadManifest()
  const matches = manifest.content_scripts[0].matches
  const bad = matches.filter(p => !isValidMatchPattern(p))
  assert.deepEqual(bad, [], `invalid content_scripts patterns: ${bad}`)
})

test('manifest: every web_accessible_resources match pattern is structurally valid', () => {
  const manifest = loadManifest()
  const bad = []
  for (const entry of manifest.web_accessible_resources) {
    for (const p of entry.matches) {
      if (!isValidMatchPattern(p)) bad.push(p)
    }
  }
  assert.deepEqual(bad, [], `invalid web_accessible_resources patterns: ${bad}`)
})

test('manifest: permissions stay narrow (no host_permissions — zero-permission stance)', () => {
  const manifest = loadManifest()
  assert.deepEqual(manifest.permissions, ['activeTab', 'storage'])
  assert.equal(
    manifest.host_permissions,
    undefined,
    'host_permissions must not be introduced — see developer_guide.md privacy principles',
  )
})
