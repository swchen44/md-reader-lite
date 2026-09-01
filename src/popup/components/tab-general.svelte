<script lang="ts">
  import FormField from '@smui/form-field'
  import Switch from '@smui/switch'
  import Select, { Option } from '@smui/select'
  import storage from '@/core/storage'
  import { getDefaultData, type Data } from '@/core/data'
  import {
    clampRefreshInterval,
    REFRESH_INTERVAL_MIN,
    REFRESH_INTERVAL_MAX,
  } from '@/core/settings'
  import i18n from '@/config/i18n'

  export let data: Data
  export let localize: (field: string) => string
  export let updateConfig: (key: string, value: any) => void

  let resetConfirming = false
  let resetDone = false
  let resetTimer: ReturnType<typeof setTimeout> | null = null

  function clearLocalStorage(): Promise<void> {
    return new Promise<void>(resolve => {
      chrome.storage.local.clear(() => resolve())
    })
  }

  function onResetClick() {
    resetDone = false
    if (!resetConfirming) {
      resetConfirming = true
      resetTimer = setTimeout(() => {
        resetConfirming = false
      }, 3000)
      return
    }
    if (resetTimer) clearTimeout(resetTimer)
    resetConfirming = false
    doReset()
  }

  async function doReset() {
    await clearLocalStorage()
    const defaults = getDefaultData()
    await storage.set(defaults)
    chrome.runtime.sendMessage({
      action: 'storage',
      data: { key: 'enable', value: true },
    })
    data = defaults
    resetDone = true
  }

  function onRefreshIntervalBlur() {
    data.refreshInterval = clampRefreshInterval(data.refreshInterval)
    updateConfig('refreshInterval', data.refreshInterval)
  }
</script>

<div class="form-item inline">
  <span class="label-item">{localize('label_enable')}:</span>
  <FormField align="end">
    <Switch
      bind:checked={data.enable}
      color="primary"
      on:change={() => updateConfig('enable', data.enable)}
    />
  </FormField>
</div>

<div class="form-item inline">
  <span class="label-item">{localize('label_auto-refresh')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.refresh}
      color="primary"
      on:change={() => updateConfig('refresh', data.refresh)}
    />
  </FormField>
</div>

{#if data.refresh}
  <div class="form-item inline">
    <span class="label-item">{localize('label_refresh-interval')}:</span>
    <input
      type="number"
      min={REFRESH_INTERVAL_MIN}
      max={REFRESH_INTERVAL_MAX}
      step="0.5"
      disabled={!data.enable}
      bind:value={data.refreshInterval}
      on:blur={onRefreshIntervalBlur}
    />
  </div>
{/if}

<div class="form-item inline">
  <span class="label-item">{localize('label_breaks')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.breaks}
      color="primary"
      on:change={() => updateConfig('breaks', data.breaks)}
    />
  </FormField>
</div>
<div class="hint-item">{localize('hint_reload')}</div>

<div class="form-item inline">
  <span class="label-item">{localize('label_txt-as-md')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.txtAsMd}
      color="primary"
      on:change={() => updateConfig('txtAsMd', data.txtAsMd)}
    />
  </FormField>
</div>
<div class="hint-item">{localize('hint_reload')}</div>

<div class="form-item inline">
  <span class="label-item">{localize('label_folder-tree')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.folderTree}
      color="primary"
      on:change={() => updateConfig('folderTree', data.folderTree)}
    />
  </FormField>
</div>

<div class="form-item inline">
  <span class="label-item">{localize('label_outline-collapse')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.outlineCollapse}
      color="primary"
      on:change={() => updateConfig('outlineCollapse', data.outlineCollapse)}
    />
  </FormField>
</div>
<div class="hint-item">{localize('hint_reload')}</div>

<div class="form-item inline">
  <span class="label-item">{localize('label_charset-compat')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.charsetCompat}
      color="primary"
      on:change={() => updateConfig('charsetCompat', data.charsetCompat)}
    />
  </FormField>
</div>
<div class="hint-item">{localize('hint_charset')}</div>

<div class="form-item">
  <div class="label-item">{localize('label_language')}:</div>
  <FormField style="padding-left: 10px">
    <Select bind:value={data.language}>
      {#each i18n.locales as locale}
        <Option value={locale}>{localize(locale)}</Option>
      {/each}
    </Select>
  </FormField>
</div>

<div class="form-item reset-row">
  <button
    type="button"
    class="btn-reset"
    class:danger={resetConfirming}
    on:click={onResetClick}
  >
    {resetConfirming ? localize('label_reset-confirm') : localize('label_reset')}
  </button>
  {#if resetDone}
    <div class="hint-item">{localize('hint_reset-done')}</div>
  {/if}
</div>

<style>
  .reset-row {
    margin-top: 10px;
  }
</style>
