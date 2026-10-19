// Pure helpers for the country checklist: build the checklist from Darwin Core
// occurrence rows (/dwc_occurrences?country=…) plus the citations of the asserted
// distributions (for page numbers), and export it. No Vue, no network, so they can be
// tested on their own (checklist.test.mjs).

// Region names as they appear in WID → one spelling per region
const REGION_ALIASES = {
  Sicily: 'Sicilia',
  Sardinia: 'Sardegna',
  'Aosta Valley': "Valle d'Aosta",
  Apulia: 'Puglia',
  Lombardy: 'Lombardia',
  Tuscany: 'Toscana',
  Piedmont: 'Piemonte'
}
export const regionName = (s) => REGION_ALIASES[s?.trim()] || s?.trim() || ''

// Gazetteers: custom areas made in TaxonWorks (Gazetteer task), e.g. the "North Italy" of
// Scaramozzino (1995). Records on a gazetteer carry no country or region in the Darwin Core
// index — only its name as `locality` — so each one is listed here with the country it belongs
// to and the label to show. Add a line when you create a new gazetteer.
export const GAZETTEER_PLACES = {
  Italy: [
    {
      locality: 'North Italy (sensu Scaramozzino 1995)',
      region: 'North Italy',
      source: 'Scaramozzino, 1995',
      members: ['Friuli-Venezia Giulia', 'Veneto', 'Trentino-Alto Adige', 'Lombardia', "Valle d'Aosta", 'Piemonte', 'Liguria', 'Emilia-Romagna']
    },
    {
      locality: 'South Italy (sensu Scaramozzino 1995)',
      region: 'South Italy',
      source: 'Scaramozzino, 1995',
      members: ['Toscana', 'Marche', 'Umbria', 'Lazio', 'Abruzzo', 'Molise', 'Campania', 'Puglia', 'Basilicata', 'Calabria']
    }
  ]
}

// The places a filter value stands for: an area of the literature ("North Italy") = the area
// itself + every region inside it; anything else = itself
export function regionsOf(country, region) {
  if (!region) return []
  const g = (GAZETTEER_PLACES[country] || []).find((x) => x.region === region)
  return g ? [g.region, ...g.members.map(regionName)] : [region]
}

// The areas drawn on the inset map of a country, in a fixed order (one light colour each)
export function insetAreas(country) {
  const gz = (GAZETTEER_PLACES[country] || []).map((g) => ({ label: g.region, region: g.region, members: g.members, source: g.source }))
  const extra = INSET_EXTRA[country] || []
  return gz.length ? [...gz, ...extra] : []
}
// islands / areas that are single regions (shown on the inset with the gazetteers)
export const INSET_EXTRA = {
  Italy: [
    { label: 'Sicily', region: 'Sicilia', members: ['Sicilia'] },
    { label: 'Sardinia', region: 'Sardegna', members: ['Sardegna'] }
  ]
}

// "North Italy" → its definition, for the filter, the list and the downloads
export function areaNote(country, region) {
  const g = (GAZETTEER_PLACES[country] || []).find((x) => x.region === region)
  return g ? `${g.region} (sensu ${g.source}): ${g.members.join(', ')}` : ''
}
// the definitions of the areas used in a checklist
export function areaNotes(cl, country) {
  const used = new Set(cl.subfamilies.flatMap((sf) => sf.genera.flatMap((g) => g.taxa.flatMap((t) => t.regions.map((r) => r.region)))))
  return (GAZETTEER_PLACES[country] || []).filter((g) => used.has(g.region)).map((g) => areaNote(country, g.region))
}

// rows of a gazetteer → rows of the country, with the gazetteer label as region
export const asCountryRows = (rows, country, region) =>
  rows.map((r) => ({ ...r, country: r.country || country, stateProvince: r.stateProvince || region }))

export const stripTags = (s) =>
  String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()

export const splitReferences = (s) => stripTags(s).split(/\s+\|\s+/).map((x) => x.trim()).filter(Boolean)

// "Pagliano, G. & Poggi, R. (2004) Title…" → "Pagliano & Poggi, 2004"
// "Di Giovanni, F., Reshchikov, A., Riedel, M. … (2021) …" → "Di Giovanni et al., 2021"
export function shortCitation(ref) {
  const s = stripTags(ref)
  const m = s.match(/^(.*?)\s*\((\d{4}[a-z]?)\)/)
  if (!m) return s.slice(0, 40)
  const [, authors, year] = m
  const surnames = authors
    .split(/\s*(?:&|,\s*(?=[^,]+,\s*[A-Z]\.)|\band\b)\s*/)
    .map((a) => a.split(',')[0].trim())
    .filter((a) => a && !/^[A-Z]\.(\s*[A-Z]\.)*$/.test(a))
  const names = [...new Set(surnames)]
  const who = names.length > 2 ? `${names[0]} et al.` : names.join(' & ')
  return `${who}, ${year}`
}

