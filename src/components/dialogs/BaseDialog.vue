<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  labelledBy: { type: String, required: true },
  describedBy: { type: String, default: undefined },
  busy: { type: Boolean, default: false },
  fitViewport: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])
const dialog = ref(null)
const viewportStyle = ref(undefined)
let opener

function fitVisibleViewport() {
  const viewport = window.visualViewport
  if (!props.fitViewport || !viewport || viewport.scale !== 1) {
    viewportStyle.value = undefined
    return
  }
  viewportStyle.value = { height: `${viewport.height}px`, top: `${viewport.offsetTop}px`, bottom: 'auto' }
}

// Native modal dialogs make the background inert and support stacked confirmations.
onMounted(() => {
  opener = document.activeElement
  if (props.fitViewport) {
    fitVisibleViewport()
    window.visualViewport?.addEventListener('resize', fitVisibleViewport)
    window.visualViewport?.addEventListener('scroll', fitVisibleViewport)
  }
  dialog.value.showModal()
  const initial = dialog.value.querySelector('[data-initial-focus]')
  initial?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', fitVisibleViewport)
  window.visualViewport?.removeEventListener('scroll', fitVisibleViewport)
  dialog.value?.close()
  nextTick(() => {
    if (opener?.isConnected) opener.focus({ preventScroll: true })
    else document.querySelector('#main-content')?.focus({ preventScroll: true })
  })
})

function cancel(event) {
  event.preventDefault()
  if (!props.busy) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog-host"
    :style="viewportStyle"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="labelledBy"
    :aria-describedby="describedBy"
    :aria-busy="busy"
    @cancel="cancel"
  >
    <slot />
  </dialog>
</template>
