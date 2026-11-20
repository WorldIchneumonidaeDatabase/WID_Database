<template>
  <VCard v-if="state !== 'off'">
    <VCardHeader class="flex items-center gap-2">
      <h2 class="text-md grow">Catalogue of Life</h2>
      <a
        v-if="col"
        :href="`https://www.catalogueoflife.org/data/taxon/${col.id}`"
        target="_blank"
        rel="noopener"
        class="col-open"
        >Open in COL ↗</a
      >
    </VCardHeader>
    <VCardContent class="text-sm">
      <p
        v-if="state === 'loading'"
        class="opacity-60"
      >
        Looking the name up in the Catalogue of Life…
      </p>
      <p
        v-else-if="state === 'error'"
        class="opacity-60"
      >
        The Catalogue of Life could not be reached.
      </p>
      <p
        v-else-if="state === 'none'"
        class="col-line"
      >
        <span class="col-pill terra">not in COL</span>
        The Catalogue of Life does not have this name.
      </p>

      <template v-else-if="col">
        <!-- how COL treats this name -->
        <p class="col-line">
          <span :class="['col-pill', agree ? 'olive' : 'amber']">{{ agree ? 'agrees with WID' : 'differs from WID' }}</span>
          <template v-if="col.status === 'accepted'">
            Accepted as
            <span
              class="col-name"
              v-html="col.labelHtml"
            />
          </template>
          <template v-else>
            Synonym of
            <span
              class="col-name"
              v-html="col.acceptedHtml"
            />
          </template>
        </p>

        <p
          v-if="col.viaOriginal"
          class="col-path"
        >
          Found in COL under the original combination <i>{{ col.viaOriginal }}</i>
        </p>

        <!-- what differs -->
        <ul
          v-if="diffs.length"
          class="col-diffs"
        >
          <li
            v-for="d in diffs"
            :key="d.key"
          >
            <b>{{ LABELS[d.key] }}</b>
            <span class="opacity-60">WID</span> <span v-html="d.wid" />
            <span class="col-sep">·</span>
            <span class="opacity-60">COL</span> <span v-html="d.col" />
          </li>
        </ul>

        <p
          v-if="col.path"
          class="col-path"
        >
          {{ col.path }}
        </p>

        <!-- synonyms in one and not the other (species only) -->
        <div
          v-if="syn"
          class="col-syn"
        >
          <p class="col-syn-sum">
            <span class="mr-1">Synonyms:</span><strong class="mr-1">{{ syn.colCount }}</strong><span class="mr-1">in COL,</span><strong class="mr-1">{{ syn.widCount }}</strong><span>in WID</span>
            <template v-if="!syn.onlyCol.length && !syn.onlyWid.length && !syn.yearDiff.length"><span class="mx-1">·</span><span>the same names</span></template>
          </p>
          <details v-if="syn.onlyCol.length">
            <summary>
              <span class="col-pill amber">{{ syn.onlyCol.length }}</span> only in COL
            </summary>
            <ul>
              <li
                v-for="n in syn.onlyCol"
                :key="n.key"
                v-html="n.html"
              />
            </ul>
          </details>
          <details v-if="syn.yearDiff.length">
            <summary>
              <span class="col-pill terra">{{ syn.yearDiff.length }}</span> same name, different year
            </summary>
            <ul>
              <li
                v-for="n in syn.yearDiff"
                :key="n.key"
                v-html="n.html"
              />
            </ul>
          </details>
          <details v-if="syn.onlyWid.length">
            <summary>
              <span class="col-pill sea">{{ syn.onlyWid.length }}</span> only in WID
            </summary>
            <ul>
              <li
                v-for="n in syn.onlyWid"
                :key="n.key"
                v-html="n.html"
              />
            </ul>
          </details>
        </div>

        <p class="col-source">
          <span>{{ release }}</span><span class="mr-1">, from</span><span>{{ col.source || '—' }}</span>
        </p>
      </template>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'

const COL = 'https://api.checklistbank.org/dataset/3LR'
const API = 'https://api.checklistbank.org'

const props = defineProps({
  otuId: { type: [Number, String], default: undefined },
  taxonId: { type: [Number, String], default: undefined },
  taxon: { type: Object, default: undefined },
  otu: { type: Object, default: undefined }
})

const LABELS = { status: 'Status', validName: 'Valid name', authorship: 'Authorship' }
const STATUS = { valid: 'valid', invalid: 'invalid', accepted: 'accepted', synonym: 'synonym' }

const state = ref('loading')
const col = ref(null)
const widValid = ref(null) // the valid name in WID (this one, or the one this is a synonym of)
const syn = ref(null)
const release = ref('')

