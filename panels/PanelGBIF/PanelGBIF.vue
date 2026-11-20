<template>
  <VCard v-if="state !== 'hidden'">
    <VCardHeader class="flex items-center justify-between gap-3">
      <GBIFLogo class="h-6" />
      <span class="gb-eyebrow">Records on GBIF</span>
    </VCardHeader>
    <VCardContent class="text-sm">
      <p
        v-if="state === 'loading'"
        class="opacity-60"
      >
        Loading…
      </p>

      <template v-else>
        <!-- the name on GBIF, and how GBIF treats it -->
        <p class="gb-name-line">
          <a
            :href="links.species"
            target="_blank"
            rel="noopener"
            class="gb-name"
            v-html="taxon.full_name_tag"
          />
          <span
            v-if="match.synonymOf"
            class="gb-pill gb-pill--warn"
            :title="`GBIF: ${match.synonymOf}`"
            >synonym on GBIF</span
          >
        </p>
        <p
          v-if="match.synonymOf"
          class="gb-note"
        >
          <span class="mr-1">GBIF treats this name as a synonym of</span>
          <a
            :href="links.accepted"
            target="_blank"
            rel="noopener"
            ><i>{{ match.synonymOf }}</i></a
          >
        </p>

        <p
          v-if="!counts.total"
          class="gb-note"
        >
          No occurrence records on GBIF yet.
        </p>

        <template v-else>
          <!-- the three numbers -->
          <div class="gb-stats">
            <a
              :href="links.records"
              target="_blank"
              rel="noopener"
            >
              <span class="gb-k">Records</span>
              <span class="gb-v">{{ fmt(counts.total) }}</span>
            </a>
            <a
              :href="links.specimens"
              target="_blank"
              rel="noopener"
            >
              <span class="gb-k">Specimens</span>
              <span class="gb-v">{{ fmt(counts.specimens) }}</span>
            </a>
            <a
              :href="links.records"
              target="_blank"
              rel="noopener"
            >
              <span class="gb-k">Countries</span>
              <span class="gb-v">{{ fmt(counts.countries) }}</span>
            </a>
          </div>

          <!-- what kind of records -->
          <div
            class="gb-bar"
            role="img"
            :aria-label="basis.map((b) => `${b.label}: ${b.count}`).join(', ')"
          >
            <span
              v-for="b in basis"
              :key="b.key"
              :style="{ flexGrow: b.count, background: b.color }"
              :title="`${b.label}: ${fmt(b.count)}`"
            />
          </div>
          <ul class="gb-key">
            <li
              v-for="b in basis"
              :key="b.key"
            >
              <span
                class="gb-dot"
                :style="{ background: b.color }"
              />
              <span>{{ b.label }}</span>
              <span class="opacity-60">{{ fmt(b.count) }}</span>
            </li>
          </ul>

          <!-- where most records come from -->
          <p
            v-if="topCountries.length"
            class="gb-countries"
          >
            <span class="gb-label">Most records from</span>
            <template
              v-for="(c, i) in topCountries"
              :key="c.code"
            >
              <span
                v-if="i"
                class="mr-1"
                >,</span
              >
              <a
                :href="`${links.records}&country=${c.code}`"
                target="_blank"
                rel="noopener"
                >{{ c.name }}</a
              >
              <span class="opacity-60 ml-1">{{ fmt(c.count) }}</span>
            </template>
          </p>

          <ul class="gb-extra">
            <li v-if="counts.images">
              <a
                :href="`${links.records}&media_type=StillImage`"
                target="_blank"
                rel="noopener"
                ><strong class="mr-1">{{ fmt(counts.images) }}</strong><span>with images</span></a
              >
            </li>
            <li v-if="counts.types">
              <a
                :href="`${links.records}&type_status=*`"
                target="_blank"
                rel="noopener"
                ><strong class="mr-1">{{ fmt(counts.types) }}</strong><span>type specimens</span></a
              >
            </li>
          </ul>
        </template>

        <p class="gb-foot">
          <RouterLink
            v-if="otuId"
            :to="{ name: 'otus-id-GBIF', params: { id: otuId } }"
            >Images, map and types from GBIF</RouterLink
          >
          <a
            :href="links.species"
            target="_blank"
            rel="noopener"
            >Open on GBIF ↗</a
          >
        </p>
      </template>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import GBIFLogo from './components/gbifLogo.vue'
import { locale } from '@/i18n/index.js'

const props = defineProps({
  taxon: { type: Object, required: true },
  otuId: { type: [Number, String], default: undefined }
})

const API = 'https://api.gbif.org/v1'
const BASIS = {
  PRESERVED_SPECIMEN: { label: 'Preserved specimens', color: 'rgb(42, 98, 183)' },
  MATERIAL_SAMPLE: { label: 'Material samples', color: 'rgb(28, 102, 112)' },
  HUMAN_OBSERVATION: { label: 'Observations', color: 'rgb(243, 182, 55)' },
  MACHINE_OBSERVATION: { label: 'Machine observations', color: 'rgb(220, 140, 60)' },
  FOSSIL_SPECIMEN: { label: 'Fossils', color: 'rgb(130, 70, 180)' },
  LIVING_SPECIMEN: { label: 'Living specimens', color: 'rgb(60, 150, 90)' }
}
const SPECIMENS = ['PRESERVED_SPECIMEN', 'MATERIAL_SAMPLE', 'FOSSIL_SPECIMEN', 'LIVING_SPECIMEN']

const state = ref('loading')
const match = ref({})
const counts = ref({})
const facets = ref({})

const fmt = (n) => Number(n || 0).toLocaleString(locale.value || 'en')

