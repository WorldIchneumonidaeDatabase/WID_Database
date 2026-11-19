<template>
  <VCard>
    <VSpinner
      v-if="store.catalog.isLoading"
      logo-class="w-8 h-8"
      legend=""
    />
    <VCardHeader class="flex justify-between">
      <h2 class="text-md">
        Nomenclature ({{ store.catalog.timeline.length }})
      </h2>
      <PanelDropdown
        :menu-options="menuOptions"
        panel-key="taxonomy"
      />
    </VCardHeader>
    <!-- Invalid name's page: its own history, or the valid name's full one -->
    <div
      v-if="store.catalog.scoped"
      class="nomen-scope px-5 py-2 text-xs"
    >
      <template v-if="store.catalog.showingOwn">
        <span>Only the history of this name.</span>
        <button
          type="button"
          class="nomen-link"
          @click="store.setOwnHistory(false)"
        >
          Show the full history of the valid name ({{ store.catalog.timelineAll.length }})
        </button>
      </template>
      <template v-else>
        <span>Full history of the valid name.</span>
        <button
          type="button"
          class="nomen-link"
          @click="store.setOwnHistory(true)"
        >
          Show only this name ({{ store.catalog.ownTimeline.length }})
        </button>
      </template>
    </div>

    <!-- Valid name's page: filter by the original names it brings together -->
    <div
      v-else-if="nameGroups.length > 1"
      class="nomen-filter px-5 py-2"
      role="group"
      aria-label="Filter by name"
    >
      <button
        type="button"
        :class="['nomen-chip', { on: !group }]"
        :aria-pressed="!group"
        @click="group = null"
      >
        All <span class="nomen-chip-n">{{ store.catalog.timeline.length }}</span>
      </button>
      <button
        v-for="g in nameGroups"
        :key="g.key"
        type="button"
        :class="['nomen-chip', { on: group === g.key }]"
        :aria-pressed="group === g.key"
        :title="g.valid ? 'The valid name and its combinations' : 'An invalid name (synonym) of this taxon'"
        @click="group = group === g.key ? null : g.key"
      >
        <span
          class="[&_i]:italic"
          v-html="g.html"
        />
        <span
          v-if="!g.valid"
          class="nomen-chip-inv"
          >Invalid</span
        >
        <span class="nomen-chip-n">{{ g.count }}</span>
      </button>
    </div>

    <!-- The history of the name at a glance; click a dot to jump to its line -->
    <NomenTimeline
      :entries="groupTimeline"
      :timeline="store.catalog.timeline || []"
      :selected-year="yearFilter"
      @select="pickYear"
    />

    <!-- a year picked on the timeline: only its entries below -->
    <div
      v-if="yearFilter"
      class="nomen-yearbar px-5 py-2 text-sm"
    >
      <span>
        <strong>{{ yearFilter }}</strong> ·
        <span>{{ filteredTimeline.length }} {{ filteredTimeline.length === 1 ? 'entry' : 'entries' }}</span>
      </span>
      <button
        type="button"
        class="nomen-link"
        @click="yearFilter = null"
      >
        Show all years
      </button>
    </div>

    <ul class="text-sm">
      <CitationRow
        v-for="citation in citationList.first"
        :key="citation.label"
        :citation="citation"
        :data-entry="entryIndex(citation)"
      />

      <PanelNomenclatureShowMore
        v-if="!showAll && citationList.middle.length"
        :count="citationList.middle.length"
        @click="showAll = true"
      />
    </ul>
    <AnimationOpacity>
      <ul
        class="text-sm"
        v-show="showAll"
      >
        <CitationRow
          v-for="citation in citationList.middle"
          :key="citation.label"
          :citation="citation"
          :data-entry="entryIndex(citation)"
        />
      </ul>
    </AnimationOpacity>
    <ul class="text-sm">
      <CitationRow
        v-for="citation in citationList.last"
        :key="citation.label"
        :citation="citation"
        :data-entry="entryIndex(citation)"
      />
    </ul>
  </VCard>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { splitList } from './splitList'
import { useOtuStore } from '@/modules/otus/store/store'
import CitationRow from './PanelCitationRow.vue'
import PanelNomenclatureShowMore from './PanelNomenclatureShowMore.vue'
import PanelDropdown from '../PanelDropdown.vue'
import NomenTimeline from './NomenTimeline.vue'

const MAX_CITATIONS = 2

const props = defineProps({
  otuId: {
    type: [Number, String],
    required: true
  },

  taxonId: {
    type: [Number, String],
    required: true
  },

  taxon: {
    type: Object,
    default: undefined
  },

  otu: {
    type: Object,
    default: undefined
  }
})

