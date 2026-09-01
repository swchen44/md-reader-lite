import MD_PLUGINS from '@/config/md-plugins'
import type PAGE_THEMES from '@/config/page-themes'
import i18n from '@/config/i18n'
import { getDefaultPluginOptions } from './plugin-options'

export interface Data {
  enable?: boolean
  refresh?: boolean
  language?: string
  centered?: boolean
  mdPlugins?: typeof MD_PLUGINS
  pageTheme?: typeof PAGE_THEMES[0]
  hiddenSide?: boolean
  folderTree?: boolean
  refreshInterval?: number
  codeWrap?: boolean
  codeBlockDayTheme?: 'light' | 'dark'
  codeBlockNightTheme?: 'light' | 'dark'
  textSize?: number
  textFont?: string
  txtAsMd?: boolean
  outlineCollapse?: boolean
  breaks?: boolean
  customWidth?: number | null
  customCss?: string
  zenMode?: boolean
  mdPluginOptions?: Record<string, Record<string, unknown>>
  customWidthUnit?: 'px' | 'percent'
  charsetCompat?: boolean
}

export function getDefaultData(mergeData: Data = {}): Data {
  return {
    enable: true,
    refresh: false,
    centered: true,
    hiddenSide: false,
    folderTree: false,
    language: i18n().locale,
    mdPlugins: [...MD_PLUGINS],
    pageTheme: 'auto',
    refreshInterval: 0.5,
    codeWrap: false,
    codeBlockDayTheme: 'light',
    codeBlockNightTheme: 'dark',
    textSize: 16,
    textFont: 'default',
    txtAsMd: false,
    outlineCollapse: false,
    breaks: false,
    customWidth: null,
    customCss: '',
    zenMode: false,
    mdPluginOptions: getDefaultPluginOptions(),
    customWidthUnit: 'px',
    charsetCompat: false,
    ...mergeData,
  }
}
