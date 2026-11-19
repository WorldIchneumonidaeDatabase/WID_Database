<template>
  <div
    v-if="dots.length > 1"
    ref="box"
    class="ntl px-5 pt-3 pb-2"
  >
    <div class="ntl-plot">
      <svg
        :width="width"
        :height="H"
        class="ntl-svg"
        role="listbox"
        :aria-label="`History of the name, ${minYear}–${maxYear}. Use the arrow keys to move, Enter to open.`"
        tabindex="0"
        @keydown="onKey"
        @focus="active < 0 && (active = 0)"
        @blur="active = -1"
        @mouseleave="hover = -1"
      >
        <line
          :x1="PAD"
          :x2="width - PAD"
          :y1="AXIS"
          :y2="AXIS"
          class="ntl-axis"
        />
        <g
          v-for="t in ticks"
          :key="t"
        >
          <line
            :x1="x(t)"
            :x2="x(t)"
            :y1="AXIS"
            :y2="AXIS + 4"
            class="ntl-axis"
          />
          <text
            :x="x(t)"
            :y="AXIS + 16"
            text-anchor="middle"
            class="ntl-year"
          >{{ t }}</text>
        </g>

        <!-- the year chosen for the list below -->
        <rect
          v-if="selectedX !== null"
          :x="selectedX - 10"
          :y="AXIS - 9 - STACK * (MAX_STACK - 1) - 10"
          width="20"
          :height="STACK * (MAX_STACK - 1) + 20"
          rx="10"
          class="ntl-selected"
        />

        <!-- one column per year -->
        <g
          v-for="col in columns"
          :key="col.year"
        >
          <circle
            v-for="d in col.shown"
            :key="d.i"
            :cx="col.x"
            :cy="d.y"
            :r="d.i === current ? 7.5 : 5.5"
            :class="[
              'ntl-dot',
              `tone-${d.kind.tone}`,
              {
                dim: (current >= 0 && d.i !== current) || (current < 0 && selectedYear && d.year !== selectedYear)
              }
            ]"
            role="option"
            :aria-selected="d.i === current"
            @mouseenter="hover = d.i"
            @click="open(d)"
          />
          <text
            v-if="col.more"
            :x="col.x"
            :y="AXIS - 9 - STACK * MAX_STACK + 3"
            text-anchor="middle"
            class="ntl-more"
          >+{{ col.more }}</text>
        </g>
      </svg>

      <!-- the entry under the pointer (or keyboard focus) -->
      <div
        v-if="currentDot"
        class="ntl-card"
        :style="cardStyle"
        aria-live="polite"
      >
        <div class="ntl-card-head">
          <strong>{{ currentDot.entry.year }}</strong>
          <span :class="['ntl-kind', `tone-${currentDot.kind.tone}`]">{{ currentDot.kind.text }}</span>
        </div>
        <div
          class="ntl-card-text"
          v-html="currentDot.html"
        />
        <div class="ntl-card-hint">
          {{ currentDot.year === selectedYear ? 'Click to show all years again' : `Click to list only ${currentDot.year}` }}
        </div>
      </div>
    </div>

    <!-- colour key: click a kind to show only those -->
    <div class="ntl-key">
      <button
        v-for="k in kinds"
        :key="k.tone"
        type="button"
        :class="['ntl-key-item', { off: hiddenTones.has(k.tone) }]"
        :aria-pressed="!hiddenTones.has(k.tone)"
        :title="hiddenTones.has(k.tone) ? 'Show these' : 'Hide these'"
        @click="toggleTone(k.tone)"
      >
        <span :class="['ntl-key-dot', `tone-${k.tone}`]" />
        <span>{{ k.text }}</span>
        <span class="ntl-key-n">{{ k.count }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { entryKind } from './nomenEntry'

const props = defineProps({
  entries: { type: Array, required: true },
  timeline: { type: Array, default: () => [] },
  selectedYear: { type: Number, default: null }
})
const emit = defineEmits(['select'])

const H = 96
const PAD = 18
const AXIS = 72
const STACK = 13 // spacing of dots in the same year
const MAX_STACK = 4 // more than this in one year shows "+n"

// draw at the real width of the panel, so dots keep their size
const box = ref(null)
const width = ref(500)
let ro = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = Math.max(240, Math.round(e.contentRect.width))))
  if (box.value) ro.observe(box.value)
})
onBeforeUnmount(() => ro?.disconnect())

// kinds grouped by colour, for the key
const KIND_GROUP = {
  orig: 'Original description',
  comb: 'Combination / placement',
  syn: 'Synonymy',
  type: 'Type designation',
  warn: 'Homonym / unavailable',
  info: 'Other act',
  muted: 'Cited'
}

const all = computed(() =>
  props.entries
    .map((entry, i) => ({
      i,
      entry,
      year: Number(entry.year),
      kind: entryKind(entry, props.timeline),
      html: String(entry.label || '').trim()
    }))
    .filter((d) => d.year > 1700 && d.year < 2200)
)

const hiddenTones = ref(new Set())
function toggleTone(t) {
  const s = new Set(hiddenTones.value)
  s.has(t) ? s.delete(t) : s.add(t)
  hiddenTones.value = s
}
const dots = computed(() => all.value.filter((d) => !hiddenTones.value.has(d.kind.tone)))

const kinds = computed(() => {
  const m = new Map()
  all.value.forEach((d) => {
    const t = d.kind.tone
    if (!m.has(t)) m.set(t, { tone: t, text: KIND_GROUP[t] || d.kind.text, count: 0 })
    m.get(t).count++
  })
  return [...m.values()]
})

const selectedX = computed(() => (props.selectedYear ? x(props.selectedYear) : null))

