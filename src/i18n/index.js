// Interface languages of WID. English is the language the site is written in;
// the others are dictionaries in ./locales, loaded only when chosen.
// Taxon names, authors and references are never translated.
import { ref } from 'vue'
import { startTranslator, setDictionary, collectMissing, missing } from './translator'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' }
]

const loaders = {
  it: () => import('./locales/it.json'),
  es: () => import('./locales/es.json'),
  pt: () => import('./locales/pt.json')
}

const STORAGE_KEY = 'wid-language'
export const locale = ref('en')

function stored() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export async function setLocale(code) {
  if (!LANGUAGES.some((l) => l.code === code)) code = 'en'
  locale.value = code
  document.documentElement.lang = code
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {}
  if (code === 'en') return setDictionary(null)
  const entries = (await loaders[code]()).default
  if (locale.value === code) setDictionary(entries) // ignore a slower, older choice
}

// A link can set the language: worldichneumonidae.com/?lang=it
// (read once, then removed from the address so a later choice is not overridden)
function fromUrl() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('lang')
  if (code) {
    params.delete('lang')
    const query = params.toString()
    const url = window.location.pathname + (query ? '?' + query : '') + window.location.hash
    window.history.replaceState(window.history.state, '', url)
  }
  return code
}

export function initI18n() {
  startTranslator(document.body)
  // in development, window.__widI18n.collectMissing() then .missing() lists
  // the interface text that has no translation yet
  if (import.meta.env.DEV) window.__widI18n = { collectMissing, missing, setLocale }
  const code = fromUrl() || stored()
  if (code && code !== 'en') setLocale(code)
  else if (code === 'en') locale.value = 'en'
}
