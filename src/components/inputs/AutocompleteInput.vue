<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps({
  id: { type: String, default: undefined },
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  maxlength: { type: Number, default: undefined },
  autofocus: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const isOpen = ref(false)
const activeIndex = ref(-1)
const closeTimer = ref(0)
const listId = useId()

onBeforeUnmount(() => window.clearTimeout(closeTimer.value))
watch(activeIndex, async (index) => {
  if (index < 0) return
  await nextTick()
  document.getElementById(`${listId}-option-${index}`)?.scrollIntoView({ block: 'nearest' })
})

function normalize(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const menuOptions = computed(() => {
  const query = String(props.modelValue || '').trim()
  const normalizedQuery = normalize(query)
  const matches = props.options
    .filter((option) => !normalizedQuery || normalize(option).includes(normalizedQuery))
    .slice(0, 7)
    .map((label) => ({ label, value: label, isNew: false }))
  const exactMatch = props.options.some((option) => normalize(option) === normalizedQuery)

  if (normalizedQuery && !exactMatch) matches.unshift({ label: query, value: query, isNew: true })
  return matches
})

function updateValue(value) {
  emit('update:modelValue', value)
  activeIndex.value = -1
}

function openMenu() {
  window.clearTimeout(closeTimer.value)
  isOpen.value = true
}

function closeMenu(event) {
  const typedValue = event.currentTarget.value.trim()
  const normalizedValue = normalize(typedValue)
  const matchingOption = props.options.find((option) => normalize(option) === normalizedValue)
  const value = matchingOption || typedValue
  if (event.currentTarget.value !== value) updateValue(value)
  closeTimer.value = window.setTimeout(() => {
    isOpen.value = false
    activeIndex.value = -1
  }, 120)
}

function choose(option) {
  window.clearTimeout(closeTimer.value)
  updateValue(option.value)
  isOpen.value = false
  activeIndex.value = -1
}

function moveActiveOption(direction) {
  if (!isOpen.value) openMenu()
  if (!menuOptions.value.length) return
  if (activeIndex.value < 0) {
    activeIndex.value = direction > 0 ? 0 : menuOptions.value.length - 1
    return
  }
  activeIndex.value = (activeIndex.value + direction + menuOptions.value.length) % menuOptions.value.length
}

function onKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActiveOption(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActiveOption(-1)
  } else if (event.key === 'Enter' && isOpen.value) {
    event.preventDefault()
    const activeOption = menuOptions.value[activeIndex.value]
    if (activeOption) choose(activeOption)
    else isOpen.value = false
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    isOpen.value = false
    activeIndex.value = -1
  }
}
</script>

<template>
  <div class="autocomplete-control">
    <input
      :id="id"
      class="autocomplete-input"
      :value="modelValue"
      type="text"
      role="combobox"
      aria-haspopup="listbox"
      aria-autocomplete="list"
      :aria-label="ariaLabel"
      :aria-expanded="isOpen"
      :aria-controls="listId"
      :aria-activedescendant="isOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :maxlength="maxlength"
      :autofocus="autofocus"
      autocomplete="off"
      autocapitalize="sentences"
      enterkeyhint="done"
      @focus="openMenu"
      @blur="closeMenu"
      @input="updateValue($event.target.value)"
      @keydown="onKeydown"
    />
    <ul :id="listId" v-show="isOpen" class="autocomplete-options" role="listbox">
      <li
        v-for="(option, index) in menuOptions"
        :id="`${listId}-option-${index}`"
        :key="`${option.isNew ? 'new' : 'suggestion'}-${option.value}`"
        role="option"
        :aria-selected="activeIndex === index"
        :class="{ active: activeIndex === index, 'new-option': option.isNew }"
        @mousedown.prevent
        @click="choose(option)"
      >
        <span v-if="option.isNew" class="autocomplete-option-action">Añadir</span>
        <span>{{ option.label }}</span>
      </li>
      <li v-if="!menuOptions.length" class="autocomplete-no-options" role="status">
        No hay sugerencias. Puedes guardar el texto tal como lo has escrito.
      </li>
    </ul>
  </div>
</template>
