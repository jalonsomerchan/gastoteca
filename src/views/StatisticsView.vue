<script setup>
import { computed, ref, watch } from 'vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import StatsBreakdownCard from '../components/statistics/StatsBreakdownCard.vue'
import StatsExpenseDialog from '../components/statistics/StatsExpenseDialog.vue'
import { PhChartDonut } from '@phosphor-icons/vue'
import { getJson } from '../lib/api.js'
import { madridDateTime } from '../domain/dates.js'
import { localStatistics } from '../domain/offline.js'

const {
  stats: globalStats,
  expenses,
  group,
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
const appliedRange = ref(null)
const selectedTag = ref('')
const appliedTag = ref('')
const stats = ref(globalStats.value)
const maxCategoryTotal = computed(() => Math.max(1, ...stats.value.by_category.map(item => Number(item.total))))
watch(globalStats, value => {
  if (appliedTag.value) stats.value = localStatistics(expenses.value.filter(expense => (expense.tags || []).includes(appliedTag.value)), appliedRange.value || {})
  else stats.value = appliedRange.value ? localStatistics(expenses.value, appliedRange.value) : value
})
const filtering = ref(false)
const filterError = ref('')
const selectedBreakdown = ref(null)
const breakdownExpenses = ref([])
const breakdownLoading = ref(false)
const breakdownError = ref('')
let filterRequestId = 0
let breakdownRequestId = 0

function localDate(date) {
  return date.toISOString().slice(0, 10)
}

function selectedRange() {
  const now = new Date(`${madridDateTime().slice(0, 10)}T12:00:00Z`)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  if (datePreset.value === 'this-month') return { from: localDate(new Date(Date.UTC(year, month, 1))), to: localDate(new Date(Date.UTC(year, month + 1, 0))) }
  if (datePreset.value === 'last-month') return { from: localDate(new Date(Date.UTC(year, month - 1, 1))), to: localDate(new Date(Date.UTC(year, month, 0))) }
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
    const tag = selectedTag.value
    const result = tag
      ? await getJson('gastoteca/expenses', token)
      : await getJson(`gastoteca/statistics${query ? `?${query}` : ''}`, token)
    if (requestId === filterRequestId) {
      stats.value = tag ? localStatistics((result.expenses || []).filter(expense => (expense.tags || []).includes(tag)), range || {}) : result.stats
      appliedRange.value = range
      appliedTag.value = tag
    }
  } catch (reason) {
    if (requestId === filterRequestId) filterError.value = reason.message || 'No se pudieron cargar las estadísticas.'
  } finally {
    if (requestId === filterRequestId) filtering.value = false
  }
}

function applyPreset() {
  const range = selectedRange()
  fromDate.value = range?.from || ''
  toDate.value = range?.to || ''
  refreshStats()
}

function applyCustomRange() {
  datePreset.value = 'custom'
  refreshStats()
}

async function openBreakdown(dimension, item) {
  const requestId = ++breakdownRequestId
  selectedBreakdown.value = { dimension, item }
  breakdownExpenses.value = []
  breakdownError.value = ''
  breakdownLoading.value = true
  try {
    const token = await freshToken()
    const result = await getJson('gastoteca/expenses', token)
    if (requestId !== breakdownRequestId) return
    const range = appliedRange.value
    const allExpenses = result.expenses || []
    breakdownExpenses.value = allExpenses
      .filter(expense => (expense.transaction_type || 'expense') === 'expense' && !expense.confirmation_pending)
      .filter(expense => !appliedTag.value || (expense.tags || []).includes(appliedTag.value))
      .filter(expense => {
        const date = String(expense.occurred_at || '').slice(0, 10)
        return (!range?.from || date >= range.from) && (!range?.to || date <= range.to)
      })
      .flatMap(expense => {
        const matchingShare = dimension === 'participant'
          ? (expense.participants || []).find(participant => participant.uid === item.uid)
          : null
        const matches = dimension === 'month' ? String(expense.occurred_at || '').slice(0, 7) === item.month
          : dimension === 'category' ? expense.category === item.category
            : dimension === 'title' ? (expense.name || '') === (item.title || '')
              : dimension === 'establishment' ? (expense.place || 'Sin establecimiento') === item.establishment
                : dimension === 'payment_method' ? expense.payment_method === item.payment_method
                  : dimension === 'member' ? (expense.paid_by_type === 'all' ? '' : expense.paid_by_uid) === item.uid
                    : dimension === 'participant' ? Boolean(matchingShare)
                      : false
        if (!matches) return []
        return [{
          expense: { ...expense, categoryLabel: category(expense.category).label },
          displayAmount: matchingShare ? Number(matchingShare.share_amount) : Number(expense.amount),
          isShare: Boolean(matchingShare),
        }]
      })
      .sort((a, b) => String(b.expense.occurred_at).localeCompare(String(a.expense.occurred_at)))
  } catch (reason) {
    if (requestId === breakdownRequestId) breakdownError.value = reason.message || 'No se pudieron cargar los gastos.'
  } finally {
    if (requestId === breakdownRequestId) breakdownLoading.value = false
  }
}

