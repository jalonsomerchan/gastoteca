<script setup>
import { computed, ref, watch } from 'vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import StatsBreakdownCard from '../components/statistics/StatsBreakdownCard.vue'
import { PhChartDonut } from '@phosphor-icons/vue'
import { getJson } from '../lib/api.js'

const {
  stats,
  maxCategoryTotal,
  category,
  memberLabel,
  paymentMethodLabel,
  money,
  monthLabel,
  freshToken,
} = useGastotecaContext()

const datePreset = ref('all')
const fromDate = ref('')
const toDate = ref('')
const filtering = ref(false)
const filterError = ref('')
let filterRequestId = 0

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function selectedRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (datePreset.value === 'this-month') return { from: localDate(new Date(year, month, 1)), to: localDate(new Date(year, month + 1, 0)) }
  if (datePreset.value === 'last-month') return { from: localDate(new Date(year, month - 1, 1)), to: localDate(new Date(year, month, 0)) }
  if (datePreset.value === 'this-year') return { from: `${year}-01-01`, to: `${year}-12-31` }
  if (datePreset.value === 'last-year') return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
  if (datePreset.value === 'custom') return { from: fromDate.value, to: toDate.value }
  return null
}

async function refreshStats() {
  const requestId = ++filterRequestId
  filterError.value = ''
  const range = selectedRange()
  if (range && (!range.from || !range.to)) return
  if (range && range.from > range.to) {
    filterError.value = 'La fecha de inicio debe ser anterior a la fecha de fin.'
    return
  }

  filtering.value = true
  try {
    const params = new URLSearchParams()
    if (range) {
      params.set('from', range.from)
      params.set('to', range.to)
    }
    const token = await freshToken()
    const query = params.toString()
    const result = await getJson(`gastoteca/statistics${query ? `?${query}` : ''}`, token)
    if (requestId === filterRequestId) stats.value = result.stats || stats.value
  } catch (reason) {
    if (requestId === filterRequestId) filterError.value = reason.message || 'No se pudieron cargar las estadísticas.'
  } finally {
    if (requestId === filterRequestId) filtering.value = false
  }
}

watch([datePreset, fromDate, toDate], () => {
  if (datePreset.value !== 'custom' || (fromDate.value && toDate.value)) refreshStats()
})

