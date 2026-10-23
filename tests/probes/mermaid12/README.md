# Mermaid 12 MV3 probe

Versioned, independent feasibility harness. This does not replace the product renderer. The independent npm lockfile pins the candidate dependency tree without editing the root pnpm lockfile. Root webpack and the locally installed Playwright provide the existing build/browser tools.

From the repository root:

```sh
npm ci --ignore-scripts --prefix tests/probes/mermaid12
node tests/probes/mermaid12/build.cjs
node --test tests/probes/mermaid12/evidence.test.mjs
node --test tests/unit/mermaid-css-policy.test.mjs tests/unit/mermaid-resource-preflight.test.mjs tests/unit/mermaid-frame-transport.test.mjs
MERMAID_PROBE_POLICY=confined node --test tests/probes/mermaid12/probe.test.mjs
```

Requires Node >=22.12.0, root dependencies, Playwright and headed Chrome for Testing. Missing browser support is a failure, not a skipped acceptance test. The manifest injects a single eager content-script bundle in the default isolated world. No popup, remote scripts, host permissions or added CSP privileges are used. The browser test enables the probe extension's file access through Chrome's native extension settings UI.

The 31 diagram fixtures come from `example/mermaid-compatibility.md`. Tests also cover strict page CSP, local files, malformed-input recovery, a complete mixed gallery and remote-resource negative fixtures. Intercepted outbound attempts are recorded and fail the privacy gate. Artifact paths, actual counts and limitations are recorded in `docs/research/mermaid12-probe.md` and the implementation checklist.

Generated extension, fixture HTML, screenshots and JSON evidence are ignored under `dist/probes/mermaid12/`. Browser profiles use an agent-created temporary directory and are removed after the run. Close only this probe's context during cleanup.

The build receipt fingerprints the source, independent/root lockfiles and generated extension. Tests reject stale artifacts before starting Chrome. Runtime receipts include each gate's actual pass/fail/unavailable result, errors and cleanup outcome, including a file-access setup failure. Independent helper tests cover stale evidence and cleanup failures. Browser cases also inject stylesheet and serialization errors to verify temporary DOM cleanup and later-diagram recovery.

The confined candidate uses an extension-local frame, restrictive renderer-only CSP, structured preflight and sanitized inline SVG. Its two execution worlds are compiled independently to prevent shared chunks. The expanded browser gates include raw counterexamples followed by rejection before any request or CSP violation, encoded/relative resources, safe author styles and host-style isolation. Native State class/inline paint, C4 relationship paint, Swimlane images, Sankey sanitizer behavior and source/edge limits have dedicated regressions. Attack receipts require `preflightPassed: false` when the input must be rejected before render; a post-render sanitizer failure is insufficient. Actual counts live in the latest migration receipt. Helper regressions cover CSS expansion budgets and disposal as well as evidence integrity.

After A4, the policy/transport/runtime modules were promoted to `src/core/mermaid/`; the probe imports those exact modules and fingerprints them. Policy regressions now live under `tests/unit/` and run automatically with the product suite. The independent dependencies still provide the raw Mermaid/ZenUML comparison and do not replace product lifecycle tests.

`MERMAID_PROBE_POLICY=raw node --test tests/probes/mermaid12/probe.test.mjs` retains the unmodified comparison and intentionally fails four strict-mode remote-resource gates. These are real failures, not TODOs or skips. Raw is also the default when the environment variable is omitted. See [the probe report](../../../docs/research/mermaid12-probe.md) and [the recovery checklist](../../../docs/superpowers/plans/2026-10-23-mermaid-modernization.md) for the latest verified checkpoint. A passing probe permits product migration; it does not claim product or style acceptance.
