<template>
  <div class="rounded-xl bg-base-foreground ring-1 ring-base-border/40 p-4">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 class="font-semibold text-base-content">
        <template v-if="focus">Map of <i>{{ focus }}</i></template>
        <template v-else>{{ byCounty ? 'Taxa per county' : metricOn ? (colorBy === 'works' ? `Works per ${placeWord}` : `Latest record per ${placeWord}`) : `Taxa per ${placeWord}` }}</template>
        <span class="font-normal text-base-content/60"> · {{ [county ? county + (/^United States/.test(country) ? ' Co.' : '') : '', region, country].filter(Boolean).join(', ') }}</span>
      </h2>
      <button
        v-if="focus"
        type="button"
        class="text-sm font-semibold text-primary-color dark:text-secondary-color hover:underline"
        @click="$emit('clear-focus')"
      >
        Show all taxa
      </button>
      <label class="ml-auto flex items-center gap-2 text-sm text-base-content/80">
        <input
          v-model="showPoints"
          type="checkbox"
        />
        Specimens with coordinates ({{ points.length }})
      </label>
    </div>

    <div class="relative mt-3">
      <div
        ref="mapEl"
        class="checklist-map h-[440px] w-full rounded-lg overflow-hidden"
      />
      <!-- legend -->
      <div
        v-if="legend.length"
        class="absolute bottom-3 left-3 z-[500] rounded-lg bg-white/90 px-3 py-2 text-xs text-gray-800 shadow"
      >
        <div
          v-if="!focus"
          class="font-semibold mb-1"
        >
          {{ metricOn ? (colorBy === 'works' ? 'Works' : 'Latest record') : 'Taxa' }}
        </div>
        <div
          v-for="l in legend"
          :key="l.label"
          class="flex items-center gap-2"
        >
          <span
            class="inline-block h-3 w-5 rounded-sm ring-1 ring-black/10"
            :style="{ background: l.color }"
          />{{ l.label }}
        </div>
        <div
          v-if="showPoints && points.length"
          class="flex items-center gap-2 mt-1"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
            :style="{ background: pointColor }"
          />Specimen
        </div>
      </div>
      <p
        v-if="status"
        class="absolute inset-0 z-[500] flex items-center justify-center text-sm text-base-content/70 bg-base-foreground/70"
      >
        {{ status }}
      </p>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-base-content/80">
      <label
        v-if="gaps && !byCounty && !focus"
        class="flex items-center gap-2"
      >
        Colour by
        <select
          v-model="colorBy"
          class="rounded-lg px-2 py-1.5 ring-1 ring-base-border bg-base-foreground text-base-content"
        >
          <option
            v-for="o in COLOR_BY"
            :key="o.id"
            :value="o.id"
          >
            {{ o.label }}
          </option>
        </select>
      </label>
      <label class="flex items-center gap-2">
        Colours
        <select
          v-model="palette"
          class="rounded-lg px-2 py-1.5 ring-1 ring-base-border bg-base-foreground text-base-content"
        >
          <option
            v-for="(p, k) in PALETTES"
            :key="k"
            :value="k"
          >
            {{ p.label }}
          </option>
          <option value="custom">Custom…</option>
        </select>
      </label>
      <label
        v-if="palette === 'custom'"
        class="flex items-center gap-2"
      >
        Colour
        <input
          v-model="customColor"
          type="color"
          class="h-8 w-10 cursor-pointer rounded bg-transparent"
        />
      </label>
      <label class="flex items-center gap-2">
        Points
        <input
          v-model="pointColor"
          type="color"
          class="h-8 w-10 cursor-pointer rounded bg-transparent"
        />
      </label>
      <span class="flex items-center gap-1">
        <span
          v-for="c in ramp"
          :key="c"
          class="inline-block h-3 w-5 ring-1 ring-black/10"
          :style="{ background: c }"
        />
      </span>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span class="text-base-content/60">Map:</span>
      <button
        v-for="d in mapDownloads"
        :key="d.label"
        type="button"
        class="rounded-lg px-3 py-1.5 font-semibold ring-1 ring-base-border text-base-content hover:bg-base-muted/40"
        :title="d.title"
        @click="d.run"
      >
        {{ d.label }}
      </button>
      <span class="text-xs text-base-content/55 ml-auto">
        Click a {{ placeWord }} to see its checklist. Boundaries: Natural Earth<template v-if="byCounty">; counties: US Census (us-atlas)</template>.
        <template v-if="unmatched.length"> Not on the map: {{ unmatched.join(', ') }}.</template>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { regionName, download } from './checklist.js'
