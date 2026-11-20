<template>
  <!-- editors' page: kept in English (data-no-i18n) -->
  <div
    class="wid-home bg-base-background"
    data-no-i18n
  >
    <PageHeader
      eyebrow="For editors"
      title="Data quality"
      subtitle="Pick a genus (or any higher taxon) and WID checks every valid species under it for gaps and conflicts in TaxonWorks: a to-do list to fix there."
    />

    <div class="container mx-auto px-4 py-10 box-border max-w-5xl">
      <!-- 1. Choose the group -->
      <form
        class="dq-search"
        @submit.prevent="findTaxon"
      >
        <label
          for="dq-name"
          class="dq-label"
          >Taxon name</label
        >
        <div class="flex flex-wrap gap-2">
          <input
            id="dq-name"
            v-model="query"
            class="dq-input"
            placeholder="e.g. Coelichneumon"
            autocomplete="off"
          />
          <button
            type="submit"
            class="dq-btn"
            :disabled="!query.trim() || running"
          >
            Find
          </button>
        </div>
        <p
          v-if="matches.length > 1"
          class="mt-2 text-sm"
        >
          Which one?
          <button
            v-for="m in matches"
            :key="m.id"
            type="button"
            class="dq-choice"
            @click="run(m)"
          >
            <span v-html="m.cached_html" /> {{ m.cached_author_year }}
            <span class="opacity-60">({{ rankOf(m) }})</span>
          </button>
        </p>
        <p
          v-if="notFound"
          class="mt-2 text-sm opacity-80"
        >
          No valid name “{{ notFound }}” in WID.
        </p>
      </form>

      <!-- 2. Progress -->
      <div
        v-if="running || done"
        class="mt-8"
      >
        <h2 class="text-xl font-bold">
          <span v-html="group?.cached_html" /> {{ group?.cached_author_year }}
        </h2>
        <p class="text-sm opacity-80 mt-1">
          {{ checked }} of {{ species.length }} valid species and subspecies checked<template v-if="tooMany">
            (only the first {{ MAX_SPECIES }}; pick a smaller group for the rest)</template
          >
        </p>
        <div
          class="dq-bar"
          role="progressbar"
          :aria-valuenow="checked"
          :aria-valuemax="species.length"
        >
          <span :style="{ width: species.length ? `${(checked / species.length) * 100}%` : '0%' }" />
        </div>
      </div>

      <!-- 3. Results, one block per kind of problem -->
      <section
        v-for="c in CHECKS"
        v-show="(issues[c.key] || []).length"
        :key="c.key"
        class="dq-block"
      >
        <h3 class="dq-block-title">
          {{ c.title }}
          <span class="dq-count">{{ (issues[c.key] || []).length }}</span>
        </h3>
        <p class="dq-block-help">{{ c.help }}</p>
        <ul>
          <li
            v-for="i in issues[c.key]"
            :key="i.key"
            class="dq-item"
          >
            <RouterLink
              v-if="i.otuId"
              :to="{ name: 'otus-id-overview', params: { id: i.otuId } }"
              class="dq-name"
              ><span v-html="i.name"
            /></RouterLink>
            <span
              v-else
              class="dq-name"
              v-html="i.name"
            />
            <span
              v-if="i.note"
              class="dq-note"
              >{{ i.note }}</span
            >
          </li>
        </ul>
      </section>

      <p
        v-if="done && !totalIssues"
        class="dq-ok"
      >
        Nothing to fix in this group. 🎉
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { makeAPIRequest } from '@/utils'
import PageHeader from './components/Home/PageHeader.vue'

const MAX_SPECIES = 400
const PARALLEL = 3
const SPECIES_RANKS = [
  'NomenclaturalRank::Iczn::SpeciesGroup::Species',
  'NomenclaturalRank::Iczn::SpeciesGroup::Subspecies'
]

