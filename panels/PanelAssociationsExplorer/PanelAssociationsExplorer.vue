<template>
  <VCard>
    <VCardHeader class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-md">Biological associations</h2>
      <p
        v-if="!isLoading && bio.length"
        class="ax-summary text-xs"
      >
        <span>{{ bio.length }} {{ bio.length === 1 ? 'record' : 'records' }}</span>
        <span> · </span>
        <span>{{ others.length }} {{ others.length === 1 ? 'associate' : 'associates' }}</span>
        <template v-if="refCount">
          <span> · </span><span>{{ refCount }} {{ refCount === 1 ? 'reference' : 'references' }}</span>
        </template>
      </p>
    </VCardHeader>

    <VCardContent>
      <p
        v-if="isLoading"
        class="opacity-60 text-sm"
      >
        Loading the associations…
      </p>
      <p
        v-else-if="!records.length"
        class="opacity-70 text-sm"
      >
        No biological associations recorded for this taxon yet.
      </p>

      <template v-else>
        <!-- Filters: kind of relationship -->
        <div
          class="ax-filters"
          role="group"
          aria-label="Filter by relationship"
        >
          <button
            v-for="r in relationships"
            :key="r.name"
            type="button"
            :class="['ax-chip', { off: hiddenRels.has(r.name) }]"
            :aria-pressed="!hiddenRels.has(r.name)"
            @click="toggleRel(r.name)"
          >
            <svg
              width="22"
              height="8"
              aria-hidden="true"
            ><line
              x1="1"
              y1="4"
              x2="21"
              y2="4"
              stroke="currentColor"
              stroke-width="2"
              :stroke-dasharray="dashFor(r.name)"
            /></svg>
            <span>{{ r.name }}</span>
            <span class="ax-n">{{ r.count }}</span>
          </button>
        </div>

        <!-- What is selected, and how to undo it -->
        <p
          v-if="selection"
          class="ax-selection"
        >
          <span>Showing only </span>
          <strong
            class="[&_i]:italic"
            v-html="selection.html"
          />
          <button
            type="button"
            class="ax-link"
            @click="selection = null"
          >
            Show all
          </button>
        </p>

        <div class="ax-grid">
          <!-- 1. Network: ichneumonids on the left, associates on the right -->
          <section
            ref="netBox"
            class="ax-net"
            aria-label="Association network"
          >
            <h3 class="ax-h">Who is associated with whom</h3>
            <svg
              :width="netW"
              :height="netH"
              class="ax-svg"
            >
              <!-- order bands behind the associates -->
              <g
                v-for="b in orderBands"
                :key="b.order"
              >
                <rect
                  :x="rightX - 9"
                  :y="b.y0 - 11"
                  width="4"
                  :height="b.y1 - b.y0 + 22"
                  rx="2"
                  :fill="b.color"
                />
              </g>

              <!-- links -->
              <path
                v-for="l in links"
                :key="l.key"
                :d="l.d"
                fill="none"
                :stroke="l.color"
                :stroke-width="l.active ? 2.4 : 1.4"
                :stroke-dasharray="dashFor(l.rel)"
                :opacity="l.dim ? 0.12 : 0.85"
              >
                <title>{{ l.title }}</title>
              </path>

              <!-- ichneumonids -->
              <g
                v-for="n in leftNodes"
                :key="n.key"
                class="ax-node"
                :opacity="n.dim ? 0.3 : 1"
                tabindex="0"
                role="button"
                :aria-label="`Show only ${n.text}`"
                @mouseenter="hover = n.key"
                @mouseleave="hover = null"
                @click="select(n)"
                @keydown.enter.prevent="select(n)"
              >
                <circle
                  :cx="leftX"
                  :cy="n.y"
                  r="6"
                  class="ax-ours"
                />
                <foreignObject
                  :x="4"
                  :y="n.y - 10"
                  :width="leftX - 14"
                  height="20"
                >
                  <div
                    class="ax-label ax-label-left"
                    v-html="n.html"
                  />
                </foreignObject>
              </g>

              <!-- associates -->
              <g
                v-for="n in rightNodes"
                :key="n.key"
                class="ax-node"
                :opacity="n.dim ? 0.3 : 1"
                tabindex="0"
                role="button"
                :aria-label="`Show only ${n.text}`"
                @mouseenter="hover = n.key"
                @mouseleave="hover = null"
                @click="select(n)"
                @keydown.enter.prevent="select(n)"
              >
                <circle
                  :cx="rightX"
                  :cy="n.y"
                  r="6"
                  :fill="n.color"
                  stroke="#fff"
                  stroke-width="1.5"
                />
                <foreignObject
                  :x="rightX + 10"
                  :y="n.y - 10"
                  :width="netW - rightX - 14"
                  height="20"
                >
                  <div class="ax-label">
                    <span v-html="n.html" /><span
                      v-if="n.family"
                      class="ax-fam"
                    > · {{ n.family }}</span>
                  </div>
                </foreignObject>
              </g>
            </svg>
          </section>

          <!-- 2. Associates by order and family -->
          <section
            class="ax-groups"
            aria-label="Associates by order and family"
          >
            <h3 class="ax-h">Associates by group</h3>
            <div
              v-for="o in groups"
              :key="o.order"
              class="ax-order"
            >
              <button
                type="button"
                class="ax-order-head"
                @click="selectGroup('order', o.order)"
              >
                <span
                  class="ax-dot"
                  :style="{ background: o.color }"
                />
                <span class="font-semibold">{{ o.order }}</span>
                <span class="ax-n">{{ o.count }}</span>
              </button>
              <button
                v-for="f in o.families"
                :key="f.family"
                type="button"
                class="ax-fam-row"
                @click="selectGroup('family', f.family, o.order)"
              >
                <span class="ax-fam-name">{{ f.family }}</span>
                <span class="ax-fam-bar">
                  <span :style="{ width: `${(f.count / maxFamily) * 100}%`, background: o.color }" />
                </span>
                <span class="ax-n">{{ f.count }}</span>
              </button>
            </div>
          </section>
        </div>

        <!-- 3. The records: one line per association, with all its references -->
        <section
          class="ax-list"
          aria-label="Records"
        >
          <div class="ax-list-head">
            <h3 class="ax-h">
              Records <span class="ax-n">{{ rows.length }}</span>
            </h3>
            <div class="ax-list-tools">
              <input
                v-model="search"
                type="search"
                class="ax-search"
                placeholder="Search hosts, families, references…"
                aria-label="Search the records"
              />
              <button
                type="button"
                class="ax-tool"
                :disabled="!rows.length"
                @click="downloadCsv"
              >
                Download CSV
              </button>
            </div>
          </div>

          <table class="ax-table">
            <thead>
              <tr>
                <th
                  v-for="c in columns"
                  :key="c.key"
                  :class="{ 'ax-col-group': c.key === 'group' }"
                  :aria-sort="sortKey === c.key ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'"
                >
                  <button
                    type="button"
                    class="ax-sort"
                    @click="sortBy(c.key)"
                  >
                    {{ c.label }}
                    <span
                      v-if="sortKey === c.key"
                      aria-hidden="true"
                      >{{ sortDir > 0 ? '▲' : '▼' }}</span
                    >
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="row in sortedRows"
                :key="row.key"
              >
                <tr>
                  <td
                    v-if="showOurs"
                    class="[&_i]:italic"
                  >
                    <RouterLink
                      v-if="row.ours.otuId"
                      :to="{ name: 'otus-id-biological_associations', params: { id: row.ours.otuId } }"
                      class="hover:underline"
                      ><span v-html="row.ours.html"
                    /></RouterLink>
                    <span
                      v-else
                      v-html="row.ours.html"
                    />
                  </td>
                  <td>
                    <span class="ax-rel">
                      <svg
                        width="18"
                        height="8"
                        aria-hidden="true"
                      ><line
                        x1="1"
                        y1="4"
                        x2="17"
                        y2="4"
                        :stroke="orderColor(row.other.order)"
                        stroke-width="2"
                        :stroke-dasharray="dashFor(row.relationship)"
                      /></svg>
                      {{ row.relText }}
                    </span>
                  </td>
                  <td class="[&_i]:italic">
                    <span
                      v-if="row.other.part"
                      class="opacity-70"
                      >{{ row.other.part }} of </span
                    >
                    <span v-html="row.other.html" />
                    <span
                      v-if="row.other.author"
                      class="opacity-60"
                    >{{ '\u00a0' + row.other.author }}</span>
                    <span class="ax-mobile-group">
                      {{ [row.other.order, row.other.family].filter(Boolean).join(': ') }}
                    </span>
                    <span
                      v-if="row.specimen"
                      class="ax-badge"
                      title="Based on a specimen or field observation"
                      >Specimen</span
                    >
                  </td>
                  <td class="ax-group-cell ax-col-group">
                    <span
                      class="ax-dot"
                      :style="{ background: orderColor(row.other.order) }"
                    />
                    {{ [row.other.order, row.other.family].filter(Boolean).join(': ') || '—' }}
                  </td>
                  <td>
                    <template
                      v-for="(c, i) in row.citations"
                      :key="c.sourceId || c.id"
                    >
                      <span v-if="i">; </span>
                      <button
                        type="button"
                        :class="['ax-ref', { open: openRef === `${row.key}|${c.sourceId}` }]"
                        :title="c.plain"
                        :aria-expanded="openRef === `${row.key}|${c.sourceId}`"
                        @click="toggleRef(row, c)"
                      >
                        <span v-html="c.short" />
                      </button>
                    </template>
                    <span
                      v-if="!row.citations.length"
                      class="opacity-50"
                      >—</span
                    >
                  </td>
                </tr>
                <!-- the full reference, opened from its short form -->
                <tr
                  v-if="openCitation(row)"
                  class="ax-ref-row"
                >
                  <td :colspan="columns.length">
                    <div class="ax-ref-full">
                      <span v-html="openCitation(row).full || openCitation(row).short" />
                      <span
                        v-if="openCitation(row).pages"
                        class="opacity-70"
                      > Page {{ openCitation(row).pages }}.</span>
                      <div class="ax-ref-actions">
                        <RequestPdfButton
                          v-if="openCitation(row).full"
                          :citation="openCitation(row).full"
                          compact
                        />
                        <button
                          type="button"
                          class="ax-tool small"
                          @click="copyText(openCitation(row).plain)"
                        >
                          {{ copied ? 'Copied' : 'Copy' }}
                        </button>
                        <button
                          type="button"
                          class="ax-tool small"
                          @click="selectSource(openCitation(row))"
                        >
                          Records from this reference
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="!sortedRows.length">
                <td
                  :colspan="columns.length"
                  class="opacity-60"
                >
                  Nothing matches.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 4. The references behind these associations -->
        <section
          v-if="references.length"
          class="ax-refs"
          aria-label="References"
        >
          <h3 class="ax-h">
            References <span class="ax-n">{{ references.length }}</span>
          </h3>
          <ul>
            <li
              v-for="ref in references"
              :key="ref.sourceId"
              :class="['ax-refs-item', { on: selection?.key === `s:${ref.sourceId}` }]"
            >
              <div
                class="ax-refs-text"
                v-html="ref.full || ref.short"
              />
              <div class="ax-ref-actions">
                <button
                  type="button"
                  class="ax-tool small"
                  @click="selectSource(ref)"
                >
                  {{ selection?.key === `s:${ref.sourceId}` ? 'Show all records' : `${ref.count} ${ref.count === 1 ? 'record' : 'records'}` }}
                </button>
                <RequestPdfButton
                  v-if="ref.full"
                  :citation="ref.full"
                  compact
                />
                <button
                  type="button"
                  class="ax-tool small"
                  @click="copyText(ref.plain)"
                >
                  Copy
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { loadAssociations, orderColor, isComparison } from '../_shared/associations'

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
    // taxonomic comparisons are not biological: off unless asked for
    hiddenRels.value = new Set(records.value.filter((r) => r.comparison).map((r) => r.relationship))
  },
  { immediate: true }
)

