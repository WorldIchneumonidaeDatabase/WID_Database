// Splits a TaxonWorks type material label into its parts, e.g.
// "Lectotype; adult, female; ANSP926; deposited at: Academy of Natural Sciences
//  of Philadelphia (ANSP); New York (Mr. James Angus)"
// → { status: 'Lectotype', sex: '♀', stage: 'adult', catalog: 'ANSP926',
//     repository: 'Academy of Natural Sciences of Philadelphia (ANSP)',
//     repositoryCode: 'ANSP', notes: 'New York (Mr. James Angus)' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseTypeLabel(label = '') {
  const parts = String(label).split(/;\s*/).map((p) => p.trim()).filter(Boolean)
  const out = {
    status: parts[0] || '',
    sex: '',
    stage: '',
    catalog: '',
    repository: '',
    repositoryCode: '',
    notes: ''
  }
  const rest = []

  for (const p of parts.slice(1)) {
    if (/^deposited at:/i.test(p)) {
      out.repository = p.replace(/^deposited at:\s*/i, '')
      out.repositoryCode = out.repository.match(/\(([A-Za-z][\w-]*)\)\s*$/)?.[1] || ''
    } else if (!out.sex && !out.stage && /\b(adult|larva|pupa|nymph|egg|immature|female|male)\b/i.test(p)) {
      const sex = p.match(/\b(female|male)\b/i)?.[1]?.toLowerCase()
      out.sex = sex === 'female' ? '♀' : sex === 'male' ? '♂' : ''
      out.stage = p.replace(/,?\s*\b(female|male)\b/i, '').replace(/^,\s*/, '').trim()
    } else if (!out.catalog && !out.repository && !/\s/.test(p) && /\d/.test(p)) {
      out.catalog = UUID.test(p) ? '' : p // internal ids are not catalogue numbers
    } else {
      rest.push(p)
    }
  }
  out.notes = rest.join('; ')
  return out
}

// "Lectotype ♀ · ANSP926 · ANSP"
export function shortTypeLabel(label) {
  const t = parseTypeLabel(label)
  return [
    [t.status, t.sex].filter(Boolean).join(' '),
    t.catalog,
    t.repositoryCode || t.repository
  ].filter(Boolean).join(' · ')
}

// Primary types first in red, secondary ones in grey
export const isPrimaryType = (status = '') => /^(holotype|lectotype|neotype)/i.test(status)
