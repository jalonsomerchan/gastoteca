<script setup>
import BaseDialog from './BaseDialog.vue'
import FormError from '../forms/FormError.vue'
import { PhTrash } from '@phosphor-icons/vue'

defineProps({
  titleId: { type: String, required: true },
  title: { type: String, required: true },
  error: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Sí, eliminar' },
  saving: { type: Boolean, default: false },
})
defineEmits(['cancel', 'confirm'])
</script>

<template>
  <BaseDialog :labelled-by="titleId" :described-by="`${titleId}-description`" :busy="saving" @close="$emit('cancel')">
    <section class="confirm-dialog"
    >
      <span class="danger-mark"><PhTrash aria-hidden="true" :size="25" /></span>
      <p :id="titleId" class="eyebrow modal-title">
        {{ title }}
      </p>
      <p :id="`${titleId}-description`"><slot /></p>
      <FormError :message="error" />
      <div>
        <button type="button" class="ghost" data-initial-focus :disabled="saving" @click="$emit('cancel')">
          Cancelar
        </button>
        <button type="button" class="danger-button" :disabled="saving" @click="$emit('confirm')">
          {{ saving ? 'Guardando…' : confirmLabel }}
        </button>
      </div>
    </section>
  </BaseDialog>
</template>
