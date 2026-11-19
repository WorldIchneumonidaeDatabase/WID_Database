<template>
  <div
    ref="rootEl"
    class="wid-gsearch relative w-full"
    :class="`wid-gsearch--${variant}`"
  >
    <div class="relative">
      <svg
        class="wid-gsearch__icon absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z"
        />
      </svg>
      <input
        ref="inputEl"
        v-model="term"
        type="search"
        role="combobox"
        autocomplete="off"
        :autofocus="autofocus"
        :placeholder="placeholder"
        :aria-expanded="isOpen"
        aria-controls="wid-gsearch-list"
        :aria-activedescendant="activeIndex >= 0 ? `wid-gsearch-opt-${activeIndex}` : undefined"
        aria-label="Search taxa, references and authors"
        class="wid-gsearch__input w-full"
        @focus="hasFocus = true"
        @keydown="onKeydown"
      />
      <span
        v-if="isBusy"
        class="wid-gsearch__spinner absolute right-3.5 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>

    <div
      v-if="isOpen"
      id="wid-gsearch-list"
      role="listbox"
      class="wid-gsearch__panel absolute z-[600] mt-2 w-full max-h-[70vh] overflow-y-auto rounded-xl bg-base-foreground text-base-content shadow-2xl ring-1 ring-base-border/50 text-left"
    >
      <template
        v-for="section in sections"
        :key="section.key"
      >
        <div
          v-if="section.items.length || section.loading"
          class="py-1.5"
        >
          <p class="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
            {{ section.title }}
          </p>
          <p
            v-if="section.loading && !section.items.length"
            class="px-4 py-2 text-sm text-base-content/50"
          >
            Searching…
          </p>
          <button
            v-for="item in section.items"
            :id="`wid-gsearch-opt-${item.index}`"
            :key="item.key"
            type="button"
            role="option"
            :aria-selected="activeIndex === item.index"
            class="w-full flex items-start gap-3 px-4 py-2 text-left text-sm hover:bg-base-muted/40"
            :class="{ 'bg-base-muted/40': activeIndex === item.index }"
            @mousedown.prevent="choose(item)"
            @mouseenter="activeIndex = item.index"
          >
            <span
              class="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold"
              :class="BADGE[section.key]"
              aria-hidden="true"
              >{{ section.badge }}</span
            >
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2 min-w-0">
                <span
                  class="truncate [&_i]:italic"
                  v-html="item.html"
                />
                <span
                  v-if="item.status && item.status !== 'valid'"
                  :class="['flex-shrink-0 rounded-full px-1.5 text-[10px] font-semibold leading-4', STATUS_CLASS[item.status]]"
                  >{{ STATUS_TEXT[item.status] }}</span
                >
              </span>
              <span
                v-if="item.sub"
                class="block truncate text-xs text-base-content/55"
                v-html="item.sub"
              />
            </span>
          </button>
        </div>
      </template>

      <p
        v-if="!anyLoading && !totalItems"
        class="px-4 py-4 text-sm text-base-content/60"
      >
        Nothing found for “{{ term.trim() }}”.
      </p>

      <RouterLink
        v-if="term.trim().length >= MIN_REFS"
        :to="{ path: '/resources/tw/filter/bibliography', query: { query_term: term.trim() } }"
        class="block border-t border-base-border/40 px-4 py-2.5 text-sm font-semibold text-primary-color dark:text-secondary-color hover:bg-base-muted/30"
        @mousedown.prevent="goBibliography"
      >
        Search all references for “{{ term.trim() }}” →
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'

const props = defineProps({
  placeholder: { type: String, default: 'Search taxa, references or authors…' },
  autofocus: { type: Boolean, default: false },
  // 'hero' (large, light input) or 'dark' (translucent input on the navy band)
  variant: { type: String, default: 'hero' }
})

const MIN_TAXA = 2
const MIN_REFS = 3
const BADGE = {
  taxa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  refs: 'bg-primary-color/10 text-primary-color dark:bg-secondary-color/15 dark:text-secondary-color',
  people: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300'
}

const router = useRouter()
const rootEl = ref(null)
const inputEl = ref(null)
const term = ref('')
const hasFocus = ref(false)
const activeIndex = ref(-1)