// TaxonWorks citation → { short: "Cresson, 1864: 142–143", full: "Cresson, E.T. (1864) …" }
// (citation_source_body is "Cresson, 1864:142-143"; pages may be empty)
export function citationRef(c) {
  const full = stripTags(c.source?.label || c.source?.cached || '')
  let short = stripTags(c.citation_source_body || '')
  if (!short) short = shortCitation(full) + (c.pages ? `:${c.pages}` : '')
  short = short.replace(/:\s*(.+)$/, (_, p) => `: ${p.replace(/(\d)\s*-\s*(\d)/g, '$1–$2')}`)
  // more than two authors → "First et al." ("Ruíz-Cancino, Kasparyan, … & Coronado-Blanco, 2005")
  short = short.replace(/^(.+?),\s*(\d{4}[a-z]?)(?=:|$)/, (all, who, year) => {
    const names = who.split(/\s*(?:,|&)\s*/).filter(Boolean)
    return names.length > 2 ? `${names[0]} et al., ${year}` : all
  })
  return { short, full: full || short }
}

// The name without its authorship, for italics: "Coelichneumon (Coelichneumon) eburnifrons"
export function bareName(r) {
  const full = r.scientificName || ''
  const auth = r.scientificNameAuthorship || ''
  return auth && full.endsWith(auth) ? full.slice(0, -auth.length).trim() : full
}

export const isSpecimen = (r) => r.basisOfRecord === 'PreservedSpecimen' || r.dwc_occurrence_object_type === 'CollectionObject'

// ---------------------------------------------------------------- evidence per place

const newGroup = (name) => ({ name, refs: new Map(), specimens: 0, inst: new Set() })

// add one record to a group: its works (with pages when known) or one specimen
function addRecord(g, r, citations) {
  if (isSpecimen(r)) {
    g.specimens++
    if (r.institutionCode) g.inst.add(r.institutionCode)
    return
  }
  const cites = citations?.get(r.dwc_occurrence_object_id)
  const refs = cites?.length ? cites.map(citationRef) : splitReferences(r.associatedReferences).map((full) => ({ short: shortCitation(full), full }))
  for (const { short, full } of refs) {
    g.refs.set(short, full)
  }
}

