<template>
  <!-- an English page for reports: the interface translator leaves it alone -->
  <div
    class="wid-home wid-impact bg-base-background pb-16"
    data-no-i18n
  >
    <PageHeader
      eyebrow="For editors"
      title="WID impact"
      subtitle="How WID is used: the size of the database, the requests that reach the editors and the visits to the website. For reports and grant applications. This page is not in the menu."
    >
      <div class="flex flex-wrap gap-3 print:hidden">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-secondary-color px-4 py-2 text-sm font-semibold text-secondary-content hover:opacity-90"
          :disabled="!summary"
          @click="copySummary"
        >
          {{ copied ? 'Copied ✓' : 'Copy a summary for a report' }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10"
          @click="print"
        >
          Print / save as PDF
        </button>
      </div>
      <!-- room for the statistics card that overlaps the header -->
      <div class="h-14 lg:h-16" />
    </PageHeader>

    <HomeStats />

    <!-- Summary paragraph -->
    <section class="container mx-auto px-4 mt-12">
      <h2 class="wid-impact-h2">In one paragraph</h2>
      <p
        class="mt-3 max-w-3xl text-base leading-relaxed text-base-content/80"
        :class="{ 'text-base-content/40': !summary }"
      >
        {{ summary || 'Loading the figures…' }}
      </p>
    </section>

    <!-- Inbox -->
    <section class="container mx-auto px-4 mt-14">
      <h2 class="wid-impact-h2">Requests to the editors</h2>
      <p class="mt-2 max-w-3xl text-sm text-base-content/60">
        Messages sent through the website forms (Request a PDF, Submit a missing
        publication, Report an error)<template v-if="inbox?.since">
          since {{ monthName(inbox.since.slice(0, 7)) }}</template
        >. Updated hourly; names and e-mail addresses are never shown here.
      </p>

      <p
        v-if="inboxState === 'off'"
        class="mt-6 text-sm text-base-content/60"
      >
        The inbox is not switched on (config/inbox.yml).
      </p>
      <p
        v-else-if="inboxState === 'error'"
        class="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/20"
      >
        The request counts could not be loaded. The inbox Worker needs the
        <code>/stats</code> address: in the PDF_Requests repository run
        <code>npm run deploy</code> from the <code>worker</code> folder.
      </p>

      <template v-else>
        <div class="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div
            v-for="tile in tiles"
            :key="tile.label"
            class="rounded-2xl bg-base-foreground p-5 ring-1 ring-base-border/40"
          >
            <div class="text-3xl font-bold tabular-nums text-base-content">
              <span
                v-if="!inbox"
                class="wid-skeleton inline-block h-8 w-16 rounded align-middle"
              />
              <template v-else>{{ tile.value }}</template>
            </div>
            <div class="mt-1 text-sm font-medium text-base-content/80">
              {{ tile.label }}
            </div>
            <div
              v-if="inbox && tile.note"
              class="mt-0.5 text-xs text-base-content/55"
            >
              {{ tile.note }}
            </div>
          </div>
        </div>

        <!-- Monthly chart -->
        <div
          v-if="inbox && months.length"
          class="mt-8 rounded-2xl bg-base-foreground p-5 sm:p-6 ring-1 ring-base-border/40"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h3 class="text-base font-semibold text-base-content">
              Requests per month
            </h3>
            <button
              type="button"
              class="text-sm text-primary-color dark:text-secondary-color underline underline-offset-2 print:hidden"
              @click="asTable = !asTable"
            >
              {{ asTable ? 'Show as chart' : 'Show as table' }}
            </button>
          </div>
          <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-base-content/70">
            <li
              v-for="s in SERIES"
              :key="s.key"
              class="inline-flex items-center gap-2"
            >
              <span
                class="inline-block size-3 rounded-sm"
                :style="{ background: `var(--wid-impact-${s.key})` }"
              />
              {{ s.label }}
            </li>
          </ul>

          <table
            v-if="asTable"
            class="mt-4 w-full text-sm tabular-nums"
          >
            <thead>
              <tr class="text-left text-base-content/60">
                <th class="py-1 pr-4 font-medium">Month</th>
                <th
                  v-for="s in SERIES"
                  :key="s.key"
                  class="py-1 pr-4 font-medium text-right"
                >
                  {{ s.label }}
                </th>
                <th class="py-1 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in months"
                :key="m.month"
                class="border-t border-base-border/30"
              >
                <td class="py-1 pr-4">{{ monthName(m.month) }}</td>
                <td
                  v-for="s in SERIES"
                  :key="s.key"
                  class="py-1 pr-4 text-right"
                >
                  {{ m[s.key] }}
                </td>
                <td class="py-1 text-right font-semibold">{{ m.total }}</td>
              </tr>
            </tbody>
          </table>

          <div
            v-else
            class="wid-impact-chart mt-4"
          >
            <div class="flex gap-3">
              <!-- y axis -->
              <div
                class="flex flex-col justify-between text-right text-xs tabular-nums text-base-content/50 h-56 -mt-1.5 -mb-1.5"
                aria-hidden="true"
              >
                <span
                  v-for="t in ticks"
                  :key="t"
                  >{{ t }}</span
                >
              </div>
              <div class="relative flex-1 min-w-0">
                <!-- grid -->
                <div
                  class="absolute inset-x-0 top-0 h-56 flex flex-col justify-between pointer-events-none"
                  aria-hidden="true"
                >
                  <div
                    v-for="t in ticks"
                    :key="t"
                    class="border-t border-base-border/30"
                  />
                </div>
                <div
                  class="relative h-56 flex items-end gap-1 sm:gap-2"
                  role="img"
                  :aria-label="`Requests per month, ${monthName(months[0].month)} to ${monthName(months[months.length - 1].month)}. Use “Show as table” for the numbers.`"
                >
                  <div
                    v-for="(m, i) in months"
                    :key="m.month"
                    class="relative flex-1 h-full flex flex-col justify-end items-stretch cursor-default"
                    @mouseenter="hover = i"
                    @mouseleave="hover = null"
                  >
                    <div
                      class="mx-auto w-full max-w-[2.5rem] flex flex-col-reverse gap-[2px]"
                      :class="{ 'opacity-80': hover !== null && hover !== i }"
                    >
                      <div
                        v-for="(s, k) in SERIES"
                        v-show="m[s.key]"
                        :key="s.key"
                        :style="{
                          height: `${(m[s.key] / scaleMax) * 14}rem`,
                          background: `var(--wid-impact-${s.key})`
                        }"
                        :class="{ 'rounded-t': isTop(m, k) }"
                      />
                    </div>
                    <div
                      v-if="hover === i"
                      class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 w-max rounded-lg bg-base-content px-3 py-2 text-xs text-base-background shadow-lg"
                      :style="tooltipEdge(i)"
                    >
                      <div class="font-semibold">{{ monthName(m.month) }}</div>
                      <div
                        v-for="s in SERIES"
                        :key="s.key"
                        class="flex justify-between gap-4 tabular-nums"
                      >
                        <span>{{ s.label }}</span><span>{{ m[s.key] }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- x labels -->
                <div class="mt-2 flex gap-1 sm:gap-2 text-[0.7rem] text-base-content/55">
                  <div
                    v-for="(m, i) in months"
                    :key="m.month"
                    class="flex-1 text-center whitespace-nowrap overflow-visible"
                  >
                    <template v-if="showLabel(i)">{{ shortMonth(m.month) }}</template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="inbox"
          class="mt-6 grid gap-6 lg:grid-cols-2"
        >
          <!-- Most requested -->
          <div class="rounded-2xl bg-base-foreground p-5 sm:p-6 ring-1 ring-base-border/40">
            <h3 class="text-base font-semibold text-base-content">
              Most requested references
            </h3>
            <p
              v-if="!inbox.topReferences?.length"
              class="mt-3 text-sm text-base-content/60"
            >
              No PDF requests yet.
            </p>
            <ol
              v-else
              class="mt-3 space-y-2 text-sm"
            >
              <li
                v-for="r in inbox.topReferences"
                :key="r.sourceId || r.title"
                class="flex gap-3"
              >
                <span class="w-6 shrink-0 text-right font-semibold tabular-nums text-base-content">{{
                  r.count
                }}</span>
                <span class="text-base-content/80">
                  <a
                    v-if="r.sourceId"
                    :href="`https://sfg.taxonworks.org/sources/${r.sourceId}`"
                    target="_blank"
                    rel="noopener"
                    title="Open the source in TaxonWorks"
                    class="text-primary-color dark:text-secondary-color hover:underline"
                    >{{ r.title }}</a
                  >
                  <template v-else>{{ r.title }}</template>
                </span>
              </li>
            </ol>
          </div>

          <!-- Error reports by type -->
          <div class="rounded-2xl bg-base-foreground p-5 sm:p-6 ring-1 ring-base-border/40">
            <h3 class="text-base font-semibold text-base-content">
              Error reports by type of problem
            </h3>
            <p
              v-if="!categories.length"
              class="mt-3 text-sm text-base-content/60"
            >
              No error reports yet.
            </p>
            <ul
              v-else
              class="mt-3 space-y-2 text-sm"
            >
              <li
                v-for="c in categories"
                :key="c.name"
              >
                <div class="flex justify-between gap-3 text-base-content/80">
                  <span>{{ c.name }}</span><span class="font-semibold tabular-nums text-base-content">{{ c.count }}</span>
                </div>
                <div class="mt-1 h-2 rounded bg-base-muted/50">
                  <div
                    class="h-2 rounded"
                    :style="{ width: `${(c.count / categories[0].count) * 100}%`, background: 'var(--wid-impact-correction)' }"
                  />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </section>

    <!-- Website visits -->
    <section class="container mx-auto px-4 mt-14">
      <h2 class="wid-impact-h2">Visits to the website</h2>
      <p class="mt-2 max-w-3xl text-sm text-base-content/60">
        From Cloudflare, which serves worldichneumonidae.com<template v-if="visits?.since">,
          {{ dayName(visits.since) }} to {{ dayName(visits.until) }}</template
        >. A visit is counted each time someone opens the site; moving between
        pages inside it is not counted again. Automated traffic is included, so
        treat the numbers as approximate.
      </p>

      <p
        v-if="!visits"
        class="mt-6 text-sm text-base-content/60"
      >
        {{ inbox ? 'Visit counts are not set up yet (CF_API_TOKEN in the inbox Worker).' : 'Loading…' }}
      </p>
      <p
        v-else-if="visits.error"
        class="mt-6 text-sm text-base-content/60"
      >
        {{ visits.error }}
      </p>

      <template v-else>
        <div class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            v-for="tile in visitTiles"
            :key="tile.label"
            class="rounded-2xl bg-base-foreground p-5 ring-1 ring-base-border/40"
          >
            <div class="text-3xl font-bold tabular-nums text-base-content">{{ tile.value }}</div>
            <div class="mt-1 text-sm font-medium text-base-content/80">{{ tile.label }}</div>
            <div
              v-if="tile.note"
              class="mt-0.5 text-xs text-base-content/55"
            >
              {{ tile.note }}
            </div>
          </div>
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2 rounded-2xl bg-base-foreground p-5 sm:p-6 ring-1 ring-base-border/40">
            <h3 class="text-base font-semibold text-base-content">Visits per month</h3>
            <ul class="mt-4 space-y-2 text-sm">
              <li
                v-for="m in visits.months"
                :key="m.month"
                class="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3"
              >
                <span class="text-base-content/70">{{ shortMonth(m.month) }}</span>
                <span class="h-3 rounded bg-base-muted/40">
                  <span
                    class="block h-3 rounded"
                    :style="{ width: `${(m.pageViews / maxMonthVisits) * 100}%`, background: 'var(--wid-impact-pdf)' }"
                  />
                </span>
                <span class="text-right font-semibold tabular-nums text-base-content">{{ nf(m.pageViews) }}</span>
              </li>
            </ul>
          </div>

          <div class="rounded-2xl bg-base-foreground p-5 sm:p-6 ring-1 ring-base-border/40">
            <h3 class="text-base font-semibold text-base-content">Where the traffic comes from</h3>
            <ul class="mt-4 space-y-2 text-sm">
              <li
                v-for="c in visits.countries"
                :key="c.code"
              >
                <div class="flex justify-between gap-3 text-base-content/80">
                  <span>{{ countryName(c.code) }}</span><span class="font-semibold tabular-nums text-base-content">{{ c.share }}%</span>
                </div>
                <div class="mt-1 h-2 rounded bg-base-muted/50">
                  <div
                    class="h-2 rounded"
                    :style="{ width: `${(c.share / visits.countries[0].share) * 100}%`, background: 'var(--wid-impact-correction)' }"
                  />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useHead } from '@unhead/vue'
