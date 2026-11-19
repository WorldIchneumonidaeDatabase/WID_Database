<template>
  <VCard>
    <div class="relative">
      <Teleport to="body">
        <VModal
          v-if="activeCitation"
          @close="activeCitation = null"
        >
          <template #header>
            <div class="text-sm font-medium">Reference</div>
          </template>
          <div
            class="px-4 pb-4 text-sm leading-relaxed"
            v-html="linkify(activeCitation.full)"
          />
        </VModal>
      </Teleport>
      <ClientOnly>
        <VSpinner v-if="isLoading" />
        <VMap
          class="h-96 max-h-96"
          dragging
          :cluster="cluster"
          :zoom="zoom"
          :zoom-bounds="8"
          :geojson="store.distribution.geojson"
          :cluster-icon-create-function="makeClusterIconFor"
          :geojson-options="geojsonOptions"
          @geojson:ready="() => (isLoading = false)"
        />
        <div ref="popupElement">
          <MapPopup
            v-if="popupItem"
            :items="popupItem.base"
            :targets="popupItem.target"
            @selected="dwcTableRef.show"
            @citation-selected="activeCitation = $event"
          />
        </div>
        <VButton
          class="h-6 text-sm absolute right-3 top-3 z-[400]"
          primary
          @click="() => (isOtuSearchVisible = true)"
        >
          Search
        </VButton>

        <OtuSearch
          v-if="isOtuSearchVisible"
          :otu="otu"
          :shapes="store.distribution.geojson"
          @close="() => (isOtuSearchVisible = false)"
        />

        <CachedMap
          v-if="store.distribution.cachedMap"
          :cached-map="store.distribution.cachedMap"
        />
      </ClientOnly>
    </div>
    <!-- Detailed records still on their way: the summary map is showing -->
    <div
      v-if="store.distribution.loadingDetail"
      class="map-note flex items-center gap-2 px-3 py-1.5 text-xs"
    >
      <span
        class="map-dot"
        aria-hidden="true"
      />
      <span>Showing the summary map; loading the detailed records…</span>
    </div>

    <!-- Records filed under the valid name or one of its synonyms -->
    <div
      v-if="nameOptions.length > 1"
      class="map-names flex flex-wrap gap-1.5 px-3 py-2"
      role="group"
      aria-label="Filter by name"
    >
      <button
        type="button"
        :class="['map-chip', { on: !store.distribution.filterOtuId }]"
        :aria-pressed="!store.distribution.filterOtuId"
        @click="store.setFilterOtu(null)"
      >
        All <span class="map-chip-n">{{ countFor(null) }}</span>
      </button>
      <button
        v-for="n in nameOptions"
        :key="n.id"
        type="button"
        :class="['map-chip', { on: store.distribution.filterOtuId === n.id }]"
        :aria-pressed="store.distribution.filterOtuId === n.id"
        @click="store.setFilterOtu(store.distribution.filterOtuId === n.id ? null : n.id)"
      >
        <span
          class="[&_i]:italic"
          v-html="n.html"
        />
        <span
          v-if="!n.valid"
          class="map-chip-inv"
          >Invalid</span
        >
        <span class="map-chip-n">{{ countFor(n.id) }}</span>
      </button>
    </div>

    <div
      v-if="store.distribution.errorMessage"
      class="flex flex-row p-2 text-xs italic"
    >
      * {{ store.distribution.errorMessage }}
    </div>
    <div
      class="flex flex-row p-2 gap-2 text-xs"
      v-if="store.distribution.currentShapeTypes.length"
    >
      <div
        v-for="type in store.distribution.currentShapeTypes"
        :key="type"
        class="flex flex-row items-center"
      >
        <div
          :class="['w-3', 'h-3', 'm-1', 'rounded-sm', LEGEND[type].background]"
        />
        <span>{{ LEGEND[type].label }}</span>
      </div>
    </div>
    <DwcTable ref="dwcTableRef" />
  </VCard>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { otuNames } from '../_shared/otuNames'

function linkify(html) {
  if (!html) return ''
  return html.replace(
    /(?<!href=["'])(?<!">)(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-secondary-color hover:underline">$1</a>'
  )
}
import { useDistributionStore } from './store/useDistributionStore.js'
import { makeClusterIconFor } from './clusters'
import { useGeojsonOptions } from './composables/useGeojsonOptions.js'
import { LEGEND } from './constants'
import MapPopup from './components/MapPopup.vue'
import CachedMap from './components/CachedMap.vue'
import OtuSearch from './components/Search/OtuSearch.vue'
import DwcTable from './components/DwcTable.vue'

const props = defineProps({
  otuId: {
    type: [String, Number],
    required: true
  },

  otu: {
    type: Object,
    required: true
  },

  taxon: {
    type: Object,
    required: true
  },

  cluster: {
    type: Boolean,
    default: true
  }
})

const zoom = 2
const isLoading = ref(true)
const activeCitation = ref(null)
const isOtuSearchVisible = ref(false)
const dwcTableRef = ref(null)
const store = useDistributionStore()
const popupElement = ref(null)
const { popupItem, geojsonOptions } = useGeojsonOptions({ popupElement })

// Names behind the records, for the filter chips (only when there is more than one)
const nameOptions = ref([])
watch(
  () => store.distribution.otuIds,
  async (ids) => {
    nameOptions.value = ids?.length > 1 ? await otuNames(ids) : []
  }
)
const countFor = (otuId) =>
  store.distribution.rawFeatures.filter(
    (f) => otuId == null || Number(f.properties.target?.id) === Number(otuId)
  ).length

onMounted(() => {
  isLoading.value = true

  store.loadDistribution({
    otuId: props.otuId,
    rankString: props.taxon.rank_string
  })
})

onBeforeUnmount(() => {
  store.resetRequest()
  store.$reset()
})
</script>

<style scoped>
.map-note {
  color: rgba(var(--color-base-content), 0.7);
  border-top: 1px solid rgba(var(--color-base-muted), 1);
}
.map-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: rgb(var(--color-primary));
  animation: map-pulse 1.2s ease-in-out infinite;
}
@keyframes map-pulse {
  50% { opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .map-dot { animation: none; }
}
.map-names {
  border-top: 1px solid rgba(var(--color-base-muted), 1);
}
.map-chip {
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
.map-chip:hover { border-color: rgba(var(--color-primary), 0.5); }
.map-chip.on {
  background: rgba(var(--color-primary), 0.12);
  border-color: rgba(var(--color-primary), 0.6);
  color: rgb(var(--color-primary));
  font-weight: 600;
}
.map-chip-n { font-size: 0.68rem; opacity: 0.6; }
.map-chip-inv {
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  background: #fbe4e1;
  color: #8f2418;
}
</style>
