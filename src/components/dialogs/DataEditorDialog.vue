<script setup>
import { PhCheck, PhX } from '@phosphor-icons/vue'
import BaseDialog from './BaseDialog.vue'
import FormError from '../forms/FormError.vue'

defineProps({
  titleId: { type: String, required: true },
  title: { type: String, required: true },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
  saveLabel: { type: String, default: 'Guardar cambios' },
  wide: { type: Boolean, default: false },
})
defineEmits(['close', 'submit'])
</script>

<template>
  <BaseDialog :labelled-by="titleId" :busy="saving" @close="$emit('close')">
    <section class="modal data-editor-modal" :class="{ 'data-editor-wide': wide }">
      <header>
        <h2 :id="titleId" class="modal-title">{{ title }}</h2>
        <button type="button" class="icon-button" aria-label="Cerrar editor" :disabled="saving" @click="$emit('close')"><PhX aria-hidden="true" :size="22" /></button>
      </header>
      <FormError :message="error" />
      <form class="feature-form data-editor-form" :aria-busy="saving" @submit.prevent="$emit('submit')">
        <fieldset class="data-editor-fields" :disabled="saving"><slot /></fieldset>
        <footer>
          <button type="button" class="ghost" :disabled="saving" @click="$emit('close')">Cancelar</button>
          <button type="submit" class="primary" :disabled="saving"><PhCheck aria-hidden="true" :size="18" /> {{ saving ? 'Guardando…' : saveLabel }}</button>
        </footer>
      </form>
    </section>
  </BaseDialog>
</template>