// ── filters ──────────────────────────────────────────────────────────────
const hiddenRels = ref(new Set())
function toggleRel(name) {
  const s = new Set(hiddenRels.value)
  s.has(name) ? s.delete(name) : s.add(name)
  hiddenRels.value = s
}
const relationships = computed(() => {
  const m = new Map()
  records.value.forEach((r) => m.set(r.relationship, (m.get(r.relationship) || 0) + 1))
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => Number(isComparison(a.name)) - Number(isComparison(b.name)) || b.count - a.count)
})

// line style says the kind of relationship; colour says the associate's order
function dashFor(rel = '') {
  if (/compared/i.test(rel)) return '1 4'
  if (/possible/i.test(rel)) return '2 4'
  if (/reared/i.test(rel)) return '6 3'
  if (/associated/i.test(rel)) return '1 3'
  return ''
}
const relText = (r) => (r.flipped && r.inverse ? r.inverse : r.relationship)

const visible = computed(() => records.value.filter((r) => !hiddenRels.value.has(r.relationship)))
const bio = computed(() => records.value.filter((r) => !r.comparison))

// clicking a node or a group selects it: { kind: 'ours'|'other'|'order'|'family', key, html }
const selection = ref(null)
function select(n) {
  selection.value = selection.value?.key === n.key ? null : { kind: n.side, key: n.key, html: n.html }
}
function selectGroup(kind, name, order) {
  const key = `${kind}:${name}`
  selection.value = selection.value?.key === key ? null : { kind, key, name, order, html: name }
}
const matches = (r, sel) => {
  if (!sel) return true
  if (sel.kind === 'ours') return `o:${r.ours.text}` === sel.key
  if (sel.kind === 'other') return `a:${r.other.text}` === sel.key
  if (sel.kind === 'order') return (r.other.order || 'Other') === sel.name
  if (sel.kind === 'family') return (r.other.family || 'Unplaced') === sel.name && (r.other.order || 'Other') === sel.order
  if (sel.kind === 'source') return r.citations.some((c) => c.sourceId === sel.sourceId)
  return true
}
const shown = computed(() =>
  visible.value
    .filter((r) => matches(r, selection.value))
    .sort(
      (a, b) =>
        (a.other.order || '~').localeCompare(b.other.order || '~') ||
        (a.other.family || '~').localeCompare(b.other.family || '~') ||
        a.other.text.localeCompare(b.other.text)
    )
)

