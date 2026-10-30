// Page translator for WID.
//
// The site is written in English. Rather than wrapping every string of every
// TaxonPages component in a translation call, this module translates what is
// on the page: it walks the rendered DOM, looks each piece of interface text up
// in a dictionary keyed by the English text, and swaps it in place. A
// MutationObserver keeps doing this as Vue renders new content. Switching back
// to English restores the original text.
//
// Dictionary keys (English text, spaces collapsed)
//   "Valid species"                plain text of one text node
//   "{x} records"                  {x} stands for any text (a number, a name…);
//                                  the translation uses {x} in the same order
//   "Please <0>log in</0> first."  a short block of text with inline elements
//                                  (links, bold, italics): <0>, <1>… stand for
//                                  those elements, in order. The translation must
//                                  keep the same elements in the same order.
//
// What is never touched: taxon names in italics (<i>, <em>), code, form values,
// and anything inside an element with the data-no-i18n attribute.

const SKIP = 'script,style,code,pre,textarea,svg,i,em,[data-no-i18n],.leaflet-tile-pane'
const INLINE = new Set(['A', 'B', 'STRONG', 'SPAN', 'I', 'EM', 'SMALL', 'SUP', 'SUB', 'MARK', 'ABBR', 'CITE', 'BR'])
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt']

let dict = null // current language: Map of English key -> translation, null for English
let patterns = [] // keys with {x}: { re, lit, value }
let collect = null // Set of keys that had no translation (for building the dictionaries)

const originals = new WeakMap() // node -> English text
const written = new WeakMap() // node -> text we wrote
const attrOriginals = new WeakMap() // element -> { attr: English }
const attrWritten = new WeakMap() // element -> { attr: text we wrote }

const norm = (s) => s.replace(/\s+/g, ' ').trim()

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function find(key) {
  if (dict.has(key)) return dict.get(key)
  for (const p of patterns) {
    if (!key.includes(p.lit)) continue
    const m = key.match(p.re)
    if (m) {
      let i = 1
      return p.value.replace(/\{x\}/g, () => m[i++] ?? '')
    }
  }
  collect?.add(key)
  return null
}

function lookup(text) {
  const key = norm(text)
  if (!key || !/[A-Za-z]/.test(key)) return null
  return find(key)
}

// Keep the spaces around the original text, so words do not run together
function withSpaces(original, translated) {
  const lead = original.match(/^\s*/)[0]
  const trail = original.match(/\s*$/)[0]
  return lead + translated + trail
}

function originalText(node) {
  if (!originals.has(node) || node.nodeValue !== written.get(node)) {
    originals.set(node, node.nodeValue)
  }
  return originals.get(node)
}

function setText(node, value) {
  if (node.nodeValue !== value) node.nodeValue = value
  written.set(node, value)
}

function translateTextNode(node) {
  const original = originalText(node)
  const t = dict ? lookup(original) : null
  setText(node, t == null ? original : withSpaces(original, t))
}

function translateAttrs(el) {
  for (const name of ATTRS) {
    if (!el.hasAttribute(name)) continue
    const orig = attrOriginals.get(el) || {}
    const wrote = attrWritten.get(el) || {}
    const current = el.getAttribute(name)
    if (!(name in orig) || current !== wrote[name]) orig[name] = current
    const t = dict ? lookup(orig[name]) : null
    const value = t == null ? orig[name] : t
    if (current !== value) el.setAttribute(name, value)
    wrote[name] = value
    attrOriginals.set(el, orig)
    attrWritten.set(el, wrote)
  }
}

// A "rich" block: text mixed with simple inline elements, e.g.
// <p>Licensed under <a>CC BY 4.0</a>, except where otherwise noted.</p>
function richParts(el) {
  let hasText = false
  let hasEl = false
  const parts = []
  for (const c of el.childNodes) {
    if (c.nodeType === 3) {
      if (c.nodeValue.trim()) hasText = true
      parts.push(c)
    } else if (c.nodeType === 1) {
      if (!INLINE.has(c.tagName)) return null
      // the inline element may only hold text (or nothing, like <br>)
      for (const g of c.childNodes) if (g.nodeType === 1 || g.nodeType === 8) return null
      hasEl = true
      parts.push(c)
    }
  }
  return hasText && hasEl ? parts : null
}

