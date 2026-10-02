<script setup>
import { PhMagnifyingGlass, PhX } from '@phosphor-icons/vue'

defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, required: true },
  label: { type: String, required: true },
  placeholder: { type: String, default: 'Buscar por nombre…' },
  count: { type: Number, required: true },
  total: { type: Number, required: true },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="data-toolbar">
    <label class="data-search" :for="id">
      <span class="sr-only">{{ label }}</span>
      <PhMagnifyingGlass aria-hidden="true" :size="20" />
      <input :id="id" type="search" :value="modelValue" :placeholder="placeholder" autocomplete="off" :aria-describedby="`${id}-count`" @input="$emit('update:modelValue', $event.target.value)" />
    </label>
    <button v-if="modelValue" type="button" class="ghost data-search-clear" @click="$emit('update:modelValue', '')"><PhX aria-hidden="true" :size="16" /> Limpiar búsqueda</button>
    <span :id="`${id}-count`" class="data-result-count" role="status" aria-live="polite" aria-atomic="true">{{ count }} de {{ total }}</span>
  </div>
</template>
