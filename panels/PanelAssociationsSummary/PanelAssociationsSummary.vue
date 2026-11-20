<template>
  <!-- Overview: a short summary of the biological associations; the full view is its own tab -->
  <VCard v-if="isLoading || records.length">
    <VCardHeader class="flex items-baseline justify-between gap-3">
      <h2 class="text-md">Biological associations</h2>
      <span
        v-if="bio.length"
        class="asum-count text-xs"
        >{{ bio.length }}</span
      >
    </VCardHeader>
    <VCardContent class="text-sm">
      <p
        v-if="isLoading"
        class="opacity-60"
      >
        Loading…
      </p>
      <template v-else>
        <p class="asum-line">
          <template v-if="bio.length">
            <strong>{{ associates.length }}</strong>
            <span>{{ associates.length === 1 ? ' associate' : ' associates' }}</span>
            <template v-if="orders.length">
              <span> in </span><strong>{{ orders.length }}</strong>
              <span>{{ orders.length === 1 ? ' order' : ' orders' }}</span>
            </template>
            <template v-if="refCount">
              <span> · </span><strong>{{ refCount }}</strong>
              <span>{{ refCount === 1 ? ' reference' : ' references' }}</span>
            </template>
          </template>
          <span v-else>No host or other biological records yet.</span>
          <template v-if="comparisons">
            <span> · </span><span class="opacity-70">{{ comparisons }} taxonomic {{ comparisons === 1 ? 'comparison' : 'comparisons' }}</span>
          </template>
        </p>

        <!-- associates by order, as one bar -->
        <div
          v-if="orders.length"
          class="asum-bar"
          role="img"
          :aria-label="orders.map((o) => `${o.name}: ${o.count}`).join(', ')"
        >
          <span
            v-for="o in orders"
            :key="o.name"
            :style="{ flexGrow: o.count, background: o.color }"
            :title="`${o.name}: ${o.count}`"
          />
        </div>
        <ul
          v-if="orders.length"
          class="asum-key"
        >
          <li
            v-for="o in orders"
            :key="o.name"
          >
            <span
              class="asum-dot"
              :style="{ background: o.color }"
            />
            <span>{{ o.name }}</span>
            <span class="opacity-60">{{ o.count }}</span>
          </li>
        </ul>

        <!-- a few of them -->
        <ul
          v-if="associates.length"
          class="asum-list"
        >
          <li
            v-for="a in associates.slice(0, 4)"
            :key="a.text"
          >
            <span class="opacity-70 mr-1">{{ a.relationship }}</span>
            <span
              class="[&_i]:italic"
              v-html="a.html"
            />
            <span
              v-if="a.family"
              class="opacity-60"
            > ({{ a.family }})</span>
          </li>
          <li
            v-if="associates.length > 4"
            class="opacity-60"
          >
            and {{ associates.length - 4 }} more
          </li>
        </ul>

        <RouterLink
          :to="{ name: 'otus-id-biological_associations', params: { id: otuId } }"
          class="asum-link"
        >
          Explore the associations →
        </RouterLink>
      </template>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { loadAssociations, orderColor } from '../_shared/associations'

const props = defineProps({
  otuId: { type: [Number, String], required: true },
  taxon: { type: Object, default: undefined }
})

const records = ref([])
const isLoading = ref(true)

watch(
  () => [props.otuId, props.taxon?.id],
  async () => {
    if (!props.taxon) return
    isLoading.value = true
    try {
      records.value = await loadAssociations({ otuId: props.otuId, taxon: props.taxon })
    } catch {
      records.value = []
    }
    isLoading.value = false
  },
  { immediate: true }
)

const bio = computed(() => records.value.filter((r) => !r.comparison))
const comparisons = computed(() => records.value.length - bio.value.length)

// distinct associates (a host recorded twice counts once)
const associates = computed(() => {
  const m = new Map()
  bio.value.forEach((r) => {
    const k = r.other.text
    if (!m.has(k)) m.set(k, { ...r.other, relationship: r.flipped && r.inverse ? r.inverse : r.relationship })
  })
  return [...m.values()]
})

const orders = computed(() => {
  const m = new Map()
  associates.value.forEach((a) => {
    const k = a.order || 'Other'
    m.set(k, (m.get(k) || 0) + 1)
  })
  return [...m.entries()]
    .map(([name, count]) => ({ name, count, color: orderColor(name === 'Other' ? '' : name) }))
    .sort((a, b) => b.count - a.count)
})

const refCount = computed(() => new Set(bio.value.flatMap((r) => r.citations.map((c) => c.sourceId))).size)
</script>

<style scoped>
.asum-count {
  padding: 0 0.5rem;
  border-radius: 999px;
  background: rgba(var(--color-base-muted), 0.8);
}
.asum-line {
  margin: 0 0 0.6rem;
}
.asum-bar {
  display: flex;
  height: 0.55rem;
  border-radius: 999px;
  overflow: hidden;
  gap: 2px;
}
.asum-bar span {
  min-width: 6px;
}
.asum-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.9rem;
  margin: 0.45rem 0 0.7rem;
  font-size: 0.78rem;
}
.asum-key li {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.asum-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
}
.asum-list {
  margin: 0 0 0.8rem;
  font-size: 0.82rem;
}
.asum-list li + li {
  margin-top: 0.15rem;
}
.asum-link {
  display: inline-block;
  font-weight: 600;
  color: rgb(var(--color-primary));
}
.asum-link:hover {
  text-decoration: underline;
}
</style>
