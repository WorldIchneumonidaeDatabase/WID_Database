// Pure helpers for the charts of a country checklist: species per subfamily, the
// species × region table, the discovery curve, the literature by decade and by work,
// the data gaps (references / latest year per region) and literature vs specimens per region.
// Input: the DwC rows of the country (+ the citations of the asserted distributions), and the
// checklist built from them. No Vue, no network (insights.test.mjs).
import { regionName, isSpecimen, citationRef, splitReferences, shortCitation, GAZETTEER_PLACES } from './checklist.js'

const isSpecies = (t) => /species/.test(t.rank || 'species')
const yearOf = (s) => {
  const m = String(s || '').match(/\b(1[6-9]\d\d|20\d\d)\b/)
  return m ? Number(m[1]) : null
}

// one entry per record and work cited: { taxon, region, kind: 'lit' | 'spec', year, work }
export function evidence(rows, country, citations = null) {
  const out = []
  for (const r of rows) {
    const taxon = r.scientificName || '—'
    const region = regionName(r.stateProvince) || country
    if (isSpecimen(r)) {
      out.push({ taxon, region, kind: 'spec', year: Number(r.year) || yearOf(r.eventDate || r.verbatimEventDate), work: '' })
      continue
    }
    const cites = citations?.get(r.dwc_occurrence_object_id)
    const refs = cites?.length
      ? cites.map(citationRef)
      : splitReferences(r.associatedReferences).map((full) => ({ short: shortCitation(full), full }))
    for (const ref of refs) out.push({ taxon, region, kind: 'lit', year: yearOf(ref.short) || yearOf(ref.full), work: ref.short.replace(/:.*$/, '') })
  }
  return out
}