import { makeAPIRequest } from '@/utils/request'
import { INBOX_ENDPOINT } from '@/components/Inbox/useInbox.js'
import PageHeader from './components/Home/PageHeader.vue'
import HomeStats from './components/Home/HomeStats.vue'

useHead({
  title: 'Impact - World Ichneumonidae Database (WID)',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})

const SERIES = [
  { key: 'pdf', label: 'PDF requests' },
  { key: 'publication', label: 'Missing publications' },
  { key: 'correction', label: 'Error reports' }
]


// ---- inbox counts, from the Worker's /stats ----
const inbox = ref(null)
const inboxState = ref(INBOX_ENDPOINT ? 'loading' : 'off')
const asTable = ref(false)
const hover = ref(null)

const nf = (n) => Number(n || 0).toLocaleString('en-US')
const plural = (n, one, many) => `${nf(n)} ${Number(n) === 1 ? one : many}`
const days = (d) => (d == null ? '—' : d < 1 ? 'under a day' : `${d} day${d === 1 ? '' : 's'}`)

const tiles = computed(() => {
  const t = inbox.value?.types || {}
  const pdf = t.pdf || {}
  return [
    {
      label: 'PDF requests',
      value: nf(pdf.total),
      note: `${nf(pdf.fulfilled)} answered · ${nf(pdf.unavailable)} not available · ${nf(pdf.open)} open`
    },
    {
      label: 'Typical time to answer',
      value: days(pdf.medianDaysToClose),
      note: 'median, PDF requests'
    },
    {
      label: 'Missing publications',
      value: nf(t.publication?.total),
      note: `${nf(t.publication?.closed)} handled`
    },
    {
      label: 'Error reports',
      value: nf(t.correction?.total),
      note: `${nf(t.correction?.closed)} handled`
    },
    {
      label: 'People who wrote',
      value: nf(inbox.value?.people),
      note: `from ${plural(inbox.value?.institutions, 'institution', 'institutions')}`
    }
  ]
})