import { chooseLevel, placeCounts, breaks, classOf, rampFor, rampFromColor, PALETTES, specimenPoints, toGeoJSON, toKML } from './mapData.js'

// Map of a country checklist: places coloured by number of taxa (or, for one taxon, where it
// is recorded), specimen points, click a place to filter; downloads SVG, PNG, GeoJSON, KML.
// Boundary files: public/checklist-maps (see README.markdown).

const props = defineProps({
  country: { type: String, required: true },
  checklist: { type: Object, required: true },
  rows: { type: Array, default: () => [] },
  region: { type: String, default: '' },
  county: { type: String, default: '' },
  byCounty: { type: Boolean, default: false },
  focus: { type: String, default: '' },
  // data gaps per region: Map(region → { works, latest }) — for "Colour by"
  gaps: { type: Object, default: null },
  placeWord: { type: String, default: 'region' }
})
const emit = defineEmits(['select-region', 'select-county', 'clear-focus'])

// colours: a palette (or one custom colour) and the colour of the specimen points,
// remembered in this browser
const COLORS_KEY = 'wid-checklist-map-colors'
const saved = (() => { try { return JSON.parse(localStorage.getItem(COLORS_KEY) || '{}') } catch (e) { return {} } })()
const palette = ref(saved.palette in PALETTES || saved.palette === 'custom' ? saved.palette : 'blue')
const customColor = ref(saved.customColor || '#2b7a78')
const pointColor = ref(saved.pointColor || '#e8590c')
const ramp = computed(() => (palette.value === 'custom' ? rampFromColor(customColor.value) : PALETTES[palette.value].ramp))
// what the colours show: taxa (default), or the data gaps — number of works, latest year
const colorBy = ref('taxa')
const COLOR_BY = [
  { id: 'taxa', label: 'Number of taxa' },
  { id: 'works', label: 'Number of works (references)' },
  { id: 'latest', label: 'Year of the latest record' }
]
const metricOn = computed(() => colorBy.value !== 'taxa' && !props.byCounty && !props.focus && props.gaps)
const metricOf = (name) => (props.gaps?.get(name) || {})[colorBy.value === 'works' ? 'works' : 'latest'] || 0
watch([palette, customColor, pointColor, colorBy], () => {
  try { localStorage.setItem(COLORS_KEY, JSON.stringify({ palette: palette.value, customColor: customColor.value, pointColor: pointColor.value })) } catch (e) { /* ignore */ }
  draw()
})

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'checklist-maps/'
const mapEl = ref(null)
const status = ref('Loading the map…')
const showPoints = ref(true)
const boundaries = shallowRef(null) // { admin1, regions }
const counties = shallowRef(null)
let L = null
let map = null
let placeLayer = null
let countyLayer = null
let pointLayer = null
let renderer = null
let selectedCounty = null
const fileCache = new Map()

