// node pages/components/Checklist/checklist.test.mjs
import assert from 'node:assert/strict'
import { shortCitation, splitReferences, bareName, buildChecklist, regionText, filterChecklist, toCSV, toText, toRTF, citationRef, distributionText, restrictToRegion, rowsInRegion, countiesIn, asCountryRows, GAZETTEER_PLACES, areaNote, areaNotes, regionsOf, insetAreas } from './checklist.js'

assert.equal(shortCitation('Pagliano, G. &amp; Poggi, R. (2004) <i>Agriotypus</i> …'), 'Pagliano & Poggi, 2004')
assert.equal(shortCitation('Pagliano, G. (2009) Le collezioni …'), 'Pagliano, 2009')
assert.equal(shortCitation('Di Giovanni, F., Reshchikov, A., Riedel, M., Diller, E. &amp; Schwarz, M. (2015) New records'), 'Di Giovanni et al., 2015')
assert.equal(shortCitation('Gravenhorst, J.L.C. (1829) Ichneumonologia'), 'Gravenhorst, 1829')
assert.equal(shortCitation('Izquierdo Moya, M.I. &amp; Rey del Castillo, C. (1985) Sobre'), 'Izquierdo Moya & Rey del Castillo, 1985')
assert.equal(shortCitation('Van Rossem, G. (1990) Key'), 'Van Rossem, 1990')
assert.deepEqual(splitReferences('A, B. (2000) X. | C, D. (2001) Y.').length, 2)
assert.equal(bareName({ scientificName: 'Coelichneumon (Coelichneumon) eburnifrons (Wesmael, 1857)', scientificNameAuthorship: '(Wesmael, 1857)' }), 'Coelichneumon (Coelichneumon) eburnifrons')

const lit = (name, auth, sf, genus, region, ref, rank = 'species', otu = 1) =>
  ({ scientificName: `${name} ${auth}`, scientificNameAuthorship: auth, taxonRank: rank, subfamily: sf, genus, stateProvince: region, basisOfRecord: 'MaterialCitation', associatedReferences: ref, otu_id: otu, dwc_occurrence_object_type: 'AssertedDistribution', country: 'Italy' })
const spec = (name, auth, sf, genus, region) =>
  ({ scientificName: `${name} ${auth}`, scientificNameAuthorship: auth, taxonRank: 'species', subfamily: sf, genus, stateProvince: region, basisOfRecord: 'PreservedSpecimen', otu_id: 9, dwc_occurrence_object_type: 'CollectionObject', country: 'Italy' })

const rows = [
  lit('Diadromus collaris', '(Gravenhorst, 1829)', 'Ichneumoninae', 'Diadromus', 'Liguria', 'Gravenhorst, J.L.C. (1829) Ichn. | Scaramozzino, P.L. (1995) Checklist. | Pagliano, G. (2009) Coll.'),
  lit('Diadromus collaris', '(Gravenhorst, 1829)', 'Ichneumoninae', 'Diadromus', 'Sicily', 'Turrisi, G.F., Schönitzer, K. &amp; Diller, E. (2007) Sicily.'),
  lit('Lycorina triangulifera', 'Holmgren, 1859', 'Lycorininae', 'Lycorina', 'Sardegna', 'Costa, A. (1886) Sarda.', 'species', 762614),
  lit('Lycorina triangulifera', 'Holmgren, 1859', 'Lycorininae', 'Lycorina', 'Sardegna', 'Costa, A. (1886) Sarda.', 'species', 763503),
  lit('Ophion brocki', 'Johansson, 2019', 'Ophioninae', 'Ophion', undefined, 'Johansson, N. &amp; Cederberg, B. (2019) Review.'),
  lit('Collyria', 'Schiødte, 1839', 'Collyriinae', 'Collyria', 'Sicily', 'Izquierdo Moya, M.I. &amp; Rey del Castillo, C. (1985) Sobre.', 'genus'),
  lit('Neorhacodes enslini', '(Ruschka, 1922)', 'Neorhacodinae', 'Neorhacodes', 'Piemonte', 'Scaramozzino, P.L. (1989) Note.'),
  spec('Neorhacodes enslini', '(Ruschka, 1922)', 'Neorhacodinae', 'Neorhacodes', 'Piemonte'),
  spec('Neorhacodes enslini', '(Ruschka, 1922)', 'Neorhacodinae', 'Neorhacodes', 'Piemonte'),
]
const cl = buildChecklist(rows, 'Italy')
assert.deepEqual(cl.subfamilies.map((s) => s.name), ['Collyriinae', 'Ichneumoninae', 'Lycorininae', 'Neorhacodinae', 'Ophioninae'])
const dia = cl.subfamilies[1].genera[0].taxa[0]
assert.equal(dia.name, 'Diadromus collaris')
assert.equal(dia.regions.map(regionText).join(', '), 'Liguria (Gravenhorst, 1829; Pagliano, 2009; Scaramozzino, 1995), Sicilia (Turrisi et al., 2007)')
const lyc = cl.subfamilies[2].genera[0].taxa
assert.equal(lyc.length, 1, 'two OTUs of one valid name → one entry')
assert.equal(regionText(lyc[0].regions[0]), 'Sardegna (Costa, 1886)')
const neo = cl.subfamilies[3].genera[0].taxa[0]
assert.equal(regionText(neo.regions[0]), 'Piemonte (Scaramozzino, 1989; 2 specimens)')
const oph = cl.subfamilies[4].genera[0].taxa[0]
assert.equal(regionText(oph.regions[0]), 'Italy (Johansson & Cederberg, 2019)')
assert.equal(cl.stats.species, 4)
assert.equal(cl.stats.specimens, 2)
assert.equal(cl.stats.literature, 7)
assert.equal(cl.references.length, 8)
assert.equal(filterChecklist(cl.subfamilies, { region: 'Sicilia' }).flatMap((s) => s.genera).length, 2)
assert.equal(filterChecklist(cl.subfamilies, { text: 'costa' }).length, 1)
const csv = toCSV(rows)
assert.ok(csv.split('\r\n')[2].includes('Sicilia'))
const txt = toText(cl, { country: 'Italy', title: 'Ichneumonidae of Italy', date: '2026-10-18' })
assert.ok(txt.includes('Diadromus collaris (Gravenhorst, 1829)\r\nDistribution in Italy: Liguria (Gravenhorst, 1829; Pagliano, 2009; Scaramozzino, 1995), Sicilia (Turrisi et al., 2007).'))
assert.ok(toRTF(cl, { country: 'Italy', title: 'T', date: 'd' }).includes('\\i Diadromus collaris\\i0'))
assert.deepEqual(dia.regions[0].fullRefs.map((f) => f.slice(0, 5)), ['Grave', 'Pagli', 'Scara'], 'hover text follows the sorted short citations')