const minYear = computed(() => Math.min(...all.value.map((d) => d.year)))
const maxYear = computed(() => Math.max(...all.value.map((d) => d.year)))
const x = (y) => {
  const span = Math.max(maxYear.value - minYear.value, 1)
  return PAD + ((y - minYear.value) / span) * (width.value - 2 * PAD)
}

const columns = computed(() => {
  const byYear = new Map()
  dots.value.forEach((d) => {
    if (!byYear.has(d.year)) byYear.set(d.year, [])
    byYear.get(d.year).push(d)
  })
  return [...byYear.entries()].map(([year, list]) => {
    const shown = list.slice(0, MAX_STACK).map((d, n) => ({ ...d, y: AXIS - 9 - n * STACK }))
    // dots beyond the stack still exist for the keyboard, at the top position
    list.slice(MAX_STACK).forEach((d) => (d.y = AXIS - 9 - (MAX_STACK - 1) * STACK))
    return { year, x: x(year), shown, more: Math.max(0, list.length - MAX_STACK) }
  })
})

// keyboard order: left to right, bottom to top
const ordered = computed(() => [...dots.value].sort((a, b) => a.year - b.year || a.i - b.i))
const active = ref(-1) // position in `ordered` when using the keyboard
const hover = ref(-1) // entry index under the mouse
const current = computed(() => (hover.value >= 0 ? hover.value : ordered.value[active.value]?.i ?? -1))
const currentDot = computed(() => {
  const d = dots.value.find((d) => d.i === current.value)
  if (!d) return null
  const n = columns.value.find((c) => c.year === d.year)?.shown.findIndex((s) => s.i === d.i) ?? 0
  return { ...d, cx: x(d.year), cy: AXIS - 9 - Math.max(0, Math.min(n, MAX_STACK - 1)) * STACK }
})

// keep the card inside the panel
const cardStyle = computed(() => {
  const d = currentDot.value
  if (!d) return {}
  const w = Math.min(300, width.value - 16)
  const left = Math.min(Math.max(d.cx - w / 2, 8), width.value - w - 8)
  return { left: `${left}px`, bottom: `${H - d.cy + 12}px`, width: `${w}px` }
})

function onKey(e) {
  const n = ordered.value.length
  if (!n) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    active.value = Math.min(n - 1, active.value + 1)
    hover.value = -1
    e.preventDefault()
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    active.value = Math.max(0, active.value - 1)
    hover.value = -1
    e.preventDefault()
  } else if (e.key === 'Home') {
    active.value = 0
    e.preventDefault()
  } else if (e.key === 'End') {
    active.value = n - 1
    e.preventDefault()
  } else if (e.key === 'Enter' && ordered.value[active.value]) {
    open(ordered.value[active.value])
    e.preventDefault()
  }
}

function open(d) {
  emit('select', d.entry)
}

// Years along the axis: the first, the last and round years in between
const ticks = computed(() => {
  const a = minYear.value
  const b = maxYear.value
  const span = b - a
  const room = Math.max(2, Math.floor(width.value / 70)) // about one label per 70 px
  const steps = [5, 10, 20, 25, 50, 100]
  const step = steps.find((s) => span / s <= room) || 100
  const out = [a]
  for (let t = Math.ceil((a + step / 2) / step) * step; t < b - step / 2; t += step) out.push(t)
  if (b !== a) out.push(b)
  return out
})
</script>

<style scoped>
.ntl-plot {
  position: relative;
}
.ntl-svg {
  display: block;
  overflow: visible;
  outline: none;
}
.ntl-svg:focus-visible {
  outline: 2px solid rgba(var(--color-primary), 0.6);
  outline-offset: 4px;
  border-radius: 6px;
}
.ntl-axis {
  stroke: rgba(var(--color-base-content), 0.25);
  stroke-width: 1.2;
}
.ntl-year {
  font-size: 11px;
  fill: rgba(var(--color-base-content), 0.6);
}
.ntl-more {
  font-size: 10px;
  font-weight: 700;
  fill: rgba(var(--color-base-content), 0.6);
}
.ntl-dot {
  cursor: pointer;
  stroke: #fff;
  stroke-width: 1.5;
  transition: r 0.12s, opacity 0.12s;
}
.ntl-selected {
  fill: rgba(var(--color-primary), 0.12);
  stroke: rgba(var(--color-primary), 0.45);
  stroke-width: 1;
}
.ntl-dot.dim {
  opacity: 0.35;
}
.ntl-card {
  position: absolute;
  z-index: 5;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  background: rgb(var(--color-base-foreground, 255, 255, 255));
  border: 1px solid rgba(var(--color-base-content), 0.15);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
  font-size: 0.78rem;
  line-height: 1.35;
  pointer-events: none;
}
.ntl-card-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.2rem;
}
.ntl-kind {
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  color: #fff;
}
.ntl-card-text :deep(i) {
  font-style: italic;
}
.ntl-card-hint {
  margin-top: 0.25rem;
  font-size: 0.68rem;
  opacity: 0.55;
}
.ntl-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin-top: 0.15rem;
}
.ntl-key-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0;
  background: none;
  border: 0;
  color: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}
.ntl-key-item.off {
  opacity: 0.4;
  text-decoration: line-through;
}
.ntl-key-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  display: inline-block;
}
.ntl-key-n {
  opacity: 0.55;
}

/* colours, same meaning as the tags in the list */
.tone-orig { fill: rgb(var(--color-primary)); background: rgb(var(--color-primary)); }
.tone-comb { fill: #2f8a50; background: #2f8a50; }
.tone-syn { fill: #7b56b8; background: #7b56b8; }
.tone-warn { fill: #c4741f; background: #c4741f; }
.tone-type { fill: #c0392b; background: #c0392b; }
.tone-info,
.tone-muted { fill: #9aa0a6; background: #9aa0a6; }
</style>
