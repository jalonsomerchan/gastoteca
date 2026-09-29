<script setup>
import { computed } from 'vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import StatsBreakdownCard from '../components/statistics/StatsBreakdownCard.vue'
import { PhChartDonut } from '@phosphor-icons/vue'

const {
  stats,
  maxCategoryTotal,
  category,
  memberLabel,
  paymentMethodLabel,
  money,
  monthLabel,
} = useGastotecaContext()

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
