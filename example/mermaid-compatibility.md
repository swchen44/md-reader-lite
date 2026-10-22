# Mermaid 圖種相容性檢查

本頁依 [Mermaid 官方圖種清單](https://mermaid.js.org/ecosystem/integrations-community.html) 列出 31 種圖，供目前的 md-reader 與未來升級比較。範例為本專案依官方語法撰寫，沒有使用遠端圖示或字型。

目前使用 Mermaid **9.1.6**。此頁刻意包含尚未支援的語法，因此部分圖會顯示錯誤或 `undefined`；這些不能視為風格驗收通過。兩種風格的逐項結果與永久測試方式見 [相容性測試報告](../docs/research/mermaid-diagram-compatibility.md)。純視覺比較請使用 [Mermaid 風格檢查頁](mermaid-styles.md)。

在「設定 → 插件 → Mermaid 風格」切換 **Original** 與 **Anthropic blog style**。

## 1. Flowchart

[官方語法](https://mermaid.js.org/syntax/flowchart.html)

```mermaid
flowchart LR
    File["Markdown 文件"] --> Check{"包含圖表？"}
    Check -->|是| Render["產生 SVG"]
    Check -->|否| Read["閱讀文字"]
    Render --> Read
```

## 2. Swimlanes Diagram

[官方語法](https://mermaid.js.org/syntax/swimlanes.html)

```mermaid
swimlane-beta LR
    subgraph Reader
        Open[Open document]
    end
    subgraph Extension
        Parse[Parse Markdown]
        Draw[Render diagram]
    end
    Open --> Parse
    Parse --> Draw
```

## 3. Sequence Diagram

[官方語法](https://mermaid.js.org/syntax/sequenceDiagram.html)

```mermaid
sequenceDiagram
    participant Reader as 閱讀者
    participant Renderer as 渲染器
    Reader->>Renderer: 開啟文件
    Note right of Renderer: 本機渲染
    Renderer-->>Reader: 顯示圖表
```

## 4. Class Diagram

[官方語法](https://mermaid.js.org/syntax/classDiagram.html)

```mermaid
classDiagram
    class Document {
        +String title
        +render()
    }
    class Diagram {
        +String source
        +toSvg()
    }
    Document "1" *-- "many" Diagram : contains
```

## 5. State Diagram

[官方語法](https://mermaid.js.org/syntax/stateDiagram.html)

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Ready: 完成
    Ready --> Rendering: 切換風格
    Rendering --> Ready: 更新
    Ready --> [*]
```

## 6. Entity Relationship Diagram

[官方語法](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)

```mermaid
erDiagram
    DOCUMENT ||--o{ DIAGRAM : contains
    DOCUMENT {
        string path PK
        string title
    }
    DIAGRAM {
        string id PK
        string source
    }
```

## 7. User Journey

[官方語法](https://mermaid.js.org/syntax/userJourney.html)

```mermaid
journey
    title Reading a document
    section Open
      Find Markdown: 4: Reader
      Open document: 5: Reader
    section Inspect
      Compare diagrams: 4: Reader
      Choose style: 5: Reader
```

## 8. Gantt

[官方語法](https://mermaid.js.org/syntax/gantt.html)

```mermaid
gantt
    title Diagram review
    dateFormat YYYY-MM-DD
    section Prepare
    Write examples :done, examples, 2026-10-22, 2d
    section Verify
    Browser checks :active, checks, after examples, 2d
    Review colors :crit, after checks, 1d
```

## 9. Pie Chart

[官方語法](https://mermaid.js.org/syntax/pie.html)

```mermaid
pie title Document content
    "Text" : 55
    "Diagrams" : 30
    "Tables" : 15
```

## 10. Quadrant Chart

[官方語法](https://mermaid.js.org/syntax/quadrantChart.html)

```mermaid
quadrantChart
    title Review priorities
    x-axis Low effort --> High effort
    y-axis Low impact --> High impact
    quadrant-1 Plan
    quadrant-2 Fix first
    quadrant-3 Later
    quadrant-4 Reconsider
    Labels: [0.2, 0.8]
    Layout: [0.7, 0.7]
    Icons: [0.3, 0.2]
```

## 11. Requirement Diagram

[官方語法](https://mermaid.js.org/syntax/requirementDiagram.html)

```mermaid
requirementDiagram
    requirement offline_render {
        id: 1
        text: Render diagrams locally.
        risk: high
        verifymethod: test
    }
    element browser_test {
        type: browser
    }
    browser_test - verifies -> offline_render
```

## 12. Use Case Diagram

[官方語法](https://mermaid.js.org/syntax/usecase.html)

```mermaid
usecase-beta
direction LR
actor Reader
systemBoundary Extension
    Open("Open Markdown")
    Inspect("Inspect diagrams")
end
Reader --> Open
Reader --> Inspect
```

## 13. GitGraph (Git) Diagram

[官方語法](https://mermaid.js.org/syntax/gitgraph.html)

```mermaid
gitGraph
    commit
    branch style
    checkout style
    commit
    commit
    checkout main
    merge style
```

## 14. C4 Diagram

[官方語法](https://mermaid.js.org/syntax/c4.html)

```mermaid
C4Context
    title Markdown reader context
    Person(reader, "Reader", "Reads local documents")
    System(extension, "md-reader", "Renders Markdown locally")
    SystemDb(files, "Local files", "Markdown documents")
    Rel(reader, extension, "Reads with")
    Rel(extension, files, "Opens")
```

## 15. Mindmaps

[官方語法](https://mermaid.js.org/syntax/mindmap.html)

```mermaid
mindmap
    root((Markdown))
        Content
            Text
            Tables
        Diagrams
            Flowchart
            Sequence
```

## 16. Timeline

[官方語法](https://mermaid.js.org/syntax/timeline.html)

```mermaid
timeline
    title Diagram style review
    Prepare : Collect examples
    Implement : Add presets
    Verify : Compare styles : Review labels
```

## 17. ZenUML

[官方語法與額外套件註冊](https://mermaid.js.org/syntax/zenuml.html#integrating-with-your-library-website)

```mermaid
zenuml
    title Local rendering
    Reader->Renderer: Open document
    Renderer->Reader: Display diagram
```

## 18. Sankey

[官方語法](https://mermaid.js.org/syntax/sankey.html)

```mermaid
sankey
Documents,Text,55
Documents,Diagrams,30
Documents,Tables,15
```

## 19. XY Chart

[官方語法](https://mermaid.js.org/syntax/xyChart.html)

```mermaid
xychart
    title "Documents reviewed"
    x-axis [Mon, Tue, Wed, Thu]
    y-axis "Count" 0 --> 20
    bar [5, 12, 8, 16]
    line [5, 12, 8, 16]
```

## 20. Block Diagram

[官方語法](https://mermaid.js.org/syntax/block.html)

```mermaid
block
    columns 3
    A["Markdown"] B["Parser"] C["SVG"]
    A --> B
    B --> C
```

## 21. Packet

[官方語法](https://mermaid.js.org/syntax/packet.html)

```mermaid
packet
    0-7: "Type"
    8-15: "Flags"
    16-31: "Length"
```

## 22. Kanban

[官方語法](https://mermaid.js.org/syntax/kanban.html)

```mermaid
kanban
    todo[To do]
        labels[Review labels]
    reviewing[Reviewing]
        colors[Compare colors]
    done[Done]
        fixtures[Write examples]
```

## 23. Architecture

[官方語法](https://mermaid.js.org/syntax/architecture.html)

```mermaid
architecture-beta
    group local(cloud)[Local browser]
    service files(disk)[Markdown] in local
    service renderer(server)[Renderer] in local
    files:R -- L:renderer
```

## 24. Radar

[官方語法](https://mermaid.js.org/syntax/radar.html)

```mermaid
radar-beta
    axis labels["Labels"], contrast["Contrast"], layout["Layout"]
    curve original["Original"]{4, 3, 4}
    curve editorial["Anthropic"]{4, 5, 3}
    min 0
    max 5
```

## 25. Event Modeling

[官方語法](https://mermaid.js.org/syntax/eventmodeling.html)

```mermaid
eventmodeling
    tf 01 ui DocumentView
    tf 02 cmd ChangeStyle
    tf 03 evt StyleChanged
```

## 26. Treemap

[官方語法](https://mermaid.js.org/syntax/treemap.html)

```mermaid
treemap-beta
"Documents"
    "Guides": 12
    "Examples": 8
"Tests"
    "Unit": 15
    "Browser": 10
```

## 27. Venn

[官方語法](https://mermaid.js.org/syntax/venn.html)

```mermaid
venn-beta
    title Diagram acceptance
    set Readable
    set Correct
    set Offline
    union Readable,Correct["Reviewable"]
    union Readable,Correct,Offline["Ready"]
```

## 28. Ishikawa

[官方語法](https://mermaid.js.org/syntax/ishikawa.html)

```mermaid
ishikawa-beta
    Unreadable diagram
    Labels
        Small text
        Long names
    Colors
        Low contrast
    Layout
        Overlapping nodes
```

## 29. Wardley

[官方語法](https://mermaid.js.org/syntax/wardley.html)

```mermaid
wardley-beta
title Markdown reading
anchor Reader [0.95, 0.40]
component Document [0.75, 0.45]
component Renderer [0.40, 0.65]
Reader -> Document
Document -> Renderer
```

## 30. Cynefin

[官方語法](https://mermaid.js.org/syntax/cynefin.html)

```mermaid
cynefin-beta
    title Diagram maintenance
    clear
        "Update examples"
    complicated
        "Review parser behavior"
    complex
        "Explore new layouts"
    chaotic
        "Restore broken rendering"
    confusion
        "Classify issue"
```

## 31. TreeView

[官方語法](https://mermaid.js.org/syntax/treeView.html)

```mermaid
treeView-beta
    md-reader/
        src/
            core/
                markdown.ts
        example/
            mermaid-styles.md
        package.json
```