const titleStats = computed(() => (stats.value.by_title || []).map((item) => ({ ...item, key: item.title, label: item.title || 'Sin título' })))
const establishmentStats = computed(() => (stats.value.by_establishment || []).map((item) => ({ ...item, key: item.establishment, label: item.establishment || 'Sin establecimiento' })))
const participantStats = computed(() => (stats.value.by_participant || []).map((item) => ({ ...item, key: item.uid, label: memberLabel(item.uid) })))
const paymentMethodStats = computed(() => (stats.value.by_payment_method || []).map((item) => ({ ...item, key: item.payment_method, label: paymentMethodLabel(item.payment_method) })))
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        UNA MIRADA AL CONJUNTO
      </p><h1>Estadísticas</h1><p>Desglosa los gastos por categoría, nombre, establecimiento, persona y método de pago.</p>
    </div>
  </section>
  <section class="stats-date-filter" aria-label="Filtrar estadísticas por fecha">
    <label class="stats-date-preset"><span>Periodo</span><select v-model="datePreset" :disabled="filtering">
      <option value="all">Todo el periodo</option>
      <option value="this-month">Este mes</option>
      <option value="last-month">Mes anterior</option>
      <option value="this-year">Este año</option>
      <option value="last-year">Año anterior</option>
      <option value="custom">Personalizado</option>
    </select></label>
    <template v-if="datePreset === 'custom'">
      <label><span>Desde</span><input v-model="fromDate" type="date" :max="toDate || undefined" :disabled="filtering"></label>
      <label><span>Hasta</span><input v-model="toDate" type="date" :min="fromDate || undefined" :disabled="filtering"></label>
    </template>
    <span v-if="filtering" class="stats-filter-status" role="status">Actualizando…</span>
    <p v-if="datePreset === 'custom' && (!fromDate || !toDate)" class="stats-filter-hint">Selecciona las dos fechas para aplicar el filtro.</p>
    <p v-if="filterError" class="stats-filter-error" role="alert">{{ filterError }}</p>
  </section>
  <section class="stats-overview" aria-label="Resumen de gastos">
    <article class="stats-overview-card"><span>Gasto total</span><strong>{{ money(stats.total) }}</strong><small>{{ stats.count }} {{ stats.count === 1 ? 'gasto registrado' : 'gastos registrados' }}</small></article>
    <article class="stats-overview-card"><span>Este mes</span><strong>{{ money(stats.current_month_total || 0) }}</strong><small>Gasto del mes actual</small></article>
    <article class="stats-overview-card"><span>Media por gasto</span><strong>{{ money(stats.average) }}</strong><small>Importe medio registrado</small></article>
  </section>
  <section class="stats-grid">
    <article class="chart-card wide">
      <div class="card-title">
        <div>
          <p class="eyebrow">
            EVOLUCIÓN
          </p><h2>Gasto por mes</h2>
        </div><PhChartDonut aria-hidden="true" :size="27" />
      </div>
      <div v-if="stats.monthly.length" class="month-chart" aria-hidden="true">
        <div v-for="item in stats.monthly" :key="item.month" class="month-column">
          <strong>{{ money(item.total) }}</strong><div><span :style="{ height: `${Math.max(8, Number(item.total) / Math.max(1, ...stats.monthly.map(x => Number(x.total))) * 100)}%` }"></span></div><small>{{ monthLabel(item.month) }}</small>
        </div>
      </div><p v-else class="muted">
        Añade gastos para ver su evolución.
      </p>
      <details v-if="stats.monthly.length" class="data-table-disclosure">
        <summary>Ver importes por mes en una tabla</summary>
        <table class="data-table"><caption>Evolución del gasto mensual</caption><thead><tr><th scope="col">Mes</th><th scope="col">Importe</th></tr></thead><tbody><tr v-for="item in stats.monthly" :key="item.month"><th scope="row">{{ monthLabel(item.month) }}</th><td>{{ money(item.total) }}</td></tr></tbody></table>
      </details>
    </article>
    <article class="chart-card">
      <div class="card-title">
        <div>
          <p class="eyebrow">
            CATEGORÍAS
          </p><h2>En qué gastáis</h2>
        </div>
      </div>
      <div class="bar-list">
        <div v-for="item in stats.by_category" :key="item.category" class="bar-item">
          <span><iconify-icon aria-hidden="true" :icon="category(item.category).icon"></iconify-icon></span><div><p><strong>{{ category(item.category).label }}</strong><b>{{ money(item.total) }}</b></p><i><em :style="{ width: `${Number(item.total) / maxCategoryTotal * 100}%`, background: category(item.category).color }"></em></i></div>
        </div><p v-if="!stats.by_category.length" class="muted">
          Aún no hay datos.
        </p>
      </div>
    </article>
    <StatsBreakdownCard eyebrow="NOMBRES" title="Gasto por título" :items="titleStats" />
    <StatsBreakdownCard eyebrow="ESTABLECIMIENTOS" title="Dónde gastáis" :items="establishmentStats" />
    <article class="chart-card">
      <div class="card-title">
        <div>
          <p class="eyebrow">
            PERSONAS
          </p><h2>Quién ha pagado</h2>
        </div>
      </div>
      <div class="member-stat">
        <div v-for="item in stats.by_member" :key="item.uid || 'all'">
          <span class="avatar">{{ item.uid ? memberLabel(item.uid).slice(0, 1).toUpperCase() : '∑' }}</span><p><strong>{{ item.uid ? memberLabel(item.uid) : 'Todo el grupo' }}</strong><small>{{ item.count }} gastos</small></p><b>{{ money(item.total) }}</b>
        </div><p v-if="!stats.by_member.length" class="muted">
          Aún no hay datos.
        </p>
      </div>
    </article>
    <StatsBreakdownCard eyebrow="PERSONAS" title="Gasto asignado por persona" :items="participantStats" />
    <StatsBreakdownCard eyebrow="MÉTODOS DE PAGO" title="Cómo pagáis" :items="paymentMethodStats" />
  </section>
</template>