function closeBreakdown() {
  breakdownRequestId++
  selectedBreakdown.value = null
  breakdownLoading.value = false
}

const titleStats = computed(() => (stats.value.by_title || []).map((item) => ({ ...item, key: item.title, label: item.title || 'Sin título' })))
const establishmentStats = computed(() => (stats.value.by_establishment || []).map((item) => ({ ...item, key: item.establishment, label: item.establishment || 'Sin establecimiento' })))
const participantStats = computed(() => (stats.value.by_participant || []).map((item) => ({ ...item, key: item.uid, label: memberLabel(item.uid) })))
const paymentMethodStats = computed(() => (stats.value.by_payment_method || []).map((item) => ({ ...item, key: item.payment_method, label: paymentMethodLabel(item.payment_method) })))

const reportLines = computed(() => {
  const data = stats.value
  const sections = [
    ['Gasto por mes', data.monthly, item => monthLabel(item.month)],
    ['En qué gastáis', data.by_category, item => category(item.category).label],
    ['Gasto por título', data.by_title, item => item.title || 'Sin título'],
    ['Dónde gastáis', data.by_establishment, item => item.establishment || 'Sin establecimiento'],
    ['Quién ha pagado', data.by_member, item => item.uid ? memberLabel(item.uid) : 'Todo el grupo'],
    ['Gasto asignado por persona', data.by_participant, item => memberLabel(item.uid)],
    ['Cómo pagáis', data.by_payment_method, item => paymentMethodLabel(item.payment_method)],
  ]
  return [
    'Estadísticas de gastos',
    appliedRange.value ? `Periodo: ${appliedRange.value.from} al ${appliedRange.value.to}` : 'Periodo: todo el periodo',
    `Etiqueta: ${appliedTag.value || 'Todas'}`,
    '', `Gasto total: ${money(data.total)}`, `Gastos registrados: ${data.count}`,
    `Este mes: ${money(data.current_month_total || 0)}`, `Media por gasto: ${money(data.average)}`,
    ...sections.flatMap(([heading, items, label]) => ['', heading, ...(items?.length ? items.map(item => `${label(item)}: ${money(item.total)}`) : ['Sin datos'])]),
  ]
})

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportText() {
  downloadFile(new Blob([reportLines.value.join('\n')], { type: 'text/plain;charset=utf-8' }), 'estadisticas.txt')
}

function exportImage() {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const width = 1000
  context.font = '24px sans-serif'
  const lines = reportLines.value.flatMap(line => {
    if (!line) return ['']
    const words = line.split(/\s+/)
    const result = ['']
    for (const word of words) {
      const index = result.length - 1
      const next = result[index] ? `${result[index]} ${word}` : word
      if (context.measureText(next).width > width - 100 && result[index]) result.push(word)
      else result[index] = next
    }
    return result
  })
  canvas.width = width
  canvas.height = 100 + lines.length * 38
  context.fillStyle = '#fafaf7'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#292b25'
  context.font = '24px sans-serif'
  lines.forEach((line, index) => context.fillText(line, 50, 65 + index * 38, width - 100))
  canvas.toBlob(blob => {
    if (blob) downloadFile(blob, 'estadisticas.png')
    else filterError.value = 'No se pudo generar la imagen.'
  }, 'image/png')
}

