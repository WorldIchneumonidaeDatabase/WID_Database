// Reads one TaxonWorks catalogue entry (a line of the Nomenclature list):
// splits the name from the reference and its topics, and works out what kind
// of entry it is (original description, combination, synonym…).
// Shared by the list rows and the timeline so the two always agree.

// "(subjective synonym of …)", "(homonym of …)", "(replaced by …)", "(nomen novum for …)"
export const RELATION_RE = /\(([a-z][a-z ]*?)\s+(?:of|by|for)\s/
const RELATION_TEXT = {
  replaced: 'Replaced name',
  'nomen novum': 'Replacement name'
}

// "<i>Imeria longitarsis</i> (Cameron, 1905) in Townes & Townes, 1973: 241."
//   → name "<i>Imeria longitarsis</i> (Cameron, 1905)", ref "Townes & Townes, 1973: 241.", inWord
// "<i>Imeria</i> Cameron, 1903: 173-174." → name "<i>Imeria</i>", ref "Cameron, 1903: 173-174."
export function splitLabel(citation) {
  const l = String(citation.label || '').trim()
  const at = l.lastIndexOf(' in ')
  if (at > 0) return { name: l.slice(0, at), ref: l.slice(at + 4), inWord: true }
  if (!citation.source_id || RELATION_RE.test(l)) return { name: l, ref: '', inWord: false }
  const endName = l.lastIndexOf('</i>')
  let cut = endName >= 0 ? endName + 4 : l.indexOf(' ')
  while (l[cut] === ')') cut++ // keep "(<i>Subgenus</i>)" whole
  if (cut <= 0) return { name: l, ref: '', inWord: false }
  return { name: l.slice(0, cut), ref: l.slice(cut).trim(), inWord: false }
}

// "Cresson, 1864: 138-139. Description; Diagnosis" → ref "Cresson, 1864: 138-139", topics [...]
export function splitRef(ref = '') {
  const y = ref.match(/\b\d{4}[a-z]?\b/)
  if (!y) return { ref, topics: [] }
  let end = y.index + y[0].length
  let tail = ref.slice(end)
  if (/^\s*:/.test(tail)) {
    const stop = tail.search(/\.(\s|$)/)
    end += stop >= 0 ? stop : tail.length
    tail = ref.slice(end)
  }
  const topics = tail
    .replace(/^\.?\s*/, '')
    .split(/;\s*/)
    .map((t) => t.trim().replace(/\.$/, ''))
    .filter(Boolean)
  return { ref: ref.slice(0, end).trim(), topics }
}

// What the entry is: { text, tone, help }
export function entryKind(citation, timeline = []) {
  const label = String(citation.label || '').trim()
  const parts = splitLabel(citation)
  const { topics } = splitRef(parts.ref)
  const topicSet = new Set(topics.map((t) => t.toLowerCase()))

  if (/nomen nudum/i.test(label)) {
    return { text: 'Nomen nudum', tone: 'warn', help: 'Published without a description: not available' }
  }
  if (/\(unavailable or invalid/i.test(label)) {
    return { text: 'Unavailable', tone: 'warn', help: 'An unavailable or invalid name, linked to an available one' }
  }
  const rel = label.match(RELATION_RE)
  if (rel) {
    const r = rel[1].trim()
    const text = RELATION_TEXT[r] || r.charAt(0).toUpperCase() + r.slice(1)
    const tone = /homonym|replaced/.test(r) ? 'warn' : /synonym/.test(r) ? 'syn' : 'info'
    return { text, tone, help: `Nomenclatural act: ${r}` }
  }
  const isProtonym = (citation.protonym_ids || []).includes(citation.taxon_name_id)
  if (isProtonym && !parts.inWord) {
    return { text: 'Original description', tone: 'orig', help: 'The name as first published (protonym)' }
  }
  if (!isProtonym) {
    // TaxonWorks topics say it outright when they are there
    const first = topics.length
      ? topicSet.has('new combination')
      : timeline.find((t) => t.taxon_name_id === citation.taxon_name_id) === citation
    // Species-group names (an italic word starting lower-case) are combinations;
    // genus-group names moved or changed in rank are placements
    const species = /<i>[^<]*\b[a-z]/.test(parts.name)
    if (species) {
      return first
        ? { text: 'New combination', tone: 'comb', help: 'First use of this combination' }
        : { text: 'Combination', tone: 'comb', help: 'Later use of this combination' }
    }
    return first
      ? { text: 'New placement', tone: 'comb', help: 'First use of this rank or placement' }
      : { text: 'Placement', tone: 'comb', help: 'Later use of this rank or placement' }
  }
  if (topicSet.has('lectotype') || topicSet.has('neotype')) {
    return { text: 'Type designation', tone: 'type', help: 'A lectotype or neotype is designated or cited here' }
  }
  return { text: 'Cited', tone: 'muted', help: 'The name as cited in a later work' }
}
