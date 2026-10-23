# Mermaid runtime benchmark

Requires the same headed Chrome for Testing/Playwright setup as `tests/e2e/`, Node >=22.12.0 and a production build. Run browser suites and benchmarks serially. Do not interact with the owned test windows during focus/keyboard cases.

Build the old product in a separate detached worktree. Commit `3b785a27c669e45a08c2578afac3a7aced68d16f` still contains Mermaid 9.1.6 in the product; its independent Mermaid 12 probe is not the baseline renderer. Install that worktree's frozen pnpm lockfile and run its production build. Do not overwrite the current extension directory with old assets.

```sh
COREPACK_ENABLE_AUTO_PIN=0 corepack pnpm install --frozen-lockfile
npm run build
node tests/perf/mermaid.mjs --baseline /path/to/baseline/extension --output dist/qa/mermaid-performance.json
node tests/perf/mermaid.mjs --scope gallery-31 --output dist/qa/mermaid-performance-gallery.json
node tests/perf/mermaid.mjs --scope zenuml --output dist/qa/mermaid-performance-zenuml.json
```

`shared-11` compares both versions with identical fixtures, 1200×900 viewport, fixed 760px content width, light page and CSS customization off. `gallery-31` and `zenuml` measure the candidate only, with the same settings. Each variant/style uses five fresh browser profiles and ten warm redraws on the final profile. Reports contain every sample, median/max, browser/hardware, source commit/dirty state, asset SHA-256/bytes and observed HTTP requests. A warm run requires actual SVG replacement and completion of every selected diagram; missing, invalid or incomplete samples fail.

Fresh-profile cold runs do not flush OS disk caches. Timings include browser polling and, for warm redraws, storage/tab messaging. These small samples do not establish p95 or CPU attribution. Standalone ZenUML and the full gallery are absolute costs; subtracting these measurements does not prove an additive ZenUML overhead. A failed run writes a failed receipt and must never be counted as acceptance.

Record the baseline/candidate asset hashes and preserve successful raw JSON under `docs/research/data/` when accepting a migration. The report's commit can predate documentation-only commits; verify the measured asset hashes against the final build. Only remove the worktree created for this benchmark, after preserving its receipt and checking it is clean. A >2× increase in aggregate engine/content size, zip size or shared-fixture median needs an explicit documented tradeoff review before acceptance.

See the [migration checklist](../../docs/superpowers/plans/2026-10-23-mermaid-modernization.md) and [design/test plan](../../docs/superpowers/specs/2026-10-22-mermaid-modernization-design.md).
