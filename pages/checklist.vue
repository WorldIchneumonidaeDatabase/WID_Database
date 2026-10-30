<template>
  <div class="bg-base-background min-h-screen">
    <PageHeader
      eyebrow="Checklists"
      :title="country ? `Ichneumonidae of ${country}` : 'Country checklists'"
      subtitle="Every species recorded from a country in WID, with its distribution by region: literature records with the works that report them, and specimens. Search it here or download it."
    >
      <label class="flex flex-col gap-1 text-sm text-white/80">
        Country
        <select
          v-model="countryInput"
          class="w-72 max-w-full rounded-lg px-3 py-2 text-base text-base-content bg-base-foreground"
          @change="go"
        >
          <option
            v-if="!visibleCountries.some((c) => c.name === countryInput)"
            :value="countryInput"
          >
            {{ countryInput || 'Choose a country…' }}
          </option>
          <option
            v-for="c in visibleCountries"
            :key="c.name"
            :value="c.name"
          >
            {{ c.name }} ({{ c.count }} records)
          </option>
        </select>
        <span
          v-if="countriesLoading"
          class="text-xs text-white/60"
        >Loading the list of countries…</span>
        <span
          v-else-if="visibleCountries.length"
          class="text-xs text-white/60"
        >{{ visibleCountries.length }} countries with records in WID</span>
      </label>
    </PageHeader>

    <section class="container mx-auto px-4 py-8 box-border">
      <!-- embargoed until publication (config/checklist.yml) -->
      <div
        v-if="blocked"
        class="max-w-2xl rounded-2xl bg-base-foreground p-6 ring-1 ring-base-border/40"
      >
        <h2 class="text-lg font-semibold text-base-content">Checklist in preparation</h2>
        <p class="mt-2 text-base-content/70">
          {{ embargo.note || `The checklist of the Ichneumonidae of ${country} is being prepared for publication and will appear here once it is published.` }}
          <template v-if="embargoUntil"> Expected from {{ embargoUntil }}.</template>
        </p>
        <p class="mt-2 text-base-content/70">Choose another country from the list above.</p>
      </div>
      <p
        v-else-if="embargo"
        class="mb-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/20"
      >
        Embargoed: this checklist is hidden on the public site<template v-if="embargoUntil"> until {{ embargoUntil }}</template>. You see it because the site runs on your computer.
      </p>

      <!-- loading / errors -->
      <p
        v-if="!blocked && loading"
        class="text-base-content/70"
      >
        Loading records for {{ country }}… {{ rows.length }}<template v-if="total"> of {{ total }}</template>
      </p>
      <p
        v-else-if="!blocked && error"
        class="text-red-600"
      >
        {{ error }}
      </p>
      <p
        v-else-if="blocked"
        class="hidden"
      />
      <p
        v-else-if="!country"
        class="text-base-content/70"
      >
        Choose a country from the list above to see its checklist.
      </p>
      <p
        v-else-if="!rows.length"
        class="text-base-content/70"
      >
        No records from {{ country }} in WID yet. Choose another country from the list above.
      </p>

      <template v-else>
        <!-- summary -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            v-for="s in statTiles"
            :key="s.label"
            class="rounded-xl bg-base-foreground ring-1 ring-base-border/40 p-3"
          >
            <div class="text-2xl font-bold tabular-nums text-base-content">{{ s.value }}</div>
            <div class="text-xs text-base-content/60">{{ s.label }}</div>
          </div>
        </div>

        <!-- tools -->
        <div class="mt-6 flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1 text-sm text-base-content/70 grow sm:grow-0">
            Search
            <input
              v-model="text"
              type="search"
              class="sm:w-72 rounded-lg px-3 py-2 ring-1 ring-base-border bg-base-foreground text-base-content"
              placeholder="Name, genus, place, author…"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-base-content/70">
            {{ regionLabel }}
            <select
              v-model="region"
              class="rounded-lg px-3 py-2 ring-1 ring-base-border bg-base-foreground text-base-content"
            >
              <option value="">All</option>
              <!-- the areas of the literature first, set apart from the regions -->
              <optgroup
                v-if="literatureAreas.length"
                :label="`Areas of the literature`"
              >
                <option
                  v-for="r in literatureAreas"
                  :key="r"
                  :value="r"
                >
                  {{ `${r} (sensu ${areaSource(r)})` }}
                </option>
              </optgroup>
              <optgroup
                v-if="literatureAreas.length"
                :label="`${regionLabel}s`"
              >
                <option
                  v-for="r in plainRegions"
                  :key="r"
                  :value="r"
                >
                  {{ r }}
                </option>
              </optgroup>
              <template v-else>
                <option
                  v-for="r in regions"
                  :key="r"
                  :value="r"
                >
                  {{ r }}
                </option>
              </template>
            </select>
          </label>
          <label
            v-if="byCounty && region && countyOptions.length"
            class="flex flex-col gap-1 text-sm text-base-content/70"
          >
            County
            <select
              v-model="county"
              class="rounded-lg px-3 py-2 ring-1 ring-base-border bg-base-foreground text-base-content"
            >
              <option value="">All counties</option>
              <option
                v-for="c in countyOptions"
                :key="c"
                :value="c"
              >
                {{ c }}{{ countySuffix }}
              </option>
            </select>
          </label>
          <fieldset
            v-if="checklist.hasCounties"
            class="min-w-0 max-w-full flex flex-col gap-1 text-sm text-base-content/70"
          >
            <legend class="mb-1">Distribution</legend>
            <div class="flex flex-wrap rounded-lg ring-1 ring-base-border overflow-hidden">
              <button
                v-for="o in [{ v: false, l: `By ${regionLabel.toLowerCase()}` }, { v: true, l: `By ${regionLabel.toLowerCase()} and county` }]"
                :key="o.l"
                type="button"
                class="px-3 py-2 font-semibold"
                :class="byCounty === o.v ? 'bg-primary-color text-white dark:bg-secondary-color dark:text-black' : 'text-base-content hover:bg-base-muted/40'"
                :aria-pressed="byCounty === o.v"
                @click="byCounty = o.v"
              >
                {{ o.l }}
              </button>
            </div>
          </fieldset>
          <div class="flex flex-wrap gap-2 sm:ml-auto">
            <span class="self-center text-sm text-base-content/60">Download:</span>
            <button
              v-for="d in downloads"
              :key="d.label"
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-base-border text-base-content hover:bg-base-muted/40"
              :title="d.title"
              @click="d.run"
            >
              {{ d.label }}
            </button>
          </div>
        </div>
        <!-- inset map of the areas of the literature (e.g. North / South Italy sensu Scaramozzino) -->
        <AreaInset
          v-if="insetAreas(country).length"
          class="mt-4"
          :country="country"
          :selected="region"
          @select="region = $event"
        />

        <!-- what the areas of the literature mean (e.g. North / South Italy sensu Scaramozzino) -->
        <div
          v-if="shownAreaNotes.length"
          class="mt-3 rounded-lg border-l-4 border-secondary-color bg-base-foreground px-3 py-2 text-sm text-base-content/80"
        >
          <p
            v-for="n in shownAreaNotes"
            :key="n"
          >
            <span class="font-semibold">{{ n.split(':')[0] }}:</span>{{ n.slice(n.indexOf(':') + 1) }}.
          </p>
        </div>
        <p class="mt-2 text-xs text-base-content/55">
          Downloads contain the whole checklist of {{ place }}<template v-if="checklist.hasCounties"> ({{ byCounty ? `by ${regionLabel.toLowerCase()} and county` : `by ${regionLabel.toLowerCase()}` }}, as shown)</template>, not only what is filtered on screen. Generated live from WID on {{ today }}.
          <template v-if="citationsLoading"> Adding page numbers to the citations…</template>
        </p>

        <!-- the map -->
        <ChecklistMap
          ref="mapRef"
          class="mt-6"
          :country="country"
          :checklist="checklist"
          :rows="rows"
          :region="region"
          :county="county"
          :by-county="byCounty"
          :focus="focus"
          :place-word="regionLabel.toLowerCase()"
          :gaps="gaps"
          @select-region="region = $event"
          @select-county="selectCounty"
          @clear-focus="focus = ''"
        />

        <!-- charts: subfamilies, species × region, discovery, literature, literature vs specimens -->
        <ChecklistInsights
          class="mt-6"
          :checklist="regional"
          :rows="rowsInRegion(rows, regionsOf(country, region), country)"
          :citations="citations"
          :country="country"
          :place="place"
          :place-word="regionLabel.toLowerCase()"
          @goto-subfamily="gotoSubfamily"
          @download="downloadInsight"
        />

        <!-- the checklist -->
        <p
          v-if="!shown.length"
          class="mt-8 text-base-content/70"
        >
          Nothing matches.
        </p>
        <div
          v-for="sf in shown"
          :key="sf.name"
          class="mt-8"
        >
          <h2
            :id="`sf-${sf.name}`"
            class="scroll-mt-24 text-sm font-bold uppercase tracking-wider text-primary-color dark:text-secondary-color"
          >
            {{ sf.name }}
          </h2>
          <ul class="mt-3 flex flex-col gap-3">
            <template
              v-for="g in sf.genera"
              :key="g.name"
            >
              <li
                v-for="t in g.taxa"
                :key="t.name"
                class="rounded-xl bg-base-foreground ring-1 ring-base-border/40 p-4"
              >
                <div class="text-base-content">
                  <RouterLink
                    v-if="t.otuId"
                    :to="{ name: 'otus-id-overview', params: { id: t.otuId } }"
                    class="font-semibold italic hover:underline"
                  >{{ t.name }}</RouterLink>
                  <span
                    v-else
                    class="font-semibold italic"
                  >{{ t.name }}</span>
                  {{ t.authorship }}
                  <span
                    v-if="t.rank && !/species/.test(t.rank)"
                    class="ml-1 text-xs text-base-content/55"
                  >({{ t.rank }}-level record)</span>
                  <button
                    type="button"
                    class="ml-2 align-middle rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-base-border text-base-content/70 hover:bg-base-muted/40"
                    :class="{ 'bg-secondary-color/30': focus === t.name }"
                    title="Show this taxon on the map"
                    @click="showOnMap(t.name)"
                  >
                    Map
                  </button>
                </div>
                <p class="mt-1 text-sm text-base-content/80">
                  <span class="font-semibold">Distribution in {{ country }}:</span>{{ ' ' }}
                  <template
                    v-for="(seg, k) in segments(t)"
                    :key="k"
                  ><abbr
                    v-if="seg.title"
                    :title="seg.title"
                    class="no-underline cursor-help"
                  >{{ seg.text }}</abbr><span
                    v-else-if="seg.place"
                    :class="{ 'bg-secondary-color/25 rounded px-0.5': region && regionsOf(country, region).includes(seg.text), 'underline decoration-dotted cursor-help': areaNote(country, seg.text) }"
                    :title="areaNote(country, seg.text) || undefined"
                  >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template>.
                </p>
              </li>
            </template>
          </ul>
        </div>

        <!-- references -->
        <details class="mt-10">
          <summary class="cursor-pointer font-semibold text-base-content">
            References cited ({{ regional.references.length }})
          </summary>
          <ol class="mt-3 flex flex-col gap-2 text-sm text-base-content/80">
            <li
              v-for="r in regional.references"
              :key="r.full"
            >
              {{ r.full }}
            </li>
          </ol>
        </details>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'
