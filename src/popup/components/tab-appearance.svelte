<script lang="ts">
  import FormField from '@smui/form-field'
  import Switch from '@smui/switch'
  import Radio from '@smui/radio'
  import Select, { Option } from '@smui/select'
  import PAGE_THEMES from '@/config/page-themes'
  import { CUSTOM_CSS_PRESETS } from '@/config/custom-css-presets'
  import type { Data } from '@/core/data'
  import {
    TEXT_SIZES,
    FONT_STACKS,
    CUSTOM_WIDTH_MIN,
    CUSTOM_WIDTH_MAX,
    CUSTOM_WIDTH_PERCENT_MIN,
    CUSTOM_WIDTH_PERCENT_MAX,
    textSizeIndex,
    clampCustomWidthValue,
  } from '@/core/settings'

  export let data: Data
  export let localize: (field: string) => string
  export let updateConfig: (key: string, value: any) => void

  const CODE_THEMES = ['light', 'dark'] as const
  const FONT_KEYS = Object.keys(FONT_STACKS)
  const DEFAULT_CUSTOM_WIDTH = 800
  const WIDTH_UNITS = ['px', 'percent'] as const

  let customCssDraft = data.customCss || ''
  let cssPresetId = ''

  $: widthMin =
    data.customWidthUnit === 'percent'
      ? CUSTOM_WIDTH_PERCENT_MIN
      : CUSTOM_WIDTH_MIN
  $: widthMax =
    data.customWidthUnit === 'percent'
      ? CUSTOM_WIDTH_PERCENT_MAX
      : CUSTOM_WIDTH_MAX

  // Pure display mapping (slider value -> index); no side effect, so this
  // stays reactive rather than event-driven.
  $: sizeIndex = textSizeIndex(data.textSize)

  // SMUI's Select dispatches a native 'MDCSelect:change' DOM event only on
  // user-driven selection changes (see @smui/select's Select.svelte
  // notifyChange), so we can bind that directly instead of using a
  // reactive block that would also fire on mount and on unrelated field
  // changes elsewhere in this component.
  function onTextFontChange(e: CustomEvent<{ value: string; index: number }>) {
    updateConfig('textFont', e.detail.value)
  }

  function onTextSizeChange(e: Event) {
    const idx = Number((e.target as HTMLInputElement).value)
    data.textSize = TEXT_SIZES[idx]
    updateConfig('textSize', data.textSize)
  }

  function defaultCustomWidthForUnit(unit: 'px' | 'percent'): number {
    return unit === 'percent' ? 100 : DEFAULT_CUSTOM_WIDTH
  }

  function onCustomWidthToggle(e: Event) {
    const checked = (e.target as HTMLInputElement).checked
    data.customWidth = checked
      ? clampCustomWidthValue(data.customWidth, data.customWidthUnit) ??
        defaultCustomWidthForUnit(data.customWidthUnit)
      : null
    updateConfig('customWidth', data.customWidth)
  }

  function onCustomWidthBlur() {
    data.customWidth = clampCustomWidthValue(
      data.customWidth,
      data.customWidthUnit,
    )
    updateConfig('customWidth', data.customWidth)
  }

  function onWidthUnitChange(unit: 'px' | 'percent') {
    data.customWidthUnit = unit
    updateConfig('customWidthUnit', unit)
    data.customWidth = clampCustomWidthValue(data.customWidth, unit)
    updateConfig('customWidth', data.customWidth)
  }

  function applyCustomCss() {
    data.customCss = customCssDraft
    updateConfig('customCss', data.customCss)
  }

  function onCssPresetChange(e: CustomEvent<{ value: string; index: number }>) {
    const preset = CUSTOM_CSS_PRESETS.find((p) => p.id === e.detail.value)
    if (preset) customCssDraft = preset.css
  }
</script>

<div class="form-item inline">
  <span class="label-item">{localize('label_centered')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.centered}
      color="primary"
      on:change={() => updateConfig('centered', data.centered)}
    />
  </FormField>
</div>