function finishGroup(g) {
  const pairs = [...g.refs.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  return { name: g.name, refs: pairs.map((x) => x[0]), fullRefs: pairs.map((x) => x[1]), specimens: g.specimens, institutions: [...g.inst].sort() }
}

// "Cresson, 1864: 142; 2 specimens: USNM, ANSP"
export function evidenceText(g) {
  const parts = [...g.refs]
  if (g.specimens) parts.push(`${g.specimens} specimen${g.specimens > 1 ? 's' : ''}${g.institutions?.length ? ` (${g.institutions.join(', ')})` : ''}`)
  return parts.join('; ')
}
const withEvidence = (label, g) => (evidenceText(g) ? `${label} (${evidenceText(g)})` : label)

// "Veneto (Dal Pos, 2026: 15; 3 specimens (MSNVE))"
// with counties: "Ohio (Riley & Howard, 1890: 151): Ottawa Co. (Cresson, 1864: 142), Lucas Co. (2 specimens (USNM))"
export function regionText(g, { countySuffix = '' } = {}) {
  const head = withEvidence(g.region, g)
  if (!g.counties?.length) return head
  return `${head}: ${g.counties.map((c) => withEvidence(c.name + countySuffix, c)).join(', ')}`
}

export const countySuffixFor = (country) => (/^United States/.test(country) ? ' Co.' : '')

export function distributionText(t, { byCounty = false, country = '' } = {}) {
  const opts = { countySuffix: countySuffixFor(country) }
  return t.regions.map((g) => regionText(g, opts)).join(byCounty ? '; ' : ', ')
}

/**
 * rows: DwC occurrences of one country. citations: Map(asserted distribution id → [TaxonWorks citations]).
 * byCounty: also group records by county within each region.
 * Returns { subfamilies: [{ name, genera: [{ name, taxa }] }], stats, references, hasCounties }
 * taxon.regions = [{ region, refs, fullRefs, specimens, institutions, counties?: [{ name, refs, … }] }]
 * (the evidence on a region itself is what was recorded for the region without a county)
 */
export function buildChecklist(rows, country, { citations = null, byCounty = false } = {}) {
  const taxa = new Map()
  const refs = new Map()
  for (const r of rows) {
    const key = r.scientificName || '—'
    if (!taxa.has(key)) {
      taxa.set(key, {
        name: bareName(r),
        authorship: r.scientificNameAuthorship || '',
        rank: r.taxonRank || '',
        subfamily: r.subfamily || 'Subfamily not assigned',
        genus: r.genus || (r.taxonRank === 'genus' ? bareName(r) : 'Genus not assigned'),
        otuId: r.otu_id,
        byRegion: new Map()
      })
    }
    const t = taxa.get(key)
    const region = regionName(r.stateProvince) || country
    if (!t.byRegion.has(region)) t.byRegion.set(region, { own: newGroup(region), counties: new Map() })
    const reg = t.byRegion.get(region)
    let g = reg.own
    if (byCounty && r.county && region !== country) {
      const c = r.county.trim()
      if (!reg.counties.has(c)) reg.counties.set(c, newGroup(c))
      g = reg.counties.get(c)
    }
    addRecord(g, r, citations)
    for (const [short, full] of g.refs) refs.set(full, short.replace(/:.*$/, ''))
  }

  const byName = (a, b) => a.name.localeCompare(b.name)
  const subfamilies = new Map()
  for (const t of taxa.values()) {
    t.regions = [...t.byRegion.values()]
      .map(({ own, counties }) => {
        const g = finishGroup(own)
        return { ...g, region: g.name, counties: [...counties.values()].map(finishGroup).sort(byName) }
      })
      // regions first, the bare country (no region given) last
      .sort((a, b) => (a.region === country) - (b.region === country) || a.region.localeCompare(b.region))
    delete t.byRegion
    if (!subfamilies.has(t.subfamily)) subfamilies.set(t.subfamily, new Map())
    const gen = subfamilies.get(t.subfamily)
    if (!gen.has(t.genus)) gen.set(t.genus, [])
    gen.get(t.genus).push(t)
  }
  const out = [...subfamilies.entries()]
    .map(([name, gen]) => ({
      name,
      genera: [...gen.entries()].map(([name, taxa]) => ({ name, taxa: taxa.sort(byName) })).sort(byName)
    }))
    .sort(byName)

  const all = [...taxa.values()]
  return {
    subfamilies: out,
    hasCounties: rows.some((r) => r.county),
    references: [...refs.entries()].map(([full, short]) => ({ full, short })).sort((a, b) => a.full.localeCompare(b.full)),
    stats: {
      species: all.filter((t) => /species|subspecies/.test(t.rank)).length,
      genera: new Set(all.map((t) => t.genus)).size,
      subfamilies: out.length,
      literature: rows.filter((r) => !isSpecimen(r)).length,
      specimens: rows.filter(isSpecimen).length,
      regions: new Set(all.flatMap((t) => t.regions.map((g) => g.region)).filter((x) => x !== country)).size,
      counties: new Set(rows.filter((r) => r.county).map((r) => `${regionName(r.stateProvince)}|${r.county.trim()}`)).size
    }
  }
}

// keep only taxa matching the text and/or the region
export function filterChecklist(list, { text = '', region = '' } = {}) {
  const q = text.trim().toLowerCase()
  return list
    .map((sf) => ({
      ...sf,
      genera: sf.genera
        .map((g) => ({
          ...g,
          taxa: g.taxa.filter((t) => {
            if (region && !t.regions.some((r) => r.region === region)) return false
            if (!q) return true
            return [sf.name, g.name, t.name, t.authorship, ...t.regions.map((r) => regionText(r))].join(' ').toLowerCase().includes(q)
          })
        }))
        .filter((g) => g.taxa.length)
    }))
    .filter((sf) => sf.genera.length)
}

// Only one region (state), and optionally one county in it: each taxon keeps just that
// region (and its counties, or only that county); the references are the works cited there.
// Used on screen and for the downloads.
export function restrictToRegion(cl, region, county = '') {
  const wanted = Array.isArray(region) ? region : region ? [region] : []
  if (!wanted.length) return cl
  const keep = (r) => {
    if (!wanted.includes(r.region)) return null
    if (!county) return r
    const c = (r.counties || []).filter((x) => x.name === county)
    return c.length ? { ...r, refs: [], fullRefs: [], specimens: 0, institutions: [], counties: c } : null
  }
  const subfamilies = cl.subfamilies
    .map((sf) => ({
      ...sf,
      genera: sf.genera
        .map((g) => ({ ...g, taxa: g.taxa.map((t) => ({ ...t, regions: t.regions.map(keep).filter(Boolean) })).filter((t) => t.regions.length) }))
        .filter((g) => g.taxa.length)
    }))
    .filter((sf) => sf.genera.length)
  const cited = new Map()
  for (const sf of subfamilies) for (const g of sf.genera) for (const t of g.taxa) for (const r of t.regions) {
    for (const grp of [r, ...(r.counties || [])]) grp.fullRefs.forEach((full, i) => cited.set(full, grp.refs[i].replace(/:.*$/, '')))
  }
  return { ...cl, subfamilies, references: [...cited.entries()].map(([full, short]) => ({ full, short })).sort((a, b) => a.full.localeCompare(b.full)) }
}

export const rowsInRegion = (rows, region, country, county = '') => {
  const wanted = Array.isArray(region) ? region : region ? [region] : []
  return wanted.length
    ? rows.filter((r) => wanted.includes(regionName(r.stateProvince) || country) && (!county || String(r.county || '').trim() === county))
    : rows
}

// counties with records in one region (for the County menu)
export function countiesIn(cl, region) {
  const set = new Set()
  for (const sf of cl.subfamilies) for (const g of sf.genera) for (const t of g.taxa) for (const r of t.regions) {
    if (r.region === region) (r.counties || []).forEach((c) => set.add(c.name))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

// ---------------------------------------------------------------- exports

const csvCell = (v) => {
  const s = String(v ?? '')
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// one row per record and work cited, Darwin Core column names (+ the citation with pages)
export function toCSV(rows, citations = null) {
  const cols = ['subfamily', 'genus', 'scientificName', 'scientificNameAuthorship', 'taxonRank', 'country', 'stateProvince', 'county',
    'basisOfRecord', 'institutionCode', 'catalogNumber', 'citation', 'associatedReferences', 'occurrenceID', 'otu_id']
  const lines = [cols.join(',')]
  for (const r of rows) {
    const cites = !isSpecimen(r) && citations?.get(r.dwc_occurrence_object_id)
    const refs = cites?.length ? cites.map(citationRef) : [{ short: '', full: stripTags(r.associatedReferences) }]
    for (const ref of refs) {
      const v = { ...r, stateProvince: regionName(r.stateProvince), citation: ref.short, associatedReferences: ref.full }
      lines.push(cols.map((c) => csvCell(v[c])).join(','))
    }
  }
  return lines.join('\r\n')
}

const heading = (cl, { country, date, byCounty }) =>
  `Generated from the World Ichneumonidae Database (WID) on ${date}${byCounty ? ', by region and county' : ''}.`

// plain-text checklist, as it would appear in a paper
export function toText(cl, { country, title, date, byCounty = false }) {
  const out = [title, heading(cl, { country, date, byCounty }), '']
  const notes = areaNotes(cl, country)
  if (notes.length) out.push('Areas:', ...notes, '')
  for (const sf of cl.subfamilies) {
    out.push(sf.name.toUpperCase(), '')
    for (const g of sf.genera) {
      for (const t of g.taxa) {
        out.push(`${t.name} ${t.authorship}`.trim())
        out.push(`Distribution in ${country}: ${distributionText(t, { byCounty, country })}.`, '')
      }
    }
  }
  out.push('REFERENCES', '', ...cl.references.map((r) => r.full))
  return out.join('\r\n')
}

// Rich Text (opens in Word with italics and bold)
const rtfEsc = (s) =>
  String(s).replace(/[\\{}]/g, (c) => '\\' + c).replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0)}?`)
export function toRTF(cl, { country, title, date, byCounty = false }) {
  const p = (s) => `{\\pard\\sa120 ${s}\\par}`
  const out = ['{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs22',
    p(`\\b ${rtfEsc(title)}\\b0`),
    p(rtfEsc(heading(cl, { country, date, byCounty }))),
    ...areaNotes(cl, country).map((n) => p(`\\i ${rtfEsc(n)}\\i0`))]
  for (const sf of cl.subfamilies) {
    out.push(p(`\\b ${rtfEsc(sf.name)}\\b0`))
    for (const g of sf.genera) {
      for (const t of g.taxa) {
        out.push(`{\\pard\\sa0 \\i ${rtfEsc(t.name)}\\i0  ${rtfEsc(t.authorship)}\\par}`)
        out.push(p(`Distribution in ${rtfEsc(country)}: ${rtfEsc(distributionText(t, { byCounty, country }))}.`))
      }
    }
  }
  out.push(p('\\b References\\b0'), ...cl.references.map((r) => p(rtfEsc(r.full))), '}')
  return out.join('\n')
}

export function download(name, content, type) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
