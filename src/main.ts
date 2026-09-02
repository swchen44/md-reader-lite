import throttle from 'lodash.throttle'
import Event from '@/core/event'
import storage from '@/core/storage'
import Ele, { svg } from '@/core/ele'
import { initPlugins } from '@/plugins'
import lifecycle from '@/core/lifecycle'
import className from '@/config/class-name'
import i18n from '@/config/i18n'
import { createFileTree, dirOf } from '@/core/file-tree'
import { createGithubLister } from '@/core/github-listing'
import { parseRawUrl, parentTreeUrl } from '@/core/github-url'
import { createSearchPanel } from '@/core/search-panel'
import type { Theme } from '@/config/page-themes'
import { getDefaultData, type Data } from '@/core/data'
import { needsCharsetCompat } from '@/core/charset'
import { isNetworkAllowed } from '@/core/network'
import {
  canRenderPlantuml,
  normalizePlantumlServer,
  isPlantumlUrl,
} from '@/core/plantuml'
import {
  clampRefreshInterval,
  formatContentWidth,
  isTxtUrl,
  FONT_STACKS,
  resolveCodeTheme,
} from '@/core/settings'
import { mdRender, type MdOptions } from '@/core/markdown'
import { fetchDirListing } from '@/core/dir-fetch'
import type { DirEntry } from '@/core/dir-listing'
import {
  createFsaLister,
  isFsaSupported,
  pickDirectory,
  requestPermission,
  verifyPermission,
  type FsaDirectoryHandle,
} from '@/core/fsa-listing'
import { clearGrant, loadGrant, saveGrant } from '@/core/fsa-store'
import {
  encodePathSegment,
  resolveByCandidates,
  rootPathCandidates,
  urlToDirPath,
} from '@/core/fsa-path'
import {
  getHeads,
  getRawContainer,
  setTheme,
  setCodeTheme,
  CONTENT_TYPES,
  darkMediaQuery,
  getMediaQueryTheme,
  toTheme,
} from '@/shared'
import codeIcon from '@/images/icon_code.svg'
import sideIcon from '@/images/icon_side.svg'
import goTopIcon from '@/images/icon_go_top.svg'
import '@/style/index.less'

