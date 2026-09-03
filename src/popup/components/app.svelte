<script lang="ts">
  import storage from '@/core/storage'
  import Warning from './warning.svelte'
  import Header from './header.svelte'
  import TabGeneral from './tab-general.svelte'
  import TabAppearance from './tab-appearance.svelte'
  import TabPlugins from './tab-plugins.svelte'
  import { getDefaultData, type Data } from '@/core/data'
  import { mergePluginOptions } from '@/core/plugin-options'
  import pkg from '../../../package.json'
  import i18n from '@/config/i18n'

  type Tab = 'general' | 'appearance' | 'plugins'

  let localize = i18n()
  let homepage = pkg.homepage
  let isAllowViewFile = true
  let data = getDefaultData()
  let activeTab: Tab = 'general'

  // Get if file allowed access
  chrome.extension.isAllowedFileSchemeAccess(
    (isAllow: boolean) => (isAllowViewFile = !!isAllow),
  )

  // Tracks what we know is already persisted, so updateConfig can no-op when
  // a value round-trips back to itself. Needed because SMUI's <Select> fires
  // MDCSelect:change as a side effect of `bind:value` being programmatically
  // set (e.g. when storage.get() below loads the saved language into the
  // dropdown) — without this guard that spurious event re-sends the same
  // language, which background.ts maps to a page reload, instantly closing
  // the settings overlay the user just opened ("設定頁一閃即逝").
  let persisted: Partial<Data> = {}

  storage.get().then((_data: Data) => {
    // need an assignment to updata UI
    data = { ...data, ..._data }
    // harden against partial/legacy mdPluginOptions missing Linkify/Alert
    data.mdPluginOptions = mergePluginOptions(data.mdPluginOptions)
    data = data
    persisted = { ...persisted, ...data }
  })

  // Pure reactive re-localization: no side effect. Persistence of `language`
  // is event-driven in tab-general's Select (on:MDCSelect:change), so this must
  // NOT call updateConfig (which previously fired on every unrelated data change).
  $: localize = i18n(data.language || i18n().locale)

  function updateConfig(key, value) {
    if (persisted[key] === value) return
    persisted[key] = value
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'storage', data: { key, value } })
    }, 0)
  }
</script>

<main>
  <Header {homepage} />

  {#if !isAllowViewFile}
    <Warning {localize} />
  {/if}

  <div class="tabs">
    <button
      type="button"
      class="tab-btn"
      class:active={activeTab === 'general'}
      on:click={() => (activeTab = 'general')}
    >
      {localize('tab_general')}
    </button>
    <button
      type="button"
      class="tab-btn"
      class:active={activeTab === 'appearance'}
      on:click={() => (activeTab = 'appearance')}
    >
      {localize('tab_appearance')}
    </button>
    <button
      type="button"
      class="tab-btn"
      class:active={activeTab === 'plugins'}
      on:click={() => (activeTab = 'plugins')}
    >
      {localize('tab_plugins')}
    </button>
  </div>

  <div class="form" disabled={!data.enable}>
    {#if activeTab === 'general'}
      <TabGeneral bind:data {localize} {updateConfig} />
    {:else if activeTab === 'appearance'}
      <TabAppearance bind:data {localize} {updateConfig} />
    {:else}
      <TabPlugins bind:data {localize} {updateConfig} />
    {/if}
  </div>
</main>

<style>
  main {
    overflow: auto;
    box-sizing: border-box;
    width: 360px;
    max-height: 599px;
    padding: 22px 24px 10px;
    border: 1px solid #24315870;
    border-radius: 1px;
  }
  .tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
    border-bottom: 1px solid #24315824;
  }
  .tab-btn {
    flex: 1;
    padding: 8px 4px;
    font-size: 13px;
    font-weight: bolder;
    color: #243158a3;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .tab-btn:hover {
    color: #243158e3;
  }
  .tab-btn.active {
    color: #607cd2;
    border-bottom-color: #607cd2;
  }
</style>
