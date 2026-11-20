<template>
  <div
    v-if="latest"
    class="wid-release-banner"
  >
    <div class="container mx-auto px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs">
      <span>
        Data release <b>{{ latest.version }}</b> · {{ fmtDate(latest.date) }}
      </span>
      <a
        v-if="latest.doi"
        :href="doiUrl(latest.doi)"
        target="_blank"
        rel="noopener"
        class="underline underline-offset-2"
        >doi:{{ latest.doi }}</a
      >
      <RouterLink
        to="/releases"
        class="font-semibold underline underline-offset-2"
        >What's in it →</RouterLink
      >
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { doiUrl, fmtDate, useReleases } from './useReleases.js'

const releases = useReleases()
const latest = computed(() => releases.value?.[0] || null)
</script>

<style scoped>
.wid-release-banner {
  background: rgb(var(--color-primary, 31 58 104) / 0.08);
  border-bottom: 1px solid rgb(var(--color-base-border, 220 220 220));
}
</style>