// page numbers from the citations of the asserted distributions
assert.deepEqual(citationRef({ citation_source_body: 'Cresson, 1864:142-143', pages: '142-143', source: { label: 'Cresson, E.T. (1864) <i>X</i>.' } }),
  { short: 'Cresson, 1864: 142–143', full: 'Cresson, E.T. (1864) X.' })
assert.equal(citationRef({ citation_source_body: 'Costa, 1886', source: { label: 'Costa, A. (1886) Sarda.' } }).short, 'Costa, 1886')
const withIds = rows.map((r, i) => ({ ...r, dwc_occurrence_object_id: i + 1 }))
const cites = new Map([[2, [{ citation_source_body: 'Turrisi et al., 2007:118', source: { label: 'Turrisi, G.F., Schönitzer, K. & Diller, E. (2007) Sicily.' } }]]])
const cl2 = buildChecklist(withIds, 'Italy', { citations: cites })
assert.ok(distributionText(cl2.subfamilies[1].genera[0].taxa[0]).includes('Sicilia (Turrisi et al., 2007: 118)'))
assert.ok(toCSV(withIds, cites).includes('Turrisi et al., 2007: 118'))

assert.equal(citationRef({ citation_source_body: 'Ruíz-Cancino, Kasparyan, Myartseva, Trjapitzin & Coronado-Blanco, 2005:173' }).short, 'Ruíz-Cancino et al., 2005: 173')
assert.equal(citationRef({ citation_source_body: 'Kasparyan & Hernandez Aguilar, 2001:229' }).short, 'Kasparyan & Hernandez Aguilar, 2001: 229')

// specimens with their institutions
const inst = buildChecklist([{ ...spec('A b', 'X, 1900', 'S', 'A', 'Ohio'), institutionCode: 'USNM' }, { ...spec('A b', 'X, 1900', 'S', 'A', 'Ohio'), institutionCode: 'ANSP' }], 'United States')
assert.equal(regionText(inst.subfamilies[0].genera[0].taxa[0].regions[0]), 'Ohio (2 specimens (ANSP, USNM))')

// counties
const us = [
  { ...lit('A b', 'X, 1900', 'S', 'A', 'Ohio', 'Riley, C.V. & Howard, L.O. (1890) Some.'), country: 'United States' },
  { ...lit('A b', 'X, 1900', 'S', 'A', 'Ohio', 'Cresson, E.T. (1864) Desc.'), county: 'Ottawa', country: 'United States' },
  { ...spec('A b', 'X, 1900', 'S', 'A', 'Ohio'), county: 'Lucas', institutionCode: 'USNM', country: 'United States' },
  { ...lit('A b', 'X, 1900', 'S', 'A', 'Maine', 'Smith, J. (1950) M.'), county: 'Hancock', country: 'United States' }
]
const byState = buildChecklist(us, 'United States')
assert.equal(distributionText(byState.subfamilies[0].genera[0].taxa[0], { country: 'United States' }),
  'Maine (Smith, 1950), Ohio (Cresson, 1864; Riley & Howard, 1890; 1 specimen (USNM))')
