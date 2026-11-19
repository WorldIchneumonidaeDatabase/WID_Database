import { defineStore } from 'pinia'

export const useOtuPageRequestStore = defineStore('otuPageRequest', {
  state: () => {
    return {
      requests: {}
    }
  },

  getters: {
    getRequest: (state) => {
      return (key) => state.requests[key]
    },

    datamap: (state) => {
      const keys = Object.keys(state.requests).sort()

      return Object.fromEntries(
        keys.map((key) => [key, state.requests[key].url])
      )
    }
  },

  actions: {
    // Tolerates failed requests (no response) and responses that did not come
    // through axios (e.g. the maps Worker), instead of breaking the page
    setRequest(key, response) {
      if (!response) return
      const { data, request } = response
      const url = request?.res?.responseUrl || request?.responseURL || response.url || ''

      this.requests[key] = {
        url,
        data
      }
    }
  }
})
