<template>
  <VCard>
    <VSpinner
      v-if="store.catalog.isLoading"
      logo-class="w-8 h-8"
      legend=""
    />
    <VCardHeader class="flex justify-between">
      <h2 class="text-md">Names by rank</h2>
      <PanelDropdown
        panel-key="taxonomy"
        :menu-options="menuOptions"
      />
    </VCardHeader>
    <VCardContent
      class="text-sm overflow-auto"
      tabindex="0"
    >
      <table class="st-table">
        <caption class="sr-only">
          Summary of taxonomic names by rank, showing valid extant names, fossil names, invalid names, and total counts.
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th
              scope="col"
              class="st-barcol"
              aria-hidden="true"
            />
            <th
              v-if="isAdvancedView"
              scope="col"
              class="st-num"
              title="OTUs linked to valid protonyms"
            >
              Taxa
            </th>
            <th
              scope="col"
              class="st-num st-h st-h-valid"
            >
              Valid
            </th>
            <th
              v-if="hasFossils"
              scope="col"
              class="st-num st-h st-h-fossil"
            >
              Fossil
            </th>
            <th
              scope="col"
              class="st-num st-h st-h-invalid"
            >
              Invalid
            </th>
            <th
              scope="col"
              class="st-num"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.rank"
          >
            <th
              scope="row"
              class="st-rank"
            >
              {{ r.rank }}
            </th>
            <td
              class="st-barcol"
              aria-hidden="true"
            >
              <span class="st-bar">
                <span
                  v-if="r.extant"
                  class="st-valid"
                  :style="{ flexGrow: r.extant }"
                />
                <span
                  v-if="r.fossil"
                  class="st-fossil"
                  :style="{ flexGrow: r.fossil }"
                />
                <span
                  v-if="r.invalid"
                  class="st-invalid"
                  :style="{ flexGrow: r.invalid }"
                />
              </span>
            </td>
            <td
              v-if="isAdvancedView"
              class="st-num"
            >
              {{ fmt(r.taxa) }}
            </td>
            <td class="st-num st-strong">{{ fmt(r.extant) }}</td>
            <td
              v-if="hasFossils"
              class="st-num"
            >
              {{ fmt(r.fossil) }}
            </td>
            <td class="st-num">{{ fmt(r.invalid) }}</td>
            <td class="st-num st-total">{{ fmt(r.total) }}</td>
          </tr>
        </tbody>
      </table>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useOtuStore } from '@/modules/otus/store/store'
import PanelDropdown from '../PanelDropdown.vue'
import { locale } from '@/i18n/index.js'

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
const fmt = (n) => Number(n || 0).toLocaleString(locale.value || 'en')

const rows = computed(() =>
  Object.values(store.catalog.stats || {}).map(({ rank, taxa, names = {} }) => ({
    rank,
    taxa,
    extant: names.valid_extant || 0,
    fossil: names.valid_fossil || 0,
    invalid: names.invalid || 0,
    total: (names.valid || 0) + (names.invalid || 0)
  }))
)
const hasFossils = computed(() => rows.value.some((r) => r.fossil))
const isAdvancedView = ref(false)

const menuOptions = computed(() => [
  {
    label: isAdvancedView.value ? 'Hide taxa' : 'Show taxa',
    action: () => (isAdvancedView.value = !isAdvancedView.value)
  }
])
</script>

<style scoped>
.st-table {
  width: 100%;
  border-collapse: collapse;
}
.st-table th,
.st-table td {
  padding: 0.4rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgba(var(--color-base-muted), 0.9);
}
.st-table thead th {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0.7;
}
.st-table tbody tr:last-child th,
.st-table tbody tr:last-child td {
  border-bottom: 0;
}
.st-rank {
  font-weight: 600;
  text-transform: capitalize;
  white-space: nowrap;
}
.st-num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.st-strong {
  font-weight: 700;
  color: rgb(var(--color-primary));
}
.st-total {
  font-weight: 600;
}
.st-barcol {
  width: 40%;
  min-width: 5rem;
}
.st-bar {
  display: flex;
  height: 0.5rem;
  gap: 2px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(var(--color-base-muted), 0.5);
}
.st-bar span {
  min-width: 4px;
}
.st-h::before {
  content: '';
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.3rem;
  border-radius: 999px;
  vertical-align: 1px;
}
.st-h-valid::before {
  background: rgb(var(--color-primary));
}
.st-h-fossil::before {
  background: rgb(130, 70, 180);
}
.st-h-invalid::before {
  background: rgb(var(--color-secondary));
}
.st-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.3rem;
  border-radius: 999px;
  vertical-align: 1px;
}
.st-valid {
  background: rgb(var(--color-primary));
}
.st-fossil {
  background: rgb(130, 70, 180);
}
.st-invalid {
  background: rgb(var(--color-secondary));
}
</style>
