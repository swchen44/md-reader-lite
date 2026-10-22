# Mermaid 12 MV3 probe

Versioned, independent feasibility harness. This does not replace the product renderer. The independent npm lockfile pins the candidate dependency tree without editing the root pnpm lockfile. Root webpack and the locally installed Playwright provide the existing build/browser tools.

From the repository root:

```sh
npm ci --ignore-scripts --prefix tests/probes/mermaid12
node tests/probes/mermaid12/build.cjs
node --test tests/probes/mermaid12/evidence.test.mjs
node --test tests/probes/mermaid12/probe.test.mjs
```

Requires Node >=22.12.0, root dependencies, Playwright and headed Chrome for Testing. Missing browser support is a failure, not a skipped acceptance test. The manifest injects a single eager content-script bundle in the default isolated world. No popup, remote scripts, host permissions or added CSP privileges are used. The browser test enables the probe extension's file access through Chrome's native extension settings UI.

The 31 diagram fixtures come from `example/mermaid-compatibility.md`. Tests also cover strict page CSP, local files, malformed-input recovery, a complete mixed gallery and remote-resource negative fixtures. Intercepted outbound attempts are recorded and fail the privacy gate. Artifact paths, actual counts and limitations are recorded in `docs/research/mermaid12-probe.md` and the implementation checklist.

Generated extension, fixture HTML, screenshots and JSON evidence are ignored under `dist/probes/mermaid12/`. Browser profiles use an agent-created temporary directory and are removed after the run. Close only this probe's context during cleanup.

The build receipt fingerprints the source, independent/root lockfiles and generated extension. Tests reject stale artifacts before starting Chrome. Runtime receipts include each gate's actual pass/fail/unavailable result, errors and cleanup outcome, including a file-access setup failure. Independent helper tests cover stale evidence and cleanup failures. Browser cases also inject stylesheet and serialization errors to verify temporary DOM cleanup and later-diagram recovery.

The unmodified candidate currently fails the four strict-mode remote-resource gates. These remain real failures outside the product test glob, not TODOs or skipped cases. A successful standard gallery does not clear the migration gate. See [the probe report](../../../docs/research/mermaid12-probe.md) and [the recovery checklist](../../../docs/superpowers/plans/2026-10-23-mermaid-modernization.md) for the latest verified checkpoint.