const byCounty = buildChecklist(us, 'United States', { byCounty: true })
assert.equal(byCounty.hasCounties, true)
assert.equal(byCounty.stats.counties, 3)
assert.equal(distributionText(byCounty.subfamilies[0].genera[0].taxa[0], { byCounty: true, country: 'United States' }),
  'Maine: Hancock Co. (Smith, 1950); Ohio (Riley & Howard, 1890): Lucas Co. (1 specimen (USNM)), Ottawa Co. (Cresson, 1864)')
assert.ok(toText(byCounty, { country: 'United States', title: 'T', date: 'd', byCounty: true }).includes('Ohio (Riley & Howard, 1890): Lucas Co.'))
const ohio = restrictToRegion(byCounty, 'Ohio')
assert.equal(distributionText(ohio.subfamilies[0].genera[0].taxa[0], { byCounty: true, country: 'United States' }),
  'Ohio (Riley & Howard, 1890): Lucas Co. (1 specimen (USNM)), Ottawa Co. (Cresson, 1864)')
assert.deepEqual(ohio.references.map((r) => r.short), ['Cresson, 1864', 'Riley & Howard, 1890'])
assert.equal(rowsInRegion(us, 'Maine', 'United States').length, 1)
const lucas = restrictToRegion(byCounty, 'Ohio', 'Lucas')
assert.equal(distributionText(lucas.subfamilies[0].genera[0].taxa[0], { byCounty: true, country: 'United States' }), 'Ohio: Lucas Co. (1 specimen (USNM))')
assert.equal(lucas.references.length, 0)
assert.equal(restrictToRegion(byCounty, 'Ohio', 'Nowhere').subfamilies.length, 0)
assert.deepEqual(countiesIn(byCounty, 'Ohio'), ['Lucas', 'Ottawa'])
assert.equal(rowsInRegion(us, 'Ohio', 'United States', 'Ottawa').length, 1)
const gz = asCountryRows([{ ...lit('Allophroides boops', '(Gravenhorst, 1829)', 'Tersilochinae', 'Allophroides', undefined, 'Scaramozzino, P.L. (1995) Checklist.'), country: undefined, locality: 'North Italy (sensu Scaramozzino 1995)' }], 'Italy', 'North Italy')
assert.equal(regionText(buildChecklist(gz, 'Italy').subfamilies[0].genera[0].taxa[0].regions[0]), 'North Italy (Scaramozzino, 1995)')
assert.equal(GAZETTEER_PLACES.Italy.length, 2)
assert.ok(areaNote('Italy', 'North Italy').startsWith('North Italy (sensu Scaramozzino, 1995): Friuli-Venezia Giulia, Veneto'))
assert.equal(areaNote('Italy', 'Veneto'), '')
const gzCl = buildChecklist(gz, 'Italy')
assert.equal(areaNotes(gzCl, 'Italy').length, 1)
assert.ok(toText(gzCl, { country: 'Italy', title: 'T', date: 'd' }).includes('Areas:'))
assert.ok(toRTF(gzCl, { country: 'Italy', title: 'T', date: 'd' }).includes('\\i North Italy (sensu'))
// "North Italy" in the filter = the area + its regions
assert.deepEqual(regionsOf('Italy', 'North Italy').slice(0, 3), ['North Italy', 'Friuli-Venezia Giulia', 'Veneto'])
assert.deepEqual(regionsOf('Italy', 'Veneto'), ['Veneto'])
const mixed = buildChecklist([...gz, lit('Ateleute linearis', 'Förster, 1871', 'Ateleutinae', 'Ateleute', 'Veneto', 'Di Giovanni, F. (2015) X.'), lit('Collyria coxator', '(Villers, 1789)', 'Collyriinae', 'Collyria', 'Lazio', 'Izquierdo Moya, M.I. (1985) Y.')], 'Italy')
const north = restrictToRegion(mixed, regionsOf('Italy', 'North Italy'))
assert.deepEqual(north.subfamilies.map((s) => s.name), ['Ateleutinae', 'Tersilochinae'])
assert.equal(rowsInRegion([...gz, lit('A b', 'X', 'S', 'A', 'Lazio', 'R')], regionsOf('Italy', 'North Italy'), 'Italy').length, 1)
assert.deepEqual(insetAreas('Italy').map((a) => a.label), ['North Italy', 'South Italy', 'Sicily', 'Sardinia'])
assert.deepEqual(insetAreas('France'), [])
console.log('checklist: all tests passed')