const CHECKS = [
  { key: 'noType', title: 'No type specimen recorded', help: 'No holotype, lectotype, neotype or syntypes in TaxonWorks for this species.' },
  { key: 'noRepo', title: 'Type without a depository', help: 'A type specimen is recorded but not where it is kept.' },
  { key: 'typeConflict', title: 'Type material that does not add up', help: 'For example a neotype next to a lectotype or paralectotype of the same name, or more than one holotype/lectotype. Often a specimen filed under the wrong name.' },
  { key: 'noOriginal', title: 'No original citation', help: 'The species has no reference (and page) for its original description.' },
  { key: 'yearClash', title: 'Same author and year, no letter', help: 'Two or more papers by the same author in the same year, without a, b… to tell them apart.' }
]

const query = ref('')
const matches = ref([])
const notFound = ref('')
const group = ref(null)
const species = ref([])
const checked = ref(0)
const running = ref(false)
const done = ref(false)
const tooMany = ref(false)
const issues = reactive({})
const totalIssues = computed(() => CHECKS.reduce((n, c) => n + (issues[c.key]?.length || 0), 0))

const rankOf = (t) => String(t.rank_string || '').split('::').pop()
const add = (key, item) => (issues[key] ||= []).push(item)

async function findTaxon() {
  matches.value = []
  notFound.value = ''
  const name = query.value.trim()
  const { data } = await makeAPIRequest.get('/taxon_names', { params: { name, validity: true } })
  // TaxonWorks matches loosely ("Coelichneumon" also finds Pseudocoelichneumon…)
  const exact = (data || []).filter((t) => String(t.cached || '').toLowerCase() === name.toLowerCase())
  if (!data?.length) {
    notFound.value = name
  } else if (exact.length === 1) {
    run(exact[0])
  } else if (data.length === 1) {
    run(data[0])
  } else {
    matches.value = (exact.length ? exact : data).slice(0, 15)
  }
}

async function run(taxon) {
  matches.value = []
  group.value = taxon
  Object.keys(issues).forEach((k) => delete issues[k])
  checked.value = 0
  done.value = false
  running.value = true

  const isSpecies = ['Species', 'Subspecies'].includes(rankOf(taxon))
  const { data } = isSpecies
    ? { data: [taxon] }
    : await makeAPIRequest.get(
        `/taxon_names?${new URLSearchParams([
          ['taxon_name_id[]', taxon.id],
          ['descendants', 'true'],
          ['validity', 'true'],
          ['taxon_name_type', 'Protonym'],
          ['per', '2000'],
          ...SPECIES_RANKS.map((r) => ['rank[]', r])
        ])}`
      )
  tooMany.value = data.length > MAX_SPECIES
  species.value = data.slice(0, MAX_SPECIES)

  const allSources = new Map() // source id -> cached reference
  const queue = [...species.value]
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift()
      try {
        await checkSpecies(t, allSources)
      } catch {
        /* TaxonWorks hiccup: skip this one */
      }
      checked.value++
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  checkYearClashes(allSources)
  running.value = false
  done.value = true
}