function richKey(parts) {
  let i = 0
  let key = ''
  for (const p of parts) {
    if (p.nodeType === 3) key += originalText(p)
    else {
      const t = p.firstChild ? originalText(p.firstChild) : ''
      key += `<${i}>${t}</${i}>`
      i++
    }
  }
  return norm(key)
}

function translateRich(el, parts) {
  const key = richKey(parts)
  const t = dict ? find(key) : null
  // split the translation into the text before, inside and after each element
  let pieces = null
  if (t != null) {
    pieces = []
    const re = /<(\d+)>([\s\S]*?)<\/\1>/g
    let last = 0
    let m
    while ((m = re.exec(t))) {
      pieces.push({ text: t.slice(last, m.index) }, { inner: m[2] })
      last = re.lastIndex
    }
    pieces.push({ text: t.slice(last) })
  }

  // walk the original parts, consuming the matching pieces
  let k = 0
  let textRun = [] // consecutive text nodes between two elements
  const flushText = (piece) => {
    textRun.forEach((n, j) => {
      const o = originalText(n)
      if (!pieces) return setText(n, o)
      if (j > 0) return setText(n, '') // the whole piece goes in the first node of the run
      const text = piece.text.trim()
      setText(n, text ? withSpaces(o, text) : /\s/.test(o) ? ' ' : '')
    })
    textRun = []
  }
  for (const p of parts) {
    if (p.nodeType === 3) textRun.push(p)
    else {
      flushText(pieces ? pieces[k] || { text: '' } : null)
      k++
      if (p.firstChild) {
        const o = originalText(p.firstChild)
        const inner = pieces?.[k]?.inner
        setText(p.firstChild, inner != null && !p.matches(SKIP) ? withSpaces(o, inner.trim()) : o)
      }
      k++
    }
  }
  flushText(pieces ? pieces[k] || { text: '' } : null)
  for (const p of parts) if (p.nodeType === 1) translateAttrs(p)
}

function translateElement(el) {
  if (el.closest(SKIP)) return
  translateAttrs(el)
  const parts = richParts(el)
  if (parts) return translateRich(el, parts)
  for (const c of el.childNodes) {
    if (c.nodeType === 3) translateTextNode(c)
    else if (c.nodeType === 1 && !c.matches(SKIP)) translateElement(c)
  }
}

// ---------------------------------------------------------------------------

let observer = null
let pending = new Set()
let scheduled = false

function flush() {
  scheduled = false
  const els = [...pending]
  pending = new Set()
  for (const el of els) if (el.isConnected) translateElement(el)
  observer?.takeRecords() // ignore the changes we just made
}

function schedule(el) {
  if (!el || el.nodeType !== 1) return
  pending.add(el)
  if (!scheduled) {
    scheduled = true
    queueMicrotask(flush)
  }
}

export function startTranslator(root = document.body) {
  if (observer) return
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') schedule(r.target.parentElement?.parentElement || r.target.parentElement)
      else if (r.type === 'attributes') schedule(r.target)
      else schedule(r.target) // childList: re-check the parent (it may be a rich block)
    }
  })
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS
  })
  schedule(root)
}

// entries: { english: translation }, or null for English
export function setDictionary(entries) {
  dict = null
  patterns = []
  if (entries) {
    dict = new Map()
    for (const [k, v] of Object.entries(entries)) {
      if (!k.includes('{x}')) {
        dict.set(k, v)
        continue
      }
      const parts = k.split('{x}')
      // patterns need enough fixed text to be safe ("{x} on {x}" would also
      // match titles of papers)
      if (parts.join('').replace(/[^A-Za-z]/g, '').length < 4) continue
      patterns.push({
        // each {x} stands for a short piece (a number, a name), never a paragraph
        re: new RegExp('^' + parts.map(escapeRe).join('(.{1,80}?)') + '$'),
        lit: parts.reduce((a, b) => (b.length > a.length ? b : a), ''),
        value: v
      })
    }
  }
  schedule(document.body)
}

// For building dictionaries: collectMissing() starts recording untranslated
// text, missing() returns it.
export function collectMissing() {
  collect = new Set()
}
export function missing() {
  return [...(collect || [])]
}
