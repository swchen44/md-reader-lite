const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml'

export function normalizePlantumlServer(server: unknown): string {
  if (typeof server !== 'string') return DEFAULT_SERVER
  const s = server.trim().replace(/\/+$/, '')
  return s || DEFAULT_SERVER
}

export function buildPlantumlImageUrl(server: string, encoded: string): string {
  return `${normalizePlantumlServer(server)}/svg/${encoded}`
}

export function canRenderPlantuml(
  enabled: boolean,
  offlineMode: boolean,
  server: string,
): boolean {
  return !!enabled && !offlineMode && !!String(server ?? '').trim()
}

export function isPlantumlUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    return /\.(puml|plantuml)$/i.test(pathname)
  } catch {
    return false
  }
}
