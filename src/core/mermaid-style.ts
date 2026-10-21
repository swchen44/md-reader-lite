export type MermaidStyle = 'original' | 'anthropic-blog'

export interface ResolvedMermaidStyleOptions {
  theme: 'default' | 'dark' | 'base'
  themeVariables: Record<string, string | number | boolean> | undefined
  themeCSS: string | undefined
  fontFamily: string | undefined
  darkMode: boolean
}

const FONT = "Georgia, 'Times New Roman', 'Noto Serif TC', serif"
const SERIES = [
  '#d49a83',
  '#a7b8a1',
  '#b4a6c0',
  '#d7c184',
  '#91afb8',
  '#c3b3a3',
]

export function resolveMermaidStyle(value: unknown): MermaidStyle {
  return value === 'anthropic-blog' ? 'anthropic-blog' : 'original'
}

export function resolveMermaidRenderOptions(
  options: unknown,
  pageTheme: 'light' | 'dark',
): ResolvedMermaidStyleOptions {
  const value =
    options && typeof options === 'object'
      ? (options as Record<string, unknown>).style
      : undefined
  if (resolveMermaidStyle(value) === 'original') {
    // The wrapper plugin retains options between calls; clear custom values explicitly.
    return {
      theme: pageTheme === 'dark' ? 'dark' : 'default',
      themeVariables: undefined,
      themeCSS: undefined,
      fontFamily: undefined,
      darkMode: false,
    }
  }
  const themeVariables: Record<string, string | number | boolean> = {
    darkMode: false,
    background: '#faf9f5',
    fontFamily: FONT,
    fontSize: '16px',
    primaryColor: '#f1eadf',
    primaryTextColor: '#24231f',
    primaryBorderColor: '#8a8074',
    secondaryColor: '#e7ede5',
    secondaryTextColor: '#24231f',
    secondaryBorderColor: '#8a8074',
    tertiaryColor: '#eee9f1',
    tertiaryTextColor: '#24231f',
    tertiaryBorderColor: '#8a8074',
    textColor: '#24231f',
    titleColor: '#24231f',
    lineColor: '#5e5b54',
    edgeLabelBackground: '#faf9f5',
    noteBkgColor: '#f7edce',
    noteTextColor: '#24231f',
    noteBorderColor: '#8a8074',
    actorBkg: '#f1eadf',
    actorBorder: '#8a8074',
    actorTextColor: '#24231f',
    actorLineColor: '#5e5b54',
    signalColor: '#5e5b54',
    signalTextColor: '#24231f',
    activationBkgColor: '#e7ede5',
    activationBorderColor: '#8a8074',
    taskBkgColor: '#e7ede5',
    taskBorderColor: '#8a8074',
    activeTaskBkgColor: '#f1eadf',
    activeTaskBorderColor: '#bd684b',
    critBkgColor: '#d49a83',
    critBorderColor: '#8a8074',
    todayLineColor: '#bd684b',
    gridColor: '#d9d3c8',
    pieStrokeColor: '#faf9f5',
    pieStrokeWidth: '1px',
    pieOpacity: '1',
    pieSectionTextColor: '#24231f',
    pieLegendTextColor: '#24231f',
  }
  SERIES.forEach((color, index) => {
    themeVariables[`pie${index + 1}`] = color
    themeVariables[`fillType${index}`] = color
    themeVariables[`git${index}`] = color
    themeVariables[`gitBranchLabel${index}`] = '#24231f'
  })
  return {
    theme: 'base',
    themeVariables,
    themeCSS: '.node rect, rect.actor { rx: 8px; ry: 8px; }',
    fontFamily: FONT,
    darkMode: false,
  }
}