// every month from the first request to now, empty months included (last 36)
const months = computed(() => {
  if (!inbox.value?.since) return []
  const byMonth = Object.fromEntries((inbox.value.monthly || []).map((m) => [m.month, m]))
  const out = []
  const d = new Date(inbox.value.since.slice(0, 7) + '-01T00:00:00Z')
  const now = new Date()
  while (d <= now) {
    const key = d.toISOString().slice(0, 7)
    const m = byMonth[key] || {}
    const row = { month: key, pdf: m.pdf || 0, publication: m.publication || 0, correction: m.correction || 0 }
    row.total = row.pdf + row.publication + row.correction
    out.push(row)
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return out.slice(-36)
})

// a "nice" top for the y axis, and four gridlines
const scaleMax = computed(() => {
  const max = Math.max(1, ...months.value.map((m) => m.total))
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => s * 4 >= max) || Math.ceil(max / 4)
  return step * 4
})
const ticks = computed(() => [4, 3, 2, 1, 0].map((i) => (scaleMax.value / 4) * i))

const isTop = (m, k) => SERIES.slice(k + 1).every((s) => !m[s.key])
const showLabel = (i) => {
  const n = months.value.length
  const every = n > 24 ? 6 : n > 12 ? 3 : 1
  return (n - 1 - i) % every === 0
}
const tooltipEdge = (i) => {
  const n = months.value.length
  if (i < 2) return { left: '0', transform: 'none' }
  if (i > n - 3) return { left: 'auto', right: '0', transform: 'none' }
  return {}
}