async function checkSpecies(t, allSources) {
  const name = `${t.cached_html || t.cached} ${t.cached_author_year || ''}`.trim()
  const [{ data: otus }, { data: catalog }] = await Promise.all([
    makeAPIRequest.get('/otus', { params: { 'taxon_name_id[]': t.id } }),
    makeAPIRequest.get(`/taxon_names/${t.id}/inventory/catalog`)
  ])
  const otuId = otus?.[0]?.id
  const base = { key: t.id, name, otuId }

  if (!catalog?.original_citation) add('noOriginal', base)
  ;(catalog?.sources || []).forEach((s) => allSources.set(s.id, s.cached))

  if (!otuId) return
  const { data: tm } = await makeAPIRequest.get(`/otus/${otuId}/inventory/type_material.json`)
  const types = tm?.type_materials_catalog_labels || []
  if (!types.length) {
    add('noType', base)
    return
  }
  if (types.some((x) => !/deposited at:/i.test(x.label || ''))) {
    add('noRepo', { ...base, note: types.filter((x) => !/deposited at:/i.test(x.label || '')).map((x) => x.type_type).join(', ') })
  }

  // per original name: does the type material make sense together?
  const byName = new Map()
  types.forEach((x) => {
    const k = x.protonym_id
    if (!byName.has(k)) byName.set(k, { name: x.taxon_name, kinds: [] })
    byName.get(k).kinds.push(String(x.type_type || '').toLowerCase())
  })
  for (const { name: n, kinds } of byName.values()) {
    const has = (k) => kinds.includes(k)
    const primary = kinds.filter((k) => ['holotype', 'lectotype', 'neotype'].includes(k)).length
    const notes = []
    // a neotype replaces lost original material, so none should be recorded beside it
    if (has('neotype') && kinds.some((k) => ['holotype', 'lectotype', 'paralectotype', 'syntype'].includes(k))) {
      notes.push('neotype together with original type material')
    }
    if (has('holotype') && has('lectotype')) notes.push('both a holotype and a lectotype')
    if (has('holotype') && has('syntype')) notes.push('both a holotype and syntypes')
    if (has('lectotype') && has('syntype')) notes.push('syntypes still listed beside a lectotype (should be paralectotypes)')
    if (primary > 1 && !notes.length) notes.push(`${primary} primary types`)
    if (has('paralectotype') && !has('lectotype')) notes.push('paralectotype without a lectotype')
    if (notes.length) {
      add('typeConflict', { key: `${t.id}-${n}`, name: byName.size > 1 ? `${name} — types of ${n}` : name, otuId, note: notes.join('; ') })
    }
  }
}

// "Cameron, P. (1905) …" twice without a/b: same author string and year, different sources
function checkYearClashes(allSources) {
  const groups = new Map()
  for (const [id, cached] of allSources) {
    const plain = String(cached || '').replace(/<[^>]+>/g, '')
    const m = plain.match(/^(.*?)\s*\((\d{4})([a-z]?)\)/)
    if (!m) continue
    const k = `${m[1].trim()}|${m[2]}`
    if (!groups.has(k)) groups.set(k, { author: m[1].trim(), year: m[2], items: [] })
    groups.get(k).items.push({ id, suffix: m[3], title: plain.slice(m[0].length).trim().slice(0, 90) })
  }
  for (const g of groups.values()) {
    if (g.items.length > 1 && g.items.some((i) => !i.suffix)) {
      add('yearClash', {
        key: `${g.author}-${g.year}`,
        name: `${g.author} (${g.year})`,
        note: g.items.map((i) => `${i.suffix ? `[${i.suffix}] ` : ''}${i.title}`).join(' · ')
      })
    }
  }
}
</script>

<style scoped>
.dq-label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
.dq-input {
  flex: 1 1 16rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--color-base-content), 0.2);
  background: transparent;
  color: inherit;
}
.dq-btn {
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-content));
  font-weight: 600;
}
.dq-btn:disabled { opacity: 0.5; }
.dq-choice {
  margin: 0.25rem 0.35rem 0 0;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(var(--color-base-content), 0.2);
}
.dq-bar {
  margin-top: 0.6rem;
  height: 6px;
  border-radius: 999px;
  background: rgba(var(--color-base-content), 0.1);
  overflow: hidden;
}
.dq-bar span {
  display: block;
  height: 100%;
  background: rgb(var(--color-primary));
  transition: width 0.3s;
}
.dq-block {
  margin-top: 1.75rem;
  padding: 1.1rem 1.25rem;
  border-radius: 16px;
  border: 1px solid rgba(var(--color-base-content), 0.12);
}
.dq-block-title { font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
.dq-count {
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: #fdf0e1;
  color: #8a4b0f;
}
.dq-block-help { font-size: 0.85rem; opacity: 0.75; margin: 0.2rem 0 0.6rem; }
.dq-item {
  padding: 0.45rem 0;
  border-top: 1px solid rgba(var(--color-base-content), 0.08);
  font-size: 0.9rem;
}
.dq-name { font-weight: 600; }
.dq-name :deep(i) { font-style: italic; }
a.dq-name:hover { text-decoration: underline; }
.dq-note { display: block; font-size: 0.8rem; opacity: 0.7; margin-top: 0.1rem; }
.dq-ok {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 12px;
  background: #e3f4ea;
  color: #1e6b3d;
  font-weight: 600;
}
</style>