async function getJSON(name) {
  if (!fileCache.has(name)) fileCache.set(name, fetch(BASE + name).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  return fileCache.get(name)
}

async function loadBoundaries() {
  status.value = 'Loading the map…'
  boundaries.value = null
  const index = await getJSON('index.json')
  const a3 = index?.[props.country.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')]
  boundaries.value = a3 ? await getJSON(`${a3}.json`) : null
  if (!boundaries.value) status.value = `No boundaries for ${props.country} yet: specimens only.`
  else status.value = ''
  draw(true)
}

const placeNames = computed(() =>
  [...new Set(props.checklist.subfamilies.flatMap((s) => s.genera.flatMap((g) => g.taxa.flatMap((t) => t.regions.map((r) => r.region)))))]
    .filter((n) => n !== props.country)
)
const level = computed(() => (boundaries.value ? chooseLevel(boundaries.value, placeNames.value) : null))
const unmatched = computed(() => (level.value ? placeNames.value.filter((n) => !level.value.match.has(n)) : []))
const counts = computed(() => placeCounts(props.checklist, props.country, props.focus))
const points = computed(() =>
  specimenPoints(props.rows, { focus: props.focus, region: props.region, regionOf: (r) => regionName(r.stateProvince) || props.country })
)

// colour classes
const scale = computed(() => {
  const src = props.byCounty ? counts.value.counties : counts.value.regions
  if (props.focus) return { br: [1], colors: [ramp.value[3]] }
  if (metricOn.value) {
    const vals = [...(props.gaps?.keys() || [])].map(metricOf).filter(Boolean)
    if (colorBy.value === 'latest' && vals.length) {
      // years: 5 equal steps from the oldest to the newest latest-record year (recent = dark)
      const a = Math.min(...vals)
      const b = Math.max(...vals)
      const st = Math.max(1, Math.ceil((b - a + 1) / 5))
      const br = [...new Set([0, 1, 2, 3, 4].map((i) => a + i * st).filter((y) => y <= b))]
      return { br, colors: rampFor(br.length, ramp.value), years: true, last: b }
    }
    const br = breaks(vals)
    return { br, colors: rampFor(br.length, ramp.value) }
  }
  const br = breaks([...src.values()].map((v) => v.taxa))
  return { br, colors: rampFor(br.length, ramp.value) }
})
const legend = computed(() => {
  const { br, colors } = scale.value
  if (props.focus) return [{ label: 'Recorded', color: colors[0] }, { label: 'No record', color: '#eef0f3' }]
  if (scale.value.years) {
    return br.map((b, i) => ({ label: i < br.length - 1 ? `${b}–${br[i + 1] - 1}` : `${b}–${scale.value.last}`, color: colors[i] }))
      .concat([{ label: 'No dated record', color: '#eef0f3' }])
  }
  return br.map((b, i) => ({ label: i < br.length - 1 && br[i + 1] - 1 > b ? `${b}–${br[i + 1] - 1}` : i < br.length - 1 ? `${b}` : `${b}+`, color: colors[i] }))
    .concat([{ label: 'No record', color: '#eef0f3' }])
})
const fillFor = (v) => (v ? scale.value.colors[classOf(v.taxa, scale.value.br)] : '#eef0f3')
const fillForPlace = (name, v) => {
  if (!metricOn.value) return fillFor(v)
  const m = metricOf(name)
  return m ? scale.value.colors[classOf(m, scale.value.br)] : '#eef0f3'
}

// name of the WID place drawn by feature i of the chosen level
const nameOfFeature = computed(() => {
  const m = new Map()
  if (level.value) for (const [name, i] of level.value.match) m.set(i, name)
  return m
})

function tip(name, v) {
  if (!v) return `<b>${name}</b><br>No record`
  if (props.focus) return `<b>${name}</b><br>${[v.literature ? 'literature' : '', v.specimens ? `${v.specimens} specimen${v.specimens > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')}`
  return `<b>${name}</b><br>${v.taxa} tax${v.taxa > 1 ? 'a' : 'on'}${v.specimens ? ` · ${v.specimens} specimen${v.specimens > 1 ? 's' : ''}` : ''}`
}

async function ensureCounties() {
  if (!counties.value && props.byCounty && /^United States/.test(props.country)) counties.value = await getJSON('USA-counties.json')
}

function draw(fit = false) {
  if (!map || !L) return
  ;[placeLayer, countyLayer, pointLayer].forEach((l) => l && map.removeLayer(l))
  placeLayer = countyLayer = pointLayer = null
  selectedCounty = null
  const lv = level.value
  if (lv) {
    const showCounties = props.byCounty && counties.value
    placeLayer = L.geoJSON({ type: 'FeatureCollection', features: lv.features }, {
      renderer,
      interactive: !showCounties,
      style: (f) => {
        const name = nameOfFeature.value.get(lv.features.indexOf(f))
        const v = name ? counts.value.regions.get(name) : null
        const sel = props.region && name === props.region
        return {
          color: sel ? '#111' : '#7a8594', weight: sel ? 2.5 : showCounties ? 1.2 : 0.8,
          // in county view the states are outlines only and let clicks through to the counties
          fill: !showCounties,
          fillColor: fillForPlace(name, v), fillOpacity: 1
        }
      },
      onEachFeature: (f, layer) => {
        const name = nameOfFeature.value.get(lv.features.indexOf(f))
        if (!showCounties) {
          const g = name && props.gaps?.get(name)
          const extra = metricOn.value && g ? `<br>${g.works} work${g.works === 1 ? '' : 's'} · latest record ${g.latest || '—'}` : ''
          layer.bindTooltip(tip(name || f.properties.name, name ? counts.value.regions.get(name) : null) + extra, { sticky: true })
        }
        if (name && !showCounties) layer.on('click', () => emit('select-region', props.region === name ? '' : name))
      }
    })
    if (showCounties) {
      const feats = counties.value.features.filter((f) => !props.region || f.properties.state === props.region)
      countyLayer = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
        renderer,
        style: (f) => {
          const sel = props.county && f.properties.name === props.county && f.properties.state === props.region
          return { color: sel ? '#111' : '#c2c8d0', weight: sel ? 2.5 : 0.3, fillColor: fillFor(counts.value.counties.get(`${f.properties.state}|${f.properties.name}`)), fillOpacity: 1 }
        },
        onEachFeature: (f, layer) => {
          layer.bindTooltip(tip(`${f.properties.name} Co., ${f.properties.state}`, counts.value.counties.get(`${f.properties.state}|${f.properties.name}`)), { sticky: true })
          layer.on('click', () => emit('select-county', { state: f.properties.state, name: f.properties.name }))
          if (props.county && f.properties.name === props.county && f.properties.state === props.region) selectedCounty = layer
        }
      }).addTo(map)
    }
    placeLayer.addTo(map)
    if (showCounties) placeLayer.bringToFront()
    selectedCounty?.bringToFront()
  }
  if (showPoints.value && points.value.length) {
    pointLayer = L.layerGroup(points.value.map((r) =>
      L.circleMarker([Number(r.decimalLatitude), Number(r.decimalLongitude)], { renderer, radius: 4, color: '#fff', weight: 1.5, fillColor: pointColor.value, fillOpacity: 1 })
        .bindTooltip(`<i>${r.scientificName}</i><br>${[r.verbatimLocality, r.eventDate || r.verbatimEventDate, [r.institutionCode, r.catalogNumber].filter(Boolean).join(' ')].filter(Boolean).join('<br>')}`)
    )).addTo(map)
  }
  if (fit) fitView()
}

// zoom to the selected place, else to the places with records, else to the country
function fitView() {
  if (!map || !L) return
  const lv = level.value
  let bounds = null
  if (lv) {
    const want = props.region ? [props.region] : [...counts.value.regions.keys()]
    const feats = want.map((n) => lv.match.get(n)).filter((i) => i !== undefined).map((i) => lv.features[i])
    const use = feats.length ? feats : lv.features
    bounds = L.geoJSON({ type: 'FeatureCollection', features: use }).getBounds()
    // the United States: keep the lower 48 in view unless a state elsewhere is selected
    if (/^United States/.test(props.country) && !props.region) bounds = L.latLngBounds([24, -125], [49.5, -66.5])
  } else if (points.value.length) {
    bounds = L.latLngBounds(points.value.map((r) => [Number(r.decimalLatitude), Number(r.decimalLongitude)]))
  }
  if (selectedCounty) bounds = selectedCounty.getBounds().pad(1.5)
  if (bounds?.isValid()) map.fitBounds(bounds, { padding: [12, 12], maxZoom: 9 })
}

onMounted(async () => {
  L = (await import('leaflet')).default
  renderer = L.svg({ padding: 0 })
  map = L.map(mapEl.value, { zoomSnap: 0.25, attributionControl: false, renderer, preferCanvas: false, worldCopyJump: false })
  map.setView([30, 0], 2)
  await loadBoundaries()
  await ensureCounties()
  draw(true)
})
onBeforeUnmount(() => { map?.remove(); map = null })

watch(() => props.country, async () => { counties.value = null; await loadBoundaries(); await ensureCounties(); draw(true) })
watch(() => props.byCounty, async () => { await ensureCounties(); draw() })
watch(() => [props.region, props.county, props.focus], () => draw(true))
watch(() => [props.checklist, showPoints.value, props.gaps], () => draw())

// ---------------------------------------------------------------- downloads

const placeTitle = computed(() => [props.county ? props.county + (/^United States/.test(props.country) ? ' Co.' : '') : '', props.region, props.country].filter(Boolean).join(', '))
const title = computed(() => (props.focus ? `${props.focus} in ${placeTitle.value}` : `Ichneumonidae of ${placeTitle.value}`))
const slug = computed(() => title.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
const today = new Date().toISOString().slice(0, 10)

// the map as a standalone SVG: Leaflet's own SVG (what is on screen) + title, legend, source
function mapSVG() {
  const svg = renderer?._container
  if (!svg) return ''
  const size = map.getSize()
  const W = size.x
  const H = size.y
  const clone = svg.cloneNode(true)
  const vb = svg.getAttribute('viewBox')
  const inner = clone.innerHTML
  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
  const leg = legend.value.map((l, i) => `<rect x="16" y="${H - 22 - (legend.value.length - i) * 18}" width="20" height="12" fill="${l.color}" stroke="#999" stroke-width="0.5"/><text x="42" y="${H - 12 - (legend.value.length - i) * 18}" font-size="12">${esc(l.label)}</text>`).join('')
  const rows = legend.value.length + (showPoints.value && points.value.length ? 1 : 0)
  const box = `<rect x="8" y="${H - 30 - legend.value.length * 18}" width="120" height="${rows * 18 + 14}" rx="6" fill="#fff" fill-opacity="0.92" stroke="#ccc" stroke-width="0.5"/>`
  const pts = showPoints.value && points.value.length ? `<circle cx="26" cy="${H - 16}" r="4" fill="${pointColor.value}" stroke="#fff" stroke-width="1.5"/><text x="42" y="${H - 12}" font-size="12">Specimen</text>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 40}" viewBox="0 0 ${W} ${H + 40}" font-family="Arial, Helvetica, sans-serif">
<rect width="100%" height="100%" fill="#fff"/>
<text x="16" y="26" font-size="16" font-weight="bold">${esc(title.value)}</text>
<svg x="0" y="40" width="${W}" height="${H}" viewBox="${vb}">${inner}</svg>
<g transform="translate(0,40)">${box}${leg}${pts}</g>
<text x="${W - 12}" y="${H + 32}" font-size="10" fill="#666" text-anchor="end">World Ichneumonidae Database (WID), ${today} · Boundaries: Natural Earth${props.byCounty ? '; US Census (us-atlas)' : ''}</text>
</svg>`
}

function downloadPNG() {
  const svg = mapSVG()
  if (!svg) return
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  img.onload = () => {
    const k = 3 // 3× for print
    const c = document.createElement('canvas')
    c.width = img.width * k
    c.height = img.height * k
    const ctx = c.getContext('2d')
    ctx.scale(k, k)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    c.toBlob((b) => download(`WID_map_${slug.value}_${today}.png`, b, 'image/png'), 'image/png')
  }
  img.src = url
}

function placesForExport() {
  const lv = level.value
  if (!lv) return []
  return [...lv.match.entries()].filter(([name]) => !props.region || name === props.region).map(([name, i]) => ({ name, geometry: lv.features[i].geometry, ...(counts.value.regions.get(name) || { taxa: 0, specimens: 0, literature: 0 }) }))
}

const mapDownloads = [
  { label: 'SVG', title: 'Vector image of the map, for papers (editable in Illustrator / Inkscape)', run: () => download(`WID_map_${slug.value}_${today}.svg`, mapSVG(), 'image/svg+xml') },
  { label: 'PNG', title: 'Image of the map at 3× resolution', run: downloadPNG },
  { label: 'GeoJSON', title: 'Specimen points and places with their number of taxa, for QGIS', run: () => download(`WID_map_${slug.value}_${today}.geojson`, toGeoJSON({ points: points.value, places: placesForExport() }), 'application/geo+json') },
  { label: 'KML', title: 'Specimen points, for Google Earth', run: () => download(`WID_specimens_${slug.value}_${today}.kml`, toKML({ points: points.value, title: title.value }), 'application/vnd.google-earth.kml+xml') }
]
</script>

<style scoped>
.checklist-map {
  background: #dfe9f2;
}
.checklist-map :deep(.leaflet-interactive) {
  cursor: pointer;
}
</style>
