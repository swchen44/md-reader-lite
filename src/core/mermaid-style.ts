export type MermaidStyle = 'original' | 'anthropic-blog'

export interface ResolvedMermaidStyleOptions {
  theme: 'default' | 'dark' | 'base'
  themeVariables: Record<string, any> | undefined
  themeCSS: string | undefined
  fontFamily: string | undefined
  darkMode: boolean
  look?: 'classic'
  c4?: Record<string, string>
  svgCSS?: string
  journey?: Record<string, string>
  usecase?: Record<string, string>
  sankey?: { nodeColors: Record<string, string> }
}

const LEGACY_TYPES = new Set([
  'flowchart',
  'flowchart-v2',
  'flowchart-elk',
  'sequence',
  'class',
  'classDiagram',
  'state',
  'stateDiagram',
  'stateDiagram-v2',
  'er',
  'journey',
  'gantt',
  'pie',
  'requirement',
  'gitGraph',
  'c4',
])
const AUTHOR_THEMES = new Set([
  'default',
  'dark',
  'forest',
  'neutral',
  'base',
  'neo',
  'neo-dark',
  'redux',
  'redux-dark',
  'redux-color',
  'redux-dark-color',
])

export function resolveMermaidDiagramOptions(
  options: unknown,
  pageTheme: 'light' | 'dark',
  parsed: { diagramType: string; config?: Record<string, unknown> },
): ResolvedMermaidStyleOptions {
  const authoredTheme = AUTHOR_THEMES.has(String(parsed.config?.theme))
  const resolved = resolveMermaidRenderOptions(
    authoredTheme ? { style: 'original' } : options,
    pageTheme,
  )
  if (LEGACY_TYPES.has(parsed.diagramType)) resolved.look = 'classic'
  if (!resolved.themeVariables) return resolved
  const variables = resolved.themeVariables
  Object.assign(variables, {
    useGradient: false,
    dropShadow: 'none',
    sectionBkgColor: '#e7ede5',
    sectionBkgColor2: '#f1eadf',
    altSectionBkgColor: '#faf9f5',
    scaleLabelColor: '#24231f',
    gradientStart: '#f1eadf',
    gradientStop: '#e7ede5',
    quadrant1Fill: '#f1eadf',
    quadrant2Fill: '#e7ede5',
    quadrant3Fill: '#eee9f1',
    quadrant4Fill: '#f7edce',
    quadrantPointFill: '#bd684b',
    quadrantPointTextFill: '#24231f',
    archEdgeColor: '#5e5b54',
    archEdgeArrowColor: '#5e5b54',
    archGroupBorderColor: '#8a8074',
    wardleyEvolutionColor: '#bd684b',
    radar: { axisColor: '#5e5b54', graticuleColor: '#8a8074' },
    wardley: {
      backgroundColor: '#faf9f5',
      axisColor: '#5e5b54',
      axisTextColor: '#24231f',
      gridColor: '#d9d3c8',
      componentFill: '#f1eadf',
      componentStroke: '#8a8074',
      componentLabelColor: '#24231f',
      linkStroke: '#5e5b54',
      evolutionStroke: '#bd684b',
    },
    cynefin: {
      complexBg: '#e7ede5',
      complicatedBg: '#e6edf0',
      chaoticBg: '#f1e0d8',
      clearBg: '#f7edce',
      confusionBg: '#eee9f1',
      boundaryColor: '#8a8074',
      cliffColor: '#bd684b',
      arrowColor: '#5e5b54',
      textColor: '#24231f',
      labelColor: '#24231f',
    },
    xyChart: {
      backgroundColor: '#faf9f5',
      titleColor: '#24231f',
      plotColorPalette: SERIES.join(','),
      xAxisLineColor: '#8a8074',
      yAxisLineColor: '#8a8074',
    },
    packet: {
      blockFillColor: '#f1eadf',
      blockStrokeColor: '#8a8074',
      labelColor: '#24231f',
      titleColor: '#24231f',
      startByteColor: '#5e5b54',
      endByteColor: '#5e5b54',
    },
    emUiFill: '#e7ede5',
    emUiStroke: '#8a8074',
    emProcessorFill: '#eee9f1',
    emProcessorStroke: '#8a8074',
    emReadModelFill: '#e6edf0',
    emReadModelStroke: '#8a8074',
    emCommandFill: '#f7edce',
    emCommandStroke: '#8a8074',
    emEventFill: '#f1e0d8',
    emEventStroke: '#8a8074',
    emSwimlaneBackgroundOdd: '#faf9f5',
    emSwimlaneBackgroundStroke: '#d9d3c8',
    emArrowhead: '#5e5b54',
    emRelationStroke: '#5e5b54',
  })
  for (let index = 0; index < 12; index++) {
    variables[`cScale${index}`] = SERIES[index % SERIES.length]
    variables[`cScaleLabel${index}`] = '#24231f'
    variables[`venn${index + 1}`] = SERIES[index % SERIES.length]
  }
  const c4: Record<string, string> = {
    boundaryFontFamily: FONT,
    messageFontFamily: FONT,
  }
  for (const [index, kind] of [
    'person',
    'system',
    'system_db',
    'system_queue',
    'container',
    'container_db',
    'container_queue',
    'component',
    'component_db',
    'component_queue',
  ].entries()) {
    for (const type of [kind, `external_${kind}`]) {
      c4[`${type}FontFamily`] = FONT
      c4[`${type}_bg_color`] = ['#495349', '#725646', '#526568'][index % 3]
      c4[`${type}_border_color`] = '#8a8074'
    }
  }
  resolved.c4 = c4
  resolved.journey = { taskFontFamily: FONT, titleFontFamily: FONT }
  resolved.usecase = { actorFontFamily: FONT, usecaseFontFamily: FONT }
  const authoredVariables = parsed.config?.themeVariables as
    | Record<string, unknown>
    | undefined
  const authoredFont =
    authoredVariables?.fontFamily ?? parsed.config?.fontFamily
  const font = typeof authoredFont === 'string' ? authoredFont : FONT
  if (parsed.diagramType === 'architecture' && !parsed.config?.themeCSS)
    resolved.svgCSS = `svg[viewBox="0 0 80 80"] > g > rect[width="80"][height="80"] { fill: #526568 !important; rx: 6px; ry: 6px; }`
  if (parsed.diagramType === 'wardley')
    resolved.svgCSS = `text { font-family: ${font}; }`
  if (parsed.diagramType === 'zenuml') {
    resolved.svgCSS = `
      text[class] { font-family: ${font}; fill: #24231f; }
      .frame-border-outer { fill: #8a8074; }
      .frame-border-inner, .frame-header-bg, .group-title-bg { fill: #faf9f5; }
      .participant-box { fill: #f1eadf; stroke: #8a8074; rx: 8px; ry: 8px; }
      .activation-bar, .fragment-tab { fill: #e7ede5; stroke: #8a8074; }
      .lifeline, .message-line, .return-line, .fragment-outline, .frame-header-line { stroke: #5e5b54; }
      .message-arrow, .return-arrow { stroke: #5e5b54; }
      .divider-bg { fill: #f7edce; stroke: #8a8074; }
    `
  }
  return resolved
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
export { SERIES as ANTHROPIC_SERIES }

export function resolveMermaidStyle(value: unknown): MermaidStyle {
  return value === 'original' ? 'original' : 'anthropic-blog'
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
    // Explicitly clear custom values when switching the shared renderer to Original.
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
    themeCSS:
      '.node > rect.label-container:not([rx]):not([ry]), .node > rect.label-container[rx="0"][ry="0"], rect.actor { rx: 8px; ry: 8px; }',
    fontFamily: FONT,
    darkMode: false,
  }
}
