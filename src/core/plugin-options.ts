export type PluginOptions = Record<string, Record<string, unknown>>

export function getDefaultPluginOptions(): PluginOptions {
  return {
    Linkify: { fuzzyLink: true, fuzzyIP: false, fuzzyEmail: true },
    Alert: { deep: true },
  }
}

export function mergePluginOptions(stored: unknown): PluginOptions {
  const def = getDefaultPluginOptions()
  if (!stored || typeof stored !== 'object') return def
  const s = stored as Record<string, unknown>
  const out: PluginOptions = {}
  for (const key of Object.keys(def)) {
    const sv = s[key]
    out[key] =
      sv && typeof sv === 'object'
        ? { ...def[key], ...(sv as Record<string, unknown>) }
        : { ...def[key] }
  }
  return out
}

export function resolveLinkify(opts: unknown): {
  fuzzyLink: boolean
  fuzzyIP: boolean
  fuzzyEmail: boolean
} {
  const def = getDefaultPluginOptions().Linkify
  const o = (opts && typeof opts === 'object' ? opts : {}) as Record<
    string,
    unknown
  >
  return {
    fuzzyLink:
      typeof o.fuzzyLink === 'boolean'
        ? o.fuzzyLink
        : (def.fuzzyLink as boolean),
    fuzzyIP:
      typeof o.fuzzyIP === 'boolean' ? o.fuzzyIP : (def.fuzzyIP as boolean),
    fuzzyEmail:
      typeof o.fuzzyEmail === 'boolean'
        ? o.fuzzyEmail
        : (def.fuzzyEmail as boolean),
  }
}

export function resolveAlertDeep(opts: unknown): boolean {
  const o = (opts && typeof opts === 'object' ? opts : {}) as Record<
    string,
    unknown
  >
  return typeof o.deep === 'boolean' ? o.deep : true
}
