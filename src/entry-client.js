import { createApp } from './main'
import { registerOnlyClientComponents } from '@/components/clientComponents'
import { registerGlobalComponents } from './components/globalComponents'
import { createHead } from '@unhead/vue/client'
import { schemaOrgPlugin } from '@/plugins/schemaOrg'
import { initI18n } from '@/i18n'

const originUrl = window.location.origin
const storeInitialState = window.initialState
const { app, router, store } = createApp({ originUrl })

const head = createHead({
  plugins: [
    schemaOrgPlugin(
      {
        host: originUrl
      },
      () => {
        const route = router.currentRoute.value
        return {
          path: route.path,
          ...route.meta
        }
      }
    )
  ]
})

app.use(head)

if (storeInitialState) {
  store.state.value = storeInitialState
}

registerOnlyClientComponents(app)
registerGlobalComponents(app)

router.isReady().then(() => {
  app.mount('#app')
  initI18n()
})
