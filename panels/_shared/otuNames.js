// Names for a few OTU ids, to label filters ("Ichneumon navus Say, 1836", valid or not).
// Cached for the page's lifetime, so several panels can ask without repeating requests.
import { makeAPIRequest } from '@/utils'

const cache = new Map() // otuId -> Promise<{ id, html, text, valid }>

function load(id) {
  return makeAPIRequest
    .get(`/otus/${id}`)
    .then(({ data: otu }) =>
      otu.taxon_name_id
        ? makeAPIRequest.get(`/taxon_names/${otu.taxon_name_id}`).then(({ data: t }) => {
            const html = `${t.cached_html || t.cached || otu.name || ''}${t.cached_author_year ? ' ' + t.cached_author_year : ''}`
            return {
              id: Number(id),
              html,
              text: html.replace(/<[^>]+>/g, ''),
              valid: t.cached_valid_taxon_name_id ? t.cached_valid_taxon_name_id === t.id : true
            }
          })
        : { id: Number(id), html: otu.name || `OTU ${id}`, text: otu.name || `OTU ${id}`, valid: true }
    )
    .catch(() => ({ id: Number(id), html: `OTU ${id}`, text: `OTU ${id}`, valid: true }))
}

export async function otuNames(ids) {
  const list = [...new Set(ids.map(Number))].filter(Boolean)
  const out = await Promise.all(
    list.map((id) => {
      if (!cache.has(id)) cache.set(id, load(id))
      return cache.get(id)
    })
  )
  // valid name first, then the others alphabetically
  return out.sort((a, b) => Number(b.valid) - Number(a.valid) || a.text.localeCompare(b.text))
}