function selectSource(c) {
  const key = `s:${c.sourceId}`
  selection.value = selection.value?.key === key ? null : { kind: 'source', key, sourceId: c.sourceId, html: c.short }
  openRef.value = null
}

// ── table: one line per association (same taxa and relationship), all its references ──
const search = ref('')
const showOurs = computed(() => leftNodesAll.value.length > 1)
const columns = computed(() =>
  [
    showOurs.value && { key: 'ours', label: 'Ichneumonid' },
    { key: 'rel', label: 'Relationship' },
    { key: 'other', label: 'Associate' },
    { key: 'group', label: 'Group' },
    { key: 'refs', label: 'References' }
  ].filter(Boolean)
)

const rows = computed(() => {
  const m = new Map()
  for (const r of shown.value) {
    const key = `${r.ours.text}|${r.relationship}|${r.other.part}|${r.other.text}`
    if (!m.has(key)) {
      m.set(key, { key, ours: r.ours, other: r.other, relationship: r.relationship, relText: relText(r), specimen: false, citations: [] })
    }
    const row = m.get(key)
    row.specimen ||= r.specimen
    for (const c of r.citations) {
      if (!row.citations.some((x) => x.sourceId === c.sourceId)) row.citations.push(c)
    }
  }
  const q = search.value.trim().toLowerCase()
  const list = [...m.values()]
  list.forEach((row) => row.citations.sort((a, b) => (a.year || 0) - (b.year || 0)))
  if (!q) return list
  return list.filter((row) =>
    [row.ours.text, row.relText, row.other.text, row.other.author, row.other.order, row.other.family, ...row.citations.map((c) => c.plain || c.short)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

const sortKey = ref('group')
const sortDir = ref(1)
function sortBy(k) {
  if (sortKey.value === k) sortDir.value = -sortDir.value
  else {
    sortKey.value = k
    sortDir.value = 1
  }
}
const sortValue = (row, k) =>
  k === 'ours' ? row.ours.text
    : k === 'rel' ? row.relText
      : k === 'other' ? row.other.text
        : k === 'refs' ? String(row.citations[0]?.year || 9999)
          : `${row.other.order || '~'} ${row.other.family || '~'} ${row.other.text}`
const sortedRows = computed(() =>
  [...rows.value].sort((a, b) => sortValue(a, sortKey.value).localeCompare(sortValue(b, sortKey.value)) * sortDir.value)
)

// the full reference opened under a row
const openRef = ref(null)
function toggleRef(row, c) {
  const k = `${row.key}|${c.sourceId}`
  openRef.value = openRef.value === k ? null : k
}
const openCitation = (row) => {
  if (!openRef.value?.startsWith(`${row.key}|`)) return null
  const id = Number(openRef.value.slice(row.key.length + 1))
  return row.citations.find((c) => c.sourceId === id) || null
}

// every reference behind the associations shown, oldest first
const references = computed(() => {
  const m = new Map()
  visible.value.forEach((r) =>
    r.citations.forEach((c) => {
      if (!c.sourceId) return
      if (!m.has(c.sourceId)) m.set(c.sourceId, { ...c, count: 0 })
      m.get(c.sourceId).count++
    })
  )
  return [...m.values()].sort((a, b) => (a.year || 0) - (b.year || 0) || (a.plain || '').localeCompare(b.plain || ''))
})

const copied = ref(false)
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || '')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text || ''
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

// what is in the table, as a spreadsheet
function downloadCsv() {
  const cell = (v) => {
    let x = String(v ?? '')
    if (/^[=+\-@]/.test(x)) x = `'${x}`
    return /[",\r\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x
  }
  const head = ['Ichneumonid', 'Relationship', 'Associate', 'Author', 'Order', 'Family', 'Evidence', 'References']
  const lines = sortedRows.value.map((r) => [
    r.ours.text,
    r.relText,
    `${r.other.part ? `${r.other.part} of ` : ''}${r.other.text}`,
    r.other.author,
    r.other.order,
    r.other.family,
    r.specimen ? 'specimen' : 'literature',
    r.citations.map((c) => c.plain || c.short).join(' | ')
  ])
  const csv = '\ufeff' + [head, ...lines].map((l) => l.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `wid-associations-${String(props.taxon?.name || props.otuId).replace(/\s+/g, '_')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const others = computed(() => [...new Set(bio.value.map((r) => r.other.text))])
const refCount = computed(() => new Set(bio.value.flatMap((r) => r.citations.map((c) => c.sourceId))).size)

// ── network layout ──────────────────────────────────────────────────────
const netBox = ref(null)
const netW = ref(640)
let ro = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => (netW.value = Math.max(320, Math.round(e.contentRect.width))))
  if (netBox.value) ro.observe(netBox.value)
})
onBeforeUnmount(() => ro?.disconnect())
watch(netBox, (el) => el && ro?.observe(el))

const ROW = 26
const TOP = 18
// columns sized to the names: the ichneumonid labels get what they need (at most
// 38% of the width), the links a band in the middle, the associates the rest
const CHAR = 7 // about one character at 12.5px
const leftX = computed(() => {
  const longest = Math.max(8, ...leftNodesAll.value.map((n) => n.text.length))
  return Math.round(Math.min(netW.value * 0.38, longest * CHAR + 16))
})
const rightX = computed(() => leftX.value + Math.round(Math.min(170, Math.max(70, netW.value * 0.18))))

const leftNodesAll = computed(() => {
  const m = new Map()
  visible.value.forEach((r) => {
    const k = `o:${r.ours.text}`
    if (!m.has(k)) m.set(k, { key: k, side: 'ours', html: r.ours.html, text: r.ours.text })
  })
  return [...m.values()].sort((a, b) => a.text.localeCompare(b.text))
})

const rightNodesAll = computed(() => {
  const m = new Map()
  visible.value.forEach((r) => {
    const k = `a:${r.other.text}`
    if (!m.has(k)) {
      m.set(k, {
        key: k,
        side: 'other',
        html: r.other.part ? `${r.other.part} of ${r.other.html}` : r.other.html,
        text: r.other.text,
        order: r.other.order || 'Other',
        family: r.other.family,
        color: orderColor(r.other.order)
      })
    }
  })
  return [...m.values()].sort(
    (a, b) => a.order.localeCompare(b.order) || (a.family || '').localeCompare(b.family || '') || a.text.localeCompare(b.text)
  )
})

// small gaps between orders on the right
const rightPlaced = computed(() => {
  let y = TOP
  let prev = null
  return rightNodesAll.value.map((n) => {
    if (prev && prev !== n.order) y += 10
    prev = n.order
    const placed = { ...n, y }
    y += ROW
    return placed
  })
})
const rightSpan = computed(() => {
  const ys = rightPlaced.value.map((n) => n.y)
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : [TOP, TOP]
})
const leftPlaced = computed(() => {
  const n = leftNodesAll.value.length
  const [a, b] = rightSpan.value
  const mid = (a + b) / 2
  const start = Math.max(TOP, mid - ((n - 1) * ROW) / 2)
  return leftNodesAll.value.map((node, i) => ({ ...node, y: start + i * ROW }))
})
const netH = computed(() => {
  const last = Math.max(
    rightPlaced.value.at(-1)?.y || TOP,
    leftPlaced.value.at(-1)?.y || TOP
  )
  return last + TOP
})

const orderBands = computed(() => {
  const m = new Map()
  rightPlaced.value.forEach((n) => {
    if (!m.has(n.order)) m.set(n.order, { order: n.order, color: n.color, y0: n.y, y1: n.y })
    m.get(n.order).y1 = n.y
  })
  return [...m.values()]
})

// highlight: the hovered node, else the selection
const hover = ref(null)
const focusKey = computed(() => hover.value || (['ours', 'other'].includes(selection.value?.kind) ? selection.value.key : null))
const linked = computed(() => {
  const k = focusKey.value
  if (!k && !selection.value) return null
  const set = new Set()
  visible.value.forEach((r) => {
    const a = `o:${r.ours.text}`
    const b = `a:${r.other.text}`
    const on = k ? a === k || b === k : matches(r, selection.value)
    if (on) {
      set.add(a)
      set.add(b)
    }
  })
  return set
})

const leftNodes = computed(() => leftPlaced.value.map((n) => ({ ...n, dim: linked.value && !linked.value.has(n.key) })))
const rightNodes = computed(() => rightPlaced.value.map((n) => ({ ...n, dim: linked.value && !linked.value.has(n.key) })))

const links = computed(() => {
  const ly = new Map(leftPlaced.value.map((n) => [n.key, n.y]))
  const ry = new Map(rightPlaced.value.map((n) => [n.key, n.y]))
  const x1 = leftX.value + 6
  const x2 = rightX.value - 6
  const mx = (x1 + x2) / 2
  return visible.value.map((r) => {
    const a = `o:${r.ours.text}`
    const b = `a:${r.other.text}`
    const y1 = ly.get(a)
    const y2 = ry.get(b)
    const on = linked.value ? linked.value.has(a) && linked.value.has(b) && (focusKey.value ? a === focusKey.value || b === focusKey.value : matches(r, selection.value)) : false
    return {
      key: `${r.id}`,
      rel: r.relationship,
      color: orderColor(r.other.order),
      d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
      active: on,
      dim: linked.value && !on,
      title: `${r.ours.text} — ${relText(r)} — ${r.other.text}${r.other.family ? ` (${r.other.family})` : ''}`
    }
  })
})

// ── associates by order and family ─────────────────────────────────────
const groups = computed(() => {
  const orders = new Map()
  const seen = new Set()
  visible.value.forEach((r) => {
    if (seen.has(r.other.text)) return
    seen.add(r.other.text)
    const o = r.other.order || 'Other'
    const f = r.other.family || 'Unplaced'
    if (!orders.has(o)) orders.set(o, { order: o, color: orderColor(r.other.order), count: 0, fams: new Map() })
    const og = orders.get(o)
    og.count++
    og.fams.set(f, (og.fams.get(f) || 0) + 1)
  })
  return [...orders.values()]
    .map((o) => ({
      ...o,
      families: [...o.fams.entries()].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count)
    }))
    .sort((a, b) => b.count - a.count)
})
const maxFamily = computed(() => Math.max(1, ...groups.value.flatMap((o) => o.families.map((f) => f.count))))
</script>

<style scoped>
.ax-summary {
  color: rgba(var(--color-base-content), 0.6);
}
.ax-h {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--color-base-content), 0.55);
  margin: 0 0 0.5rem;
}
.ax-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.8rem;
}
.ax-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  border: 1px solid rgba(var(--color-base-content), 0.18);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.ax-chip.off {
  opacity: 0.45;
  text-decoration: line-through;
}
.ax-n {
  font-size: 0.7rem;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}
.ax-selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.8rem;
  padding: 0.4rem 0.75rem;
  border-radius: 10px;
  font-size: 0.85rem;
  background: rgba(var(--color-primary), 0.08);
}
.ax-link {
  background: none;
  border: 0;
  padding: 0;
  color: rgb(var(--color-primary));
  text-decoration: underline;
  cursor: pointer;
}
.ax-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1.5rem;
}
@media (max-width: 900px) {
  .ax-grid {
    grid-template-columns: 1fr;
  }
}
.ax-svg {
  display: block;
  overflow: visible;
}
.ax-node {
  cursor: pointer;
  outline: none;
}
.ax-node:focus-visible circle {
  stroke: rgb(var(--color-primary));
  stroke-width: 3;
}
.ax-ours {
  fill: rgb(var(--color-primary));
  stroke: #fff;
  stroke-width: 1.5;
}
.ax-label {
  font-size: 12.5px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ax-label :deep(i) {
  font-style: italic;
}
.ax-label-left {
  text-align: right;
}
.ax-fam {
  opacity: 0.55;
  font-size: 11.5px;
}
.ax-order + .ax-order {
  margin-top: 0.7rem;
}
.ax-order-head,
.ax-fam-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  background: none;
  border: 0;
  padding: 0.15rem 0;
  color: inherit;
  text-align: left;
  font-size: 0.85rem;
  cursor: pointer;
}
.ax-order-head:hover,
.ax-fam-row:hover {
  color: rgb(var(--color-primary));
}
.ax-fam-row {
  padding-left: 1rem;
  font-size: 0.8rem;
}
.ax-fam-name {
  flex: 0 0 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ax-fam-bar {
  flex: 1 1 auto;
  height: 0.5rem;
  border-radius: 999px;
  background: rgba(var(--color-base-content), 0.07);
  overflow: hidden;
}
.ax-fam-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  opacity: 0.85;
}
.ax-dot {
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  flex-shrink: 0;
}
.ax-list {
  margin-top: 1.5rem;
  overflow-x: auto;
}
.ax-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.ax-table th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: rgba(var(--color-base-content), 0.55);
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid rgba(var(--color-base-content), 0.15);
}
.ax-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid rgba(var(--color-base-content), 0.07);
  vertical-align: top;
}
.ax-list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.ax-list-head .ax-h {
  margin: 0;
}
.ax-list-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.ax-search {
  min-width: 14rem;
  padding: 0.3rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(var(--color-base-content), 0.18);
  background: transparent;
  color: inherit;
  font-size: 0.82rem;
}
.ax-tool {
  padding: 0.3rem 0.7rem;
  border-radius: 8px;
  border: 1px solid rgba(var(--color-base-content), 0.18);
  background: transparent;
  color: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.ax-tool:hover:not(:disabled) {
  border-color: rgb(var(--color-primary));
  color: rgb(var(--color-primary));
}
.ax-tool:disabled {
  opacity: 0.45;
}
.ax-tool.small {
  padding: 0.1rem 0.55rem;
  font-size: 0.74rem;
}
.ax-sort {
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}
.ax-sort:hover {
  color: rgb(var(--color-primary));
}
.ax-badge {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  font-style: normal;
  background: #e3f4ea;
  color: #1e6b3d;
  vertical-align: 1px;
}
.ax-ref {
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  cursor: pointer;
}
.ax-ref:hover,
.ax-ref.open {
  color: rgb(var(--color-primary));
  text-decoration-style: solid;
}
.ax-ref-row td {
  border-bottom: 1px solid rgba(var(--color-base-content), 0.07);
  padding-top: 0;
}
.ax-ref-full {
  padding: 0.55rem 0.75rem;
  border-left: 3px solid rgba(var(--color-primary), 0.5);
  border-radius: 0 6px 6px 0;
  background: rgba(var(--color-base-muted), 0.35);
  font-size: 0.82rem;
}
.ax-ref-full :deep(a),
.ax-refs-text :deep(a) {
  color: rgb(var(--color-primary));
  word-break: break-all;
}
.ax-ref-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.35rem;
}
.ax-refs {
  margin-top: 1.5rem;
}
.ax-refs-item {
  padding: 0.55rem 0.6rem;
  border-top: 1px solid rgba(var(--color-base-content), 0.07);
  font-size: 0.85rem;
  border-radius: 6px;
}
.ax-refs-item.on {
  background: rgba(var(--color-primary), 0.08);
}
.ax-refs-text :deep(i) {
  font-style: italic;
}
.ax-rel {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}
.ax-mobile-group {
  display: none;
}
@media (max-width: 760px) {
  .ax-col-group {
    display: none;
  }
  .ax-mobile-group {
    display: block;
    font-style: normal;
    font-size: 0.75rem;
    opacity: 0.6;
  }
}
.ax-group-cell {
  white-space: nowrap;
}
.ax-group-cell .ax-dot {
  margin-right: 0.3rem;
  vertical-align: -1px;
}
</style>
