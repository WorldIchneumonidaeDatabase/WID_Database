<template>
  <VButton
    primary
    class="text-sm flex items-center"
    :title="copied ? 'Link copied' : 'Share this page (with a preview card on social media and chat apps)'"
    @click="share"
  >
    <svg
      class="w-4 h-4 mr-1"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M7.2 10.9a2.25 2.25 0 1 0 0 2.2m0-2.2a2.25 2.25 0 0 1 0 2.2m0-2.2 9.6-5.3m-9.6 7.5 9.6 5.3m0 0a2.25 2.25 0 1 0 3.9 2.2 2.25 2.25 0 0 0-3.9-2.2Zm0-12.8a2.25 2.25 0 1 0 3.9-2.2 2.25 2.25 0 0 0-3.9 2.2Z"
      />
    </svg>
    {{ copied ? 'Link copied' : 'Share' }}
  </VButton>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  otuId: { type: [Number, String], required: true },
  title: { type: String, default: '' }
})

// The maps Worker serves the share page (config/maps.yml); without it, share the page itself
const WORKER = String(__APP_ENV__.maps?.endpoint || '').replace(/\/$/, '')
const copied = ref(false)

async function share() {
  const url = WORKER
    ? `${WORKER}/share/${props.otuId}`
    : `${location.origin}${location.pathname}#/otus/${props.otuId}/overview`

  // Phones and tablets: the system share sheet
  if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title: props.title, url })
      return
    } catch {
      /* cancelled: fall through to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = url
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}
</script>