const store = useOtuStore()

const showAll = ref(false)
// ── Filter by original name (protonym) ──────────────────────────────────
// Every entry lists the protonyms it involves; the names that have their own
// original description in this list are the "names" a reader can filter by.
const group = ref(null)
const yearCut = (label = '') => (String(label).match(/^(.*?\b\d{4}[a-z]?)\b/)?.[1] || label).trim()

const nameGroups = computed(() => {
  const tl = store.catalog.timeline || []
  const protonyms = new Map() // protonym id -> entry that first published it
  for (const c of tl) {
    if ((c.protonym_ids || []).includes(c.taxon_name_id) && !protonyms.has(c.taxon_name_id)) {
      protonyms.set(c.taxon_name_id, c)
    }
  }
  const validId = store.taxon?.cached_valid_taxon_name_id || store.taxon?.id
  const groups = new Map() // by displayed name, so a nomen nudum joins its namesake
  const keyOf = new Map() // protonym id -> group key
  for (const [id, c] of protonyms) {
    const html = yearCut(c.label)
    const key = html.replace(/<[^>]+>/g, '').trim()
    keyOf.set(id, key)
    if (!groups.has(key)) groups.set(key, { key, html, valid: false, count: 0 })
    if (id === validId) groups.get(key).valid = true
  }
  for (const c of tl) {
    const id = (c.protonym_ids || []).find((p) => keyOf.has(p))
    if (id !== undefined) groups.get(keyOf.get(id)).count++
  }
  // the valid name first, then the synonyms in order of publication
  return [...groups.values()].sort((a, b) => Number(b.valid) - Number(a.valid))
})

// The entries for the chosen name (all names when none is chosen)
const groupTimeline = computed(() => {
  const tl = store.catalog.timeline || []
  if (!group.value) return tl
  // map protonym ids to their group again (cheap; lists are short)
  const ids = new Set()
  for (const c of tl) {
    if ((c.protonym_ids || []).includes(c.taxon_name_id) &&
        yearCut(c.label).replace(/<[^>]+>/g, '').trim() === group.value) ids.add(c.taxon_name_id)
  }
  const allProto = new Set(tl.filter((c) => (c.protonym_ids || []).includes(c.taxon_name_id)).map((c) => c.taxon_name_id))
  return tl.filter((c) => ids.has((c.protonym_ids || []).find((p) => allProto.has(p))))
})

// Click a dot on the timeline: show only that year's entries (click it again to show all)
const yearFilter = ref(null)
function pickYear(entry) {
  const y = Number(entry.year)
  yearFilter.value = yearFilter.value === y ? null : y
}
const filteredTimeline = computed(() =>
  yearFilter.value
    ? groupTimeline.value.filter((c) => Number(c.year) === yearFilter.value)
    : groupTimeline.value
)
watch(group, () => (yearFilter.value = null))

const entryIndex = (c) => (store.catalog.timeline || []).indexOf(c)

// Filtering shows every match, without the "Show all" fold
watch(group, (g) => { if (g) showAll.value = true })
watch(yearFilter, (y) => { if (y) showAll.value = true })

const citationList = computed(() =>
  splitList(filteredTimeline.value, MAX_CITATIONS)
)

const menuOptions = computed(() => [
  {
    label: showAll.value ? 'Show less' : 'Show all',
    action: () => (showAll.value = !showAll.value)
  }
])
</script>

<style scoped>
.nomen-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  border-bottom: 1px solid rgba(var(--color-base-muted), 1);
}
.nomen-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  border: 1px solid rgba(var(--color-base-muted), 1);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.nomen-chip:hover { border-color: rgba(var(--color-primary), 0.5); }
.nomen-chip.on {
  background: rgba(var(--color-primary), 0.12);
  border-color: rgba(var(--color-primary), 0.6);
  color: rgb(var(--color-primary));
  font-weight: 600;
}
.nomen-chip-n {
  font-size: 0.68rem;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.nomen-chip-inv {
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  background: #fbe4e1;
  color: #8f2418;
}
.nomen-yearbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem 0.8rem;
  background: rgba(var(--color-primary), 0.08);
  border-top: 1px solid rgba(var(--color-primary), 0.2);
  border-bottom: 1px solid rgba(var(--color-primary), 0.2);
}
.nomen-scope {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.6rem;
  align-items: center;
  border-bottom: 1px solid rgba(var(--color-base-muted), 1);
  color: rgba(var(--color-base-content), 0.7);
}
.nomen-link {
  background: none;
  border: 0;
  padding: 0;
  color: rgb(var(--color-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  font: inherit;
}
</style>