const links = computed(() => {
  const k = match.value.key
  return {
    species: `https://www.gbif.org/species/${k}`,
    accepted: `https://www.gbif.org/species/${match.value.acceptedKey}`,
    records: `https://www.gbif.org/occurrence/search?taxon_key=${k}`,
    specimens: `https://www.gbif.org/occurrence/search?taxon_key=${k}&basis_of_record=PRESERVED_SPECIMEN&basis_of_record=MATERIAL_SAMPLE`
  }
})

// kinds of records; the ones without a label of their own are merged into "Other"
const basis = computed(() => {
  const out = []
  let other = 0
  for (const f of facets.value.BASIS_OF_RECORD || []) {
    if (!f.count) continue
    if (BASIS[f.name]) out.push({ key: f.name, count: f.count, label: BASIS[f.name].label, color: BASIS[f.name].color })
    else other += f.count
  }
  if (other) out.push({ key: 'OTHER', count: other, label: 'Other', color: 'rgb(180, 185, 195)' })
  return out
})

const topCountries = computed(() => {
  let names
  try {
    names = new Intl.DisplayNames([locale.value || 'en'], { type: 'region' })
  } catch {
    names = null
  }
  return (facets.value.COUNTRY || []).slice(0, 4).map((c) => ({
    code: c.name,
    count: c.count,
    name: names?.of(c.name) || c.name
  }))
})

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(r.status)
  return r.json()
}

onMounted(async () => {
  try {
    // match the full name; a match only at a higher rank (e.g. the genus) is no match
    const q = new URLSearchParams({ name: props.taxon.expanded_name || props.taxon.name, kingdom: 'Animalia' })
    const m = await getJSON(`${API}/species/match?${q}`)
    if (!m.usageKey || m.matchType === 'NONE' || m.matchType === 'HIGHERRANK') {
      state.value = 'hidden'
      return
    }
    const synonym = m.synonym || (m.status && m.status !== 'ACCEPTED' && m.status !== 'DOUBTFUL')
    match.value = {
      key: m.usageKey,
      acceptedKey: m.acceptedUsageKey,
      synonymOf: synonym && m.acceptedUsageKey ? m.species || m.canonicalName || '' : ''
    }
    if (synonym && m.acceptedUsageKey) {
      try {
        const acc = await getJSON(`${API}/species/${m.acceptedUsageKey}`)
        match.value.synonymOf = acc.scientificName || match.value.synonymOf
      } catch {
        // keep the short name
      }
    }

    const base = `${API}/occurrence/search?taxonKey=${m.usageKey}&limit=0`
    const [all, img] = await Promise.all([
      getJSON(`${base}&facet=basisOfRecord&facet=country&facet=typeStatus&facetLimit=300`),
      getJSON(`${base}&mediaType=StillImage`).catch(() => ({ count: 0 }))
    ])
    const f = Object.fromEntries((all.facets || []).map((x) => [x.field, x.counts]))
    facets.value = f
    const sum = (list, keep) => (list || []).filter((x) => keep(x.name)).reduce((n, x) => n + x.count, 0)
    counts.value = {
      total: all.count,
      specimens: sum(f.BASIS_OF_RECORD, (n) => SPECIMENS.includes(n)),
      countries: (f.COUNTRY || []).length,
      types: sum(f.TYPE_STATUS, (n) => !/^not\s*a\s*type$/i.test(n.replace(/_/g, ' '))),
      images: img.count
    }
    state.value = 'done'
  } catch {
    state.value = 'hidden'
  }
})
</script>

<style scoped>
.gb-eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}
.gb-name-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
}
.gb-name {
  font-weight: 600;
  color: rgb(var(--color-primary));
}
.gb-name:hover {
  text-decoration: underline;
}
.gb-pill {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  border: 1px solid transparent;
}
.gb-pill--warn {
  background: #fdf0e1;
  color: #8a4b0f;
  border-color: #f0d2ad;
}
.gb-note {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  opacity: 0.8;
}
.gb-note a {
  color: rgb(var(--color-primary));
}
.gb-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin: 0.8rem 0 0.7rem;
}
.gb-stats a {
  display: block;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  background: rgba(var(--color-base-muted), 0.35);
  border: 1px solid rgba(var(--color-base-muted), 0.9);
}
.gb-stats a:hover {
  border-color: rgba(var(--color-primary), 0.5);
}
.gb-k {
  display: block;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.65;
}
.gb-v {
  display: block;
  margin: 0.1rem 0 0;
  font-size: 1.2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--color-base-content));
}
.gb-bar {
  display: flex;
  height: 0.55rem;
  border-radius: 999px;
  overflow: hidden;
  gap: 2px;
}
.gb-bar span {
  min-width: 6px;
}
.gb-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.9rem;
  margin: 0.45rem 0 0.6rem;
  font-size: 0.78rem;
}
.gb-key li {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.gb-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
}
.gb-countries {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
}
.gb-label {
  margin-right: 0.35rem;
  opacity: 0.7;
}
.gb-countries a,
.gb-extra a {
  color: rgb(var(--color-primary));
}
.gb-countries a:hover,
.gb-extra a:hover {
  text-decoration: underline;
}
.gb-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 1rem;
  margin: 0;
  font-size: 0.82rem;
}
.gb-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.4rem 1rem;
  margin: 0.8rem 0 0;
  padding-top: 0.6rem;
  border-top: 1px solid rgba(var(--color-base-muted), 0.9);
  font-size: 0.8rem;
}
.gb-foot a {
  font-weight: 600;
  color: rgb(var(--color-primary));
}
.gb-foot a:hover {
  text-decoration: underline;
}
</style>
