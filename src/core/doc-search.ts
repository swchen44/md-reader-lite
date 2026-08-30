export interface SearchEntry {
  kind: 'heading' | 'block'
  text: string
  ref: unknown
}

export interface SearchHit {
  entry: SearchEntry
  ranges: Array<[number, number]>
}

export interface SearchResult {
  headings: SearchHit[]
  blocks: SearchHit[]
  truncated: boolean
}

export interface Snippet {
  text: string
  ranges: Array<[number, number]>
}

export const BLOCK_HIT_LIMIT = 100

/** 大小寫不敏感、非重疊的全部命中位置 */
export function findRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  if (!query) return ranges
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) break
    ranges.push([at, at + needle.length])
    from = at + needle.length
  }
  return ranges
}

export function buildIndex(entries: SearchEntry[]): SearchEntry[] {
  return entries.filter(e => e.text.trim().length > 0)
}

export function search(
  entries: SearchEntry[],
  query: string,
  limit: number = BLOCK_HIT_LIMIT,
): SearchResult {
  const q = query.trim()
  const result: SearchResult = { headings: [], blocks: [], truncated: false }
  if (!q) return result
  for (const entry of entries) {
    const ranges = findRanges(entry.text, q)
    if (!ranges.length) continue

    if (entry.kind === 'block' && result.blocks.length >= limit) {
      // Honest truncation: only set flag if there are actual hits beyond the limit
      result.truncated = true
      continue
    }

    const hit: SearchHit = { entry, ranges }
    if (entry.kind === 'heading') result.headings.push(hit)
    else result.blocks.push(hit)
  }
  return result
}

/** 以第一個命中為中心擷取上下文；視窗內其餘命中重映射、視窗外丟棄 */
export function makeSnippet(
  text: string,
  ranges: Array<[number, number]>,
  context: number = 30,
): Snippet {
  if (!ranges.length) return { text, ranges: [] }
  const [first] = ranges
  const start = Math.max(0, first[0] - context)
  const end = Math.min(text.length, first[1] + context)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const offset = prefix.length - start
  const remapped: Array<[number, number]> = []
  for (const [s, e] of ranges) {
    if (s >= start && e <= end) remapped.push([s + offset, e + offset])
  }
  return { text: prefix + text.slice(start, end) + suffix, ranges: remapped }
}

export interface HeadingLevelEntry {
  level: number
}

export interface AncestorItem {
  index: number
  isContext: boolean
}

/**
 * 命中標題 + 其未命中祖先（提供層級脈絡）。
 * 祖先 = 該標題前方最近且 level 更小者，遞迴至無。輸出依文件順序。
 */
export function withAncestors(
  headings: HeadingLevelEntry[],
  hitIndexes: number[],
): AncestorItem[] {
  const hits = new Set(hitIndexes)
  if (!hits.size) return []
  const visible = new Set<number>(hits)
  for (const hit of hitIndexes) {
    let level = headings[hit]?.level ?? 0
    for (let i = hit - 1; i >= 0 && level > 1; i--) {
      if (headings[i].level < level) {
        visible.add(i)
        level = headings[i].level
      }
    }
  }
  return Array.from(visible)
    .sort((a, b) => a - b)
    .map(index => ({ index, isContext: !hits.has(index) }))
}
