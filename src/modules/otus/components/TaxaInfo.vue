<template>
  <div>
    <div class="flex flex-wrap items-center gap-2">
      <span
        class="rounded-full bg-white/10 ring-1 ring-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-secondary-color"
      >
        {{ store.taxon.rank || 'Combination' }}
      </span>
      <span
        v-if="store.taxon.is_valid"
        class="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300"
        :title="store.taxon.short_status"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-current" />
        Valid
      </span>
      <span
        v-else
        class="inline-flex items-center gap-1 rounded-full bg-red-400/15 px-2.5 py-0.5 text-xs font-semibold text-red-300"
        :title="store.taxon.short_status"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-current" />
        {{ store.taxon.cached_is_available === false ? 'Unavailable' : 'Invalid' }}
      </span>
      <span
        v-for="status in store.taxon.descorator_status"
        :key="status"
        class="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80"
      >
        {{ status }}
      </span>
    </div>

    <h1
      class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight [&_i]:font-bold"
      :title="store.taxon.short_status"
      v-html="store.taxon.full_name_tag"
    />

    <!-- A not-valid name: say so plainly and link to the valid one -->
    <p
      v-if="validName"
      class="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-red-400/10 ring-1 ring-red-300/30 px-3 py-1.5 text-sm text-white/85"
    >
      <span>{{ store.taxon.cached_is_available === false ? 'Unavailable name.' : 'Invalid name.' }}</span>
      <span>Valid name:</span>
      <RouterLink
        v-if="validName.otuId"
        :to="{ name: 'otus-id-overview', params: { id: validName.otuId } }"
        class="font-semibold text-white underline underline-offset-2 [&_i]:italic"
        ><span v-html="validName.html"
      /></RouterLink>
      <span
        v-else
        class="font-semibold text-white [&_i]:italic"
        v-html="validName.html"
      />
    </p>

    <!-- Came from the search with an earlier combination of this species -->
    <p
      v-if="cameFrom"
      class="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/10 ring-1 ring-white/15 px-3 py-1.5 text-sm text-white/85"
    >
      <span>You searched for</span>
      <em class="font-semibold text-white">{{ cameFrom }}</em>
      <span>— an earlier combination of this species.</span>
    </p>

    <p
      v-if="commonNames"
      class="mt-2 text-white/75"
    >
      <CommonNames />
    </p>

    <!-- At a glance -->
    <dl
      v-if="facts.length"
      class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm"
    >
      <div
        v-for="fact in facts"
        :key="fact.label"
        class="flex items-baseline gap-1.5"
        :title="fact.title || ''"
      >
        <dt class="text-white/50">{{ fact.label }}</dt>
        <dd
          class="text-white/90 font-medium [&_i]:italic"
          v-html="fact.value"
        />
      </div>
    </dl>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import { useRoute } from 'vue-router'
import { useOtuStore } from '../store/store'
import CommonNames from './CommonNames.vue'

const store = useOtuStore()
const route = useRoute()

// Set by the global search: ?from=<name>&fromId=<its OTU>&fromStatus=invalid|combination
const cameFrom = computed(() => (route.query?.from ? String(route.query.from) : ''))

// For a not-valid name: the valid name and its page
const validName = ref(null)
watch(
  () => [store.taxon?.id, store.taxon?.cached_valid_taxon_name_id, store.taxon?.is_valid],
  async ([id, validId, isValid]) => {
    validName.value = null
    if (!id || !validId || isValid || validId === id) return
    try {
      const [{ data: t }, { data: otus }] = await Promise.all([
        makeAPIRequest.get(`/taxon_names/${validId}`),
        makeAPIRequest.get('/otus', { params: { 'taxon_name_id[]': validId } })
      ])
      if (store.taxon?.id !== id) return
      validName.value = {
        html: `${t.cached_html || t.cached}${t.cached_author_year ? ' ' + t.cached_author_year : ''}`,
        otuId: otus?.[0]?.id || null
      }
    } catch {
      validName.value = null
    }
  },
  { immediate: true }
)
const commonNames = computed(() => store.taxonomy.commonNames?.length)

const plain = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
const fmt = (n) => Number(n).toLocaleString('en-US')

const facts = computed(() => {
  const t = store.taxon || {}
  const c = store.catalog || {}
  const out = []

  // Original combination, only when it differs from the current name
  if (t.original_combination && plain(t.original_combination) !== plain(t.full_name_tag)) {
    out.push({ label: 'Original combination', value: t.original_combination })
  }

  // For genera and above: how many valid species sit below this taxon
  const speciesRow = (Array.isArray(c.stats) ? c.stats : []).find((s) => s.rank === 'species')
  const isSpeciesGroup = /SpeciesGroup/.test(t.rank_string || '')
  if (!isSpeciesGroup && speciesRow?.names?.valid) {
    out.push({ label: 'Valid species', value: fmt(speciesRow.names.valid) })
  }

  const synonyms = store.taxonomy?.synonyms?.length || 0
  if (synonyms) out.push({ label: 'Synonyms & combinations', value: fmt(synonyms) })

  if (c.timeline?.length) out.push({ label: 'Nomenclatural acts', value: fmt(c.timeline.length) })
  if (c.sources?.length) out.push({ label: 'References', value: fmt(c.sources.length) })

  // Type depositories, e.g. [[["ANSP", "Academy of Natural Sciences of Philadelphia"]]]
  const repos = (Array.isArray(c.repositories) ? c.repositories : []).flat().filter((r) => Array.isArray(r) && r[0])
  if (repos.length) {
    const unique = [...new Map(repos.map((r) => [r[0], r[1]])).entries()]
    out.push({
      label: unique.length > 1 ? 'Type depositories' : 'Type depository',
      value: unique.map(([code]) => code).join(', '),
      title: unique.map(([code, name]) => `${code}: ${name}`).join('\n')
    })
  }

  // When this name was last changed in WID (the name or its OTU, whichever is newer)
  const stamps = [t.updated_at, store.otu?.updated_at].filter(Boolean).map((d) => Date.parse(d)).filter(Number.isFinite)
  if (stamps.length) {
    const last = new Date(Math.max(...stamps))
    out.push({
      label: 'Updated',
      value: last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      title: 'Last change to this name in WID (TaxonWorks)'
    })
  }

  return out
})
</script>
