<script setup>
import BaseDialog from '../dialogs/BaseDialog.vue'
import { money, dateLabel } from '../../utils/formatters.js'

defineProps({
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['close'])
</script>

<template>
  <BaseDialog labelled-by="stats-expenses-title" :busy="loading" @close="emit('close')">
    <section class="modal stats-expense-dialog">
      <header>
        <div>
          <p class="eyebrow">GASTOS DEL DESGLOSE</p>
          <h2 id="stats-expenses-title" class="modal-title">{{ title }}</h2>
          <p v-if="!loading && !error" class="stats-expense-summary">
            {{ items.length }} {{ items.length === 1 ? 'gasto' : 'gastos' }} · {{ money(items.reduce((sum, item) => sum + Number(item.displayAmount), 0)) }}
          </p>
        </div>
        <button type="button" class="icon-button" aria-label="Cerrar" @click="emit('close')">×</button>
      </header>
      <p v-if="loading" class="stats-expense-message" role="status">Cargando gastos…</p>
      <p v-else-if="error" class="stats-expense-message stats-expense-error" role="alert">{{ error }}</p>
      <p v-else-if="!items.length" class="stats-expense-message">No hay gastos para este elemento en el periodo seleccionado.</p>
      <div v-else class="stats-expense-table-wrap">
        <table class="data-table stats-expense-table">
          <caption class="sr-only">{{ title }}</caption>
          <thead><tr><th scope="col">Fecha</th><th scope="col">Gasto</th><th scope="col">Categoría</th><th scope="col">Establecimiento</th><th scope="col">Importe</th></tr></thead>
          <tbody>
            <tr v-for="item in items" :key="item.expense.id">
              <td>{{ dateLabel(item.expense.occurred_at) }}</td>
              <th scope="row">{{ item.expense.name || 'Sin título' }}<small v-if="item.isShare">Parte asignada</small></th>
              <td>{{ item.expense.categoryLabel || item.expense.category || '—' }}</td>
              <td>{{ item.expense.place || 'Sin establecimiento' }}</td>
              <td>{{ money(item.displayAmount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer><button type="button" class="secondary" @click="emit('close')">Cerrar</button></footer>
    </section>
  </BaseDialog>
</template>
