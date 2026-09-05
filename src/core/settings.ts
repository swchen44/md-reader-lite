export const REFRESH_INTERVAL_MIN = 0.5
export const REFRESH_INTERVAL_MAX = 600
export const CUSTOM_WIDTH_MIN = 500
export const CUSTOM_WIDTH_MAX = 3000
export const TEXT_SIZES = [12, 14, 16, 18, 20, 24] as const

export function clampRefreshInterval(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return REFRESH_INTERVAL_MIN
  return Math.min(REFRESH_INTERVAL_MAX, Math.max(REFRESH_INTERVAL_MIN, n))
}

export function clampCustomWidth(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return null
  return Math.round(Math.min(CUSTOM_WIDTH_MAX, Math.max(CUSTOM_WIDTH_MIN, n)))
}

export const SIDE_WIDTH_MIN = 180
export const SIDE_WIDTH_MAX = 560
export const SIDE_WIDTH_DEFAULT = 260

export function clampSideWidth(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return SIDE_WIDTH_DEFAULT
  return Math.round(Math.min(SIDE_WIDTH_MAX, Math.max(SIDE_WIDTH_MIN, n)))
}

export function textSizeIndex(px: unknown): number {
  const n = typeof px === 'number' ? px : parseFloat(String(px))
  let best = 2 // 16px
  ;(TEXT_SIZES as readonly number[]).forEach((size, i) => {
    if (Math.abs(size - n) < Math.abs(TEXT_SIZES[best] - n)) best = i
  })
  return isFinite(n as number) ? best : 2
}

export const FONT_STACKS: Record<string, string> = {
  default: '',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", "Songti TC", "Noto Serif CJK TC", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
}

export function resolveCodeTheme(
  pageThemeResolved: 'light' | 'dark',
  day: 'light' | 'dark' = 'light',
  night: 'light' | 'dark' = 'dark',
): 'light' | 'dark' {
  return pageThemeResolved === 'dark' ? night : day
}

export const CUSTOM_WIDTH_PERCENT_MIN = 20
export const CUSTOM_WIDTH_PERCENT_MAX = 100

export function clampCustomWidthPercent(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return null
  return Math.round(
    Math.min(CUSTOM_WIDTH_PERCENT_MAX, Math.max(CUSTOM_WIDTH_PERCENT_MIN, n)),
  )
}

export function clampCustomWidthValue(
  v: unknown,
  unit: 'px' | 'percent',
): number | null {
  return unit === 'percent' ? clampCustomWidthPercent(v) : clampCustomWidth(v)
}

export function formatContentWidth(
  value: number | null,
  unit: 'px' | 'percent',
): string | null {
  const clamped = clampCustomWidthValue(value, unit)
  if (clamped === null) return null
  return unit === 'percent' ? `${clamped}%` : `${clamped}px`
}

export function isTxtUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    return /\.txt$/i.test(pathname)
  } catch {
    return false
  }
}

export function isMermaidFileUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    return /\.mmd$/i.test(pathname)
  } catch {
    return false
  }
}
