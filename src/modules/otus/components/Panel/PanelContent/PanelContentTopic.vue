<template>
  <section class="ct-topic">
    <VCardHeader class="ct-head">
      <h2 class="text-md">{{ title }}</h2>
    </VCardHeader>
    <VCardContent class="text-sm">
      <!-- citations in the text open the full reference here, instead of a broken link -->
      <div
        v-for="(text, index) in textList"
        :key="index"
        class="ct-text panel-content-list"
        @click="onClick"
        v-html="text"
      />

      <div
        v-if="open"
        class="ct-card"
      >
        <p
          v-if="!sources[open]"
          class="opacity-60"
        >
          Loading…
        </p>
        <ul v-else>
          <PanelReferenceRow :reference="sources[open]" />
        </ul>
        <button
          type="button"
          class="ct-close"
          aria-label="Close"
          @click="open = null"
        >
          ×
        </button>
      </div>

      <!-- every reference cited in this topic -->
      <details
        v-if="ids.length"
        class="ct-refs"
        @toggle="loadAll"
      >
        <summary>
          <span>References cited</span><span class="ct-count">{{ ids.length }}</span>
        </summary>
        <ul>
          <template
            v-for="id in ids"
            :key="id"
          >
            <PanelReferenceRow
              v-if="sources[id]"
              :reference="sources[id]"
            />
          </template>
        </ul>
      </details>
    </VCardContent>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import PanelReferenceRow from '../PanelNomenclatureReferences/PanelReferenceRow.vue'

const props = defineProps({
  title: { type: String, required: true },
  textList: { type: Array, required: true }
})

const SOURCE_RE = /\/sources\/(\d+)/
const open = ref(null)
const sources = ref({})

// the sources cited in the text, in order of first appearance
const ids = computed(() => {
  const out = []
  for (const t of props.textList) {
    for (const m of String(t).matchAll(/href="[^"]*\/sources\/(\d+)"/g)) if (!out.includes(m[1])) out.push(m[1])
  }
  return out
})

const linkify = (html = '') =>
  html.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')

async function loadSource(id) {
  if (sources.value[id]) return
  try {
    const { data } = await makeAPIRequest.get(`/sources/${id}`)
    sources.value = { ...sources.value, [id]: linkify(data.cached || data.object_tag || '') }
  } catch {
    sources.value = { ...sources.value, [id]: `Reference ${id}` }
  }
}

function loadAll(e) {
  if (e.target.open) ids.value.forEach(loadSource)
}

function onClick(e) {
  const a = e.target.closest('a')
  const m = a && (a.getAttribute('href') || '').match(SOURCE_RE)
  if (!m) return
  e.preventDefault()
  open.value = open.value === m[1] ? null : m[1]
  if (open.value) loadSource(open.value)
}
</script>

<style>
.panel-content-list ul {
  margin: 1rem 0;
  list-style: disc;
  margin-left: 1rem;
}
.panel-content-list ol {
  list-style-type: decimal;
  margin-left: 1rem;
}
</style>

<style scoped>
.ct-topic + .ct-topic .ct-head {
  border-top: 1px solid rgba(var(--color-base-muted), 0.9);
}
.ct-text {
  line-height: 1.65;
}
.ct-text + .ct-text {
  margin-top: 0.6rem;
}
.ct-text :deep(p + p) {
  margin-top: 0.6rem;
}
/* citations look like the ones in Nomenclature */
.ct-text :deep(a[href*='/sources/']) {
  color: inherit;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: rgba(var(--color-primary), 0.55);
  text-underline-offset: 3px;
  cursor: pointer;
}
.ct-text :deep(a[href*='/sources/']:hover) {
  color: rgb(var(--color-primary));
  text-decoration-style: solid;
}
.ct-card {
  position: relative;
  margin-top: 0.6rem;
  border-radius: 0.4rem;
  border-left: 3px solid rgb(var(--color-primary));
  background: rgba(var(--color-primary), 0.05);
  font-size: 0.85rem;
}
.ct-card > p {
  padding: 0.6rem 1rem;
}
.ct-card :deep(li) {
  border-bottom: 0;
  padding-right: 2rem;
}
.ct-close {
  position: absolute;
  top: 0.25rem;
  right: 0.5rem;
  font-size: 1.1rem;
  line-height: 1;
  opacity: 0.6;
}
.ct-close:hover {
  opacity: 1;
}
.ct-refs {
  margin-top: 0.8rem;
  font-size: 0.85rem;
}
.ct-refs summary {
  cursor: pointer;
  font-weight: 600;
}
.ct-refs ul {
  margin-top: 0.3rem;
  border-top: 1px solid rgba(var(--color-base-muted), 0.9);
}
.ct-refs :deep(li) {
  padding-left: 0;
  padding-right: 0;
}
.ct-count {
  margin-left: 0.2rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  background: rgba(var(--color-base-muted), 0.8);
}
</style>