function main(data: Data) {
  const configData = getDefaultData(data)
  const actions = {
    reload() {
      window.location.reload()
    },
    updateMdPlugins() {
      reloading = true
      if (mdRaw) {
        contentRender(mdRaw)
        renderSide()
      } else {
        window.location.reload()
      }
      reloading = false
    },
    updatePageTheme(theme: Theme, prevTheme: Theme) {
      setTheme(theme)
      applyCodeTheme()
      renderContentByTheme(theme, prevTheme)
    },
    toggleRefresh(value) {
      clearTimeout(pollingTimer)
      value && isNetworkAllowed(configData.offlineMode) && polling()
    },
    toggleCentered(value) {
      mdContent.classList.toggle('centered', value)
    },
    toggleSide() {
      onToggleSide()
    },
    toggleFolderTree(value) {
      setFolderTree(value)
    },
    applySetting(value, _oldValue, key) {
      switch (key) {
        case 'refreshInterval':
          // 無動作：polling() 每輪重新讀取 configData.refreshInterval
          break
        case 'codeWrap':
          applyCodeWrap()
          break
        case 'breaks':
        case 'txtAsMd':
        case 'outlineCollapse':
        case 'charsetCompat':
        case 'offlineMode':
          window.location.reload()
          break
        case 'codeBlockDayTheme':
        case 'codeBlockNightTheme':
          applyCodeTheme()
          break
        case 'textSize':
        case 'textFont':
        case 'customWidth':
        case 'customWidthUnit':
          applyTypography()
          break
        case 'customCss':
          applyCustomCss()
          break
        case 'mdPluginOptions':
        case 'plantumlEnabled':
        case 'plantumlServer':
          actions.updateMdPlugins()
          break
        default:
      }
    },
  }
  chrome.runtime.onMessage.addListener(({ action, data: { key, value } }) => {
    const oldValue = configData[key]
    configData[key] = value
    actions[action]?.(value, oldValue, key)
  })

  if (isTxtUrl(window.location.href) && !configData.txtAsMd) {
    return
  }

  const isPuml = isPlantumlUrl(window.location.href)
  if (!configData.enable) {
    return
  }
  if (isPuml) {
    // .puml/.plantuml：本擴充明確認得的副檔名。放行條件縮窄為 text/* 且非
    // text/html——保留對「某網站 .puml 動態路由實回 HTML」誤命中的防線。
    const ct = document.contentType
    if (!ct.startsWith('text/') || ct === 'text/html') {
      return
    }
  } else if (!CONTENT_TYPES.includes(document.contentType)) {
    return
  }

  let pollingTimer: number = null
  let reloading: boolean = false
  let mdRaw: string = null
  let isSideHover: boolean = false
  let globalEvent: Event = new Event()

  initPlugins({ event: globalEvent, offlineMode: configData.offlineMode })

  /* init md page */
  setTheme(configData.pageTheme)
  const applyCodeTheme = () =>
    setCodeTheme(
      resolveCodeTheme(
        toTheme(configData.pageTheme),
        configData.codeBlockDayTheme,
        configData.codeBlockNightTheme,
      ),
    )
  applyCodeTheme()
  document.body.classList.toggle(
    className.SIDE_COLLAPSED,
    configData.hiddenSide,
  )

  const rawContainer = getRawContainer()
  lifecycle.init(rawContainer)
  mdRaw = rawContainer?.textContent
  if (isPuml && mdRaw) {
    // .puml/.plantuml 獨立檔：整份內容即一張 PlantUML 圖，包成單一 plantuml
    // fence 走既有 markdown→plantuml 插件管線（離線/啟用管制、關閉顯示原碼
    // 全部自動沿用站點 4 機制）。
    mdRaw = '```plantuml\n' + mdRaw.trim() + '\n```'
  }

  /* render content */
  const mdContent = new Ele<HTMLElement>('article', {
    className: `${className.MD_CONTENT} ${
      configData.centered ? 'centered' : ''
    }`,
  })

  const applyCodeWrap = () => {
    mdContent.classList.toggle(className.CODE_WRAP, !!configData.codeWrap)
  }
  applyCodeWrap()

  const applyTypography = () => {
    const s = mdContent.ele.style
    s.setProperty('--md-reader-text-size', `${configData.textSize || 16}px`)
    const stack = FONT_STACKS[configData.textFont] || ''
    stack
      ? s.setProperty('--md-reader-text-font', stack)
      : s.removeProperty('--md-reader-text-font')
    const w = formatContentWidth(
      configData.customWidth,
      configData.customWidthUnit || 'px',
    )
    w
      ? s.setProperty('--md-reader-content-width', w)
      : s.removeProperty('--md-reader-content-width')
  }
  applyTypography()

  const CUSTOM_CSS_ID = 'md-reader-custom-css'
  const applyCustomCss = () => {
    let styleEle = document.getElementById(
      CUSTOM_CSS_ID,
    ) as HTMLStyleElement | null
    if (!configData.customCss) {
      styleEle?.remove()
      return
    }
    if (!styleEle) {
      styleEle = document.createElement('style')
      styleEle.id = CUSTOM_CSS_ID
      document.head.appendChild(styleEle)
    }
    styleEle.textContent = configData.customCss
  }
  applyCustomCss()

  const localize = i18n(configData.language)
  const mdRenderer =
    (target: HTMLElement | Ele) =>
    (code: string = '', options?: MdOptions) => {
      target.innerHTML = mdRender(code, {
        theme: toTheme(configData.pageTheme),
        plugins: configData.mdPlugins,
        config: { breaks: !!configData.breaks },
        pluginOptions: configData.mdPluginOptions,
        plantuml: {
          server: normalizePlantumlServer(configData.plantumlServer),
          allowed: canRenderPlantuml(
            configData.plantumlEnabled,
            configData.offlineMode,
            configData.plantumlServer,
          ),
          disabledHint: localize('plantuml_disabled_render'),
        },
        ...options,
      })
      globalEvent.emit(
        'contentRendered',
        target instanceof Ele ? target.ele : target,
      )
    }
  const contentRender = mdRenderer(mdContent)
  contentRender(mdRaw)

  mdContent.on(
    'click',
    async e => {
      globalEvent.emit('click', e.target)
    },
    true,
  )

  const mdBody = new Ele<HTMLElement>(
    'main',
    { className: className.MD_BODY },
    mdContent,
  )

  /* render side */
  const mdSide = new Ele<HTMLElement>('ul', { className: className.MD_SIDE })
  let idCache: { [content: string]: number } = Object.create(null)
  let headElements: HTMLElement[] = []
  let sideLiElements: HTMLElement[] = []
  let df: Ele<DocumentFragment> = null
  let targetIndex: number = null
  mdSide.on('mouseenter', () => {
    isSideHover = true
  })
  mdSide.on('mouseleave', () => {
    isSideHover = false
  })

  /* render folder tree tab */
  let fileTree: ReturnType<typeof createFileTree> | null = null
  let filesPanel: Ele<HTMLElement> | null = null
  let activeTab: 'outline' | 'files' = 'outline'
  let rawShown = false

  function ensureFilesPanel(): Ele<HTMLElement> {
    if (!filesPanel) {
      filesPanel = new Ele<HTMLElement>('div', {
        className: className.FILES_PANEL,
      })
      lifecycle.mount([filesPanel])
      void initFilesContent()
    }
    return filesPanel
  }

  async function initFilesContent() {
    const rootDir = dirOf(window.location.href.replace(/[?#].*$/, ''))
    const isFile = rootDir.startsWith('file:')
    const gh = parseRawUrl(window.location.href.replace(/[?#].*$/, ''))
    if (gh) {
      if (!isNetworkAllowed(configData.offlineMode)) {
        buildTree(undefined, 'default', null, localize('offline_blocked'))
        return
      }
      buildTree(createGithubLister(gh, rootDir), 'github', parentTreeUrl(gh))
      return
    }
    if (!isFile && !isNetworkAllowed(configData.offlineMode)) {
      buildTree(undefined, 'default', null, localize('offline_blocked'))
      return
    }
    try {
      await fetchDirListing(rootDir) // 探測：http 及老 Chromium 成功
      buildTree(undefined)
      return
    } catch {
      if (!isFile || !isFsaSupported()) {
        buildTree(undefined) // 維持原降級（樹內 dir_error 訊息）
        return
      }
    }
    const grant = (await loadGrant()) as {
      handle: FsaDirectoryHandle
      rootDirUrl: string
    } | null
    if (grant && rootDir.startsWith(grant.rootDirUrl)) {
      const state = await verifyPermission(grant.handle).catch(() => 'denied')
      if (state === 'granted') {
        buildTree(createFsaLister(grant.handle, grant.rootDirUrl), 'fsa')
        return
      }
      if (state === 'prompt') {
        showFsaPanel('regrant', grant)
        return
      }
      await clearGrant()
    }
    showFsaPanel('guide', null)
  }

  function buildTree(
    listDir?: (u: string) => Promise<DirEntry[]>,
    kind: 'default' | 'fsa' | 'github' = 'default',
    parentHref?: string | null,
    rootMessage?: string,
  ) {
    const panel = filesPanel!
    panel.innerHTML = null
    fileTree = createFileTree({
      currentUrl: window.location.href,
      localize,
      listDir,
      parentHref,
      rootMessage,
      onRootStatus: status => {
        if (status === 'error' && kind === 'fsa') {
          // FSA root 失效：清授權、回引導面板
          void clearGrant()
          fileTree = null
          showFsaPanel('guide', null)
        }
      },
    })
    panel.append(fileTree.tree)
  }

  function showFsaPanel(
    kind: 'guide' | 'regrant',
    grant: { handle: FsaDirectoryHandle; rootDirUrl: string } | null,
    message?: string,
  ) {
    const panel = filesPanel!
    panel.innerHTML = null
    const box = new Ele<HTMLElement>('div', { className: className.FSA_PANEL })
    if (message) {
      const msg = new Ele<HTMLElement>('div', { className: className.FSA_HINT })
      msg.textContent = message
      box.append(msg)
    }
    const btn = new Ele<HTMLElement>('button', {
      className: className.FSA_BUTTON,
    })
    btn.textContent = localize(
      kind === 'guide' ? 'fsa_pick_button' : 'fsa_regrant_button',
    )
    const hint = new Ele<HTMLElement>('div', { className: className.FSA_HINT })
    hint.textContent = localize('fsa_pick_hint')
    btn.on('click', async () => {
      if (kind === 'regrant' && grant) {
        const state = await requestPermission(grant.handle).catch(
          () => 'denied',
        )
        if (state === 'granted') {
          buildTree(createFsaLister(grant.handle, grant.rootDirUrl), 'fsa')
        } else {
          await clearGrant()
          showFsaPanel('guide', null)
        }
        return
      }
      try {
        const handle = await pickDirectory()
        const dirSegs = urlToDirPath(window.location.href)
        const resolved = await resolveByCandidates(
          handle,
          rootPathCandidates(handle.name, dirSegs),
        )
        if (!resolved) {
          showFsaPanel('guide', null, localize('fsa_mismatch'))
          return
        }
        const rootDirUrl =
          'file:///' +
          resolved.rootDir.map(encodePathSegment).join('/') +
          (resolved.rootDir.length ? '/' : '')
        await saveGrant({ handle, rootDirUrl })
        buildTree(createFsaLister(handle, rootDirUrl), 'fsa')
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return // 取消：靜默
        showFsaPanel('guide', null, String((err as Error)?.message || err))
      }
    })
    box.append(btn)
    box.append(hint)
    panel.append(box)
  }

  function tabButton(labelKey: string, active: boolean) {
    const btn = new Ele<HTMLElement>('button', {
      className: active
        ? `${className.SIDE_TAB} ${className.SIDE_TAB_ACTIVE}`
        : className.SIDE_TAB,
    })
    btn.textContent = localize(labelKey)
    return btn
  }

  const outlineTabBtn = tabButton('label_outline', true)
  const filesTabBtn = tabButton('label_files', false)

  let searchOpen = false
  let searchMounted = false
  const searchPanel = createSearchPanel({
    getArticle: () => mdContent.ele,
    getHeads: () => headElements,
    localize,
    onRequestClose: () => closeSearch(),
    getMode: () => activeTab,
    onFilesQuery: q => fileTree?.applyFilter(q),
  })
  searchPanel.button.on('click', () => openSearch())
  // Registered here (after searchPanel exists), not right after
  // initPlugins(): the initial contentRender(mdRaw) call above already
  // emits 'contentRendered' synchronously, before this point in the
  // function runs. Wiring this listener any earlier would fire on that
  // first render while `searchPanel` is still in its TDZ.
  globalEvent.on('contentRendered', () => {
    searchPanel.rebuild()
  })

  function openSearch() {
    if (activeTab === 'files' && !fileTree) return
    if (searchOpen || rawShown) return
    searchOpen = true
    const filesMode = activeTab === 'files'
    if (!filesMode) {
      if (!searchMounted) {
        lifecycle.mount([searchPanel.panel])
        searchMounted = true
      }
      mdSide.hide()
      filesPanel?.hide()
      searchPanel.panel.show()
    }
    outlineTabBtn.hide()
    filesTabBtn.hide()
    searchPanel.button.hide()
    searchPanel.bar.show()
    searchPanel.focus()
  }

  function closeSearch() {
    if (!searchOpen) return
    searchOpen = false
    searchPanel.clear()
    fileTree?.clearFilter()
    searchPanel.bar.hide()
    searchPanel.panel.hide()
    outlineTabBtn.show()
    filesTabBtn.toggle(configData.folderTree !== false)
    searchPanel.button.show()
    activateTab(activeTab)
  }

  const sideTabs = new Ele<HTMLElement>(
    'div',
    { className: className.SIDE_TABS },
    [outlineTabBtn, filesTabBtn, searchPanel.button, searchPanel.bar],
  )

  function activateTab(tab: 'outline' | 'files') {
    activeTab = tab
    const isFiles = tab === 'files'
    outlineTabBtn.ele.classList.toggle(className.SIDE_TAB_ACTIVE, !isFiles)
    filesTabBtn.ele.classList.toggle(className.SIDE_TAB_ACTIVE, isFiles)
    mdSide.toggle(!isFiles)
    if (isFiles) ensureFilesPanel()
    filesPanel?.toggle(isFiles)
  }
  outlineTabBtn.on('click', () => activateTab('outline'))
  filesTabBtn.on('click', () => activateTab('files'))

  function setFolderTree(enabled: boolean) {
    // While raw view is showing, defer the visual toggles (re-applied via
    // activateTab() when raw view restores).
    if (rawShown) return
    if (!enabled && searchOpen) closeSearch()
    if (!searchOpen) filesTabBtn.toggle(enabled)
    if (!enabled) activateTab('outline')
  }

  renderSide()

  if (needsCharsetCompat(window.location.protocol, configData.charsetCompat)) {
    chrome.runtime.sendMessage(
      { action: 'bgFetch', data: { url: window.location.href } },
      resp => {
        if (chrome.runtime.lastError) return
        if (resp?.ok && typeof resp.text === 'string' && resp.text !== mdRaw) {
          mdRaw = resp.text
          contentRender(mdRaw)
          renderSide()
          setTimeout(() => {
            if (rawContainer) rawContainer.textContent = mdRaw
          }, 0)
        }
      },
    )
  }

  document.addEventListener('scroll', throttle(onScroll, 100))

  /* render raw toggle button */
  const rawToggleBtn = new Ele<HTMLElement>(
    'button',
    {
      className: [className.MD_BUTTON, className.CODE_TOGGLE_BTN],
      title: 'Toggle raw',
    },
    svg(codeIcon),
  )
  function toggleRawView() {
    if (searchOpen) closeSearch()
    const eles: Ele<HTMLElement>[] = [mdBody, mdSide, sideTabs]
    if (filesPanel) eles.push(filesPanel)
    lifecycle.toggleRaw(eles)
    rawShown = !rawShown
    if (!rawShown) {
      // lifecycle.toggleRaw() unconditionally re-shows every panel it was
      // given, so leaving raw view can make mdSide and filesPanel visible at
      // once. Re-run the tab/folder-tree wiring to restore exclusivity.
      setFolderTree(configData.folderTree !== false)
      activateTab(activeTab)
    }
  }
  rawToggleBtn.on('click', () => toggleRawView())

  /* render side expand button */
  const sideExpandBtn = new Ele<HTMLElement>(
    'button',
    {
      className: [className.MD_BUTTON, className.SIDE_EXPAND_BTN],
      title: 'Expand side',
    },
    svg(sideIcon),
  )
  sideExpandBtn.on('click', () => {
    chrome.runtime.sendMessage({
      action: 'storage',
      data: {
        key: 'hiddenSide',
        value: !configData.hiddenSide,
      },
    })
  })
  function onToggleSide() {
    if (window.innerWidth <= 960) {
      const value = document.body.classList.toggle(className.SIDE_EXPANDED)
      mdBody.off('click', foldSide, true)
      window.removeEventListener('resize', foldSide)
      document.removeEventListener('keydown', foldSide)
      if (value) {
        setTimeout(() => {
          mdBody.on('click', foldSide, { capture: true, once: true })
          window.addEventListener('resize', foldSide, { once: true })
          document.addEventListener('keydown', foldSide, { once: true })
        }, 0)
      }
    } else {
      configData.hiddenSide = document.body.classList.toggle(
        className.SIDE_COLLAPSED,
      )
    }
  }
  function foldSide(e: UIEvent) {
    if (e.type === 'keydown' && (e as KeyboardEvent).code !== 'Escape') {
      return
    }
    document.body.classList.remove(className.SIDE_EXPANDED)
    mdBody.off('click', foldSide, true)
    window.removeEventListener('resize', foldSide)
    document.removeEventListener('keydown', foldSide)
    e.stopPropagation()
    e.preventDefault()
    return false
  }
  /* render go top button */
  const goTopBtn = new Ele<HTMLElement>(
    'button',
    {
      className: [className.MD_BUTTON, className.GO_TOP_BTN],
      title: 'Go top',
    },
    svg(goTopIcon),
  )
  goTopBtn.hide()
  goTopBtn.on('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  const buttonWrap = new Ele<HTMLElement>(
    'div',
    { className: className.BUTTON_WRAP_ELE },
    [sideExpandBtn, rawToggleBtn, goTopBtn],
  )

  /* render page-level floating menu（獨立於 buttonWrap：raw 檢視時它借用
   * 的樣式（FLOAT_MENU / FLOAT_MENU_BTN / ...）與 buttonWrap/btn 同放在
   * 未受 body.md-reader 限定的頂層 `.md-reader { }` 區塊，故
   * lifecycle.toggleRaw() 移除 body 的 md-reader class 時不受影響，選單
   * 在 raw 檢視下仍可正常顯示與互動）*/
  const floatMenuBtn = new Ele<HTMLElement>('button', {
    className: [className.MD_BUTTON, className.FLOAT_MENU_BTN],
    title: 'Menu',
  })
  floatMenuBtn.textContent = '≡'

  function floatMenuItem(labelKey: string, onSelect: () => void) {
    const item = new Ele<HTMLElement>('button', {
      className: className.FLOAT_MENU_ITEM,
    })
    item.textContent = localize(labelKey)
    item.on('click', () => {
      closeFloatMenu()
      onSelect()
    })
    return item
  }

  const floatMenuDropdown = new Ele<HTMLElement>(
    'div',
    { className: className.FLOAT_MENU_DROPDOWN },
    [
      floatMenuItem('menu_settings', () =>
        chrome.runtime.sendMessage({ action: 'openOptions' }),
      ),
      floatMenuItem('menu_toggle-raw', () => toggleRawView()),
      floatMenuItem('menu_fullscreen', () => {
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen().catch(() => {})
      }),
      floatMenuItem('menu_print', () => window.print()),
      floatMenuItem('menu_about', () =>
        window.open('https://github.com/swchen44/md-reader-lite'),
      ),
    ],
  )
  floatMenuDropdown.hide()

  const floatMenu = new Ele<HTMLElement>(
    'div',
    { className: className.FLOAT_MENU },
    [floatMenuBtn, floatMenuDropdown],
  )

  let floatMenuOpen = false
  function openFloatMenu() {
    if (floatMenuOpen) return
    floatMenuOpen = true
    floatMenu.classList.add(className.FLOAT_MENU_OPEN)
    floatMenuDropdown.show()
    document.addEventListener('click', onDocClickForFloatMenu, true)
  }
  function closeFloatMenu() {
    if (!floatMenuOpen) return
    floatMenuOpen = false
    floatMenu.classList.remove(className.FLOAT_MENU_OPEN)
    floatMenuDropdown.hide()
    document.removeEventListener('click', onDocClickForFloatMenu, true)
  }
  function onDocClickForFloatMenu(e: MouseEvent) {
    if (!floatMenu.ele.contains(e.target as Node)) closeFloatMenu()
  }
  floatMenuBtn.on('click', e => {
    e.stopPropagation()
    floatMenuOpen ? closeFloatMenu() : openFloatMenu()
  })

  /* mount elements */
  lifecycle.mount([buttonWrap, floatMenu, mdBody, mdSide, sideTabs])
  document.body.classList.add(className.HAS_TABS)
  setFolderTree(configData.folderTree !== false)
  updateAnchorPosition()

  darkMediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
    if (configData.pageTheme === 'auto') {
      applyCodeTheme()
      renderContentByTheme(
        e.matches ? 'light' : 'dark',
        e.matches ? 'dark' : 'light',
      )
    }
  })

  /* auto refresh */
  if (configData.refresh && isNetworkAllowed(configData.offlineMode)) {
    polling()
  }

  function polling() {
    void (function watch() {
      clearTimeout(pollingTimer)
      fetch(window.location.href, { cache: 'no-store' })
        .then(r => (r.ok ? r.text() : undefined))
        .catch(() => undefined)
        .then(res => {
          if (res !== undefined) {
            if (mdRaw === undefined || mdRaw === null) {
              if (res) {
                window.location.reload()
                return
              }
            } else if (mdRaw !== res) {
              mdRaw = res
              contentRender(res)
              renderSide()
              /* update raw content */
              setTimeout(() => {
                rawContainer.textContent = res
              }, 0)
            }
          }
          pollingTimer = setTimeout(
            watch,
            clampRefreshInterval(configData.refreshInterval) * 1000,
          )
        })
    })()
  }

  function renderSide() {
    idCache = Object.create(null)
    headElements = getHeads(mdContent)
    df = new Ele<DocumentFragment>('#document-fragment')
    sideLiElements = headElements.reduce(handleHeadItem, [])
    mdSide.innerHTML = null
    mdSide.append(df)
    setTimeout(onScroll, 0)
  }

  function handleHeadItem(
    eleList: HTMLElement[],
    head: HTMLElement,
    index: number,
  ): HTMLElement[] {
    const content = String(head.textContent).trim()
    const encodeContent = getDecodeContent(content)

    head.setAttribute('id', encodeContent)

    const headAnchor = new Ele<HTMLElement>('a', {
      className: className.HEAD_ANCHOR,
      href: `#${encodeContent}`,
    })
    headAnchor.textContent = '#'
    head.insertBefore(headAnchor.ele, head.firstChild)

    const link = new Ele<HTMLElement>('a', {
      title: content,
      href: `#${encodeContent}`,
    })
    link.textContent = content
    const li = new Ele<HTMLElement>('li', {
      className: `${className.MD_SIDE}-${head.tagName.toLowerCase()}`,
    })
    eleList.push(li.ele)

    if (configData.outlineCollapse && hasDeeperFollowing(index)) {
      const fold = new Ele<HTMLElement>('span', {
        className: className.SIDE_FOLD,
      })
      fold.ele.setAttribute('aria-expanded', 'true')
      fold.on('click', e => {
        e.preventDefault()
        e.stopPropagation()
        toggleOutlineFold(fold.ele, index)
      })
      li.append(fold)
    }

    li.append(link)
    df.append(li.ele)

    return eleList
  }

  function headLevel(head: HTMLElement): number {
    return Number(head.tagName[1])
  }

  // 是否其後緊接的標題層級更深（有子標題）：headElements 依文件順序排列，
  // 若下一個標題層級更深即代表存在巢狀子項；若層級相同或更淺，中間不可能
  // 夾帶更深層級的標題（那樣它自己就會是「下一個」），故只需檢查緊鄰的下一項。
  function hasDeeperFollowing(index: number): boolean {
    const next = headElements[index + 1]
    return !!next && headLevel(next) > headLevel(headElements[index])
  }

  // 展開父層＝展開其後所有更深層級的 li 並重置其內巢狀箭頭為展開狀態，
  // 避免「父層展開、子層仍顯示收合殘影」的不一致狀態；收合則單純隱藏。
  function toggleOutlineFold(foldEle: HTMLElement, index: number) {
    const level = headLevel(headElements[index])
    const expanding = foldEle.getAttribute('aria-expanded') !== 'true'
    for (let i = index + 1; i < headElements.length; i++) {
      if (headLevel(headElements[i]) <= level) break
      const descLi = sideLiElements[i]
      if (!descLi) continue
      if (expanding) {
        descLi.style.display = ''
        const nestedFold = descLi.querySelector(
          `.${className.SIDE_FOLD}`,
        ) as HTMLElement | null
        nestedFold?.setAttribute('aria-expanded', 'true')
      } else {
        descLi.style.display = 'none'
      }
    }
    foldEle.setAttribute('aria-expanded', expanding ? 'true' : 'false')
  }

  function getDecodeContent(content: string): string {
    return (function unique(key: string): string {
      if (key in idCache) {
        return unique(`${key}-${idCache[key]++}`)
      } else {
        idCache[key] = 1
        return key
      }
    })(encodeURIComponent(content.toLowerCase().replace(/\s+/g, '-')))
  }

  function onScroll() {
    const documentScrollTop = document.documentElement.scrollTop
    goTopBtn.toggle(documentScrollTop >= 640)

    headElements.some((_, index) => {
      let sectionHeight = -20
      const item = headElements[index + 1]
      if (item) {
        sectionHeight += item.offsetTop
      }

      const hit = sectionHeight <= 0 || sectionHeight > documentScrollTop

      if (hit && (targetIndex !== index || reloading)) {
        let target = sideLiElements[targetIndex]
        target && target.classList.remove(className.MD_SIDE_ACTIVE)

        target = sideLiElements[(targetIndex = index)]
        if (target) {
          target.classList.add(className.MD_SIDE_ACTIVE)
          if (!isSideHover && target.scrollIntoView) {
            target.scrollIntoView({ block: 'nearest' })
          }
        }
      }
      return hit
    })
  }

  function renderContentByTheme(theme: Theme, prevTheme: Theme) {
    if (configData.mdPlugins.includes('Mermaid')) {
      if (theme === 'auto' || prevTheme === 'auto') {
        const themeScheme = getMediaQueryTheme()
        if (theme !== themeScheme && prevTheme !== themeScheme) {
          contentRender(mdRaw)
          renderSide()
        }
      } else {
        contentRender(mdRaw)
        renderSide()
      }
    }
  }

  function updateAnchorPosition() {
    if (window.location.hash) {
      setTimeout(() => {
        const hash = window.location.hash.slice(1)
        const target = headElements.find(head => {
          return head.getAttribute('id') === hash
        })
        if (target) {
          const top = target.offsetTop
          top && window.scrollTo(0, top)
        }
      })
    }
  }
}

storage.get().then(main)
