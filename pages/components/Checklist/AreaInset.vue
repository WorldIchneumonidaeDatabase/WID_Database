<template>
  <figure
    v-if="shapes.length"
    class="ai"
  >
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="ai-svg"
      role="img"
      :aria-label="`Areas used in the literature: ${areas.map((a) => a.label).join(', ')}`"
    >
      <!-- regions, coloured by the area they belong to -->
      <g
        v-for="a in areaShapes"
        :key="a.label"
        class="ai-area"
        :class="{ 'ai-dim': active && active !== a.label, 'ai-on': active === a.label }"
        @mouseenter="hover = a.label"
        @mouseleave="hover = ''"
        @click="$emit('select', selected === a.region ? '' : a.region)"
      >
        <title>{{ a.title }}</title>
        <path
          v-for="(d, i) in a.paths"
          :key="i"
          :d="d"
          :fill="active === a.label ? a.strong : a.color"
          stroke="#fff"
          stroke-width="0.6"
          stroke-linejoin="round"
        />
      </g>
      <!-- names -->
      <text
        v-for="a in areaShapes"
        :key="`t-${a.label}`"
        :x="a.lx"
        :y="a.ly"
        text-anchor="middle"
        class="ai-label"
        :class="{ 'ai-label-on': active === a.label }"
      >{{ a.label }}</text>
    </svg>
    <figcaption class="ai-cap">
      {{ caption }}
    </figcaption>
  </figure>
</template>

<script setup>
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { insetAreas } from './checklist.js'
import { matchPlaces } from './mapData.js'

// Small map of the areas used in the literature for a country (e.g. North Italy and South
// Italy sensu Scaramozzino 1995, Sicily, Sardinia): each area in its own light colour with its
// name. Hover or choose an area in the filter to highlight it; click it to filter the list.
// Regions from public/checklist-maps/<ISO3>.json (regions level).
const props = defineProps({
  country: { type: String, required: true },
  selected: { type: String, default: '' } // the Region filter value
})
defineEmits(['select'])

const W = 220
const H = 250
// one light colour per area, fixed order (North, South, Sicily, Sardinia); names are written
// on the map, so colour is never the only cue
const COLORS = ['#8fb8e6', '#f2b97a', '#d9a3c8', '#a9d69b']
const STRONG = ['#3f7cc4', '#d4892a', '#b0679b', '#5fa850']

const areas = computed(() => insetAreas(props.country))
const file = shallowRef(null)
const hover = ref('')

async function load() {
  file.value = null
  if (!areas.value.length) return
  try {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
    const index = await fetch(`${base}checklist-maps/index.json`).then((r) => r.json())
    const a3 = index[props.country.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')]
    file.value = a3 ? await fetch(`${base}checklist-maps/${a3}.json`).then((r) => r.json()) : null
  } catch {
    file.value = null
  }
}
onMounted(load)
watch(() => props.country, load)

const shapes = computed(() => file.value?.regions || file.value?.admin1 || [])

// equirectangular, scaled by cos(latitude) of the country's middle
const projected = computed(() => {
  const fs = shapes.value
  if (!fs.length) return null
  const rings = (g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat())
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const f of fs) for (const r of rings(f.geometry)) for (const [lon, lat] of r) {
    minX = Math.min(minX, lon); maxX = Math.max(maxX, lon); minY = Math.min(minY, lat); maxY = Math.max(maxY, lat)
  }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180)
  const s = Math.min((W - 6) / ((maxX - minX) * k), (H - 6) / (maxY - minY))
  const ox = (W - (maxX - minX) * k * s) / 2
  const oy = (H - (maxY - minY) * s) / 2
  const px = (lon) => ox + (lon - minX) * k * s
  const py = (lat) => oy + (maxY - lat) * s
  return { rings, px, py }
})

const areaShapes = computed(() => {
  const p = projected.value
  if (!p) return []
  return areas.value.map((a, i) => {
    const match = matchPlaces(shapes.value, a.members)
    const feats = [...new Set(match.values())].map((j) => shapes.value[j])
    const paths = feats.map((f) => p.rings(f.geometry).map((r) => 'M' + r.map(([lon, lat]) => `${p.px(lon).toFixed(1)},${p.py(lat).toFixed(1)}`).join('L') + 'Z').join(''))
    // label at the middle of the area's extent (the largest region for a single-region area)
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const f of feats) for (const r of p.rings(f.geometry)) for (const [lon, lat] of r) {
      x0 = Math.min(x0, p.px(lon)); x1 = Math.max(x1, p.px(lon)); y0 = Math.min(y0, p.py(lat)); y1 = Math.max(y1, p.py(lat))
    }
    const title = a.source ? `${a.label} (sensu ${a.source}): ${a.members.join(', ')}` : a.label
    return { ...a, paths, color: COLORS[i % 4], strong: STRONG[i % 4], lx: (x0 + x1) / 2, ly: (y0 + y1) / 2 + 3, title }
  })
})

// highlighted: the area under the mouse, else the area chosen in the filter
const active = computed(() => hover.value || areas.value.find((a) => a.region === props.selected)?.label || '')
const caption = computed(() => {
  const a = areaShapes.value.find((x) => x.label === active.value)
  return a ? a.title : 'Areas used in the literature — hover to see what each includes, click to filter.'
})
</script>

<style scoped>
.ai {
  width: 15rem;
  max-width: 100%;
}
.ai-svg {
  width: 100%;
  height: auto;
  display: block;
}
.ai-area {
  cursor: pointer;
  transition: opacity 0.15s;
}
.ai-dim {
  opacity: 0.45;
}
.ai-label {
  font: 700 9.5px system-ui, sans-serif;
  fill: #1f2933;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
  pointer-events: none;
}
.ai-label-on {
  font-size: 11px;
}
.ai-cap {
  margin-top: 0.3rem;
  font-size: 0.75rem;
  line-height: 1.35;
  opacity: 0.75;
}
</style>
