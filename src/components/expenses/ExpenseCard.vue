<script setup>
import { computed } from 'vue'
import { PhMapPin, PhTag } from '@phosphor-icons/vue'
import { money, dateLabel } from '../../utils/formatters.js'

const props = defineProps({
  expense: { type: Object, required: true },
  category: { type: Object, required: true },
  placeIcon: { type: String, default: '' },
  payerName: { type: String, required: true },
  participantNames: { type: String, default: '' },
  currentUid: { type: String, default: '' },
  isNew: { type: Boolean, default: false },
})
defineEmits(['edit'])

const payerIsCurrentUser = computed(() => props.expense.paid_by_type !== 'all' && props.expense.paid_by_uid === props.currentUid)
const appliesOnlyToCurrentUser = computed(() => !props.expense.applies_to_all && props.expense.participant_uids?.length === 1 && props.expense.participant_uids[0] === props.currentUid)
const isBankinterImport = computed(() => /^Importado desde Bankinter(?:\s*·.*)?$/i.test(String(props.expense.details || '').trim()))
const detailsText = computed(() => isBankinterImport.value ? 'Importado desde Bankinter' : props.expense.details)
const amountTone = computed(() => {
  if (props.expense.paid_by_type === 'all') return 'paid-by-group'
  if (props.expense.transaction_type === 'income') return 'income'
  if (payerIsCurrentUser.value) return 'paid-by-current'
  if (props.expense.applies_to_all || appliesOnlyToCurrentUser.value) return 'applies-to-current'
  return ''
})
</script>

<template>
  <article class="expense-card"
           :class="{ 'expense-card-new': isNew }"
           role="button"
           tabindex="0"
           :aria-label="`Editar movimiento: ${expense.name}`"
           @click="$emit('edit')"
           @keydown.enter.prevent="$emit('edit')"
           @keydown.space.prevent="$emit('edit')"
  >
    <span class="category-icon" :style="expense.place && placeIcon ? { background: '#e5efe8', color: 'var(--green)' } : { background: `${category.color}18`, color: category.color }"><iconify-icon aria-hidden="true" v-if="expense.place && placeIcon" :icon="placeIcon"></iconify-icon><iconify-icon aria-hidden="true" v-else :icon="category.icon"></iconify-icon></span>
    <div class="expense-main">
      <strong>{{ expense.name }} <em v-if="isNew" class="unseen-expense-pill">Nuevo</em><em v-if="expense.transaction_type === 'income'" class="movement-type">Ingreso</em><em v-if="expense.is_quick" class="quick-pending-pill">Por completar</em><em v-if="expense.confirmation_pending" class="confirmation-pending-pill">Pendiente de confirmar</em></strong><span><PhMapPin aria-hidden="true" :size="14" /> {{ expense.place || 'Sin establecimiento' }} · {{ dateLabel(expense.occurred_at) }}</span><small v-if="detailsText" class="expense-details" :class="{ 'expense-details-imported': isBankinterImport }">{{ detailsText }}</small><span v-if="expense.tags?.length" class="expense-tag-list"><em v-for="tag in expense.tags" :key="tag">{{ tag }}</em></span>
    </div>
    <span class="category-pill" :style="{ color: category.color }"><PhTag aria-hidden="true" :size="13" /> {{ category.label }}</span>
    <div class="expense-people">
      <span>{{ expense.transaction_type === 'income' ? 'Recibió' : 'Pagó' }}</span>
      <strong>{{ expense.paid_by_type === 'all' ? 'Todo el grupo' : payerIsCurrentUser ? 'TÚ' : payerName }}</strong>
      <span class="expense-people-separator" aria-hidden="true">·</span>
      <small>Para {{ expense.applies_to_all ? 'todo el grupo' : appliesOnlyToCurrentUser ? 'ti' : participantNames }}</small>
    </div>
    <strong class="expense-amount" :class="amountTone">{{ expense.transaction_type === 'income' ? '+' : '' }}{{ money(expense.amount) }}</strong>
  </article>
</template>
