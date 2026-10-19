// Pure helpers for the checklist map: match WID place names to the boundary files in
// public/checklist-maps (Natural Earth admin-1, simplified; US counties from us-atlas),
// count taxa per place, colour classes, and the exports (GeoJSON, KML).

// "Trentino-Alto Adige" → "trentinoaltoadige" (same normalisation as the build script)
export const norm = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// a few WID spellings that differ from Natural Earth
const EXTRA = { sicilia: 'sicily', puglia: 'apulia', sardinia: 'sardegna', lombardy: 'lombardia', tuscany: 'toscana', piedmont: 'piemonte', islascanarias: 'canaryis', esp00canaryisaggregation: 'canaryis' }
const keysOf = (name) => [norm(name), EXTRA[norm(name)]].filter(Boolean)

// features: [{ properties: { name, keys } }]; names: WID place names → Map(name → feature index)
export function matchPlaces(features, names) {
  const byKey = new Map()
  features.forEach((f, i) => (f.properties.keys || [norm(f.properties.name)]).forEach((k) => { if (!byKey.has(k)) byKey.set(k, i) }))
  const out = new Map()
  for (const n of names) {
    const i = keysOf(n).map((k) => byKey.get(k)).find((x) => x !== undefined)
    if (i !== undefined) out.set(n, i)
  }
  return out
}

// boundary file → the level (admin-1 units or their regions) that matches more WID names
export function chooseLevel(file, names) {
  const a = matchPlaces(file.admin1, names)
  const r = file.regions ? matchPlaces(file.regions, names) : new Map()
  return r.size > a.size ? { features: file.regions, match: r, level: 'regions' } : { features: file.admin1, match: a, level: 'admin1' }
}

// taxa per place from a built checklist (all taxa, or only `focus`)
export function placeCounts(checklist, country, focus = '') {
  const regions = new Map()
  const counties = new Map()
  for (const sf of checklist.subfamilies) for (const g of sf.genera) for (const t of g.taxa) {
    if (focus && t.name !== focus) continue
    for (const r of t.regions) {
      if (r.region === country) continue
      bump(regions, r.region, r)
      for (const c of r.counties || []) bump(counties, `${r.region}|${c.name}`, c)
    }
  }
  return { regions, counties }
}
function bump(map, key, g) {
  const v = map.get(key) || { taxa: 0, specimens: 0, literature: 0 }
  v.taxa++
  v.specimens += g.specimens
  if (g.refs.length) v.literature++
  map.set(key, v)
}

// up to 5 classes with rounded breaks: [1, 3, 6, 12, 25] → class 0..4
export function breaks(values) {
  const max = Math.max(1, ...values)
  if (max <= 5) return Array.from({ length: max }, (_, i) => i + 1)
  const raw = [1, max * 0.1, max * 0.25, max * 0.5, max * 0.75].map((x) => Math.max(1, Math.round(x)))
  return [...new Set(raw)]
}
export const classOf = (v, br) => br.reduce((c, b, i) => (v >= b ? i : c), 0)
// colour ramps, light → dark (5 steps); "custom" is built from one colour
export const PALETTES = {
  blue: { label: 'Blue', ramp: ['#d6e4f5', '#a7c4e8', '#6f9fd6', '#3d76bd', '#1b4f93'] },
  green: { label: 'Green', ramp: ['#d9f0d3', '#a6dba0', '#5aae61', '#1b7837', '#00441b'] },
  orange: { label: 'Orange', ramp: ['#fee6ce', '#fdae6b', '#fd8d3c', '#e6550d', '#a63603'] },
  red: { label: 'Red', ramp: ['#fee0d2', '#fc9272', '#fb6a4a', '#cb181d', '#67000d'] },
  purple: { label: 'Purple', ramp: ['#e7e1ef', '#c6b8dc', '#9e9ac8', '#6a51a3', '#3f007d'] },
  grey: { label: 'Grey (print)', ramp: ['#e0e0e0', '#bdbdbd', '#969696', '#636363', '#252525'] },
  viridis: { label: 'Viridis (colour-blind safe)', ramp: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'] }
}
export const RAMP = PALETTES.blue.ramp

const hex = (c) => {
  const m = String(c).replace('#', '')
  const v = m.length === 3 ? m.split('').map((x) => x + x).join('') : m
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))
}
const toHex = (rgb) => '#' + rgb.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
// one colour → 5 steps from a light tint to a darker shade of it
export function rampFromColor(c) {
  const rgb = hex(c)
  if (rgb.some((x) => Number.isNaN(x))) return RAMP
  const tint = (t) => toHex(rgb.map((x) => 255 - (255 - x) * t))
  const shade = (t) => toHex(rgb.map((x) => x * t))
  return [tint(0.2), tint(0.45), tint(0.75), toHex(rgb), shade(0.7)]
}
export const rampFor = (n, ramp = RAMP) => (n >= 5 ? ramp : ramp.slice(5 - n))

// specimens with coordinates (optionally one taxon, one region)
export function specimenPoints(rows, { focus = '', region = '', regionOf = (r) => r.stateProvince } = {}) {
  return rows.filter((r) => {
    const lat = Number(r.decimalLatitude); const lon = Number(r.decimalLongitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return false
    const sn = String(r.scientificName || '')
    if (focus && sn !== focus && !sn.startsWith(focus + ' ')) return false
    if (region && regionOf(r) !== region) return false
    return true
  })
}

export function toGeoJSON({ points, places }) {
  const features = points.map((r) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [Number(r.decimalLongitude), Number(r.decimalLatitude)] },
    properties: {
      scientificName: r.scientificName, basisOfRecord: r.basisOfRecord, country: r.country, stateProvince: r.stateProvince,
      county: r.county, locality: r.verbatimLocality, eventDate: r.eventDate || r.verbatimEventDate,
      institutionCode: r.institutionCode, catalogNumber: r.catalogNumber, occurrenceID: r.occurrenceID
    }
  }))
  for (const p of places) features.push({ type: 'Feature', geometry: p.geometry, properties: { place: p.name, taxa: p.taxa, specimens: p.specimens, literatureTaxa: p.literature } })
  return JSON.stringify({ type: 'FeatureCollection', features })
}

const xml = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]))
export function toKML({ points, title }) {
  const pm = points.map((r) => `<Placemark><name>${xml(r.scientificName)}</name><description>${xml([r.verbatimLocality, r.eventDate || r.verbatimEventDate, [r.institutionCode, r.catalogNumber].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</description><Point><coordinates>${Number(r.decimalLongitude)},${Number(r.decimalLatitude)}</coordinates></Point></Placemark>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(title)}</name>${pm.join('')}</Document></kml>`
}