const taxa = ref([])
const refs = ref([])
const people = ref([])
const loading = ref({ taxa: false, refs: false, people: false })

let timer = null
let requestId = 0

const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
const escapeHtml = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function clearResults() {
  taxa.value = []
  refs.value = []
  people.value = []
}

async function search(q, id) {
  const tasks = []

  if (q.length >= MIN_TAXA) {
    loading.value.taxa = true
    tasks.push(
      makeAPIRequest
        .get('/otus/autocomplete', { params: { term: q, having_taxon_name_only: true } })
        .then(({ data }) => {
          if (id !== requestId) return
          taxa.value = (data || []).slice(0, 6).map((o) => {
            // TaxonWorks marks names: ✓ valid, ❌ not valid, [c] a combination
            const raw = String(o.label_html || o.label)
            const status = /&#10060;|❌/.test(raw) ? 'invalid' : /\[c\]/.test(raw) ? 'combination' : 'valid'
            const html = raw.replace(/\s*(&#10003;|&#10060;|✓|❌|\[c\])\s*/g, ' ').trim()
            const name = stripTags(html)
            // "Caenojoppa Cameron, 1905 now Imeria Cameron, 1903" → "Imeria Cameron, 1903"
            const now = String(o.label || '').split(/\s+now\s+/)[1] || (status === 'combination' ? o.label : '')
            return {
              key: `t${o.id}-${name}`,
              type: 'taxa',
              html,
              status,
              sub: status !== 'valid' && now && now !== name ? `→ ${escapeHtml(now)}` : '',
              otuId: o.otu_valid_id || o.id,
              ownOtuId: o.id,
              name
            }
          })
        })
        .catch(() => {})
        .finally(() => id === requestId && (loading.value.taxa = false))
    )
  }

  if (q.length >= MIN_REFS) {
    loading.value.refs = true
    loading.value.people = true

    tasks.push(
      Promise.all([
        makeAPIRequest.get('/sources', { params: { in_project: true, author: q, per: 5 } }).catch(() => ({ data: [] })),
        makeAPIRequest.get('/sources', { params: { in_project: true, query_term: q, per: 5 } }).catch(() => ({ data: [] }))
      ])
        .then(([byAuthor, byTerm]) => {
          if (id !== requestId) return
          const seen = new Set()
          refs.value = [...(byAuthor.data || []), ...(byTerm.data || [])]
            .filter((s) => !seen.has(s.id) && seen.add(s.id))
            .slice(0, 5)
            .map((s) => ({
              key: `r${s.id}`,
              type: 'refs',
              html: `${escapeHtml(s.cached_author_string || 'Unknown author')}${s.year ? `, ${s.year}` : ''}`,
              sub: s.title || stripTags(s.cached).slice(0, 140),
              url: s.doi ? `https://doi.org/${s.doi}` : null,
              title: stripTags(s.title || s.cached)
            }))
        })
        .finally(() => id === requestId && (loading.value.refs = false))
    )

    tasks.push(
      makeAPIRequest
        .get('/people/autocomplete', { params: { term: q } })
        .then(({ data }) => {
          if (id !== requestId) return
          people.value = (data || [])
            .filter((p) => /In(&nbsp;|\s)Project/i.test(p.label_html || ''))
            .slice(0, 4)
            .map((p) => {
              const usage = (p.label_html || '').match(/(\d+)\s+uses/)
              const active = (p.label_html || '').match(/active ~ ([\d-]+)/)
              return {
                key: `p${p.id}`,
                type: 'people',
                html: escapeHtml(p.label),
                sub: [active ? `active ${active[1]}` : '', usage ? `${usage[1]} uses in TaxonWorks` : '']
                  .filter(Boolean)
                  .join(' · '),
                lastName: String(p.label || '').split(',')[0].trim()
              }
            })
        })
        .catch(() => {})
        .finally(() => id === requestId && (loading.value.people = false))
    )
  }

  await Promise.all(tasks)
}

watch(term, (value) => {
  clearTimeout(timer)
  activeIndex.value = -1
  const q = value.trim()
  if (q.length < MIN_TAXA) {
    requestId++
    clearResults()
    loading.value = { taxa: false, refs: false, people: false }
    return
  }
  timer = setTimeout(() => {
    const id = ++requestId
    clearResults()
    search(q, id)
  }, 250)
})

const sections = computed(() => {
  let i = 0
  const withIndex = (list) => list.map((item) => ({ ...item, index: i++ }))
  return [
    { key: 'taxa', title: 'Taxa', badge: 'T', items: withIndex(taxa.value), loading: loading.value.taxa },
    { key: 'refs', title: 'References', badge: 'R', items: withIndex(refs.value), loading: loading.value.refs },
    { key: 'people', title: 'People', badge: 'P', items: withIndex(people.value), loading: loading.value.people }
  ]
})

const flatItems = computed(() => sections.value.flatMap((s) => s.items))
const totalItems = computed(() => flatItems.value.length)
const anyLoading = computed(() => Object.values(loading.value).some(Boolean))
const isBusy = computed(() => anyLoading.value && term.value.trim().length >= MIN_TAXA)
const isOpen = computed(() => hasFocus.value && term.value.trim().length >= MIN_TAXA)

function close() {
  hasFocus.value = false
  activeIndex.value = -1
}

// Not-valid names open their own page (which links to the valid name);
// old combinations open the species page, which says what was searched for
const STATUS_TEXT = { invalid: 'Invalid', combination: 'Combination' }
const STATUS_CLASS = {
  invalid: 'bg-red-500/10 text-red-700 dark:text-red-300',
  combination: 'bg-base-muted text-base-content/70'
}

function choose(item) {
  if (item.type === 'taxa') {
    if (item.status === 'invalid') {
      router.push({ name: 'otus-id-overview', params: { id: item.ownOtuId } })
    } else {
      const query = item.status === 'combination' ? { from: item.name } : {}
      router.push({ name: 'otus-id-overview', params: { id: item.otuId }, query })
    }
  } else if (item.type === 'refs') {
    router.push({ path: '/resources/tw/filter/bibliography', query: { query_term: item.title } })
  } else if (item.type === 'people') {
    router.push({ path: '/resources/tw/filter/bibliography', query: { author: item.lastName } })
  }
  term.value = ''
  close()
  inputEl.value?.blur()
}

function goBibliography() {
  router.push({ path: '/resources/tw/filter/bibliography', query: { query_term: term.value.trim() } })
  term.value = ''
  close()
}

function onKeydown(e) {
  const n = totalItems.value
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % n
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems.value[activeIndex.value] || flatItems.value[0]
    if (item) choose(item)
    else if (term.value.trim().length >= MIN_REFS) goBibliography()
  } else if (e.key === 'Escape') {
    close()
    inputEl.value?.blur()
  }
}

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) close()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  if (props.autofocus && window.matchMedia('(min-width: 768px)').matches) inputEl.value?.focus()
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  clearTimeout(timer)
})
</script>

