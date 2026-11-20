// Biological associations of a taxon, in one tidy shape for the summary card
// and the Associations tab. For a species: its own records (and those of its
// synonyms' OTUs). For a genus or above: every record of every species below.
// Each record is turned around so that "ours" is the ichneumonid and "other"
// is the host, plant or other associate, whichever side TaxonWorks stored it on.
import { makeAPIRequest } from '@/utils'

const cache = new Map() // taxon/otu key -> Promise<records>

const isSpeciesRank = (rankString = '') => /SpeciesGroup|SpeciesAndInfraspeciesGroup/.test(rankString)

// Relationships that are not biological (taxonomic comparisons etc.)
export const isComparison = (rel = '') => /compared with/i.test(rel)

function nameOf(entity) {
  const t = entity?.taxonomy || {}
  const genus = t.genus?.[1]
  const species = t.species?.[1]
  const label = String(entity?.object_label || '').trim()
  // "leaf: Artemisia vulgaris" → part "Leaf"
  const part = entity?.base_class && !['Otu', 'CollectionObject', 'FieldOccurrence'].includes(entity.base_class)
    ? (label.split(': ')[0] || '')
    : ''
  let html = genus && species ? `<i>${genus} ${species}</i>` : genus ? `<i>${genus}</i> sp.` : ''
  if (!html) {
    const m = String(entity?.object_tag || '').match(/otu_tag_taxon_name[^>]*>([\s\S]*?)<\/span>/)
    html = m ? m[1] : label
  }
  // keep the author, from the label, for the text version
  const author = label.match(/\s(\(?[A-Z][^()]*\d{4}\)?)\s*$/)?.[1] || ''
  return {
    html,
    text: html.replace(/<[^>]+>/g, '').trim(),
    author,
    part: part ? part.charAt(0).toUpperCase() + part.slice(1) : ''
  }
}

function sideOf(entity) {
  const t = entity?.taxonomy || {}
  return {
    kind: entity?.base_class || '',
    id: entity?.id,
    otuId: entity?.base_class === 'Otu' ? entity.id : null,
    // plants rarely carry an order in TaxonWorks: group them as "Plants"
    order: t.order || (t.kingdom === 'Plantae' ? 'Plants' : ''),
    family: t.family || '',
    genus: t.genus?.[1] || '',
    isIchneumonid: t.family === 'Ichneumonidae',
    ...nameOf(entity)
  }
}

// Every web address in a reference becomes a link
export const linkifyRef = (html = '') =>
  String(html).replace(
    /(^|[\s(>])(https?:\/\/[^\s<>"]+?)([.,;)]?)(?=\s|$|<)/g,
    (m, before, href, after) => `${before}<a href="${href}" target="_blank" rel="noopener">${href}</a>${after}`
  )

async function fetchSources(ids) {
  const out = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const params = new URLSearchParams()
    ids.slice(i, i + 100).forEach((id) => params.append('source_id[]', id))
    try {
      const { data } = await makeAPIRequest.get(`/sources?${params}`)
      for (const s of data || []) out.set(s.id, { cached: s.cached || '', year: Number(s.year) || 0 })
    } catch {
      /* the short form still shows */
    }
  }
  return out
}

async function fetchCitations(ids) {
  const out = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const params = new URLSearchParams([['citation_object_type', 'BiologicalAssociation']])
    ids.slice(i, i + 100).forEach((id) => params.append('citation_object_id[]', id))
    try {
      const { data } = await makeAPIRequest.get(`/citations?${params}`)
      for (const c of data || []) {
        if (!out.has(c.citation_object_id)) out.set(c.citation_object_id, [])
        out.get(c.citation_object_id).push({
          id: c.id,
          sourceId: c.source_id,
          pages: c.pages || '',
          short: c.citation_source_body || ''
        })
      }
    } catch {
      /* references are a bonus: carry on without them */
    }
  }
  return out
}

export function loadAssociations({ otuId, taxon }) {
  const species = isSpeciesRank(taxon?.rank_string)
  const key = species ? `otu:${otuId}` : `taxon:${taxon?.id}`
  if (cache.has(key)) return cache.get(key)

  const promise = (async () => {
    const params = new URLSearchParams([['per', '1000']])
    if (species) {
      params.append('otu_query[otu_id][]', otuId)
      params.append('otu_query[coordinatify]', 'true')
    } else {
      params.append('taxon_name_query[taxon_name_id][]', taxon.id)
      params.append('taxon_name_query[descendants]', 'true')
    }
    ;['subject', 'object', 'biological_relationship', 'taxonomy'].forEach((x) => params.append('extend[]', x))
    const { data } = await makeAPIRequest.get(`/biological_associations?${params}`)
    const list = Array.isArray(data) ? data : []
    const cites = await fetchCitations(list.map((b) => b.id))
    const sourceIds = [...new Set([...cites.values()].flat().map((c) => c.sourceId).filter(Boolean))]
    const sources = await fetchSources(sourceIds)
    for (const arr of cites.values()) {
      for (const c of arr) {
        const src = sources.get(c.sourceId)
        c.full = src ? linkifyRef(src.cached) : ''
        c.plain = src ? src.cached.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : c.short
        c.year = src?.year || 0
      }
    }

    return list.map((b) => {
      const subject = sideOf(b.subject)
      const object = sideOf(b.object)
      // "ours" = the ichneumonid; if neither or both are, the subject
      const flipped = !subject.isIchneumonid && object.isIchneumonid
      const rel = b.biological_relationship?.name || ''
      return {
        id: b.id,
        relationship: rel,
        inverse: b.biological_relationship?.inverted_name || '',
        flipped, // the ichneumonid is the object: read the relationship backwards
        comparison: isComparison(rel),
        // based on a specimen or field observation rather than on the literature alone
        specimen: ['CollectionObject', 'FieldOccurrence'].includes(subject.kind) ||
          ['CollectionObject', 'FieldOccurrence'].includes(object.kind),
        ours: flipped ? object : subject,
        other: flipped ? subject : object,
        citations: cites.get(b.id) || []
      }
    })
  })()

  cache.set(key, promise)
  promise.catch(() => cache.delete(key))
  return promise
}

// One colour per order of associate (the common ones get fixed colours)
const ORDER_COLORS = {
  Lepidoptera: '#d9822b',
  Coleoptera: '#3c7d4e',
  Hymenoptera: '#b8463a',
  Diptera: '#3f6fb5',
  Hemiptera: '#8a5bb0',
  Araneae: '#7a6a55',
  Neuroptera: '#2f9c9c',
  Trichoptera: '#a77b2f',
  Raphidioptera: '#6b8f2e',
  Orthoptera: '#a3576e',
  Phasmida: '#557a95',
  Phasmatodea: '#557a95',
  Plants: '#5d8a3a'
}
const SPARE = ['#5b7083', '#9c6b3f', '#6e5aa8', '#3f8f7a', '#a0525e', '#7a7f2f']
export function orderColor(order) {
  if (!order) return '#9aa0a6'
  if (ORDER_COLORS[order]) return ORDER_COLORS[order]
  let h = 0
  for (const ch of order) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SPARE[h % SPARE.length]
}