import PageHeader from './components/Home/PageHeader.vue'
import ChecklistMap from './components/Checklist/ChecklistMap.vue'
import AreaInset from './components/Checklist/AreaInset.vue'
import ChecklistInsights from './components/Checklist/ChecklistInsights.vue'
import { evidence as gapEvidence, regionGaps } from './components/Checklist/insights.js'
import { buildChecklist, filterChecklist, toCSV, toText, toRTF, download, isSpecimen, countySuffixFor, restrictToRegion, rowsInRegion, countiesIn, GAZETTEER_PLACES, asCountryRows, areaNote, areaNotes, regionsOf, insetAreas } from './components/Checklist/checklist.js'

// Country checklist: all Darwin Core occurrences of the country (literature records from
// asserted distributions + specimens), grouped by subfamily, genus and species, with the
// regions and the works that report them. See components/Checklist/README.markdown.

// The countries that have records in WID, with their number of records. Built from all the
// Darwin Core occurrences (a few seconds) and kept in the browser for a day.
const COUNTRIES_KEY = 'wid-checklist-countries'
const countries = ref([])
const countriesLoading = ref(false)
async function loadCountries() {
  try {
    const cached = JSON.parse(localStorage.getItem(COUNTRIES_KEY) || 'null')
    if (cached && Date.now() - cached.t < 86400000 && cached.list?.length) {
      countries.value = cached.list
      return
    }
  } catch (e) { /* no storage: just load */ }
  countriesLoading.value = true
  try {
    const per = 500
    const first = await makeAPIRequest.get('/dwc_occurrences', { params: { per, page: 1 } })
    const pages = Math.ceil(Number(first.headers['pagination-total'] || 0) / per)
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, pages - 1) }, (_, i) => makeAPIRequest.get('/dwc_occurrences', { params: { per, page: i + 2 } }))
    )
    const count = {}
    for (const res of [first, ...rest]) for (const r of res.data) if (r.country) count[r.country] = (count[r.country] || 0) + 1
    countries.value = Object.entries(count).map(([name, n]) => ({ name, count: n })).sort((a, b) => a.name.localeCompare(b.name))
    try { localStorage.setItem(COUNTRIES_KEY, JSON.stringify({ t: Date.now(), list: countries.value })) } catch (e) { /* ignore */ }
  } catch (e) {
    countries.value = []
  } finally {
    countriesLoading.value = false
  }
}

