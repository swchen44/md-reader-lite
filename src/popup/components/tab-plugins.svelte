<script lang="ts">
  import Chip, { Set, Text } from '@smui/chips'
  import MD_PLUGINS from '@/config/md-plugins'
  import type { Data } from '@/core/data'

  export let data: Data
  export let localize: (field: string) => string
  export let updateConfig: (key: string, value: any) => void

  $: allSelected = data.mdPlugins.length === MD_PLUGINS.length

  function toggleAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked
    data.mdPlugins = checked ? [...MD_PLUGINS] : []
    updateConfig('mdPlugins', data.mdPlugins)
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
