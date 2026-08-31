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

  storage.get().then((_data: Data) => {
    // need an assignment to updata UI
    data = { ...data, ..._data }
    // harden against partial/legacy mdPluginOptions missing Linkify/Alert
    data.mdPluginOptions = mergePluginOptions(data.mdPluginOptions)
    data = data
  })

  $: if (data.language) {
    updateConfig('language', data.language)
    changeLocale(data.language)
  }

  function updateConfig(key, value) {
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'storage', data: { key, value } })
    }, 0)
  }

  function changeLocale(language) {
    localize = i18n(language)
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
