# Mermaid 12 acceptance receipts

All dated `2026-10-23-mermaid12-*.json` files belong to the [acceptance report](../2026-10-23-mermaid12-acceptance.md).

- `performance-shared-11`, `performance-gallery-31`, `performance-zenuml`: unaltered successful benchmark data, including every sample, environment, clean source commit, asset digests and no-external-request assertions. Later formatting changes whitespace only.
- `matrix`: all 62 individual and 372 layout measurements from the final serial browser suite, including fonts, labels and external-request inventory.
- `audit`: structured projection of both production audit JSON inventories, preserving advisory IDs, versions, severity and primary URLs, plus added/removed IDs. Audit exits 1 because findings remain; this is not exploitability analysis.
- `verification`: test counts and log hashes, exact shared-probe build inputs/outputs, gates, cleanup result and final zip/notices fingerprints. This is a derived receipt checked against successful logs and actual files, not the full ignored browser logs or screenshots.

The runtime benchmark commit is `4eea56a`; the CI-only notice follow-up is `1065b21`. The probe was executed before the former commit and records the then-current HEAD plus exact dirty-source fingerprints. Do not infer probe source from HEAD alone. No raw `file://` test-profile paths are copied into this durable summary.

Reproduce with the permanent commands and browser prerequisites in the report and [tests/perf/README.md](../../../tests/perf/README.md). Results are dated observations, not evergreen dependency/security claims. Never relabel a failed or incomplete benchmark as a successful receipt.
