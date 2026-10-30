<template>
  <label
    class="tp-language relative inline-flex items-center gap-1.5 cursor-pointer"
    data-no-i18n
  >
    <svg
      class="size-4 shrink-0 pointer-events-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9s1.3-6.4 3.8-9z" />
    </svg>
    <span class="sr-only">Language / Lingua / Idioma</span>
    <select
      class="tp-language-select appearance-none bg-transparent border-0 p-0 pr-4 text-sm font-medium cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
      :value="locale"
      title="Language"
      @change="setLocale($event.target.value)"
    >
      <option
        v-for="l in LANGUAGES"
        :key="l.code"
        :value="l.code"
        :lang="l.code"
      >
        {{ short ? l.code.toUpperCase() : l.label }}
      </option>
    </select>
    <svg
      class="size-3 absolute right-0 pointer-events-none"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.2 7.5 10 12.3l4.8-4.8 1.1 1.1L10 14.5 4.1 8.6z" />
    </svg>
  </label>
</template>

<script setup>
import { LANGUAGES, locale, setLocale } from '@/i18n'

defineProps({
  // show EN / IT / ES / PT instead of the full names
  short: { type: Boolean, default: false }
})
</script>

<style scoped>
.tp-language-select option {
  color: #111;
  background: #fff;
}
</style>
