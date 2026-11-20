<template>
  <VCard>
    <ClientOnly>
      <VSpinner
        v-if="isLoading"
        logo-class="w-8 h-8"
        legend=""
      />
    </ClientOnly>
    <VCardHeader class="flex justify-between">
      <h2 class="text-md flex items-baseline gap-2">
        <span>Descendants and synonyms</span>
        <span
          v-if="counts.desc"
          class="ds-count"
          
          ><b class="mr-1">{{ counts.desc }}</b><span>{{ counts.desc === 1 ? 'taxon' : 'taxa' }}</span></span
        >
        <span
          v-if="counts.syn"
          class="ds-count ds-count--syn"
          ><b class="mr-1">{{ counts.syn }}</b><span>{{ counts.syn === 1 ? 'synonym' : 'synonyms' }}</span></span
        >
      </h2>
      <PanelDropdown panel-key="panel:descendants" />
    </VCardHeader>
    <VCardContent class="text-sm">
      <ul class="tree ml-2">
        <AnimationOpacity>
          <DescendantsTree
            v-if="hasRecords"
            :taxonomy="taxonomy"
          />
        </AnimationOpacity>
      </ul>
      <span v-if="!hasRecords && !isLoading">No records found.</span>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useOtuPageRequest } from '@/modules/otus/helpers/useOtuPageRequest'
import DescendantsTree from './DescendantsTree.vue'
import TaxonWorks from '../../../services/TaxonWorks'
import PanelDropdown from '../PanelDropdown.vue'

const props = defineProps({
  otuId: {
    type: [String, Number],
    required: true
  }
})

const taxonomy = ref(null)
const isLoading = ref(false)

const counts = computed(() => ({
  desc: taxonomy.value?.descendants?.length || 0,
  syn: taxonomy.value?.nomenclatural_synonyms?.length || 0
}))

const hasRecords = computed(
  () =>
    taxonomy.value &&
    (taxonomy.value.nomenclatural_synonyms.length ||
      taxonomy.value.descendants.length)
)

watch(
  () => props.otuId,
  async () => {
    if (!props.otuId) {
      return
    }

    isLoading.value = true
    useOtuPageRequest('panel:descendants', () =>
      TaxonWorks.getTaxonomy(props.otuId, {
        params: { max_descendants_depth: 1 }
      })
    )
      .then(({ data }) => {
        taxonomy.value = data
      })
      .catch(() => {})
      .finally(() => (isLoading.value = false))
  },
  { immediate: true }
)
</script>

<style scoped>
.ds-count {
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(var(--color-base-muted), 0.8);
}
.ds-count--syn {
  background: rgba(var(--color-secondary), 0.2);
}
.otu-synonyms {
  list-style: none;
  border-left: 1px solid rgb(100, 100, 100);
  padding-left: 8px;
  padding-bottom: 8px;
}
</style>
