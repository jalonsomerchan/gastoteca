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
  loadMoreExpenses,
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
        <small>Ver desglose completo <PhArrowRight aria-hidden="true" :size="16" /></small>
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
      <span><PhFunnel aria-hidden="true" :size="18" /> Filtros <b v-if="activeFilterCount">{{ activeFilterCount }}</b></span>
      <PhCaretDown aria-hidden="true" :size="18" :class="{ rotated: filtersOpen }" />
    </button>
    <div v-if="filtersOpen" id="expense-filters" class="filter-content">
      <div class="filters">
        <label class="filter-field search-field" for="expense-search">
          <span>Buscar movimientos</span>
          <input id="expense-search" v-model="filters.search" type="search" placeholder="Nombre, lugar, ciudad o etiqueta" />
        </label>
        <label class="filter-field filter-field-category" for="expense-category">
          <span>Categoría</span>
          <select id="expense-category" v-model="filters.category">
            <option value="">Todas las categorías</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select>
        </label>
        <label class="filter-field" for="expense-from"><span>Desde</span><input id="expense-from" v-model="filters.from" type="date" :max="filters.to || undefined" /></label>
        <label class="filter-field" for="expense-to"><span>Hasta</span><input id="expense-to" v-model="filters.to" type="date" :min="filters.from || undefined" /></label>
      </div>
      <p v-if="filters.from && filters.to && filters.from > filters.to" class="filter-hint" role="alert">La fecha final debe ser igual o posterior a la inicial.</p>
      <button v-if="activeFilterCount"
              class="clear-filters"
              type="button"
              @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </div>
  </section>

  <div class="expense-list-heading">
    <h1>Movimientos</h1><span aria-hidden="true">{{ filteredExpenses.length }}</span>
  </div>
  <p class="result-summary" role="status" aria-live="polite" aria-atomic="true">{{ filteredExpenses.length }} {{ filteredExpenses.length === 1 ? 'movimiento encontrado' : 'movimientos encontrados' }} · Mostrando {{ visibleExpenses.length }}</p>
  <section v-if="filteredExpenses.length" class="expense-list" aria-label="Lista de movimientos">
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
         aria-label="Más movimientos"
    >
      <button type="button" class="secondary" @click="loadMoreExpenses">Mostrar más movimientos</button>
    </div>
  </section>
  <section v-else class="empty-state">
    <PhReceipt aria-hidden="true" :size="40" /><h2>{{ expenses.length ? 'No hay resultados' : 'Tu primer gasto empieza aquí' }}</h2><p>{{ expenses.length ? 'Prueba a cambiar los filtros.' : 'Pulsa el botón + para añadir una compra, una factura o una cena.' }}</p>
    <button type="button" class="primary" @click="expenses.length ? clearFilters() : openExpense()">{{ expenses.length ? 'Limpiar filtros' : 'Añadir el primer movimiento' }}</button>
  </section>
  <button class="floating-add"
          type="button"
          title="Nuevo movimiento"
          aria-label="Nuevo movimiento"
          @click="openExpense()"
  >
    <PhPlus aria-hidden="true" :size="30" weight="bold" />
  </button>
</template>
