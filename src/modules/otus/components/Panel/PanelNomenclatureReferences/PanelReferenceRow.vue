<template>
  <li class="border-b border-base-muted p-3 px-5">
    <span
      class="[&>a]:break-all block"
      :title="stripHTML(reference)"
      v-html="reference"
    />
    <div class="flex flex-wrap items-center gap-3 mt-1">
      <RequestPdfButton
        :citation="reference"
        compact
      />
      <button
        type="button"
        class="ref-copy"
        :title="copied ? 'Copied' : 'Copy this reference'"
        @click="copyReference"
      >
        <svg
          v-if="!copied"
          viewBox="0 0 16 16"
          aria-hidden="true"
        ><rect x="5" y="5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h6.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <svg
          v-else
          viewBox="0 0 16 16"
          aria-hidden="true"
        ><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>{{ copied ? 'Copied' : 'Copy' }}</span>
      </button>
    </div>
  </li>
</template>

<script setup>
import { ref } from 'vue'
import { stripHTML } from '../../../utils'

const props = defineProps({
  reference: {
    type: String,
    required: true
  }
})

// Copy the full reference as plain text, ready to paste into a manuscript
const copied = ref(false)
async function copyReference() {
  const text = stripHTML(props.reference).replace(/\s+/g, ' ').trim()
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<style scoped>
.ref-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  background: none;
  border: 0;
  color: inherit;
  font-size: 0.72rem;
  opacity: 0.6;
  cursor: pointer;
}
.ref-copy svg {
  width: 0.8rem;
  height: 0.8rem;
}
.ref-copy:hover,
.ref-copy:focus-visible {
  opacity: 1;
  color: rgb(var(--color-primary));
}
</style>
