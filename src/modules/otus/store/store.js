import { defineStore } from 'pinia'
import { useOtuPageRequest } from '../helpers/useOtuPageRequest'
import { useOtuPageRequestStore } from './request'
import { useFooterStore } from '@/store'
import TaxonWorks from '../services/TaxonWorks'

export const useOtuStore = defineStore('otuStore', {
  state: () => {
    return {
      otu: null,
      taxon: null,
      images: null,
      catalog: {
        sources: [],
        sourceById: {},
        stats: {},
        timeline: [],
        isLoading: false
      },
      taxonomy: {
        commonNames: [],
        synonyms: []
      }
    }
  },
  actions: {
    async loadTaxon(id, { signal }) {
      const footerStore = useFooterStore()
      const responses = await Promise.all([
        TaxonWorks.getTaxon(id, {
          params: { extend: ['type_taxon_name_relationship'] }
        }),
        useOtuPageRequest('summary', () => TaxonWorks.summary(id, { signal }))
      ])

      this.taxon = Object.assign({}, ...responses.map((r) => r.data))
      footerStore.setNextAuthorText(this.taxon.full_name_tag + '.')
    },
    async loadOtu(id, { signal }) {
      const otu = await TaxonWorks.getOtu(id, { signal })

      this.otu = otu.data
    },

    async loadTaxonomy(otuId, { signal }) {
      const { data } = await TaxonWorks.getTaxonomy(otuId, {
        params: {
          max_descendants_depth: 0,
          extend: ['common_names']
        },
        signal
      })

      this.taxonomy = {
        commonNames: data.common_names,
        synonyms: data.nomenclatural_synonyms
      }
    },

    async loadCatalog(taxonId, { signal }) {
      this.catalog.isLoading = true

      const response = await useOtuPageRequest('taxonomy', () =>
        TaxonWorks.getTaxonNameCitations(taxonId, { signal })
      )

      // Every web address in a reference becomes a link (DOI, BHL, JSTOR…),
      // not only the one TaxonWorks stores as the source's url
      const linked = ({ cached }) =>
        String(cached || '').replace(
          /(^|[\s(>])(https?:\/\/[^\s<>"]+?)([.,;)]?)(?=\s|$|<)/g,
          (m, before, href, after) =>
            `${before}<a href="${href}" target="_blank" rel="noopener">${href}</a>${after}`
        )

      const all = response.data.timeline || []
      const allSources = response.data.sources || []

      // An invalid name's page shows only that name's own history
      // (the catalogue TaxonWorks sends is the valid name's, with every synonym)
      const t = this.taxon || {}
      const isInvalidPage = t.cached_valid_taxon_name_id && t.cached_valid_taxon_name_id !== t.id
      const own = isInvalidPage
        ? all.filter((c) => (c.protonym_ids || []).includes(t.id) || c.taxon_name_id === t.id)
        : all
      const scoped = isInvalidPage && own.length > 0 && own.length < all.length

      this.catalog = {
        ...response.data,
        timelineAll: all,
        sourcesAll: allSources.map(linked),
        ownTimeline: own,
        ownSources: allSources.filter((s) => own.some((c) => c.source_id === s.id)).map(linked),
        scoped, // this page could show only its own history
        showingOwn: scoped,
        timeline: scoped ? own : all,
        sources: (scoped ? allSources.filter((s) => own.some((c) => c.source_id === s.id)) : allSources).map(linked),
        // Full reference for each source id, so a citation in the timeline
        // ("Cameron, 1905: 155") can show which paper it is
        sourceById: Object.fromEntries(
          allSources.map((s) => [s.id, { html: linked(s), cached: s.cached }])
        ),
        isLoading: false
      }
    },

    // On an invalid name's page: switch between its own history and the full one
    setOwnHistory(own) {
      const c = this.catalog
      if (!c.scoped) return
      c.showingOwn = own
      c.timeline = own ? c.ownTimeline : c.timelineAll
      c.sources = own ? c.ownSources : c.sourcesAll
    },

    async loadInit({ otuId, controller }) {
      const requestStore = useOtuPageRequestStore()

      requestStore.$reset()

      try {
        await this.loadOtu(otuId, controller)
        await this.loadTaxon(this.otu.taxon_name_id, controller)
        // these two don't depend on each other: ask TaxonWorks for both at once
        await Promise.all([
          this.loadCatalog(this.otu.taxon_name_id, controller),
          this.loadTaxonomy(otuId, controller)
        ])
      } catch (error) {
        return Promise.reject(error)
      }
    }
  }
})