const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
const ital = (name = '') => `<i>${name}</i>`
const norm = (s = '') =>
  String(s)
    .replace(/\s\([A-Z][a-z]+\)\s/g, ' ') // subgenus: Syrphus (Syrphus) ribesii = Syrphus ribesii
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim()
const yearOf = (s = '') => (String(s).match(/\d{4}/) || [''])[0]
// the epithet without its gender ending: the same synonym whatever genus it is combined with
// (olitorius = olitoria, nigrum = niger)
const stemOf = (name = '') =>
  String(name).trim().split(/\s+/).pop().toLowerCase().replace(/(ius|ia|ium|us|um|a|is|e|er|ra|rum)$/, '')
const keyOf = (name = '', author = '') => `${stemOf(name)}|${yearOf(author)}`

const agree = computed(() => !diffs.value.length)
const diffs = computed(() => {
  if (!col.value || !widValid.value) return []
  const out = []
  const tx = props.taxon || {}
  const widIsValid = tx.cached_is_valid !== false
  const colIsAccepted = col.value.status === 'accepted'
  if (widIsValid !== colIsAccepted)
    out.push({ key: 'status', wid: widIsValid ? STATUS.valid : STATUS.invalid, col: colIsAccepted ? STATUS.accepted : STATUS.synonym })
  if (norm(widValid.value.name) !== norm(col.value.acceptedName))
    out.push({ key: 'validName', wid: ital(widValid.value.name), col: ital(col.value.acceptedName) })
  else if (norm(widValid.value.author) && norm(col.value.acceptedAuthor) && norm(widValid.value.author) !== norm(col.value.acceptedAuthor))
    out.push({ key: 'authorship', wid: widValid.value.author, col: col.value.acceptedAuthor })
  return out
})

async function load() {
  const tx = props.taxon
  if (!tx?.cached) return
  state.value = 'loading'
  col.value = null
  syn.value = null
  try {
    // the valid name in WID
    let valid = tx
    if (tx.cached_is_valid === false && tx.cached_valid_taxon_name_id && tx.cached_valid_taxon_name_id !== tx.id) {
      const { data } = await makeAPIRequest.get(`/taxon_names/${tx.cached_valid_taxon_name_id}`)
      valid = data
    }
    widValid.value = { name: valid.cached, author: valid.cached_author_year || '' }

    // COL: match this name (with authorship when we have it); if COL lacks it, try the original combination
    const info = await get(COL).catch(() => ({}))
    release.value = info.alias || (info.version ? `COL ${info.version}` : 'COL')
    async function match(name, author) {
      const q = new URLSearchParams({ q: name, rank: tx.rank || '' })
      if (author) q.set('authorship', author)
      const m = await get(`${COL}/match/nameusage?${q}`)
      const u = m?.usage
      // COL falls back to a higher taxon (e.g. the genus) when it lacks the name: that is no match
      const sameRank = u && String(u.rank || '').toLowerCase() === String(tx.rank || '').toLowerCase()
      const sameName = u && stemOf(u.name) === stemOf(name) && norm(u.name).split(' ')[0] === norm(name).split(' ')[0]
      if (!u || m.type === 'none' || m.type === 'higherrank' || !sameRank) return null
      if (!sameName && m.type !== 'exact' && m.type !== 'variant') return null
      return u
    }
    let u = await match(tx.cached, tx.cached_author_year)
    let viaOriginal = ''
    const orig = tx.cached_original_combination
    if (!u && orig && orig !== tx.cached) {
      u = await match(orig, String(tx.cached_author_year || '').replace(/^\((.*)\)$/, '$1'))
      if (u) viaOriginal = orig
    }
    if (!u) {
      state.value = 'none'
      return
    }
    const cls = u.classification || []
    const acc = u.status === 'accepted' ? u : cls[0] || {}
    const ranks = ['subfamily', 'tribe', 'genus']
    const path = cls.filter((c) => ranks.includes(c.rank) && c.id !== acc.id).reverse().map((c) => c.name).join(' › ')
    // where COL got it from
    let source = ''
    if (u.sectorKey) {
      try {
        const sec = await get(`${COL}/sector/${u.sectorKey}`)
        const ds = await get(`${API}/dataset/${sec.subjectDatasetKey}`)
        source = [ds.alias || ds.title, ds.version].filter(Boolean).join(' ')
      } catch {
        source = ''
      }
    }
    col.value = {
      id: acc.id || u.id,
      status: u.status === 'accepted' ? 'accepted' : 'synonym',
      labelHtml: `<i>${u.name}</i> ${u.authorship || ''}`,
      viaOriginal,
      acceptedName: acc.name || '',
      acceptedAuthor: acc.authorship || '',
      acceptedHtml: acc.labelHtml || `<i>${acc.name || ''}</i> ${acc.authorship || ''}`,
      path,
      source
    }
    state.value = 'done'

    // species: compare the synonyms of the accepted name
    if (/species/i.test(tx.rank || '') && acc.id && tx.cached_is_valid !== false) {
      const [colSyn, wid] = await Promise.all([
        get(`${COL}/taxon/${acc.id}/synonyms`),
        makeAPIRequest.get('/taxon_names', { params: { 'taxon_name_id[]': [tx.id], synonymify: true, per: 500 } })
      ])
      const colList = [...(colSyn.homotypic || []), ...(colSyn.heterotypic || [])]
        .map((x) => x.name || {})
        .map((n) => ({
          stem: stemOf(n.scientificName),
          year: yearOf(n.authorship),
          html: `<i>${n.scientificName}</i> ${n.authorship || ''}`
        }))
      const widList = (wid.data || [])
        .filter((n) => n.type === 'Protonym' && n.id !== tx.id && n.rank === tx.rank)
        .map((n) => ({
          stem: stemOf(n.name || n.cached),
          year: yearOf(n.cached_author_year),
          html: `<i>${n.cached_original_combination || n.cached}</i> ${String(n.cached_author_year || '').replace(/^\((.*)\)$/, '$1')}`
        }))
      const uniq = (l) => l.filter((x, i) => l.findIndex((y) => y.stem === x.stem && y.year === x.year) === i)
      const c = uniq(colList)
      const s = uniq(widList)
      const own = stemOf(tx.name || tx.cached)
      const same = (a, b) => a.stem === b.stem && a.year === b.year
      const nameOnly = (a, b) => a.stem === b.stem && a.year !== b.year
      // same name in both, but a different year
      const yearDiff = s
        .filter((x) => !c.some((y) => same(x, y)))
        .map((x) => ({ x, y: c.find((y) => nameOnly(x, y) && !s.some((z) => same(z, y))) }))
        .filter((p) => p.y)
      const paired = (x) => yearDiff.some((p) => p.x === x || p.y === x)
      syn.value = {
        colCount: c.length,
        widCount: s.length,
        onlyCol: c.filter((x) => !(x.stem === own) && !s.some((y) => same(x, y)) && !paired(x)).map((x, i) => ({ key: 'c' + i, html: x.html })),
        onlyWid: s.filter((x) => !c.some((y) => same(x, y)) && !paired(x)).map((x, i) => ({ key: 's' + i, html: x.html })),
        yearDiff: yearDiff.map((p, i) => ({ key: 'y' + i, html: `${p.x.html} <span class="opacity-60">· COL ${p.y.year}</span>` }))
      }
    }
  } catch {
    state.value = col.value ? 'done' : 'error'
  }
}

