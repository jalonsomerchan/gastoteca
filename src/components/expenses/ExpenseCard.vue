<script setup>
import { PhMapPin, PhTag } from '@phosphor-icons/vue'
import { money, dateLabel, expenseLocation } from '../../utils/formatters.js'
import { paymentMethodLabel } from '../../domain/catalogs.js'

defineProps({
  expense: { type: Object, required: true },
  category: { type: Object, required: true },
  placeIcon: { type: String, default: '' },
  payerName: { type: String, required: true },
  participantNames: { type: String, default: '' },
})
defineEmits(['edit'])
</script>

<template>
  <article class="expense-card"
           role="button"
           tabindex="0"
           :aria-label="`Editar movimiento: ${expense.name}`"
           @click="$emit('edit')"
           @keydown.enter.prevent="$emit('edit')"
           @keydown.space.prevent="$emit('edit')"
  >
    <span class="category-icon" :style="expense.place && placeIcon ? { background: '#e5efe8', color: 'var(--green)' } : { background: `${category.color}18`, color: category.color }"><iconify-icon v-if="expense.place && placeIcon" :icon="placeIcon"></iconify-icon><iconify-icon v-else :icon="category.icon"></iconify-icon></span>
    <div class="expense-main">
      <strong>{{ expense.name }} <em v-if="expense.transaction_type === 'income'" class="movement-type">Ingreso</em><em v-if="expense.is_quick" class="quick-pending-pill">Por completar</em></strong><span><PhMapPin :size="14" /> {{ expenseLocation(expense) }} · {{ dateLabel(expense.occurred_at) }}</span><small class="expense-payment-method">{{ paymentMethodLabel(expense.payment_method) }}</small><small v-if="expense.details" class="expense-details">{{ expense.details }}</small><span v-if="expense.tags?.length" class="expense-tag-list"><em v-for="tag in expense.tags" :key="tag">{{ tag }}</em></span>
    </div>
    <span class="category-pill" :style="{ color: category.color }"><PhTag :size="13" /> {{ category.label }}</span>
    <div class="expense-people">
      <span>{{ expense.transaction_type === 'income' ? 'Recibió' : 'Pagó' }}</span><strong>{{ expense.paid_by_type === 'all' ? 'Todo el grupo' : payerName }}</strong><small>Para {{ expense.applies_to_all ? 'todo el grupo' : participantNames }}</small>
    </div>
    <strong class="expense-amount" :class="{ income: expense.transaction_type === 'income' }">{{ expense.transaction_type === 'income' ? '+' : '' }}{{ money(expense.amount) }}</strong>
  </article>
</template>
