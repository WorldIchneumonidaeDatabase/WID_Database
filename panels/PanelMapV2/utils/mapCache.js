// Keeps a lighter copy of a taxon's detailed map in the browser (IndexedDB),
// so opening the same page again shows it at once instead of waiting ~10 s
// for TaxonWorks to build it. Copies expire after a day.

const DB = 'wid-map-cache'
const STORE = 'geojson'
const MAX_AGE = 24 * 60 * 60 * 1000

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function readMap(key) {
  try {
    const db = await open()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => {
        const v = req.result
        resolve(v && Date.now() - v.savedAt < MAX_AGE ? v.data : null)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function saveMap(key, data) {
  try {
    const db = await open()
    db.transaction(STORE, 'readwrite').objectStore(STORE).put({ savedAt: Date.now(), data }, key)
  } catch {
    /* storage full or blocked: just skip caching */
  }
}

// Country and state outlines come at full resolution (megabytes). Thin them
// out: round to ~100 m and drop points closer than ~1 km to the previous one.
// Points (specimens) are left exactly as they are.
const STEP = 0.01

function thinRing(ring) {
  if (ring.length < 50) return ring
  const out = [ring[0]]
  for (let i = 1; i < ring.length - 1; i++) {
    const [x, y] = ring[i]
    const [px, py] = out[out.length - 1]
    if (Math.abs(x - px) >= STEP || Math.abs(y - py) >= STEP) out.push([Math.round(x * 1e3) / 1e3, Math.round(y * 1e3) / 1e3])
  }
  out.push(ring[ring.length - 1])
  return out.length >= 4 ? out : ring
}

function thinGeometry(g) {
  if (!g) return g
  switch (g.type) {
    case 'Polygon':
      return { ...g, coordinates: g.coordinates.map(thinRing) }
    case 'MultiPolygon':
      return { ...g, coordinates: g.coordinates.map((p) => p.map(thinRing)) }
    case 'GeometryCollection':
      return { ...g, geometries: g.geometries.map(thinGeometry) }
    default:
      return g
  }
}

export function thinFeatures(features = []) {
  return features.map((f) => ({ ...f, geometry: thinGeometry(f.geometry) }))
}
