<script lang="ts">
  import Chip, { Set, Text } from '@smui/chips'
  import FormField from '@smui/form-field'
  import Switch from '@smui/switch'
  import MD_PLUGINS from '@/config/md-plugins'
  import type { Data } from '@/core/data'
  import { normalizePlantumlServer } from '@/core/plantuml'

  export let data: Data
  export let localize: (field: string) => string
  export let updateConfig: (key: string, value: any) => void

  $: allSelected = data.mdPlugins.length === MD_PLUGINS.length

  function toggleAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked
    data.mdPlugins = checked ? [...MD_PLUGINS] : []
    updateConfig('mdPlugins', data.mdPlugins)
  }

  // bind:checked updates data.mdPluginOptions.* synchronously before
  // on:change fires (same convention as the Switch controls in
  // tab-appearance.svelte), so on:change simply pushes the already-updated
  // object to storage.
  function onMdPluginOptionsChange() {
    updateConfig('mdPluginOptions', data.mdPluginOptions)
  }

  function onPlantumlServerBlur() {
    data.plantumlServer = normalizePlantumlServer(data.plantumlServer)
    updateConfig('plantumlServer', data.plantumlServer)
  }
</script>

<div class="form-item inline">
  <span class="label-item">{localize('label_all-plugins')}:</span>
  <input
    type="checkbox"
    disabled={!data.enable}
    checked={allSelected}
    on:change={toggleAll}
  />
</div>

<div class="form-item">
  <div class="label-item">{localize('label_md-plugins')}:</div>
  <Set
    let:chip
    bind:selected={data.mdPlugins}
    chips={MD_PLUGINS}
    nonInteractive={!data.enable}
    filter={data.enable}
  >
    <Chip
      {chip}
      title={chip}
      on:click={() =>
        data.enable && updateConfig('mdPlugins', data.mdPlugins)}
      ><Text>{localize(chip)}</Text></Chip
    >
  </Set>
</div>

<div class="form-item">
  <div class="label-item">{localize('label_plugin-options')}:</div>

  <div class="sub-label">{localize('label_linkify')}</div>
  <div class="form-item inline">
    <span class="label-item">{localize('label_fuzzy-link')}:</span>
    <FormField align="end">
      <Switch
        disabled={!data.enable}
        bind:checked={data.mdPluginOptions.Linkify.fuzzyLink}
        color="primary"
        on:change={onMdPluginOptionsChange}
      />
    </FormField>
  </div>
  <div class="form-item inline">
    <span class="label-item">{localize('label_fuzzy-ip')}:</span>
    <FormField align="end">
      <Switch
        disabled={!data.enable}
        bind:checked={data.mdPluginOptions.Linkify.fuzzyIP}
        color="primary"
        on:change={onMdPluginOptionsChange}
      />
    </FormField>
  </div>
  <div class="form-item inline">
    <span class="label-item">{localize('label_fuzzy-email')}:</span>
    <FormField align="end">
      <Switch
        disabled={!data.enable}
        bind:checked={data.mdPluginOptions.Linkify.fuzzyEmail}
        color="primary"
        on:change={onMdPluginOptionsChange}
      />
    </FormField>
  </div>

  <div class="sub-label">{localize('Alert')}</div>
  <div class="form-item inline">
    <span class="label-item">{localize('label_alert-deep')}:</span>
    <FormField align="end">
      <Switch
        disabled={!data.enable}
        bind:checked={data.mdPluginOptions.Alert.deep}
        color="primary"
        on:change={onMdPluginOptionsChange}
      />
    </FormField>
  </div>
</div>

<div class="form-item inline">
  <span class="label-item">{localize('label_plantuml')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable || data.offlineMode}
      bind:checked={data.plantumlEnabled}
      color="primary"
      on:change={() => updateConfig('plantumlEnabled', data.plantumlEnabled)}
    />
  </FormField>
</div>
{#if data.offlineMode}
  <div class="hint-item">{localize('hint_offline-disabled')}</div>
{/if}

<div class="form-item">
  <div class="label-item">{localize('label_plantuml-server')}:</div>
  <input
    type="text"
    class="plantuml-server-input"
    disabled={!data.enable || data.offlineMode || !data.plantumlEnabled}
    bind:value={data.plantumlServer}
    on:blur={onPlantumlServerBlur}
  />
</div>
<div class="hint-item">{localize('warn_plantuml')}</div>
<div class="hint-item plantuml-help">
  {localize('label_plantuml-help')}:
  <a
    href="https://github.com/swchen44/md-reader-lite/blob/main/docs/plantuml-server-setup.zh-TW.md"
    target="_blank"
    rel="noopener">中文</a
  >
  /
  <a
    href="https://github.com/swchen44/md-reader-lite/blob/main/docs/plantuml-server-setup.md"
    target="_blank"
    rel="noopener">English</a
  >
</div>

<style>
  .plantuml-server-input {
    width: 100%;
    padding: 4px 6px;
    box-sizing: border-box;
    font-size: 13px;
    border: 1px solid #24315840;
    border-radius: 4px;
  }
  .sub-label {
    margin-top: 8px;
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: bolder;
    color: #243158a3;
  }
</style>
