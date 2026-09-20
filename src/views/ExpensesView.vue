<script setup>
import ExpenseCard from '../components/expenses/ExpenseCard.vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhArrowRight, PhFunnel, PhCaretDown, PhReceipt, PhPlus } from '@phosphor-icons/vue'

const {
  
  router,
  expenses,
  group,
  filters,
  filtersOpen,
  loadMoreSentinel,
  
  categories,
  filteredExpenses,
  visibleExpenses,
  hasMoreExpenses,
  activeFilterCount,
  netBalance,
  netBalanceTitle,
  category,
  memberLabel,
  establishmentIcon,
  money,
  
  
  clearFilters,
  openExpense,
} = useGastotecaContext()
</script>

<template>
  <section class="balance-section" aria-label="Tu balance">
    <p class="eyebrow">
      {{ group?.name || 'MI GRUPO' }}
    </p>
    <div class="balance-grid single-balance">
      <button type="button"
              class="balance-card balance-summary-card"
              :class="netBalance < 0 ? 'balance-negative' : 'balance-positive'"
              :aria-label="`${netBalanceTitle}: ${money(Math.abs(netBalance))}. Ver desglose completo`"
              @click="router.push({ name: 'balance' })"
      >
        <span>{{ netBalanceTitle }}</span>
        <strong>{{ money(Math.abs(netBalance)) }}</strong>
        <small>Ver desglose completo <PhArrowRight :size="16" /></small>
      </button>
    </div>
  </section>

  <section class="filter-accordion">
    <button class="filter-toggle"
            type="button"
            :aria-expanded="filtersOpen"
            aria-controls="expense-filters"
            @click="filtersOpen = !filtersOpen"
    >
      <span><PhFunnel :size="18" /> Filtros <b v-if="activeFilterCount">{{ activeFilterCount }}</b></span>
      <PhCaretDown :size="18" :class="{ rotated: filtersOpen }" />
    </button>
    <div v-if="filtersOpen" id="expense-filters" class="filter-content">
      <div class="filters">
        <label class="search">
          <PhReceipt :size="18" /><input v-model="filters.search" placeholder="Buscar movimiento, establecimiento o ciudad…" />
        </label>
        <select v-model="filters.category">
          <option value="">Todas las categorías</option><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.label }}</option>
        </select>
        <input v-model="filters.from"
               type="date"
               title="Desde"
               aria-label="Desde"
        />
        <input v-model="filters.to"
               type="date"
               title="Hasta"
               aria-label="Hasta"
        />
      </div>
      <button v-if="activeFilterCount"
              class="clear-filters"
              type="button"
              @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </div>
  </section>

  <section v-if="filteredExpenses.length" class="expense-list">
    <div class="expense-list-heading">
      <h1>Movimientos</h1><span>{{ filteredExpenses.length }}</span>
    </div>
    <ExpenseCard
      v-for="expense in visibleExpenses"
      :key="expense.id"
      :expense="expense"
      :category="category(expense.category)"
      :place-icon="establishmentIcon(expense.place)"
      :payer-name="memberLabel(expense.paid_by_uid)"
      :participant-names="expense.applies_to_all ? '' : expense.participant_uids.map(memberLabel).join(', ')"
      @edit="openExpense(expense)"
    />
    <div v-if="hasMoreExpenses"
         ref="loadMoreSentinel"
         class="load-more"
         aria-label="Cargando más gastos"
    >
      <span class="loader"></span>
    </div>
  </section>
  <section v-else class="empty-state">
    <div>🧾</div><h2>{{ expenses.length ? 'No hay resultados' : 'Tu primer gasto empieza aquí' }}</h2><p>{{ expenses.length ? 'Prueba a cambiar los filtros.' : 'Pulsa el botón + para añadir una compra, una factura o una cena.' }}</p>
  </section>
  <button class="floating-add"
          type="button"
          title="Nuevo movimiento"
          aria-label="Nuevo movimiento"
          @click="openExpense()"
  >
    <PhPlus :size="30" weight="bold" />
  </button>
</template>