<div class="form-item">
  <div class="label-item">{localize('label_theme')}:</div>
  {#each PAGE_THEMES as mode}
    <FormField>
      <span slot="label"> {localize(mode)} </span>
      <Radio
        disabled={!data.enable}
        bind:group={data.pageTheme}
        bind:value={mode}
        on:change={() => updateConfig('pageTheme', mode)}
      />
    </FormField>
  {/each}
</div>

<div class="form-item">
  <div class="label-item">{localize('label_text-size')}:</div>
  <input
    type="range"
    min="0"
    max="5"
    step="1"
    disabled={!data.enable}
    value={sizeIndex}
    on:change={onTextSizeChange}
  />
  <span class="range-value">{data.textSize}px</span>
</div>

<div class="form-item">
  <div class="label-item">{localize('label_text-font')}:</div>
  <FormField style="padding-left: 10px">
    <Select
      bind:value={data.textFont}
      disabled={!data.enable}
      on:MDCSelect:change={onTextFontChange}
    >
      {#each FONT_KEYS as key}
        <Option value={key}>{localize(`font_${key}`)}</Option>
      {/each}
    </Select>
  </FormField>
</div>

<div class="form-item">
  <div class="label-item">{localize('label_code-theme-day')}:</div>
  {#each CODE_THEMES as mode}
    <FormField>
      <span slot="label"> {localize(mode)} </span>
      <Radio
        disabled={!data.enable}
        bind:group={data.codeBlockDayTheme}
        bind:value={mode}
        on:change={() => updateConfig('codeBlockDayTheme', mode)}
      />
    </FormField>
  {/each}
</div>

<div class="form-item">
  <div class="label-item">{localize('label_code-theme-night')}:</div>
  {#each CODE_THEMES as mode}
    <FormField>
      <span slot="label"> {localize(mode)} </span>
      <Radio
        disabled={!data.enable}
        bind:group={data.codeBlockNightTheme}
        bind:value={mode}
        on:change={() => updateConfig('codeBlockNightTheme', mode)}
      />
    </FormField>
  {/each}
</div>

<div class="form-item inline">
  <span class="label-item">{localize('label_code-wrap')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.codeWrap}
      color="primary"
      on:change={() => updateConfig('codeWrap', data.codeWrap)}
    />
  </FormField>
</div>

{#if data.centered}
  <div class="form-item inline">
    <span class="label-item">{localize('label_custom-width')}:</span>
    <FormField align="end">
      <Switch
        disabled={!data.enable}
        checked={data.customWidth != null}
        color="primary"
        on:change={onCustomWidthToggle}
      />
    </FormField>
  </div>
  {#if data.customWidth != null}
    <div class="form-item inline">
      <input
        type="number"
        min={widthMin}
        max={widthMax}
        disabled={!data.enable}
        bind:value={data.customWidth}
        on:blur={onCustomWidthBlur}
      />
      <span class="unit-label">{localize('label_width-unit')}:</span>
      {#each WIDTH_UNITS as unit}
        <FormField>
          <span slot="label"> {localize(`unit_${unit}`)} </span>
          <Radio
            disabled={!data.enable}
            bind:group={data.customWidthUnit}
            bind:value={unit}
            on:change={() => onWidthUnitChange(unit)}
          />
        </FormField>
      {/each}
    </div>
  {/if}
{/if}

<div class="form-item">
  <div class="label-item">{localize('label_custom-css-preset')}:</div>
  <FormField style="padding-left: 10px">
    <Select
      bind:value={cssPresetId}
      disabled={!data.enable}
      on:MDCSelect:change={onCssPresetChange}
    >
      <Option value="">{localize('custom-css-preset_none')}</Option>
      {#each CUSTOM_CSS_PRESETS as preset}
        <Option value={preset.id}>
          {localize(`custom-css-preset_${preset.id}`)}
        </Option>
      {/each}
    </Select>
  </FormField>
</div>

<div class="form-item">
  <div class="label-item">{localize('label_custom-css')}:</div>
  <textarea
    disabled={!data.enable}
    bind:value={customCssDraft}
    placeholder="/* custom CSS */"
  ></textarea>
  <button
    type="button"
    class="btn-apply"
    disabled={!data.enable}
    on:click={applyCustomCss}
  >
    {localize('label_apply')}
  </button>
</div>

<style>
  .range-value {
    margin-left: 8px;
    font-size: 12px;
    color: #243158a3;
  }
  .unit-label {
    margin-left: 10px;
    font-size: 12px;
    color: #243158a3;
  }
</style>
