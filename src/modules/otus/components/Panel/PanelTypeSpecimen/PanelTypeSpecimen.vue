<template>
  <VCard v-if="typeMaterials.length">
    <VCardHeader class="flex justify-between">
      <h2 class="text-md">
        <span>{{ shownCount > 1 ? 'Type specimens' : 'Type specimen' }}</span>
        <span v-if="shownCount > 1"> ({{ shownCount }})</span>
      </h2>
      <PanelDropdown panel-key="panel:typeMaterial" />
    </VCardHeader>
    <VCardContent class="text-sm">
      <!-- Grouped by the name each type was designated for: this name first, then its synonyms -->
      <section
        v-for="g in groups"
        :key="g.id"
        class="type-group"
      >
        <h3 class="type-group-head">
          <span
            class="type-group-name"
            v-html="g.html"
          />
          <span :class="['type-name-status', g.valid ? 'valid' : 'invalid']">{{ g.valid ? 'Valid' : 'Invalid' }}</span>
        </h3>
        <ul class="type-list">
          <li
            v-for="t in g.items"
            :key="t.id"
            class="type-item"
          >
            <div class="type-head">
              <span :class="['type-status', { primary: t.primary }]">{{ t.status }}</span>
              <span
                v-if="t.sex"
                class="type-sex"
                :title="t.sex === '♀' ? 'female' : 'male'"
                >{{ t.sex }}</span
              >
              <span
                v-if="t.stage"
                class="type-muted"
                >{{ t.stage }}</span
              >
              <span
                v-if="t.catalog"
                class="type-catalog"
                data-no-i18n
                >{{ t.catalog }}</span
              >
            </div>
            <div
              v-if="t.repository"
              class="type-repo"
            >
              {{ t.repository }}
            </div>
            <div
              v-if="t.notes"
              class="type-muted type-notes"
            >
              {{ t.notes }}
            </div>
          </li>
        </ul>
      </section>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { SPECIMEN_TYPES } from '../../../constants'
import { useOtuPageRequest } from '@/modules/otus/helpers/useOtuPageRequest'
import { parseTypeLabel, isPrimaryType } from './parseTypeLabel'
import { useOtuStore } from '@/modules/otus/store/store'
import PanelDropdown from '../PanelDropdown.vue'
import TaxonWorks from '../../../services/TaxonWorks'

const props = defineProps({
  otuId: {
    type: [String, Number],
    required: true
  }
})

const typeMaterials = ref([])

// Every type specimen (holotype or lectotype first), split into readable parts
const parsed = computed(() =>
  typeMaterials.value.map((t) => {
    const p = parseTypeLabel(t.label)
    return { id: t.id, ...p, primary: isPrimaryType(p.status), t }
  })
)

// "Ichneumon navus Say, 1836" → "<i>Ichneumon navus</i> Say, 1836"
function nameHtml(name = '') {
  const tokens = String(name).split(' ')
  let n = 1
  while (n < tokens.length && (/^[a-z]/.test(tokens[n]) || /^\([A-Z][a-z]+\)$/.test(tokens[n]))) n++
  return `<i>${tokens.slice(0, n).join(' ')}</i> ${tokens.slice(n).join(' ')}`.trim()
}

// One group per name the types belong to: valid first
const store = useOtuStore()
const shownCount = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))

const groups = computed(() => {
  const map = new Map()
  for (const p of parsed.value) {
    const key = p.t.protonym_id || p.t.taxon_name
    if (!map.has(key)) map.set(key, { id: key, html: nameHtml(p.t.taxon_name), valid: !!p.t.is_valid, items: [] })
    map.get(key).items.push(p)
  }
  const list = [...map.values()].sort((a, b) => Number(b.valid) - Number(a.valid))
  // On an invalid name's page, only that name's types (if it has any here)
  const t = store.taxon || {}
  if (t.cached_valid_taxon_name_id && t.cached_valid_taxon_name_id !== t.id) {
    const own = list.filter((g) => String(g.id) === String(t.id))
    if (own.length) return own
  }
  return list
})

watch(
  () => props.otuId,
  () => {
    if (!props.otuId) {
      return
    }

    useOtuPageRequest('panel:typeMaterial', () =>
      TaxonWorks.getOtuTypeMaterial(props.otuId)
    )
      .then(({ data }) => {
        typeMaterials.value = data.type_materials_catalog_labels.sort(
          (a, b) =>
            SPECIMEN_TYPES.indexOf(a.type_type) -
            SPECIMEN_TYPES.indexOf(b.type_type)
        )
      })
      .catch(() => {})
  },
  { immediate: true }
)
</script>

<style scoped>
.type-group + .type-group {
  margin-top: 1rem;
  padding-top: 0.8rem;
  border-top: 1px dashed rgba(var(--color-base-content), 0.2);
}
.type-group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
}
.type-name-status {
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.5;
}
.type-name-status.valid { background: #e3f4ea; color: #1e6b3d; }
.type-name-status.invalid { background: #fbe4e1; color: #8f2418; }
.type-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.type-item + .type-item {
  margin-top: 0.7rem;
  padding-top: 0.7rem;
  border-top: 1px solid rgba(var(--color-base-muted), 1);
}
.type-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}
.type-status {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(var(--color-base-muted), 0.6);
  border: 1px solid rgba(var(--color-base-muted), 1);
}
.type-status.primary {
  background: #fbe4e1;
  color: #8f2418;
  border-color: #f0c2bb;
}
.type-sex {
  font-size: 1rem;
  line-height: 1;
}
.type-catalog {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.8rem;
  padding: 0 0.35rem;
  border-radius: 4px;
  background: rgba(var(--color-base-muted), 0.45);
}
.type-repo {
  margin-top: 0.3rem;
}
.type-muted {
  color: rgba(var(--color-base-content), 0.6);
}
.type-notes {
  margin-top: 0.1rem;
  font-size: 0.8rem;
}
</style>