const monthName = (ym) =>
  new Date(ym + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortMonth = (ym) =>
  new Date(ym + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })

// ---- visits (Cloudflare), delivered with the inbox counts ----
const visits = computed(() => inbox.value?.visits ?? null)
const maxMonthVisits = computed(() => Math.max(1, ...(visits.value?.months || []).map((m) => m.pageViews)))
const visitTiles = computed(() => {
  const v = visits.value
  if (!v || v.error) return []
  const months = v.months || []
  const full = months.length > 1 ? months[months.length - 2] : months[0]
  return [
    { label: 'Visits', value: nf(v.pageViews), note: `${nf(v.days)} days` },
    { label: 'Visitors per day', value: nf(v.avgDailyVisitors), note: 'average' },
    { label: `Visits in ${full ? monthName(full.month) : '—'}`, value: nf(full?.pageViews), note: 'last full month' },
    {
      label: 'Top country',
      value: v.countries?.[0] ? countryName(v.countries[0].code) : '—',
      note: v.countries?.[0] ? `${v.countries[0].share}% of the traffic` : ''
    }
  ]
})
const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
const countryName = (code) => {
  try {
    return regionNames?.of(code) || code
  } catch {
    return code
  }
}
const dayName = (d) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const categories = computed(() =>
  Object.entries(inbox.value?.types?.correction?.categories || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
)

// ---- database counts, for the summary paragraph ----
const db = ref(null)

async function loadDatabase() {
  try {
    const [{ data }, species] = await Promise.all([
      makeAPIRequest('/stats'),
      makeAPIRequest('/taxon_names.json', {
        params: { page: 1, per: 1, validity: true, rank: ['NomenclaturalRank::Iczn::SpeciesGroup::Species'] }
      })
    ])
    const s = data?.data || {}
    db.value = {
      species: Number(species.headers['pagination-total']) || null,
      names: s['Taxon names'],
      references: s['Project sources'],
      citations: s['Citations'],
      images: s['Images'],
      specimens: s['Collection objects']
    }
  } catch {
    db.value = {}
  }
}

async function loadInbox() {
  if (!INBOX_ENDPOINT) return
  try {
    const url = INBOX_ENDPOINT.replace(/\/request\/?$/, '') + '/stats'
    // the Worker keeps its own hourly copy; skip the browser's, so a new deploy shows at once
    const res = await fetch(url, { cache: 'no-cache' })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error()
    inbox.value = data
    inboxState.value = 'ok'
  } catch {
    inboxState.value = 'error'
  }
}

const summary = computed(() => {
  if (!db.value || inboxState.value === 'loading') return ''
  const d = db.value
  const parts = []
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const dbBits = [
    d.species && `${nf(d.species)} valid species`,
    d.names && `${nf(d.names)} scientific names`,
    d.references && `${nf(d.references)} references`,
    d.citations && `${nf(d.citations)} citations`,
    d.images && `${nf(d.images)} images`,
    d.specimens && `${nf(d.specimens)} specimen records`
  ].filter(Boolean)
  if (dbBits.length) {
    parts.push(
      `As of ${today}, the World Ichneumonidae Database (WID, worldichneumonidae.com) holds ${list(dbBits)}, curated in TaxonWorks by an international team of specialists.`
    )
  }
  const t = inbox.value?.types
  if (t) {
    const since = monthName(inbox.value.since?.slice(0, 7) || '')
    parts.push(
      `Since ${since}, users have sent ${nf(t.pdf.total)} PDF requests (${nf(t.pdf.fulfilled)} answered, with a median response time of ${days(t.pdf.medianDaysToClose)}), ${nf(t.publication.total)} missing publications and ${nf(t.correction.total)} error reports, from ${plural(inbox.value.people, 'person', 'people')} at ${plural(inbox.value.institutions, 'institution', 'institutions')}.`
    )
  }
  const v = visits.value
  if (v && !v.error && v.days) {
    parts.push(
      `Over the last ${nf(v.days)} days the website was opened ${nf(v.pageViews)} times, by about ${nf(v.avgDailyVisitors)} visitors a day.`
    )
  }
  return parts.join(' ')
})

function list(items) {
  return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]
}

const copied = ref(false)
async function copySummary() {
  try {
    await navigator.clipboard.writeText(summary.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {}
}

const print = () => window.print()

onMounted(() => {
  loadDatabase()
  loadInbox()
})
</script>

<style scoped>
.wid-impact {
  --wid-impact-pdf: #2a62b7;
  --wid-impact-publication: #b97c00;
  --wid-impact-correction: #00918b;
}
:global(html.dark) .wid-impact {
  --wid-impact-pdf: #5b8ee0;
  --wid-impact-publication: #b8820f;
  --wid-impact-correction: #22a8a2;
}
.wid-impact-h2 {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: rgb(var(--color-base-content));
}
@media print {
  .wid-impact-chart * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
