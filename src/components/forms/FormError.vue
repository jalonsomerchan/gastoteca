<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({ message: { type: String, default: '' } })
const summary = ref(null)
watch(() => props.message, async message => {
  if (!message) return
  await nextTick()
  summary.value?.focus({ preventScroll: false })
})
</script>

<template>
  <div v-if="message" ref="summary" class="form-error" role="alert" tabindex="-1">
    <strong>No se ha podido completar la acción.</strong>
    <p>{{ message }}</p>
  </div>
</template>
