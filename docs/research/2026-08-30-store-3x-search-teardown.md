# 商店版 3.6.x 搜尋功能拆解（CRX 逆向）vs MD Reader Lite 案 E

日期：2026-08-30 ／ 方法：下載商店 CRX（id medapdbncneneejhbgcjceippjlfkmkg）解壓，對 `dist/content/index.global.js`（5.8MB minified）做字串/指紋分析與程式碼還原。僅為互通性研究與功能對照，未複製任何程式碼。

## 結論摘要

商店版的「搜尋」本質是**樹節點過濾器**（placeholder 就叫 "Filter"）：大綱樹與檔案樹共用同一個泛用 TreeNode 元件，各帶一個 `filter-key`。**沒有全文（內文）搜尋、沒有文件內高亮、沒有 snippet、沒有用任何搜尋函式庫**。我們的案 E 在比對規則上與其等價，並在全文搜尋與文件內高亮上超出商店版。

## 拆解證據

### 1. 狀態模型（Vue）

```js
{ folder: { isSearching: false, searchKey: '' },
  outline: { isSearching: false, searchKey: '' } }
```

兩個獨立過濾器：檔案樹過濾、大綱過濾。無 content/fulltext 相關狀態。

### 2. 比對規則

```js
// 大綱節點 hidden 判定（還原）
node.hidden = searchKey
  ? !(node.children?.some(c => !c.hidden) ?? false) &&
    !node.content.toLowerCase().includes(searchKey.toLowerCase())
  : false
// 檔案樹另以 parentVisible 傳遞：資料夾命中 → 子孫全顯示
```

- 大小寫不敏感 `toLowerCase().includes()` 純子字串——與 Lite 的 `findRanges` 等價。
- 階層保留：節點顯示條件 = 自己命中 ∨ 存在可見子孫（祖先鏈自動保留）；資料夾命中則整棵子樹顯示。

### 3. 命中高亮元件（還原）

```js
props: { text: String, filterKey: String },
render() {
  if (!this.filterKey || !this.text) return this.text
  const re = new RegExp(`(${this.filterKey})`, 'gi')
  return h('span', {}, this.text.split(re).map((seg, i) =>
    i % 2 ? h('b', { class: 'bg-[--highlight-color]…' }, seg) : seg))
}
```

- 只在**側欄清單**內以 `<b>` 包裹命中字串（Tailwind arbitrary class 上色）。
- **Bug**：使用者輸入未經 regex 跳脫直接進 `new RegExp()`——輸入 `(`、`[`、`*` 等會拋 invalid regex（元件層例外）。Lite 用 indexOf 掃描，天然免疫。

### 4. 指紋掃描（皆零命中）

| 掃描目標                                           | 結果 |
| -------------------------------------------------- | ---- |
| Fuse.js / MiniSearch / FlexSearch / lunr / mark.js | 無   |
| CSS.highlights / ::highlight / TreeWalker 高亮     | 無   |
| 內文/段落搜尋狀態、snippet 產生                    | 無   |

（`keywords`/`matched` 命中皆屬 highlight.js / KaTeX / dagre 等第三方，與搜尋無關。）

## 功能對照

| 面向             | 商店 3.6.x                     | Lite 案 E                                |
| ---------------- | ------------------------------ | ---------------------------------------- |
| 比對規則         | toLowerCase + includes         | 同（indexOf 掃描，另回傳全部命中位置）   |
| 大綱搜尋         | 樹內就地過濾，保留祖先鏈與縮排 | 獨立結果面板，保留層級縮排（不就地過濾） |
| 檔案樹搜尋       | 有（第二個過濾器）             | 無                                       |
| 全文（內文）搜尋 | **無**                         | 有（snippet + 跳轉 + 閃爍）              |
| 文件內高亮       | **無**                         | CSS Custom Highlight API（零 DOM 變動）  |
| 清單命中高亮     | `<b>` 包裹（regex split）      | `<span>` 包裹（ranges 驅動）             |
| Regex 注入       | 有 bug（未跳脫）               | 免疫                                     |
| 函式庫           | 無（手寫 Vue 元件）            | 無（手寫 + 純函式引擎）                  |

## 若要與商店版「形態一致」的補強方向

1. **大綱就地過濾模式**：在大綱頁籤內直接過濾 TOC 清單（隱藏未命中且無命中後代的項目）而非切到結果面板——引擎不變，只加一種呈現模式。
2. **檔案樹過濾**：檔案頁籤加同款過濾框，資料夾命中顯示整棵子樹；與懶加載互動需定義（已載入節點才過濾）。

兩者皆為 UI 層增量，`doc-search` 引擎與比對語意無需改動。

## 教訓

- 「像不像」要拆開講：**比對語意**我們已一致；**呈現形態**（就地過濾 vs 結果面板）不同；**能力**（全文搜尋）我們超出。
- 第三方實作的 UI 慣例可以借鑑，但直接還原也會繼承它的 bug（regex 未跳脫）——指紋分析同時是 QA 素材。
