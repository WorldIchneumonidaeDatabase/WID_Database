<template>
  <section class="ci rounded-xl bg-base-foreground ring-1 ring-base-border/40 p-4">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="font-semibold text-base-content mr-2">Overview</h2>
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        class="rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-base-border"
        :class="tab === t.id ? 'bg-primary-color text-white dark:bg-secondary-color dark:text-black' : 'text-base-content hover:bg-base-muted/40'"
        :aria-pressed="tab === t.id"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 1. species per subfamily -->
    <div
      v-if="tab === 'subfamilies'"
      class="mt-4"
    >
      <p class="ci-help">Species per subfamily, most first. Click a bar to jump to that part of the list.</p>
      <ul class="mt-3 grid gap-1">
        <li
          v-for="s in subfamilies"
          :key="s.name"
        >
          <button
            type="button"
            class="ci-hbar w-full"
            :title="`${s.name}: ${s.n} species`"
            @click="$emit('goto-subfamily', s.name)"
          >
            <span class="ci-hname">{{ s.name }}</span>
            <span class="ci-htrack"><span
              class="ci-hfill"
              :style="{ width: `${(s.n / subfamilies[0].n) * 100}%` }"
            /></span>
            <span class="ci-hn">{{ s.n }}</span>
          </button>
        </li>
      </ul>
    </div>

    <!-- 2. species × region table -->
    <div
      v-else-if="tab === 'table'"
      class="mt-4"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p class="ci-help">
          <span class="ci-sym">○</span> literature · <span class="ci-sym">●</span> specimens · <span class="ci-sym">◉</span> both
          <template v-if="table.groups.some((g) => g.area)"> · <span class="ci-band-key" /> recorded only for the wider area (e.g. North Italy)</template>
        </p>
        <button
          type="button"
          class="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-base-border text-base-content hover:bg-base-muted/40"
          @click="$emit('download', { name: 'table', content: tableCSV(table) })"
        >
          Download table (CSV)
        </button>
      </div>
      <div class="ci-tablewrap mt-3">
        <table class="ci-table">
          <thead>
            <tr v-if="table.groups.some((g) => g.label)">
              <th />
              <th
                v-for="g in table.groups"
                :key="g.label + g.columns[0]"
                :colspan="g.columns.length"
                class="ci-group"
              >
                {{ g.label }}
              </th>
            </tr>
            <tr>
              <th class="ci-corner">Taxon</th>
              <th
                v-for="c in table.columns"
                :key="c"
                class="ci-col"
              >
                <span>{{ c }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in table.rows"
              :key="r.name + r.authorship"
            >
              <th class="ci-taxon">
                <i>{{ r.name }}</i>
              </th>
              <td
                v-for="(cell, i) in r.cells"
                :key="i"
                :class="{ 'ci-band': cell.band && !cell.kind }"
                :title="cellTitle(r, i, cell)"
              >
                {{ SYM[cell.kind] || '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. discovery curve -->
    <div
      v-else-if="tab === 'discovery'"
      class="mt-4"
    >
      <p class="ci-help">
        Species known from {{ place }} over time, by the year of their first record (publication year or collecting year).
        <template v-if="curve.undated"> {{ curve.undated }} species without a dated record are not counted.</template>
      </p>
      <svg
        v-if="curve.points.length"
        :viewBox="`0 0 ${CW} ${CH}`"
        class="ci-svg mt-2"
        role="img"
        :aria-label="`Discovery curve: ${curve.points.map((p) => `${p.year}: ${p.n}`).join(', ')}`"
        @mousemove="onCurveMove"
        @mouseleave="hoverYear = null"
      >
        <line
          v-for="tk in curveYTicks"
          :key="`y${tk}`"
          :x1="PAD_L"
          :x2="CW - PAD_R"
          :y1="cy(tk)"
          :y2="cy(tk)"
          class="ci-grid"
        />
        <text
          v-for="tk in curveYTicks"
          :key="`yt${tk}`"
          :x="PAD_L - 6"
          :y="cy(tk) + 4"
          text-anchor="end"
          class="ci-tick"
        >{{ tk }}</text>
        <text
          v-for="tk in curveXTicks"
          :key="`xt${tk}`"
          :x="cx(tk)"
          :y="CH - 8"
          text-anchor="middle"
          class="ci-tick"
        >{{ tk }}</text>
        <path
          :d="curvePath"
          class="ci-line"
        />
        <template v-if="hoverPoint">
          <line
            :x1="cx(hoverPoint.year)"
            :x2="cx(hoverPoint.year)"
            :y1="PAD_T"
            :y2="CH - PAD_B"
            class="ci-cross"
          />
          <circle
            :cx="cx(hoverPoint.year)"
            :cy="cy(hoverPoint.n)"
            r="4.5"
            class="ci-dot"
          />
          <text
            :x="Math.min(cx(hoverPoint.year) + 8, CW - 120)"
            :y="PAD_T + 14"
            class="ci-tip"
          >{{ hoverPoint.year }}: {{ hoverPoint.n }} species</text>
        </template>
      </svg>
      <p
        v-else
        class="ci-help mt-2"
      >
        No dated records yet.
      </p>
    </div>

    <!-- 4. literature -->
    <div
      v-else-if="tab === 'literature'"
      class="mt-4 grid gap-6 lg:grid-cols-2"
    >
      <div>
        <p class="ci-help">Literature records per decade of publication.</p>
        <svg
          v-if="decades.length"
          :viewBox="`0 0 ${CW} ${CH}`"
          class="ci-svg mt-2"
          role="img"
          :aria-label="`Literature records per decade: ${decades.map((d) => `${d.decade}s: ${d.n}`).join(', ')}`"
        >
          <g
            v-for="(d, i) in decades"
            :key="d.decade"
          >
            <title>{{ d.decade }}s: {{ d.n }} record{{ d.n === 1 ? '' : 's' }}</title>
            <rect
              :x="dx(i)"
              :y="PAD_T"
              :width="dw"
              :height="CH - PAD_T - PAD_B"
              fill="transparent"
            />
            <path
              v-if="d.n"
              :d="barPath(dx(i), dw, dy(d.n), CH - PAD_B)"
              class="ci-bar"
            />
            <text
              v-if="d.n === decMax"
              :x="dx(i) + dw / 2"
              :y="dy(d.n) - 5"
              text-anchor="middle"
              class="ci-tick ci-strong"
            >{{ d.n }}</text>
            <text
              v-if="i % decStep === 0"
              :x="dx(i) + dw / 2"
              :y="CH - 8"
              text-anchor="middle"
              class="ci-tick"
            >{{ d.decade }}</text>
          </g>
          <line
            :x1="PAD_L"
            :x2="CW - PAD_R"
            :y1="CH - PAD_B"
            :y2="CH - PAD_B"
            class="ci-axis"
          />
        </svg>
      </div>
      <div>
        <p class="ci-help">Works contributing most records.</p>
        <ul class="mt-3 grid gap-1">
          <li
            v-for="w in works"
            :key="w.work"
            class="ci-hbar"
            :title="`${w.work}: ${w.records} records, ${w.taxa} taxa`"
          >
            <span class="ci-hname ci-hname-wide">{{ w.work }}</span>
            <span class="ci-htrack"><span
              class="ci-hfill"
              :style="{ width: `${(w.records / works[0].records) * 100}%` }"
            /></span>
            <span class="ci-hn">{{ w.records }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- 6. literature vs specimens -->
    <div
      v-else-if="tab === 'litspec'"
      class="mt-4"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 ci-help">
        <span>Species per {{ placeWord }}, by how they are known.</span>
        <span class="inline-flex items-center gap-1"><i class="ci-sw" :style="{ background: COL.lit }" /> literature only</span>
        <span class="inline-flex items-center gap-1"><i class="ci-sw" :style="{ background: COL.both }" /> both</span>
        <span class="inline-flex items-center gap-1"><i class="ci-sw" :style="{ background: COL.spec }" /> specimens only</span>
      </div>
      <ul class="mt-3 grid gap-1">
        <li
          v-for="r in litspec"
          :key="r.region"
          class="ci-hbar"
          :title="`${r.region}: ${r.lit} literature only, ${r.both} both, ${r.spec} specimens only`"
        >
          <span class="ci-hname">{{ r.region }}</span>
          <span class="ci-htrack ci-stack">
            <span
              v-for="k in ['lit', 'both', 'spec']"
              v-show="r[k]"
              :key="k"
              :style="{ width: `${(r[k] / litspecMax) * 100}%`, background: COL[k] }"
            />
          </span>
          <span class="ci-hn">{{ r.total }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { insetAreas } from './checklist.js'
import { evidence, subfamilyCounts, speciesRegionTable, tableCSV, discoveryCurve, literatureByDecade, topWorks, litVsSpecimens } from './insights.js'

// Charts of a country checklist (tabs). The data-gaps view is on the map ("Colour by").
const props = defineProps({
  checklist: { type: Object, required: true },
  rows: { type: Array, default: () => [] },
  citations: { type: Object, default: null },
  country: { type: String, required: true },
  place: { type: String, default: '' },
  placeWord: { type: String, default: 'region' }
})
defineEmits(['goto-subfamily', 'download'])

const TABS = [
  { id: 'subfamilies', label: 'Subfamilies' },
  { id: 'table', label: 'Species × region' },
  { id: 'discovery', label: 'Discovery curve' },
  { id: 'literature', label: 'Literature' },
  { id: 'litspec', label: 'Literature vs specimens' }
]
const tab = ref('subfamilies')
const SYM = { lit: '○', spec: '●', both: '◉' }
// categorical slots 1–3 of the validated reference palette (all-pairs safe)
const COL = { lit: '#2a78d6', both: '#1baf7a', spec: '#eb6834' }

const ev = computed(() => evidence(props.rows, props.country, props.citations))
const subfamilies = computed(() => subfamilyCounts(props.checklist))
const table = computed(() => speciesRegionTable(props.checklist, props.country, insetAreas(props.country)))
function cellTitle(r, i, cell) {
  const where = props.checklist && table.value.columns[i]
  const what = { lit: 'literature', spec: 'specimens', both: 'literature and specimens' }[cell.kind]
  return what ? `${r.name} — ${where}: ${what}` : cell.band ? `${r.name} — ${cell.band}` : `${r.name} — ${where}: no record`
}
const curve = computed(() => discoveryCurve(ev.value, props.checklist))
const decades = computed(() => literatureByDecade(ev.value))
const works = computed(() => topWorks(ev.value, 10))
const litspec = computed(() => litVsSpecimens(props.checklist, props.country))
const litspecMax = computed(() => Math.max(1, ...litspec.value.map((r) => r.total)))

// ---- chart geometry (one axis each)
const CW = 640
const CH = 220
const PAD_L = 40
const PAD_R = 12
const PAD_T = 14
const PAD_B = 26
const yearsSpan = computed(() => {
  const p = curve.value.points
  if (!p.length) return [0, 1]
  const a = p[0].year
  const b = Math.max(p[p.length - 1].year, new Date().getFullYear())
  return [a, b === a ? a + 1 : b]
})
const cx = (y) => PAD_L + ((y - yearsSpan.value[0]) / (yearsSpan.value[1] - yearsSpan.value[0])) * (CW - PAD_L - PAD_R)
const curveMax = computed(() => Math.max(1, curve.value.total - curve.value.undated))
const cy = (n) => CH - PAD_B - (n / curveMax.value) * (CH - PAD_T - PAD_B)
const nice = (max, n = 4) => {
  const step = Math.max(1, Math.ceil(max / n / Math.pow(10, Math.floor(Math.log10(max / n || 1)))) * Math.pow(10, Math.floor(Math.log10(max / n || 1))))
  const out = []
  for (let v = 0; v <= max; v += step) out.push(Math.round(v))
  return out
}
const curveYTicks = computed(() => nice(curveMax.value))
const curveXTicks = computed(() => {
  const [a, b] = yearsSpan.value
  const step = b - a > 120 ? 50 : b - a > 50 ? 25 : 10
  const out = []
  for (let y = Math.ceil(a / step) * step; y <= b; y += step) out.push(y)
  return out
})
// step line: flat until the next species is first recorded
const curvePath = computed(() => {
  const p = curve.value.points
  if (!p.length) return ''
  let d = `M${cx(p[0].year)},${cy(0)}V${cy(p[0].n)}`
  for (let i = 1; i < p.length; i++) d += `H${cx(p[i].year)}V${cy(p[i].n)}`
  return d + `H${cx(yearsSpan.value[1])}`
})
const hoverYear = ref(null)
function onCurveMove(e) {
  const svg = e.currentTarget
  const r = svg.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * CW
  const [a, b] = yearsSpan.value
  hoverYear.value = Math.round(a + ((x - PAD_L) / (CW - PAD_L - PAD_R)) * (b - a))
}
const hoverPoint = computed(() => {
  if (hoverYear.value == null) return null
  const p = curve.value.points.filter((q) => q.year <= hoverYear.value)
  const y = Math.max(yearsSpan.value[0], Math.min(hoverYear.value, yearsSpan.value[1]))
  return { year: y, n: p.length ? p[p.length - 1].n : 0 }
})

const decMax = computed(() => Math.max(1, ...decades.value.map((d) => d.n)))
const dStepW = computed(() => (CW - PAD_L - PAD_R) / Math.max(1, decades.value.length))
const dw = computed(() => Math.max(2, Math.min(36, dStepW.value - 3)))
const dx = (i) => PAD_L + i * dStepW.value + (dStepW.value - dw.value) / 2
const dy = (n) => CH - PAD_B - (n / decMax.value) * (CH - PAD_T - PAD_B - 10)
const decStep = computed(() => Math.max(1, Math.ceil(decades.value.length / 10)))
function barPath(x, w, top, base) {
  const r = Math.min(3, w / 2, base - top)
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`
}
</script>

<style scoped>
.ci-help {
  font-size: 0.85rem;
  opacity: 0.75;
}
.ci-hbar {
  width: 100%;
  display: grid;
  grid-template-columns: 10rem 1fr 3rem;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  text-align: left;
  padding: 0.12rem 0;
}
button.ci-hbar:hover .ci-hname {
  text-decoration: underline;
}
.ci-hname {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ci-hname-wide {
  white-space: normal;
}
.ci-htrack {
  height: 0.8rem;
  display: flex;
  gap: 2px;
}
.ci-hfill {
  display: block;
  height: 100%;
  min-width: 2px;
  background: #2a78d6;
  border-radius: 0 4px 4px 0;
}
.ci-stack span {
  display: block;
  height: 100%;
  min-width: 3px;
}
.ci-stack span:last-of-type {
  border-radius: 0 4px 4px 0;
}
.ci-hn {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.ci-sw {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 2px;
}
.ci-sym {
  font-size: 1rem;
}
.ci-band-key {
  display: inline-block;
  width: 1.2rem;
  height: 0.8rem;
  vertical-align: middle;
  background: repeating-linear-gradient(135deg, rgba(42, 120, 214, 0.22) 0 3px, transparent 3px 6px);
  border: 1px solid rgba(42, 120, 214, 0.4);
}
.ci-tablewrap {
  overflow: auto;
  max-height: 34rem;
  border: 1px solid rgba(127, 127, 127, 0.25);
  border-radius: 0.5rem;
}
.ci-table {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.8rem;
}
.ci-table th,
.ci-table td {
  border-bottom: 1px solid rgba(127, 127, 127, 0.18);
}
.ci-table thead th {
  position: sticky;
  top: 0;
  background: rgb(var(--color-base-foreground, 255, 255, 255));
  z-index: 1;
}
.ci-table thead tr:nth-child(2) th {
  top: 1.6rem;
}
.ci-group {
  font-weight: 700;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.3rem 0.4rem;
  border-left: 2px solid rgba(127, 127, 127, 0.35);
  white-space: nowrap;
}
.ci-col {
  height: 8.5rem;
  vertical-align: bottom;
  padding: 0 0.15rem 0.4rem;
  font-weight: 500;
  white-space: nowrap;
}
.ci-col span {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
.ci-corner,
.ci-taxon {
  position: sticky;
  left: 0;
  background: rgb(var(--color-base-foreground, 255, 255, 255));
  text-align: left;
  padding: 0.25rem 0.6rem 0.25rem 0.3rem;
  white-space: nowrap;
  font-weight: 500;
  z-index: 2;
}
.ci-table td {
  min-width: 1.6rem;
  text-align: center;
  font-size: 0.95rem;
  line-height: 1.5rem;
}
.ci-band {
  background: repeating-linear-gradient(135deg, rgba(42, 120, 214, 0.18) 0 3px, transparent 3px 6px);
}
.ci-svg {
  width: 100%;
  height: auto;
  display: block;
}
.ci-grid {
  stroke: currentColor;
  stroke-opacity: 0.12;
}
.ci-axis {
  stroke: currentColor;
  stroke-opacity: 0.35;
}
.ci-tick {
  font: 500 11px system-ui, sans-serif;
  fill: currentColor;
  fill-opacity: 0.65;
}
.ci-strong {
  font-weight: 700;
  fill-opacity: 1;
}
.ci-line {
  fill: none;
  stroke: #2a78d6;
  stroke-width: 2;
  stroke-linejoin: round;
}
.ci-bar {
  fill: #2a78d6;
}
.ci-cross {
  stroke: currentColor;
  stroke-opacity: 0.35;
  stroke-dasharray: 3 3;
}
.ci-dot {
  fill: #2a78d6;
  stroke: rgb(var(--color-base-foreground, 255, 255, 255));
  stroke-width: 2;
}
.ci-tip {
  font: 700 12px system-ui, sans-serif;
  fill: currentColor;
}
.ci,
.ci-svg {
  color: inherit;
}
</style>