watch(() => props.taxon?.id, load, { immediate: true })
</script>

<style scoped>
.col-open {
  font-size: 0.78rem;
  color: rgb(var(--color-primary));
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.col-line {
  margin: 0;
  line-height: 1.6;
}
.col-name {
  font-weight: 600;
}
.col-pill {
  display: inline-block;
  margin-right: 0.4rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  vertical-align: 1px;
  border: 1px solid #b9dcc4;
  background: #e6f3ea;
  color: #1f6a3a;
}
.col-pill.amber {
  background: #fdf0e1;
  color: #8a4b0f;
  border-color: #f0d2ad;
}
.col-pill.terra {
  background: #fbe4e1;
  color: #8f2418;
  border-color: #f0c2bb;
}
.col-pill.sea {
  background: rgba(var(--color-primary), 0.12);
  color: rgb(var(--color-primary));
  border-color: rgba(var(--color-primary), 0.3);
}
.col-diffs {
  margin: 0.5rem 0 0;
  padding: 0.45rem 0.7rem;
  list-style: none;
  border-left: 3px solid rgb(var(--color-secondary));
  background: rgba(var(--color-secondary), 0.1);
  border-radius: 0 0.35rem 0.35rem 0;
  font-size: 0.82rem;
  line-height: 1.6;
}
.col-diffs b {
  margin-right: 0.4rem;
  font-weight: 600;
}
.col-sep {
  margin: 0 0.4rem;
  opacity: 0.4;
}
.col-path {
  margin: 0.45rem 0 0;
  font-size: 0.78rem;
  opacity: 0.75;
}
.col-syn {
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px solid rgba(var(--color-base-muted), 0.9);
}
.col-syn-sum {
  margin: 0 0 0.3rem;
  font-size: 0.82rem;
  opacity: 0.75;
}
.col-syn details {
  margin-top: 0.3rem;
}
.col-syn summary {
  cursor: pointer;
  font-size: 0.85rem;
}
.col-syn ul {
  margin: 0.3rem 0 0 1.2rem;
  padding: 0;
  list-style: none;
  font-size: 0.82rem;
  line-height: 1.6;
  opacity: 0.75;
}
.col-source {
  margin: 0.7rem 0 0;
  font-size: 0.72rem;
  opacity: 0.75;
}
</style>