</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        UNA MIRADA AL CONJUNTO
      </p><h1>Estadísticas</h1><p>Desglosa los gastos por categoría, nombre, establecimiento, persona y método de pago.</p>
    </div>
    <div class="stats-export-actions" aria-label="Exportar estadísticas">
      <button type="button" class="secondary" :disabled="filtering" @click="exportImage">Exportar imagen</button>
      <button type="button" class="secondary" :disabled="filtering" @click="exportText">Exportar texto</button>
    </div>
  </section>
  <section class="stats-date-filter" aria-label="Filtrar estadísticas">
    <label class="stats-date-preset"><span>Periodo</span><select v-model="datePreset" :disabled="filtering" @change="applyPreset">
      <option value="all">Todo el periodo</option>
      <option value="this-month">Este mes</option>
      <option value="last-month">Mes anterior</option>
      <option value="this-year">Este año</option>
      <option value="last-year">Año anterior</option>
      <option value="custom">Personalizado</option>
    </select></label>
    <label><span>Desde</span><input v-model="fromDate" type="date" :max="toDate || undefined" :disabled="filtering" @change="applyCustomRange"></label>
    <label><span>Hasta</span><input v-model="toDate" type="date" :min="fromDate || undefined" :disabled="filtering" @change="applyCustomRange"></label>
    <label><span>Etiqueta</span><select v-model="selectedTag" :disabled="filtering" @change="refreshStats">
      <option value="">Todas las etiquetas</option>
      <option v-for="tag in group?.tags || []" :key="tag.id" :value="tag.name">{{ tag.name }}</option>
    </select></label>
    <span v-if="filtering" class="stats-filter-status" role="status">Actualizando…</span>
    <p v-if="datePreset === 'custom' && (!fromDate || !toDate)" class="stats-filter-hint">Selecciona las dos fechas para aplicar el filtro.</p>
    <p v-if="filterError" class="stats-filter-error" role="alert">{{ filterError }}</p>
    <p class="stats-filter-hint">{{ appliedRange ? `Mostrando del ${appliedRange.from} al ${appliedRange.to}.` : 'Mostrando todo el periodo.' }} {{ appliedTag ? `Etiqueta: ${appliedTag}.` : '' }}</p>
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
      <div v-if="stats.monthly.length" class="month-chart">
        <button v-for="item in stats.monthly" :key="item.month" type="button" class="month-column stats-month-button" @click="openBreakdown('month', item)">
          <strong>{{ money(item.total) }}</strong><div><span :style="{ height: `${Math.max(8, Number(item.total) / Math.max(1, ...stats.monthly.map(x => Number(x.total))) * 100)}%` }"></span></div><small>{{ monthLabel(item.month) }}</small>
        </button>
      </div><p v-else class="muted">
        Añade gastos para ver su evolución.
      </p>
      <details v-if="stats.monthly.length" class="data-table-disclosure">
        <summary>Ver importes por mes en una tabla</summary>
        <table class="data-table"><caption>Evolución del gasto mensual</caption><thead><tr><th scope="col">Mes</th><th scope="col">Importe</th></tr></thead><tbody><tr v-for="item in stats.monthly" :key="item.month"><th scope="row"><button type="button" class="stats-table-link" @click="openBreakdown('month', item)">{{ monthLabel(item.month) }}</button></th><td>{{ money(item.total) }}</td></tr></tbody></table>
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
        <button v-for="item in stats.by_category" :key="item.category" type="button" class="bar-item stats-breakdown-button" @click="openBreakdown('category', item)">
          <span><iconify-icon aria-hidden="true" :icon="category(item.category).icon"></iconify-icon></span><div><p><strong>{{ category(item.category).label }}</strong><b>{{ money(item.total) }}</b></p><i><em :style="{ width: `${Number(item.total) / maxCategoryTotal * 100}%`, background: category(item.category).color }"></em></i></div>
        </button><p v-if="!stats.by_category.length" class="muted">
          Aún no hay datos.
        </p>
      </div>
    </article>
    <StatsBreakdownCard eyebrow="NOMBRES" title="Gasto por título" :items="titleStats" dimension="title" @select="openBreakdown" />
    <StatsBreakdownCard eyebrow="ESTABLECIMIENTOS" title="Dónde gastáis" :items="establishmentStats" dimension="establishment" @select="openBreakdown" />
    <article class="chart-card">
      <div class="card-title">
        <div>
          <p class="eyebrow">
            PERSONAS
          </p><h2>Quién ha pagado</h2>
        </div>
      </div>
      <div class="member-stat">
        <button v-for="item in stats.by_member" :key="item.uid || 'all'" type="button" class="stats-member-button" @click="openBreakdown('member', item)">
          <span class="avatar">{{ item.uid ? memberLabel(item.uid).slice(0, 1).toUpperCase() : '∑' }}</span><p><strong>{{ item.uid ? memberLabel(item.uid) : 'Todo el grupo' }}</strong><small>{{ item.count }} gastos</small></p><b>{{ money(item.total) }}</b>
        </button><p v-if="!stats.by_member.length" class="muted">
          Aún no hay datos.
        </p>
      </div>
    </article>
    <StatsBreakdownCard eyebrow="PERSONAS" title="Gasto asignado por persona" :items="participantStats" dimension="participant" @select="openBreakdown" />
    <StatsBreakdownCard eyebrow="MÉTODOS DE PAGO" title="Cómo pagáis" :items="paymentMethodStats" dimension="payment_method" @select="openBreakdown" />
  </section>
  <StatsExpenseDialog v-if="selectedBreakdown" :title="selectedBreakdown.item.label" :items="breakdownExpenses" :loading="breakdownLoading" :error="breakdownError" @close="closeBreakdown" />
</template>