<style scoped>
.wid-gsearch__input {
  border: 0;
  outline: none;
  font-size: 1rem;
  padding: 0 2.75rem 0 2.5rem;
  box-sizing: border-box;
}

.wid-gsearch--hero .wid-gsearch__input {
  height: 3.25rem;
  border-radius: 0.75rem;
  background: #fff;
  color: #1f2937;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.wid-gsearch--hero .wid-gsearch__input:focus {
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 0 3px rgb(var(--color-secondary));
}

.wid-gsearch--hero .wid-gsearch__icon {
  color: #6b7280;
}

.wid-gsearch--dark .wid-gsearch__input {
  height: 2.5rem;
  font-size: 0.875rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
}

.wid-gsearch--dark .wid-gsearch__input::placeholder {
  color: rgba(255, 255, 255, 0.55);
}

.wid-gsearch--dark .wid-gsearch__input:focus {
  border-color: rgb(var(--color-secondary));
  background: rgba(255, 255, 255, 0.12);
}

.wid-gsearch--dark .wid-gsearch__icon {
  color: rgba(255, 255, 255, 0.6);
}

.wid-gsearch__spinner {
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  border: 2px solid rgba(var(--color-primary), 0.25);
  border-top-color: rgb(var(--color-primary));
  animation: wid-spin 0.7s linear infinite;
}

@keyframes wid-spin {
  to {
    transform: rotate(360deg);
  }
}

/* hide the browser's own clear button on type=search */
.wid-gsearch__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}
</style>
