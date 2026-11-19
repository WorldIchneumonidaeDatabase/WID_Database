<template>
  <li class="nomen-row border-b border-base-muted p-3 px-5">
    <div class="nomen-main">
      <!-- One line: the name in dark ink, then the reference in grey (click it for the full reference) -->
      <div class="break-words">
      <span
        class="nomen-name"
        v-html="parts.name"
      />
      <span
        v-if="parts.ref"
        class="nomen-source"
      >
        {{ ' ' }}<span v-if="parts.inWord">in </span>
        <button
          v-if="source"
          type="button"
          class="citation-toggle"
          :title="hoverText"
          :aria-expanded="open"
          @click="open = !open"
        >
          <span
            class="citation-ref-text"
            v-html="refSplit.ref"
          /><span
            class="citation-chevron"
            :class="{ open }"
            aria-hidden="true"
            >›</span
          >
        </button>
        <span
          v-else
          v-html="refSplit.ref"
        />
        <span
          v-for="t in shownTopics"
          :key="t"
          class="nomen-topic"
          >{{ t }}</span
        >
      </span>
      </div>
      <p
        v-if="typeLine"
        class="nomen-type"
      >
        <span class="nomen-type-label">{{ typeLine.isSpecies ? 'Type' : 'Type species' }}</span>
        <span v-if="typeLine.status">{{ typeLine.status }}</span>
        <span v-html="typeLine.html" />
      </p>
      <div
        v-if="source && open"
        class="citation-ref mt-2"
      >
        <span
          class="[&>a]:break-all block"
          v-html="source.html"
        />
        <RequestPdfButton
          :citation="source.html"
          compact
          class="mt-1"
        />
      </div>
    </div>
    <!-- What this entry is, on the right -->
    <span
      v-if="kind"
      :class="['nomen-kind', `nomen-kind--${kind.tone}`]"
      :title="kind.help"
      >{{ kind.text }}</span
    >
  </li>
</template>

<script setup>
import { ref, computed } from 'vue'
import { stripHTML } from '../../../utils'
import { useOtuStore } from '@/modules/otus/store/store'
import { shortTypeLabel } from '../PanelTypeSpecimen/parseTypeLabel'
import { splitLabel, splitRef, entryKind } from './nomenEntry'

const props = defineProps({
  citation: {
    type: Object,
    required: true
  }
})

const store = useOtuStore()
const open = ref(false)

const source = computed(() => store.catalog.sourceById?.[props.citation.source_id])

const parts = computed(() => splitLabel(props.citation))
const refSplit = computed(() => splitRef(parts.value.ref || ''))
// Topics already shown as the tag are not repeated
const shownTopics = computed(() =>
  refSplit.value.topics.filter((t) => t.toLowerCase() !== kind.value?.text.toLowerCase())
)

// The type, compact: "Lectotype ♀ · ANSP926 · ANSP" for species; type species as given for genera
const typeLine = computed(() => {
  const t = String(props.citation.type_label || '').trim()
  if (!t) return null
  if (/^type species/i.test(t)) return { isSpecies: false, html: t.replace(/^type species\s*/i, '') }
  const short = shortTypeLabel(t) // "Lectotype ♀ · ANSP926 · ANSP"
  const status = short.match(/^[A-Za-z]+/)?.[0] || ''
  return { isSpecies: true, status, html: short.slice(status.length) }
})

// What this entry is, shown as a small tag on the right
const kind = computed(() => entryKind(props.citation, store.catalog.timeline || []))

// Hover: the paper itself, e.g. "Cameron, P. (1905) A third contribution to … Sarawak. Journal of …"
const hoverText = computed(() =>
  stripHTML(source.value?.cached || '')
    .replace(/\s*\[in [^\]]+\]/i, '')
    .replace(/\s*Available at\s+\S+\s*$/i, '')
    .trim() + '\n(click for the full reference)'
)
</script>

<style scoped>
.nomen-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.nomen-main {
  flex: 1 1 auto;
  min-width: 0;
}
.nomen-name {
  color: rgb(var(--color-base-content));
}
/* grey that works in light and dark themes */
.nomen-source {
  color: rgba(var(--color-base-content), 0.6);
}
.nomen-source .citation-toggle:hover,
.nomen-source .citation-toggle:focus-visible {
  color: rgb(var(--color-primary));
}
.nomen-type {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: rgba(var(--color-base-content), 0.7);
}
.nomen-type-label {
  margin-right: 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--color-base-content), 0.5);
}
.nomen-topic {
  display: inline-block;
  margin: 0.15rem 0 0 0.3rem;
  padding: 0 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  line-height: 1.5;
  background: rgba(var(--color-base-muted), 0.45);
  color: rgba(var(--color-base-content), 0.7);
}
.nomen-kind {
  flex-shrink: 0;
  margin-top: 0.1rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  border: 1px solid transparent;
}
.nomen-kind--orig { background: rgba(var(--color-primary), 0.12); color: rgb(var(--color-primary)); border-color: rgba(var(--color-primary), 0.3); }
.nomen-kind--comb { background: #e6f3ea; color: #1f6a3a; border-color: #b9dcc4; }
.nomen-kind--type { background: #fbe4e1; color: #8f2418; border-color: #f0c2bb; }
.nomen-kind--syn { background: #f3eefb; color: #5b3a8f; border-color: #d8cbee; }
.nomen-kind--warn { background: #fdf0e1; color: #8a4b0f; border-color: #f0d2ad; }
.nomen-kind--info,
.nomen-kind--muted { background: rgba(var(--color-base-muted), 0.6); color: inherit; border-color: rgba(var(--color-base-muted), 1); opacity: 0.85; }

.citation-toggle {
  display: inline;
  cursor: pointer;
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
}
.citation-ref-text {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: rgba(var(--color-primary), 0.55);
  text-underline-offset: 3px;
}
.citation-toggle:hover .citation-ref-text,
.citation-toggle:focus-visible .citation-ref-text {
  text-decoration-style: solid;
  color: rgb(var(--color-primary));
}
.citation-toggle:focus-visible {
  outline: 2px solid rgb(var(--color-primary));
  outline-offset: 2px;
  border-radius: 2px;
}
.citation-chevron {
  display: inline-block;
  margin-left: 0.25rem;
  opacity: 0.45;
  transition: transform 0.15s ease;
}
.citation-chevron.open {
  transform: rotate(90deg);
}
.citation-ref {
  padding: 0.5rem 0.7rem;
  border-left: 3px solid rgba(var(--color-primary), 0.5);
  background: rgba(var(--color-base-muted), 0.35);
  font-size: 0.8rem;
  border-radius: 0 4px 4px 0;
}
/* Narrow screens: the tag sits above the name */
@media (max-width: 480px) {
  .nomen-row { flex-direction: column; gap: 0.3rem; }
  .nomen-kind { order: -1; }
}
</style>
