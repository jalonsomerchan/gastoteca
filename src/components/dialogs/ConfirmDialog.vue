<script setup>
import { PhTrash } from '@phosphor-icons/vue'

defineProps({
  titleId: { type: String, required: true },
  title: { type: String, required: true },
  saving: { type: Boolean, default: false },
})
defineEmits(['cancel', 'confirm'])
</script>

<template>
  <div class="modal-backdrop" @mousedown.self="$emit('cancel')">
    <section class="confirm-dialog"
             role="dialog"
             aria-modal="true"
             :aria-labelledby="titleId"
    >
      <span class="danger-mark"><PhTrash :size="25" /></span>
      <p :id="titleId" class="eyebrow modal-title">
        {{ title }}
      </p>
      <p><slot /></p>
      <div>
        <button class="ghost" @click="$emit('cancel')">
          Cancelar
        </button>
        <button class="danger-button" :disabled="saving" @click="$emit('confirm')">
          Sí, eliminar
        </button>
      </div>
    </section>
  </div>
</template>
