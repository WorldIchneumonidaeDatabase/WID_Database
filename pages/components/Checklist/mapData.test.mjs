// node pages/components/Checklist/mapData.test.mjs
import assert from 'node:assert/strict'
import { rampFromColor, rampFor, PALETTES, norm, matchPlaces, chooseLevel, placeCounts, breaks, classOf, specimenPoints, toKML, toGeoJSON } from './mapData.js'

assert.equal(norm('Trentino-Alto Adige'), 'trentinoaltoadige')
assert.equal(norm('Québec'), 'quebec')
const f = (name, keys) => ({ properties: { name, keys } })
const file = {
  admin1: [f('Torino', ['torino']), f('Palermo', ['palermo'])],
  regions: [f('Piemonte', ['piemonte']), f('Sicily', ['sicily'])]
}
const lvl = chooseLevel(file, ['Piemonte', 'Sicilia'])
assert.equal(lvl.level, 'regions')
assert.equal(lvl.match.get('Sicilia'), 1, 'Sicilia matches Sicily')
assert.equal(matchPlaces(file.admin1, ['Torino']).get('Torino'), 0)

const g = (refs, specimens, counties = []) => ({ refs, fullRefs: refs, specimens, institutions: [], counties })
const cl = { subfamilies: [{ genera: [{ taxa: [
  { name: 'A b', regions: [{ region: 'Ohio', ...g(['X, 1900'], 0, [{ name: 'Lucas', ...g([], 2) }]) }, { region: 'United States', ...g(['Y, 1901'], 0) }] },
  { name: 'A c', regions: [{ region: 'Ohio', ...g([], 1) }] }
] }] }] }
const pc = placeCounts(cl, 'United States')
assert.deepEqual(pc.regions.get('Ohio'), { taxa: 2, specimens: 1, literature: 1 })
assert.equal(pc.regions.has('United States'), false)
assert.deepEqual(pc.counties.get('Ohio|Lucas'), { taxa: 1, specimens: 2, literature: 0 })
assert.equal(placeCounts(cl, 'United States', 'A c').regions.get('Ohio').taxa, 1)

assert.deepEqual(breaks([1, 2, 3]), [1, 2, 3])
const br = breaks([1, 10, 40, 100])
assert.equal(br[0], 1)
assert.equal(classOf(1, br), 0)
assert.equal(classOf(100, br), br.length - 1)

const rows = [{ scientificName: 'A b X, 1900', decimalLatitude: '41.5', decimalLongitude: '-83.6', stateProvince: 'Ohio' }, { scientificName: 'A b X, 1900' }, { scientificName: 'A c', decimalLatitude: '0', decimalLongitude: '0' }]
assert.equal(specimenPoints(rows).length, 1)
assert.equal(specimenPoints(rows, { focus: 'A c' }).length, 0)
assert.ok(toKML({ points: specimenPoints(rows), title: 'T & U' }).includes('<coordinates>-83.6,41.5</coordinates>'))
assert.equal(JSON.parse(toGeoJSON({ points: specimenPoints(rows), places: [] })).features[0].geometry.coordinates[1], 41.5)
assert.deepEqual(rampFromColor('#ff0000'), ['#ffcccc', '#ff8c8c', '#ff4040', '#ff0000', '#b30000'])
assert.equal(rampFor(3, PALETTES.green.ramp)[2], PALETTES.green.ramp[4])
console.log('mapData: all tests passed')
