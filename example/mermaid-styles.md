# Mermaid 風格檢查頁

在「設定 → 插件 → Mermaid 風格」切換 **Original** 與 **Anthropic blog style**，比較同一份圖表。也可以搭配 Developer、Editorial 或關閉 CSS 客製化，並切換頁面亮暗主題。

前十一節沒有指定配色，應隨選單切換。第 12、13 節刻意指定作者配色與主題，應保留作者的設定；第 14 節則確認主題不會延續到下一張圖。

## 1. 流程圖

檢查一般節點、判斷分支、連線標籤與圓角。

```mermaid
graph TD
    Start(["開始閱讀"]) --> Open["開啟 Markdown 文件"]
    Open --> Valid{"文件格式有效？"}
    Valid -->|是| Render["渲染文字與圖表"]
    Valid -->|否| Error["顯示錯誤"]
    Render --> Read["閱讀內容"]
    Read --> Change{"切換圖表風格？"}
    Change -->|是| Render
    Change -->|否| Done(["完成"])
```

## 2. 時序圖

檢查角色、訊息、虛線回應、註記與分組框。

```mermaid
sequenceDiagram
    participant Reader as 閱讀者
    participant Settings as 設定面板
    participant Renderer as 圖表渲染器
    Reader->>Settings: 選擇 Mermaid 風格
    Settings->>Settings: 儲存於本機
    Settings->>Renderer: 通知風格變更
    loop 逐張渲染
        Renderer->>Renderer: 產生 SVG
    end
    Note right of Renderer: 保留作者指定的顏色
    Renderer-->>Reader: 更新圖表並保留閱讀位置
```

## 3. 類別圖

檢查類別標題、屬性、方法與關聯箭頭。

```mermaid
classDiagram
    class MarkdownReader {
        +String theme
        +openDocument()
        +render()
    }
    class DiagramRenderer {
        +String style
        +renderSvg()
    }
    class Settings {
        +String mermaidStyle
        +save()
    }
    MarkdownReader --> DiagramRenderer : uses
    MarkdownReader --> Settings : reads
    Settings --> DiagramRenderer : configures
```

## 4. 狀態圖

檢查起點、終點、狀態節點與轉移文字。

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Ready: 載入成功
    Loading --> Failed: 載入失敗
    Failed --> Loading: 重試
    Ready --> Rendering: 切換風格
    Rendering --> Ready: 更新完成
    Ready --> [*]: 關閉文件
```

## 5. ER 關聯圖

檢查實體表格、欄位、關聯符號與連線文字。

```mermaid
erDiagram
    READER ||--o{ DOCUMENT : opens
    DOCUMENT ||--o{ DIAGRAM : contains
    READER ||--|| SETTINGS : owns
    READER {
        string id PK
        string name
    }
    DOCUMENT {
        string path PK
        string title
        string content
    }
    DIAGRAM {
        string id PK
        string type
        string source
    }
    SETTINGS {
        string mermaidStyle
        string pageTheme
    }
```

## 6. 甘特圖

檢查時間軸、階段背景、一般任務、進行中任務與重要任務。日期為固定範例。

```mermaid
gantt
    title Mermaid style development
    dateFormat YYYY-MM-DD
    section Design
    Confirm requirements :done, design, 2026-10-22, 2d
    Review visual style :active, review, after design, 2d
    section Implementation
    Add presets :presets, after review, 3d
    Add selector :selector, after review, 2d
    section Verification
    Regression tests :crit, tests, after presets, 2d
    Visual inspection :visual, after tests, 1d
```

## 7. 圓餅圖

檢查不同分類的配色、百分比、標題與圖例對比。

```mermaid
pie title 文件內容分布
    "文字說明" : 40
    "流程圖" : 20
    "時序圖" : 15
    "資料模型" : 15
    "其他圖表" : 10
```

## 8. Git 分支圖

檢查不同分支的顏色、分支標籤、提交節點與合併線。縮窄視窗時，確認初始畫面完整，也能縮放與拖曳。

```mermaid
gitGraph
    commit
    commit
    branch feature
    checkout feature
    commit
    commit
    checkout main
    commit
    merge feature
    branch review
    checkout review
    commit
    checkout main
    merge review
```

## 9. 使用者旅程

檢查階段、活動、角色、分數與表情符號。

```mermaid
journey
    title Markdown reading journey
    section Open
      Find document: 4: Reader
      Load document: 5: Reader
    section Read
      Read text: 5: Reader
      Inspect diagrams: 4: Reader
    section Customize
      Change style: 5: Reader
      Compare results: 4: Reader
```

## 10. 節點形狀

一般矩形可以柔化圓角；圓角矩形、膠囊形、菱形、圓形與資料庫形狀仍應保留各自的形狀。

```mermaid
graph LR
    A[一般矩形] --> B(圓角矩形)
    B --> C([膠囊形])
    C --> D{判斷}
    D --> E((圓形))
    E --> F[(資料庫)]
```

## 11. 中文長標籤與寬圖

檢查繁體中文、英文混排與連線文字。視窗較窄時，可使用圖表的縮放與拖曳控制查看細節。

```mermaid
graph LR
    A["使用者開啟包含中文內容的 Markdown 文件"] --> B["讀取本機儲存的 Mermaid style 設定"]
    B --> C{"文件作者是否指定主題？"}
    C -->|保留作者設定| D["依照文件內容產生 SVG 圖表"]
    C -->|採用選單設定| E["套用 Original 或 Anthropic blog style"]
    D --> F["呈現可以縮放與拖曳的圖表"]
    E --> F
```

## 12. 作者自訂配色

這張圖的紅色錯誤節點、藍色重試節點與綠色連線，在兩種風格下都應保留。未指定配色的「完成」節點仍可跟隨選單風格。

```mermaid
graph TD
    Failure[處理失敗] --> Retry[重新嘗試]
    Retry --> Done[完成]
    classDef failure fill:#b91c1c,color:#ffffff,stroke:#7f1d1d
    class Failure failure
    style Retry fill:#dbeafe,stroke:#1d4ed8,color:#172554
    linkStyle 0 stroke:#15803d,stroke-width:2px
```

## 13. 作者指定 Forest 主題

這張時序圖明確指定 `forest`，角色與文字應保留作者主題，不被 Anthropic preset 的配色或字型覆蓋。

```mermaid
%%{init: {"theme": "forest"}}%%
sequenceDiagram
    participant Author as 作者
    participant Reader as 閱讀者
    Author->>Reader: 這張圖使用 Forest 主題
    Note right of Reader: 保留作者指定的主題
    Reader-->>Author: 完整呈現顏色與字型
```

## 14. 回到選單風格

前一張圖的 Forest 設定不應延續到這張圖；這裡應重新使用選單目前選擇的風格。

```mermaid
sequenceDiagram
    participant Reader as 閱讀者
    participant Renderer as 渲染器
    Reader->>Renderer: 使用目前選單風格
    Note right of Renderer: 不繼承前一張圖的 Forest 設定
    Renderer-->>Reader: 顯示正確的配色與字型
```
