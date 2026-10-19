// node pages/components/Checklist/insights.test.mjs
import assert from 'node:assert/strict'
import { buildChecklist, insetAreas } from './checklist.js'
import { evidence, subfamilyCounts, speciesRegionTable, tableCSV, discoveryCurve, literatureByDecade, topWorks, regionGaps, litVsSpecimens } from './insights.js'

const lit = (name, auth, sf, region, ref) => ({ scientificName: `${name} ${auth}`, scientificNameAuthorship: auth, taxonRank: 'species', subfamily: sf, genus: name.split(' ')[0], stateProvince: region, basisOfRecord: 'MaterialCitation', associatedReferences: ref, dwc_occurrence_object_type: 'AssertedDistribution', country: 'Italy' })
const spec = (name, auth, sf, region, year) => ({ scientificName: `${name} ${auth}`, scientificNameAuthorship: auth, taxonRank: 'species', subfamily: sf, genus: name.split(' ')[0], stateProvince: region, basisOfRecord: 'PreservedSpecimen', dwc_occurrence_object_type: 'CollectionObject', country: 'Italy', year: String(year) })
const rows = [
  lit('A b', 'X, 1900', 'Aaa', 'Veneto', 'Rossi, M. (1950) T.'),
  lit('A b', 'X, 1900', 'Aaa', 'North Italy', 'Scaramozzino, P.L. (1995) C.'),
  spec('A b', 'X, 1900', 'Aaa', 'Veneto', 2010),
  lit('A c', 'Y, 1901', 'Aaa', 'Lazio', 'Scaramozzino, P.L. (1995) C.'),
  spec('B d', 'Z, 1902', 'Bbb', 'Sicily', 1988),
  lit('B e', 'Z, 1903', 'Bbb', undefined, 'Bianchi, A. (2021) N.')
]
const cl = buildChecklist(rows, 'Italy')
const ev = evidence(rows, 'Italy')
assert.equal(ev.length, 6)
assert.deepEqual(subfamilyCounts(cl), [{ name: 'Aaa', n: 2 }, { name: 'Bbb', n: 2 }])

const tb = speciesRegionTable(cl, 'Italy', insetAreas('Italy'))
assert.deepEqual(tb.groups.map((g) => g.label), ['North Italy', 'South Italy', 'Sicily', 'Sardinia', ''])
const ab = tb.rows.find((r) => r.name === 'A b')
const vi = tb.columns.indexOf('Veneto')
const pi = tb.columns.indexOf('Piemonte')
assert.equal(ab.cells[vi].kind, 'both')
assert.equal(ab.cells[pi].kind, '')
assert.ok(ab.cells[pi].band.startsWith('North Italy (Scaramozzino, 1995)'))
assert.equal(tb.rows.find((r) => r.name === 'B d').cells[tb.columns.indexOf('Sicilia')].kind, 'spec')
assert.ok(tableCSV(tb).split('\r\n')[0].startsWith('Subfamily,Taxon,Author,Friuli-Venezia Giulia'))

const dc = discoveryCurve(ev, cl)
assert.deepEqual(dc.points, [{ year: 1950, n: 1 }, { year: 1988, n: 2 }, { year: 1995, n: 3 }, { year: 2021, n: 4 }])
assert.equal(dc.undated, 0)

assert.deepEqual(literatureByDecade(ev).map((d) => d.decade), [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020])
assert.deepEqual(topWorks(ev)[0], { work: 'Scaramozzino, 1995', records: 2, taxa: 2 })

const gaps = regionGaps(ev, 'Italy')
assert.deepEqual(gaps.get('Veneto'), { works: 1, latest: 2010 })
assert.equal(gaps.has('Italy'), false)

assert.deepEqual(litVsSpecimens(cl, 'Italy')[0], { region: 'Lazio', lit: 1, both: 0, spec: 0, total: 1 })
assert.deepEqual(litVsSpecimens(cl, 'Italy').find((x) => x.region === 'Veneto'), { region: 'Veneto', lit: 0, both: 1, spec: 0, total: 1 })
console.log('insights: all tests passed')
