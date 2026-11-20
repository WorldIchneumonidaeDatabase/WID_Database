// WID data releases, read from the wid-releases repository on GitHub
// (releases.json is written by its "Make a release" workflow).
import { ref } from 'vue'

export const RELEASES_REPO = 'WorldIchneumonidaeDatabase/wid-releases'
const RAW = `https://raw.githubusercontent.com/${RELEASES_REPO}/main`
export const RELEASES_URL = `https://github.com/${RELEASES_REPO}/releases`

const releases = ref(null) // null = loading, [] = none yet
let loading = null

export function useReleases() {
  loading ||= fetch(`${RAW}/releases.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => (releases.value = Array.isArray(list) ? list : []))
  return releases
}

export async function loadStats(version) {
  try {
    const r = await fetch(`${RAW}/releases/${version}/stats.json`, { cache: 'no-cache' })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

export const fmtNum = (n) => Number(n || 0).toLocaleString('en-US')
export const fmtDate = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
export const doiUrl = (doi) => (doi ? `https://doi.org/${doi}` : '')
