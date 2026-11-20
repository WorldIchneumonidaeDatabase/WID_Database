import TaxonWorks from '@/modules/otus/services/TaxonWorks'
import { makeAPIRequest } from '@/utils'
import { defineStore } from 'pinia'
import { useOtuPageRequest } from '@/modules/otus/helpers/useOtuPageRequest'
import { RESPONSE_ERROR } from '@/modules/otus/constants'
import {
  isRankGroup,
  removeDuplicateShapes,
  makeGeoJSONFeature
} from '../utils'
import { ASSERTED_ABSENT } from '@/constants/objectTypes'
import { LEGEND } from '../constants'
import { readMap, saveMap, thinFeatures } from '../utils/mapCache'

// Ready-made maps from the WID maps Worker (config/maps.yml); empty = ask TaxonWorks
const MAP_ENDPOINT = String(__APP_ENV__.maps?.endpoint || '').replace(/\/$/, '')

// The map from the Worker if there is one (fast), otherwise from TaxonWorks (~10 s)
async function fetchDetailedMap(otuId, signal) {
  if (MAP_ENDPOINT) {
    try {
      const res = await fetch(`${MAP_ENDPOINT}/map/${otuId}`, { signal })
      if (res.ok) return await res.json()
    } catch (e) {
      if (e.name === 'AbortError') throw e
    }
  }
  const { data } = await makeAPIRequest.get(`/otus/${otuId}/inventory/distribution.geojson`, { signal })
  return data
}

function normalizeAbsentFeatures(arr) {
  arr.forEach((feature) => {
    if (feature.properties.is_absent) {
      feature.properties.base.type = ASSERTED_ABSENT
    }
  })
}

function sortFeaturesByType(arr, reference) {
  const referenceMap = new Map()

  reference.forEach((item, index) => {
    referenceMap.set(item, index)
  })

  return arr.toSorted((a, b) => {
    const indexA = referenceMap.has(a.properties.base.type)
      ? referenceMap.get(a.properties.base.type)
      : Infinity
    const indexB = referenceMap.has(b.properties.base.type)
      ? referenceMap.get(b.properties.base.type)
      : Infinity
    return indexA - indexB
  })
}

