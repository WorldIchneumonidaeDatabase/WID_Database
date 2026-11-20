<template>
  <ul class="syn-list">
    <li
      v-for="s in sorted"
      :key="s.html"
    >
      <span
        class="syn-eq"
        aria-hidden="true"
        >=</span
      >
      <!-- invalid names have their own page: open it -->
      <a
        href="#"
        class="syn-name"
        :title="'Open the page of this name'"
        @click.prevent="openName(s)"
        v-html="s.html"
      />
      <span
        v-if="s.missing"
        class="syn-miss"
        >no page</span
      >
    </li>
  </ul>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'

const props = defineProps({
  list: { type: Array, required: true }
})

const router = useRouter()
const missing = reactive({})
const plain = (html = '') => String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
const yearOf = (html) => Number((plain(html).match(/(\d{4})\)?\s*$/) || [])[1]) || 9999

// oldest first, as in a synonymy
const sorted = computed(() =>
  props.list
    .map((html) => ({ html, year: yearOf(html), missing: missing[html] }))
    .sort((a, b) => a.year - b.year || plain(a.html).localeCompare(plain(b.html)))
)

async function openName(s) {
  const name = plain(s.html)
  try {
    const { data } = await makeAPIRequest.get('/otus/autocomplete', { params: { term: name } })
    const hit =
      (data || []).find((o) => plain(o.label_html || o.label).startsWith(name)) ||
      (data || []).find((o) => plain(o.label_html || o.label).startsWith(name.split(/\s(?=[A-Z(])/)[0]))
    const id = hit && (hit.id || hit.otu_valid_id)
    if (id) router.push({ name: 'otus-id', params: { id } })
    else missing[s.html] = true
  } catch {
    missing[s.html] = true
  }
}
</script>

<style scoped>
.syn-list {
  margin: 0.2rem 0 0.4rem 0.9rem;
  padding: 0;
  list-style: none;
}
.syn-list li {
  padding: 0.05rem 0;
  border: 0 !important;
}
.syn-list li::before {
  display: none !important;
}
.syn-eq {
  display: inline-block;
  width: 0.9rem;
  font-weight: 700;
  color: rgb(var(--color-secondary));
}
.syn-name {
  color: rgba(var(--color-base-content), 0.85);
}
.syn-name:hover {
  color: rgb(var(--color-primary));
  text-decoration: underline;
}
.syn-miss {
  margin-left: 0.4rem;
  font-size: 0.7rem;
  opacity: 0.6;
}
</style>
