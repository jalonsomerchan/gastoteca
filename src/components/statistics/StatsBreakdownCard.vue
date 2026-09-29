<script setup>
import { computed } from 'vue'
import { money } from '../../utils/formatters.js'

const props = defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  limit: { type: Number, default: 8 },
})

const visibleItems = computed(() => props.items.slice(0, props.limit))
const maxTotal = computed(() => props.items.reduce((max, item) => Math.max(max, Number(item.total) || 0), 1))
</script>

<template>
  <article class="chart-card stats-breakdown-card">
    <div class="card-title">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
    </div>
    <div v-if="items.length" class="bar-list stats-breakdown-list">
      <div v-for="item in visibleItems" :key="item.key" class="bar-item stats-breakdown-row">
        <div>
          <p><strong>{{ item.label }}</strong><b>{{ money(item.total) }}</b></p>
          <small>{{ item.count }} {{ item.count === 1 ? 'gasto' : 'gastos' }}</small>
          <i><em :style="{ width: `${Number(item.total) / maxTotal * 100}%` }"></em></i>
        </div>
      </div>
    </div>
    <p v-else class="muted">Aún no hay datos.</p>
    <details v-if="items.length > limit" class="data-table-disclosure">
      <summary>Ver todos ({{ items.length }})</summary>
      <table class="data-table">
        <caption>{{ title }}</caption>
        <thead><tr><th scope="col">{{ title }}</th><th scope="col">Gastos</th><th scope="col">Importe</th></tr></thead>
        <tbody>
          <tr v-for="item in items" :key="item.key">
            <th scope="row">{{ item.label }}</th>
            <td>{{ item.count }}</td>
            <td>{{ money(item.total) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </article>
</template>