export const useDistributionStore = defineStore('distributionStoreMapV2', {
  state: () => {
    return {
      distribution: {
        geojson: null,
        errorMessage: null,
        currentShapeTypes: [],
        cachedMap: null,
        // every record, before merging shared shapes (for the name filter)
        rawFeatures: [],
        // OTU ids the records are filed under (valid name + synonyms)
        otuIds: [],
        filterOtuId: null,
        // kinds of record switched off in the legend (e.g. 'AssertedDistribution')
        hiddenTypes: [],
        // asserted distribution id -> source ids that record it (for the source picker)
        adSources: {},
        sources: [], // [{ id, short, full, year, count }]
        filterSourceId: null,
        // the quick summary map is showing while the detailed one loads
        loadingDetail: false
      },
      controller: null
    }
  },
  actions: {
    resetRequest() {
      this.controller?.abort()
    },

    loadCachedMap(mapId) {
      TaxonWorks.getCachedMap(mapId, { signal: this.controller.signal })
        .then((response) => {
          this.distribution.cachedMap = response.data
        })
        .catch(() => {})
    },

    async getAggregateShape(otuId) {
      useOtuPageRequest('panel:map-v2', () =>
        TaxonWorks.getOtuDistribution(otuId, {
          signal: this.controller.signal
        })
      )
        .then(({ data }) => {
          const geojson = JSON.parse(data.cached_map.geo_json)

          this.distribution.currentShapeTypes = ['Aggregate']
          this.distribution.geojson = {
            features: [makeGeoJSONFeature(geojson, 'Aggregate')]
          }

          this.loadCachedMap(data.cached_map.id)
        })
        .catch((e) => {
          if (e.name != RESPONSE_ERROR.CanceledError) {
            this.distribution.errorMessage = e.response.data.error
            this.distribution.currentShapeTypes = []
            this.distribution.geojson = []
          }
        })
    },

    // Show the records (all, or only those filed under one name)
    applyFeatures() {
      const d = this.distribution
      const byName = d.filterOtuId
        ? d.rawFeatures.filter((f) => Number(f.properties.target?.id) === Number(d.filterOtuId))
        : d.rawFeatures
      // the legend always lists every kind present, even the hidden ones
      d.currentShapeTypes = removeDuplicateShapes(sortFeaturesByType(byName, Object.keys(LEGEND))).shapeTypes
      const bySource = d.filterSourceId
        ? byName.filter((f) => {
            const b = f.properties.base
            return b?.type !== 'AssertedDistribution' || (d.adSources[b.id] || []).includes(d.filterSourceId)
          })
        : byName
      const shown = bySource.filter((f) => !d.hiddenTypes.includes(f.properties.base?.type))
      const { features } = removeDuplicateShapes(sortFeaturesByType(shown, Object.keys(LEGEND)))
      d.geojson = { features }
    },

    setFilterSource(sourceId) {
      this.distribution.filterSourceId = sourceId || null
      this.applyFeatures()
    },

    // Which references record each asserted distribution (one quick request per name)
    async loadSources() {
      const d = this.distribution
      const ids = d.otuIds
      if (!ids.length) return
      try {
        const params = new URLSearchParams()
        ids.forEach((id) => params.append('otu_id[]', id))
        params.set('per', '1000')
        const { data } = await makeAPIRequest.get(`/asserted_distributions?${params.toString()}`)
        const adSources = {}
        const sources = new Map()
        for (const ad of data || []) {
          for (const c of ad.citations || []) {
            const sid = Number(String(c.source?.global_id || '').split('/').pop())
            if (!sid) continue
            ;(adSources[ad.id] ||= []).push(sid)
            if (!sources.has(sid)) {
              const full = String(c.source?.name || '')
              const m = full.replace(/<[^>]+>/g, '').match(/^(.*?)\s*\((\d{4})[a-z]?\)/)
              const authors = (m?.[1] || full).split(/,\s*[A-Z][.\-A-Z]*\.?(?:\s|,|$)|\s&\s/)[0].trim()
              const many = m && /&|,.*,/.test(m[1])
              sources.set(sid, {
                id: sid,
                year: m ? Number(m[2]) : 0,
                short: m ? `${authors}${many ? ' et al.' : ''} ${m[2]}` : full.slice(0, 40),
                full: full.replace(/<[^>]+>/g, ''),
                count: 0
              })
            }
            sources.get(sid).count++
          }
        }
        d.adSources = adSources
        d.sources = [...sources.values()].sort((a, b) => a.year - b.year || a.short.localeCompare(b.short))
      } catch {
        d.sources = []
      }
    },

    toggleType(type) {
      const h = this.distribution.hiddenTypes
      this.distribution.hiddenTypes = h.includes(type) ? h.filter((t) => t !== type) : [...h, type]
      this.applyFeatures()
    },

    setFilterOtu(otuId) {
      this.distribution.filterOtuId = otuId || null
      this.applyFeatures()
    },

    useDetailed(features) {
      normalizeAbsentFeatures(features)
      const d = this.distribution
      d.rawFeatures = features
      d.otuIds = [...new Set(features.map((f) => Number(f.properties.target?.id)).filter(Boolean))]
      d.loadingDetail = false
      this.applyFeatures()
      this.loadSources()
    },

    // The 1-second summary shape, shown while the detailed map is being built
    loadPreview(otuId) {
      TaxonWorks.getOtuDistribution(otuId, { signal: this.controller.signal })
        .then(({ data }) => {
          if (!this.distribution.loadingDetail) return // detail already here
          const geojson = JSON.parse(data.cached_map.geo_json)
          this.distribution.currentShapeTypes = ['Aggregate']
          this.distribution.geojson = { features: [makeGeoJSONFeature(geojson, 'Aggregate')] }
        })
        .catch(() => {})
    },

    async loadDistribution({ otuId, rankString }) {
      const isSpeciesGroup =
        rankString &&
        (isRankGroup('SpeciesGroup', rankString) ||
          isRankGroup('SpeciesAndInfraspeciesGroup', rankString))

      this.controller = new AbortController()

      if (isSpeciesGroup) {
        const key = `otu:${otuId}`
        const saved = await readMap(key)
        if (saved) {
          this.useDetailed(saved)
          return
        }

        this.distribution.loadingDetail = true
        this.loadPreview(otuId)

        useOtuPageRequest('panel:map-v2', () =>
          fetchDetailedMap(otuId, this.controller.signal).then((data) => ({
            data,
            url: MAP_ENDPOINT ? `${MAP_ENDPOINT}/map/${otuId}` : ''
          }))
        )
          .then(({ data }) => {
            if (data.request_too_large) {
              this.distribution.loadingDetail = false
              this.distribution.geojson = null
              this.distribution.errorMessage = data.message
            } else {
              const features = thinFeatures(data.features)
              saveMap(key, JSON.parse(JSON.stringify(features)))
              this.useDetailed(features)
            }
          })
          .catch((e) => {
            if (e.name !== RESPONSE_ERROR.CanceledError && e.name !== 'AbortError') {
              this.distribution.loadingDetail = false
              this.getAggregateShape(otuId)
            }
          })
      } else {
        this.getAggregateShape(otuId)
      }
    }
  }
})