// 1. species per subfamily, most first
export function subfamilyCounts(cl) {
  return cl.subfamilies
    .map((sf) => ({ name: sf.name, n: sf.genera.reduce((s, g) => s + g.taxa.filter(isSpecies).length, 0) }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

// 2. species × region table
// columns: grouped by the country's areas when it has them (North Italy: its regions…), else
// alphabetical. cell: 'lit' | 'spec' | 'both' | '' and band: the area recorded for the taxon
// covers this column (e.g. "North Italy (Scaramozzino, 1995)")
export function speciesRegionTable(cl, country, areas = []) {
  const used = new Set()
  for (const sf of cl.subfamilies) for (const g of sf.genera) for (const t of g.taxa) for (const r of t.regions) used.add(r.region)
  const areaNames = new Set((GAZETTEER_PLACES[country] || []).map((g) => g.region))
  const groups = []
  const placed = new Set()
  for (const a of areas) {
    const cols = a.members.map(regionName)
    cols.forEach((c) => placed.add(c))
    if (areaNames.has(a.region)) placed.add(a.region)
    groups.push({ label: a.label, area: areaNames.has(a.region) ? a.region : null, columns: cols })
  }
  const rest = [...used].filter((r) => !placed.has(r) && r !== country && !areaNames.has(r)).sort((a, b) => a.localeCompare(b))
  if (rest.length) groups.push({ label: areas.length ? 'Other' : '', area: null, columns: rest })
  if (used.has(country)) groups.push({ label: '', area: null, columns: [country] })
  const columns = groups.flatMap((g) => g.columns)

  const rows = []
  for (const sf of cl.subfamilies) for (const g of sf.genera) for (const t of g.taxa) {
    const by = new Map(t.regions.map((r) => [r.region, r]))
    const kind = (r) => (!r ? '' : r.refs.length && r.specimens ? 'both' : r.specimens ? 'spec' : r.refs.length ? 'lit' : '')
    const cells = columns.map((c) => {
      const own = kind(by.get(c))
      const band = groups.find((gr) => gr.area && gr.columns.includes(c) && by.has(gr.area))
      return { kind: own, band: band ? `${band.area} (${by.get(band.area).refs.join('; ')})` : '' }
    })
    rows.push({ subfamily: sf.name, name: t.name, authorship: t.authorship, otuId: t.otuId, cells, n: cells.filter((x) => x.kind || x.band).length })
  }
  return { groups, columns, rows }
}

export function tableCSV(table) {
  const sym = { lit: 'L', spec: 'S', both: 'LS', '': '' }
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const head = ['Subfamily', 'Taxon', 'Author', ...table.columns]
  const lines = [head.map(esc).join(',')]
  for (const r of table.rows) lines.push([r.subfamily, r.name, r.authorship, ...r.cells.map((c) => sym[c.kind] || (c.band ? '(area)' : ''))].map(esc).join(','))
  lines.push('', esc('L = literature record, S = specimen, LS = both, (area) = recorded only for the wider area (e.g. North Italy)'))
  return lines.join('\r\n')
}

// 3. discovery curve: first year each species is known from the country → cumulative by year
export function discoveryCurve(ev, cl) {
  const species = new Set()
  for (const sf of cl.subfamilies) for (const g of sf.genera) for (const t of g.taxa) if (isSpecies(t)) species.add(`${t.name} ${t.authorship}`.trim())
  const first = new Map()
  for (const e of ev) {
    if (!species.has(e.taxon) || !e.year) continue
    if (!first.has(e.taxon) || e.year < first.get(e.taxon)) first.set(e.taxon, e.year)
  }
  const years = [...first.values()].sort((a, b) => a - b)
  const points = []
  years.forEach((y, i) => {
    if (points.length && points[points.length - 1].year === y) points[points.length - 1].n = i + 1
    else points.push({ year: y, n: i + 1 })
  })
  return { points, dated: first.size, undated: species.size - first.size, total: species.size }
}

// 4. literature: records per decade, and the works contributing most records
export function literatureByDecade(ev) {
  const by = new Map()
  for (const e of ev) if (e.kind === 'lit' && e.year) {
    const d = Math.floor(e.year / 10) * 10
    by.set(d, (by.get(d) || 0) + 1)
  }
  if (!by.size) return []
  const ds = [...by.keys()]
  const out = []
  for (let d = Math.min(...ds); d <= Math.max(...ds); d += 10) out.push({ decade: d, n: by.get(d) || 0 })
  return out
}
export function topWorks(ev, limit = 10) {
  const by = new Map()
  for (const e of ev) if (e.kind === 'lit' && e.work) {
    const w = by.get(e.work) || { work: e.work, records: 0, taxa: new Set() }
    w.records++
    w.taxa.add(e.taxon)
    by.set(e.work, w)
  }
  return [...by.values()].map((w) => ({ work: w.work, records: w.records, taxa: w.taxa.size }))
    .sort((a, b) => b.records - a.records || a.work.localeCompare(b.work)).slice(0, limit)
}

// 5. data gaps per region: number of works, and the latest year of any record
export function regionGaps(ev, country) {
  const by = new Map()
  for (const e of ev) {
    if (e.region === country) continue
    const g = by.get(e.region) || { works: new Set(), latest: null }
    if (e.kind === 'lit' && e.work) g.works.add(e.work)
    if (e.year && (!g.latest || e.year > g.latest)) g.latest = e.year
    by.set(e.region, g)
  }
  return new Map([...by.entries()].map(([r, g]) => [r, { works: g.works.size, latest: g.latest }]))
}

// 6. per region: species known only from the literature, from both, only from specimens
export function litVsSpecimens(cl, country) {
  const by = new Map()
  for (const sf of cl.subfamilies) for (const g of sf.genera) for (const t of g.taxa) for (const r of t.regions) {
    if (r.region === country) continue
    const v = by.get(r.region) || { region: r.region, lit: 0, both: 0, spec: 0 }
    if (r.refs.length && r.specimens) v.both++
    else if (r.specimens) v.spec++
    else if (r.refs.length) v.lit++
    by.set(r.region, v)
  }
  return [...by.values()].map((v) => ({ ...v, total: v.lit + v.both + v.spec })).sort((a, b) => b.total - a.total || a.region.localeCompare(b.region))
}
