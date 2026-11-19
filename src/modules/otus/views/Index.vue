<template>
  <div class="wid-home bg-base-background min-h-full">
    <div class="wid-otu-header relative z-[1200] text-white print:text-black print:bg-none">
      <div class="container mx-auto px-4">
        <div class="pt-6 pb-6 sm:pt-8">
          <div
            class="flex flex-col-reverse md:flex-row justify-between items-start gap-4"
          >
            <VSkeleton class="w-full md:w-3/4">
              <Breadcrumb
                v-if="isReady"
                class="w-full"
                :list="otu?.parents || {}"
                :current="taxon"
              />
            </VSkeleton>
            <GlobalSearch
              class="print:hidden md:!w-80 flex-shrink-0"
              variant="dark"
              placeholder="Search taxa, references, authors…"
            />
          </div>

          <div
            class="mt-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4"
          >
            <VSkeleton
              :lines="2"
              class="w-full md:w-2/3"
            >
              <TaxaInfo v-if="isReady" />
            </VSkeleton>
            <div class="wid-otu-actions flex flex-row gap-2 print:hidden">
              <ClientOnly>
                <DataMap />
              </ClientOnly>
              <CiteButton v-if="isReady" />
              <ShareButton
                v-if="isReady"
                :otu-id="otu.id"
                :title="taxon.full_name"
              />
              <ReportErrorButton
                v-if="isReady"
                :subject="taxon.full_name"
              />
              <DWCDownload
                v-if="isReady"
                :otu="otu"
              />
            </div>
          </div>
        </div>

        <TabMenu
          v-if="isReady && childrenRoutes.length > 1"
          class="wid-otu-tabs print:hidden -mb-px"
        >
          <TabItem
            v-for="{ name, label } in tabs"
            :key="name"
            :to="{ name }"
          >
            {{ label }}
          </TabItem>
        </TabMenu>
      </div>
    </div>
    <div class="pt-6 pb-10">
      <div class="container mx-auto box-border px-4">
        <!-- TaxonWorks did not answer: say so, and offer to try again -->
        <div
          v-if="loadError"
          class="wid-load-error"
          role="alert"
        >
          <p class="font-semibold">TaxonWorks is not responding right now.</p>
          <p class="text-sm opacity-80">
            The data behind this page comes from TaxonWorks, which is slow or unavailable at the moment. Please try again in a minute.
          </p>
          <button
            type="button"
            class="wid-load-retry"
            :disabled="retrying"
            @click="retry"
          >
            {{ retrying ? 'Trying…' : 'Try again' }}
          </button>
        </div>
        <RouterView
          v-if="isReady"
          :key="route.fullPath"
          :taxon-id="taxon.id"
          :taxon="taxon"
          :taxon-rank="taxon.rank_string"
          :otu-id="otu.id"
          :otu="otu"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  watch,
  onServerPrefetch,
  computed,
  onMounted,
  onBeforeUnmount
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOtuStore } from '../store/store'
import { useFooterStore } from '@/store'
import { useHead, injectHead } from '@unhead/vue'
import { useSchemaOrg, defineTaxon } from '@/plugins/schemaOrg/composables'
import { RESPONSE_ERROR } from '../constants'
import { isAvailableForRank } from '../utils'
import { useChildrenRoutes, useUserLifeCycles } from '../composables'
import DataMap from '../components/DataMap.vue'
import Breadcrumb from '../components/Breadcrumb/Breadcrumb.vue'
import TaxaInfo from '../components/TaxaInfo.vue'
import DWCDownload from '../components/DWCDownload.vue'
import CiteButton from '../components/CiteButton.vue'
import ShareButton from '../components/ShareButton.vue'
import GlobalSearch from '~/pages/components/Search/GlobalSearch.vue'

const head = injectHead()
const route = useRoute()
const router = useRouter()
const routeParams = ref(route.params)
const childrenRoutes = useChildrenRoutes()
const store = useOtuStore()
const footerStore = useFooterStore()
let controller = new AbortController()
const loadError = ref(false)
const retrying = ref(false)

async function retry() {
  retrying.value = true
  controller.abort()
  controller = new AbortController()
  await loadInitialData()
  retrying.value = false
}

router.afterEach((route) => {
  routeParams.value = route.params
})

const otu = computed(() => store.otu)
const taxon = computed(() => store.taxon)
const isReady = computed(() => otu.value?.id && taxon.value?.id)
const tabs = computed(() =>
  childrenRoutes.value.filter((item) =>
    isAvailableForRank(item.meta.rankGroup, taxon.value.rank_string)
  )
)

