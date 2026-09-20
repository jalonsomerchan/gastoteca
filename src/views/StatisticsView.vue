<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhChartDonut } from '@phosphor-icons/vue'

const {
  stats,
  maxCategoryTotal,
  category,
  memberLabel,
  money,
  monthLabel,
} = useGastotecaContext()
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        UNA MIRADA AL CONJUNTO
      </p><h1>Estadísticas</h1><p>Descubre dónde, cuándo y entre quién se reparte el gasto.</p>
    </div>
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
  </section>
</template>
