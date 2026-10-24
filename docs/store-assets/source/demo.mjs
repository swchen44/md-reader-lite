// Original demonstration notes for store photography, not user documents.
export const notes = {
  en: {
    reading: `# A quieter place for your ideas

Good notes make room for the thought that comes next.

## A little structure goes a long way

Keep the question, the decision and the reason together. Markdown makes the structure simple; a thoughtful reader brings it into focus.

| In your notebook | A clearer way to read |
| --- | --- |
| Research & references | Tables, links and callouts |
| Systems & workflows | Mermaid & Graphviz diagrams |
| Ideas worth keeping | Local files, ready when you are |

> [!note] Keep the context
> Save the reasoning alongside the result. Your future self will know where to begin.

## Connect the dots

Use **headings** for a clear outline, inline code for exact details and links to keep related ideas close.

## Design decisions

- [x] Keep source notes in Markdown.
- [x] Use a diagram when a relationship is easier to see.
- [ ] Revisit the next open question.

## Mermaid diagrams

Draw the relationships that words alone cannot show.

## Knowledge base

A small collection, connected over time.
`,
    diagrams: `# From an idea to understanding

Make the relationships visible. Keep the diagram with your notes.

\`\`\`mermaid
flowchart LR
    A[Capture an idea] --> B[Connect the context]
    B --> C{What becomes clear?}
    C --> D[A better question]
    C --> E[A shared understanding]
    D --> A
\`\`\`

## Read it your way

Choose Anthropic blog style or switch back to Original. Flowcharts, sequences, mindmaps and more live right inside your Markdown.
`,
  },
  'zh-TW': {
    reading: `# 讓想法，有個安靜的地方

好的筆記，會替下一個想法留下空間。

## 一點結構，讓閱讀更清楚

把問題、決定與理由放在一起。用 Markdown 留下簡單的結構，再用舒服的閱讀方式，重新看見重點。

| 筆記裡的內容 | 更清楚的閱讀方式 |
| --- | --- |
| 研究與參考資料 | 表格、連結與重點標註 |
| 系統與工作流程 | Mermaid 與 Graphviz 圖表 |
| 值得留下的想法 | 本機文件，隨時接續 |

> [!note] 把脈絡一起留下
> 記下結果，也記下當時的理由。未來再讀，就知道從哪裡開始。

## 把線索連起來

用**標題**整理大綱，用精確的細節保存線索，再用連結把相關想法放在一起。

## 設計決策

- [x] 用 Markdown 保存原始筆記。
- [x] 關係適合用圖說明時，就畫一張圖。
- [ ] 回頭看看下一個值得追問的問題。

## Mermaid 圖表

把不容易說清楚的關係，畫給自己看。

## 知識庫

從一小份筆記，慢慢連成自己的知識。
`,
    diagrams: `# 從一個想法，到看見全貌

讓關係變得清楚，讓圖表與筆記留在一起。

\`\`\`mermaid
flowchart LR
    A[記下一個想法] --> B[連起相關脈絡]
    B --> C{看見了什麼？}
    C --> D[更好的問題]
    C --> E[共同的理解]
    D --> A
\`\`\`

## 選擇舒服的閱讀方式

使用 Anthropic blog style，或切回 Original。流程圖、循序圖、心智圖，都能直接留在 Markdown 裡。
`,
  },
}
