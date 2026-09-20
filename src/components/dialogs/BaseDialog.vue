<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  labelledBy: { type: String, required: true },
  describedBy: { type: String, default: undefined },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])
const dialog = ref(null)
let opener

// Native modal dialogs make the background inert and support stacked confirmations.
onMounted(() => {
  opener = document.activeElement
  dialog.value.showModal()
  const initial = dialog.value.querySelector('[data-initial-focus]')
  initial?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
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
