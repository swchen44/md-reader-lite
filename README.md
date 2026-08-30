# MD Reader Lite

> Forked from [md-reader](https://github.com/md-reader/md-reader) by Bener (MIT). Renamed and extended; not affiliated with the upstream project or its store listing.

A lightweight Chrome extension that renders local and online Markdown files as clean, readable pages. Fully offline — no external requests, no telemetry.

## Features

- CommonMark + GFM-style rendering (tables, task lists, footnotes, KaTeX, Mermaid, Graphviz)
- Obsidian syntax: `![[image|300]]` embeds, `[[wikilinks|alias]]`, `%%comments%%`, callouts, front matter table
- Folder tree side panel for browsing sibling markdown files (http/https autoindex)
- Outline (TOC) side panel, light/dark/auto themes, custom plugins toggle
- Works on `file://`, intranet servers, and raw URLs

## Install (unpacked / intranet)

1. Build or download `dist/md-reader-lite-<version>.zip`, unzip to a fixed folder
2. Open `chrome://extensions`, enable Developer mode, Load unpacked → select the folder
3. For local files, enable "Allow access to file URLs" in the extension's details

## Development

See [docs/developer_guide.md](docs/developer_guide.md). Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Privacy

Zero data collection — see [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE). Original work © 2018-present Bener; modifications © 2026 swchen44.