// Italy opens by default, unless its checklist is under embargo (then the page asks for a country)
function defaultCountry() {
  const day = new Date().toISOString().slice(0, 10)
  const italyHidden =
    !import.meta.env.DEV &&
    (__APP_ENV__.checklist?.embargo || []).some(
      (e) => String(e?.country || '').trim().toLowerCase() === 'italy' && (!e.until || day < String(e.until).slice(0, 10))
    )
  return italyHidden ? '' : 'Italy'
}

const route = useRoute()
const router = useRouter()
const country = ref(route.query.country || defaultCountry())
const countryInput = ref(country.value)
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const text = ref('')
const region = ref('')
const byCounty = ref(false)
// one county of the chosen region (county view only)
const county = ref('')
watch([region, byCounty], () => { county.value = '' })
// a click on a county of the map: its state, then the county (after the watcher above)
function selectCounty({ state, name }) {
  region.value = state
  nextTick(() => { county.value = county.value === name ? '' : name })
}
// one taxon shown on the map
const focus = ref('')
const mapRef = ref(null)
function showOnMap(name) {
  focus.value = focus.value === name ? '' : name
  if (focus.value) mapRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
// citations of the asserted distributions (for page numbers): id → [citation]
const citations = ref(new Map())
const citationsLoading = ref(false)
const today = new Date().toISOString().slice(0, 10)
onMounted(loadCountries)

// Embargo (config/checklist.yml): countries kept off the public checklist until
// their checklist is published. On a development server they still show.
const EMBARGO = (__APP_ENV__.checklist?.embargo || []).filter((e) => e && e.country)
const untilOf = (e) => (e.until ? String(e.until).slice(0, 10) : '')
const embargoOf = (name) =>
  EMBARGO.find((e) => e.country.trim().toLowerCase() === String(name).trim().toLowerCase() && (!untilOf(e) || today < untilOf(e)))
const preview = import.meta.env.DEV
const embargo = computed(() => embargoOf(country.value) || null)
const blocked = computed(() => !!embargo.value && !preview)
const embargoUntil = computed(() =>
  embargo.value && untilOf(embargo.value)
    ? new Date(untilOf(embargo.value) + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : ''
)
const visibleCountries = computed(() => countries.value.filter((c) => preview || !embargoOf(c.name)))

async function load() {
  if (blocked.value || !country.value) {
    rows.value = []
    total.value = 0
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  rows.value = []
  total.value = 0
  region.value = ''
  byCounty.value = false
  focus.value = ''
  citations.value = new Map()
  try {
    for (let page = 1; page < 200; page++) {
      const res = await makeAPIRequest.get('/dwc_occurrences', { params: { country: country.value, per: 500, page } })
      total.value = Number(res.headers['pagination-total'] || 0)
      rows.value = rows.value.concat(res.data)
      if (!res.data.length || rows.value.length >= total.value) break
    }
    // records on the country's gazetteers (custom areas, e.g. "North Italy" sensu Scaramozzino)
    for (const g of GAZETTEER_PLACES[country.value] || []) {
      for (let page = 1; page < 50; page++) {
        const res = await makeAPIRequest.get('/dwc_occurrences', { params: { locality: g.locality, per: 500, page } })
        rows.value = rows.value.concat(asCountryRows(res.data, country.value, g.region))
        if (res.data.length < 500) break
      }
    }
  } catch (e) {
    error.value = 'Could not load the records. Please try again later.'
  } finally {
    loading.value = false
  }
  loadCitations()
}

// Page numbers: the citations of the asserted distributions behind the literature records,
// 150 ids per request. Until they arrive, records show the work without pages.
async function loadCitations() {
  const forCountry = country.value
  const ids = [...new Set(rows.value.filter((r) => !isSpecimen(r) && r.dwc_occurrence_object_type === 'AssertedDistribution').map((r) => r.dwc_occurrence_object_id))]
  const map = new Map()
  citationsLoading.value = true
  try {
    for (let i = 0; i < ids.length; i += 150) {
      const res = await makeAPIRequest.get('/citations', {
        params: { citation_object_type: 'AssertedDistribution', citation_object_id: ids.slice(i, i + 150), extend: ['source'], per: 1000 }
      })
      for (const c of res.data) {
        if (!map.has(c.citation_object_id)) map.set(c.citation_object_id, [])
        map.get(c.citation_object_id).push(c)
      }
      if (forCountry !== country.value) return
    }
    citations.value = map
  } catch (e) {
    /* keep the works without pages */
  } finally {
    if (forCountry === country.value) citationsLoading.value = false
  }
}

function go() {
  const c = countryInput.value.trim()
  if (c) router.replace({ query: { ...route.query, country: c } })
}

watch(() => route.query.country, (c) => {
  country.value = c || defaultCountry()
  countryInput.value = country.value
  load()
}, { immediate: true })

const checklist = computed(() => buildChecklist(rows.value, country.value, { citations: citations.value, byCounty: byCounty.value }))
const regionLabel = computed(() => (/^United States/.test(country.value) ? 'State' : 'Region'))

// the distribution line as pieces: places, works (with the full reference on hover), punctuation
function evidence(g) {
  const out = []
  const items = g.refs.map((r, i) => ({ text: r, title: g.fullRefs[i] }))
  if (g.specimens) items.push({ text: `${g.specimens} specimen${g.specimens > 1 ? 's' : ''}${g.institutions.length ? ` (${g.institutions.join(', ')})` : ''}` })
  if (!items.length) return out
  out.push({ text: ' (' })
  items.forEach((it, i) => { out.push(it); if (i < items.length - 1) out.push({ text: '; ' }) })
  out.push({ text: ')' })
  return out
}
function segments(t) {
  const suffix = countySuffixFor(country.value)
  const out = []
  t.regions.forEach((g, i) => {
    out.push({ text: g.region, place: true }, ...evidence(g))
    if (byCounty.value && g.counties.length) {
      out.push({ text: ': ' })
      g.counties.forEach((c, j) => {
        out.push({ text: c.name + suffix, place: true }, ...evidence(c))
        if (j < g.counties.length - 1) out.push({ text: ', ' })
      })
    }
    if (i < t.regions.length - 1) out.push({ text: byCounty.value ? '; ' : ', ' })
  })
  return out
}
// with a region (state) chosen, the checklist is the checklist of that region
// a literature area ("North Italy") stands for itself + its regions
const regional = computed(() => restrictToRegion(checklist.value, regionsOf(country.value, region.value), byCounty.value ? county.value : ''))
const countyOptions = computed(() => (region.value ? countiesIn(checklist.value, region.value) : []))
const countySuffix = computed(() => countySuffixFor(country.value))
// definitions of the literature areas: the one chosen in the filter, else all those used
const literatureAreas = computed(() => regions.value.filter((r) => areaNote(country.value, r)))
const plainRegions = computed(() => regions.value.filter((r) => !areaNote(country.value, r)))
const areaSource = (r) => (GAZETTEER_PLACES[country.value] || []).find((g) => g.region === r)?.source || ''
// data gaps per region (map "Colour by": number of works / latest record)
const gaps = computed(() => regionGaps(gapEvidence(rows.value, country.value, citations.value), country.value))
function gotoSubfamily(name) {
  text.value = ''
  nextTick(() => document.getElementById(`sf-${name}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function downloadInsight({ name, content }) {
  download(`WID_${name}_${slug.value}_${today}.csv`, '\ufeff' + content, 'text/csv;charset=utf-8')
}
const shownAreaNotes = computed(() => (region.value ? [areaNote(country.value, region.value)].filter(Boolean) : areaNotes(checklist.value, country.value)))
const shown = computed(() => filterChecklist(regional.value.subfamilies, { text: text.value }))
const regions = computed(() =>
  [...new Set([
    ...checklist.value.subfamilies.flatMap((s) => s.genera.flatMap((g) => g.taxa.flatMap((t) => t.regions.map((r) => r.region)))),
    // the literature areas are always offered (they also gather their regions)
    ...(GAZETTEER_PLACES[country.value] || []).map((g) => g.region)
  ])]
    .sort((a, b) => (a === country.value) - (b === country.value) || a.localeCompare(b))
)
const statTiles = computed(() => {
  const s = checklist.value.stats
  return [
    { label: 'species', value: s.species },
    { label: 'genera', value: s.genera },
    { label: 'subfamilies', value: s.subfamilies },
    { label: `${regionLabel.value.toLowerCase()}s with records`, value: s.regions },
    ...(byCounty.value ? [{ label: 'counties with records', value: s.counties }] : []),
    { label: 'literature records', value: s.literature },
    { label: 'specimens', value: s.specimens }
  ]
})

const place = computed(() => [county.value && byCounty.value ? county.value + countySuffix.value : '', region.value && region.value !== country.value ? region.value : '', country.value].filter(Boolean).join(', '))
const slug = computed(() => place.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
const opts = computed(() => ({ country: country.value, title: `Ichneumonidae of ${place.value}`, date: today, byCounty: byCounty.value }))
const downloads = [
  { label: 'Word (RTF)', title: 'Formatted checklist, opens in Word', run: () => download(`WID_checklist_${slug.value}_${today}.rtf`, toRTF(regional.value, opts.value), 'application/rtf') },
  { label: 'Text', title: 'Formatted checklist as plain text', run: () => download(`WID_checklist_${slug.value}_${today}.txt`, toText(regional.value, opts.value), 'text/plain;charset=utf-8') },
  { label: 'CSV', title: 'One row per record and work cited, Darwin Core columns, with the citation and its pages', run: () => download(`WID_records_${slug.value}_${today}.csv`, '﻿' + toCSV(rowsInRegion(rows.value, regionsOf(country.value, region.value), country.value, byCounty.value ? county.value : ''), citations.value), 'text/csv;charset=utf-8') },
  { label: 'References', title: 'All works cited in the checklist', run: () => download(`WID_references_${slug.value}_${today}.txt`, regional.value.references.map((r) => r.full).join('\r\n'), 'text/plain;charset=utf-8') }
]
</script>
