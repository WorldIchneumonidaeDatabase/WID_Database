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
      const list = d.filterOtuId
        ? d.rawFeatures.filter((f) => Number(f.properties.target?.id) === Number(d.filterOtuId))
        : d.rawFeatures
      const { features, shapeTypes } = removeDuplicateShapes(
        sortFeaturesByType(list, Object.keys(LEGEND))
      )
      d.currentShapeTypes = shapeTypes
      d.geojson = { features }
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
          makeAPIRequest.get(`/otus/${otuId}/inventory/distribution.geojson`, {
            signal: this.controller.signal
          })
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
            if (e.name !== RESPONSE_ERROR.CanceledError) {
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
