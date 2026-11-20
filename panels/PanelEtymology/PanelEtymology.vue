<template>
  <VCard v-if="taxon.etymology || adjective || tags.length">
    <VCardHeader>
      <h2 class="text-md">Name: gender, form and etymology</h2>
    </VCardHeader>
    <VCardContent class="text-sm">
      <!-- the name itself, then what kind of word it is -->
      <p class="ety-word">
        <i>{{ word }}</i>
        <span
          v-for="tag in tags"
          :key="tag.key"
          :class="['ety-pill', tag.tone]"
          >{{ LABEL[tag.key] }}</span
        >
      </p>
      <p
        v-if="grammarNote"
        class="ety-note"
      >
        {{ grammarNote }}
      </p>

      <!-- adjectives agree with the genus: the three forms -->
      <dl
        v-if="inSpeciesGroup && adjectiveOrParticiple && forms.length"
        class="ety-forms"
      >
        <template
          v-for="f in forms"
          :key="f.key"
        >
          <dt>{{ LABEL[f.key] }}</dt>
          <dd><i>{{ f.value }}</i></dd>
        </template>
      </dl>

      <div
        v-if="taxon.etymology"
        class="ety-text"
      >
        <span class="ety-label">Etymology</span>
        <div v-html="md.render(taxon.etymology)" />
      </div>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { makeAPIRequest } from '@/utils'
import MarkdownIt from 'markdown-it'
import { computed, ref, watch } from 'vue'

const SPECIES_GROUP = 'SpeciesGroup'
const SPECIES_AND_INFRASPECIES = 'SpeciesAndInfraspecies'
const NAMES_PROP = { masculine_name: 'masculine', feminine_name: 'feminine', neuter_name: 'neuter' }

// TaxonWorks classification → dictionary key + pill colour
const TYPE_LIST = {
  'TaxonNameClassification::Latinized::Gender::Masculine': { key: 'masculine', tone: 'sea' },
  'TaxonNameClassification::Latinized::Gender::Feminine': { key: 'feminine', tone: 'sea' },
  'TaxonNameClassification::Latinized::Gender::Neuter': { key: 'neuter', tone: 'sea' },
  'TaxonNameClassification::Latinized::PartOfSpeech::Adjective': { key: 'adjective', tone: 'olive' },
  'TaxonNameClassification::Latinized::PartOfSpeech::Participle': { key: 'participle', tone: 'olive' },
  'TaxonNameClassification::Latinized::PartOfSpeech::NounInApposition': { key: 'apposition', tone: 'olive' },
  'TaxonNameClassification::Latinized::PartOfSpeech::NounInGenitiveCase': { key: 'genitive', tone: 'olive' }
}

const props = defineProps({
  taxon: { type: Object, required: true }
})

const LABEL = {'masculine': 'masculine', 'feminine': 'feminine', 'neuter': 'neuter', 'adjective': 'adjective', 'participle': 'participle', 'apposition': 'noun in apposition', 'genitive': 'noun in genitive case'}
const NOTE = { noun: 'A noun: its ending stays the same whatever genus the species is placed in.', adj: 'Agrees in gender with the genus name, so its ending can change when the species moves to another genus.', genus: 'The gender of a genus name sets the endings of the adjectival species names placed in it.' }

const md = new MarkdownIt({ html: true })
const classifications = ref([])

const inSpeciesGroup = computed(() => {
  const rank = props.taxon.rank_string || ''
  return rank.includes(SPECIES_GROUP) || rank.includes(SPECIES_AND_INFRASPECIES)
})

// the epithet for species-group names, the whole name otherwise
const word = computed(() => {
  const n = String(props.taxon.name || '').trim()
  return inSpeciesGroup.value ? n.split(/\s+/).pop() : n
})

const tags = computed(() =>
  classifications.value
    .map((c) => TYPE_LIST[c.type])
    .filter(Boolean)
    .filter((x, i, a) => a.findIndex((y) => y.key === x.key) === i)
)

const adjectiveOrParticiple = computed(() => tags.value.some((x) => x.key === 'adjective' || x.key === 'participle'))

const grammarNote = computed(() => {
  const keys = tags.value.map((x) => x.key)
  if (inSpeciesGroup.value) {
    if (keys.includes('genitive') || keys.includes('apposition')) return NOTE.noun
    if (adjectiveOrParticiple.value) return NOTE.adj
    return ''
  }
  return keys.some((k) => ['masculine', 'feminine', 'neuter'].includes(k)) ? NOTE.genus : ''
})

const forms = computed(() =>
  Object.entries(NAMES_PROP)
    .filter(([prop]) => props.taxon[prop])
    .map(([prop, key]) => ({ key, value: props.taxon[prop] }))
)
const adjective = computed(() => forms.value.length > 0)

function loadClassifications() {
  if (!props.taxon?.id) return
  makeAPIRequest
    .get('/taxon_name_classifications', { params: { taxon_name_id: [props.taxon.id] } })
    .then(({ data }) => {
      classifications.value = data.filter((item) => item.type.includes('::Latinized::'))
    })
    .catch(() => {})
}

watch(() => props.taxon.id, loadClassifications, { immediate: true })
</script>

<style scoped>
.ety-word {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
}
.ety-word i {
  margin-right: 0.3rem;
  font-size: 1.45rem;
  font-weight: 600;
  color: rgb(var(--color-base-content));
}
.ety-pill {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  border: 1px solid #b9dcc4;
  background: #e6f3ea;
  color: #1f6a3a;
}
.ety-pill.sea {
  background: rgba(var(--color-primary), 0.12);
  color: rgb(var(--color-primary));
  border-color: rgba(var(--color-primary), 0.3);
}
.ety-note {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  opacity: 0.75;
}
.ety-forms {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.1rem 0.8rem;
  margin: 0.6rem 0 0;
}
.ety-forms dt {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.75;
}
.ety-forms dd {
  margin: 0;
}
.ety-text {
  margin-top: 0.8rem;
  padding: 0.55rem 0.8rem;
  border-left: 3px solid rgb(var(--color-secondary));
  background: rgba(var(--color-secondary), 0.1);
  border-radius: 0 0.35rem 0.35rem 0;
}
.ety-label {
  display: block;
  margin-bottom: 0.1rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.ety-text :deep(p) {
  margin: 0;
}
</style>