const { onCreatePage, onSSRCreatePage } = useUserLifeCycles({ taxon, otu })

onServerPrefetch(async () => {
  await loadInitialData()
  await onSSRCreatePage()
})

onCreatePage()

watch(
  () => route.params.id,
  async () => {
    controller.abort()
    controller = new AbortController()
    loadInitialData()
  }
)

onMounted(async () => {
  if (otu.value?.id !== Number(route.params.id) || !taxon.value?.id) {
    await loadInitialData()
  } else {
    updateMetadata()
  }
})

onBeforeUnmount(() => {
  store.$reset()
  footerStore.$reset()
})

async function loadInitialData() {
  store.$reset()
  footerStore.$reset()
  loadError.value = false

  try {
    await store.loadInit({
      otuId: route.params.id,
      controller
    })
    updateMetadata()
  } catch (e) {
    if (e.name !== RESPONSE_ERROR.CanceledError) {
      const status = e?.response?.status
      if (status === 404 || status === 500) redirectOnError(e)
      else loadError.value = true // no answer, a time-out or another server error
    }
  }
}

function redirectOnError(error) {
  switch (error?.response?.status) {
    case 404:
      router.replace({ name: 'httpError404' })
      break
    case 500:
      router.replace({ name: 'httpError500' })
      break
  }
}

function updateMetadata() {
  const plainName = taxon.value.full_name
  const parentName = taxon.value.parent?.full_name
  const description = [
    `${plainName}${taxon.value.rank ? ` (${taxon.value.rank})` : ''}`,
    parentName ? `in ${parentName}` : '',
    '— nomenclature, references, distribution, specimens and images in the World Ichneumonidae Database.'
  ]
    .filter(Boolean)
    .join(' ')

  useHead(
    {
      title: `${plainName} - ${__APP_ENV__.project_name}`,
      meta: [
        { name: 'description', content: description },
        { property: 'og:title', content: `${plainName} - ${__APP_ENV__.project_name}` },
        { property: 'og:description', content: description }
      ]
    },
    { head }
  )

  useSchemaOrg(
    [
      defineTaxon({
        id: route.fullPath,
        name: taxon.value.full_name,
        scientificName: {
          name: taxon.value.full_name,
          author: taxon.value.author,
          taxonRank: taxon.value.rank
        },
        parentTaxon: {
          name: taxon.value.parent.full_name,
          taxonRank: taxon.value.parent.rank
        },
        commonNames: store.taxonomy.commonNames,
        alternateName: store.taxonomy.synonyms
      })
    ],
    head
  )
}

function loadOtu({ id, otu_valid_id }) {
  router.push({
    name: 'otus-id-overview',
    params: {
      id: otu_valid_id || id
    }
  })
}
</script>

<style scoped>
.wid-load-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: #fdf0e1;
  color: #5c3208;
  border: 1px solid #f0d2ad;
}
.wid-load-retry {
  margin-top: 0.3rem;
  padding: 0.35rem 0.9rem;
  border-radius: 8px;
  background: #8a4b0f;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.wid-load-retry:disabled {
  opacity: 0.6;
  cursor: default;
}
.wid-otu-header {
  background:
    radial-gradient(50rem 20rem at 90% 0%, rgba(42, 98, 183, 0.45), transparent 60%),
    linear-gradient(180deg, #0f1b33 0%, #13223f 100%);
}

/* Datamap / DwC buttons as ghost buttons on the dark band */
.wid-otu-actions :deep(.tp-button) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem 0.875rem;
  font-weight: 600;
}

.wid-otu-actions :deep(.tp-button:hover) {
  background: rgba(255, 255, 255, 0.18);
}

/* Tabs sit on the bottom edge of the band */
.wid-otu-tabs :deep(.tp-tab-list) {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 0.25rem;
  scrollbar-width: none;
}

.wid-otu-tabs :deep(.tp-tab-item a) {
  white-space: nowrap;
  padding: 0.75rem 1rem;
  border-radius: 0.625rem 0.625rem 0 0;
  border-bottom: 0;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.wid-otu-tabs :deep(.tp-tab-item a:hover) {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.wid-otu-tabs :deep(.tp-tab-item a.router-link-active),
.wid-otu-tabs :deep(.tp-tab-item a.router-link-exact-active) {
  background: rgb(var(--color-base-background));
  color: rgb(var(--color-base-content));
  font-weight: 600;
}
</style>
