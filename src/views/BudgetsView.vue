<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhPlus, PhWallet } from '@phosphor-icons/vue'

const {
  saving,
  group,
  budgetDraft,
  categories,
  budgetSummary,
  category,
  money,
  saveBudget,
  deleteBudget,
} = useGastotecaContext()
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        PLANIFICA EL MES
      </p><h1>Presupuestos</h1><p>Define cuánto queréis gastar en cada categoría y sigue el avance del mes.</p>
    </div>
  </section>
  <section class="budget-overview" aria-label="Resumen de presupuestos">
    <article class="budget-overview-card">
      <span>Categorías con límite</span><strong>{{ group?.budgets?.length || 0 }}</strong>
    </article>
    <article class="budget-overview-card">
      <span>Gastado este mes</span><strong>{{ money(budgetSummary.spent) }}</strong>
    </article>
    <article class="budget-overview-card">
      <span>Límite mensual total</span><strong>{{ money(budgetSummary.limit) }}</strong>
    </article>
  </section>
  <section class="feature-layout budget-page-layout">
    <form class="feature-panel feature-form budget-editor" @submit.prevent="saveBudget">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            {{ group?.budgets?.some((item) => item.category === budgetDraft.category) ? 'AJUSTA EL LÍMITE' : 'NUEVO PRESUPUESTO' }}
          </p><h2>Presupuesto por categoría</h2>
        </div>
      </div>
      <label><span>Categoría *</span><select v-model="budgetDraft.category" required @change="budgetDraft.monthly_limit = ''">
        <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select></label>
      <label><span>Límite mensual *</span><div class="money-input">
        <input v-model="budgetDraft.monthly_limit"
               type="number"
               min="0.01"
               max="99999999"
               step="0.01"
               placeholder="0,00"
               required
        /><b>€</b>
      </div></label>
      <p class="feature-hint">
        Si la categoría ya tiene un presupuesto, guardar actualizará su límite.
      </p>
      <div class="feature-form-actions">
        <button v-if="group?.budgets?.some((item) => item.category === budgetDraft.category)"
                type="button"
                class="ghost"
                @click="budgetDraft.monthly_limit = ''"
        >
          Limpiar
        </button><span v-else></span><button class="primary" :disabled="saving">
          <PhPlus :size="17" /> {{ saving ? 'Guardando…' : 'Guardar presupuesto' }}
        </button>
      </div>
    </form>
    <section class="feature-panel feature-list-panel budget-list-panel">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            SEGUIMIENTO MENSUAL
          </p><h2>Uso por categoría</h2>
        </div><span class="feature-count">{{ group?.budgets?.length || 0 }}</span>
      </div>
      <div v-if="group?.budgets?.length" class="budget-list">
        <article v-for="budget in group.budgets" :key="budget.category" class="budget-item">
          <div class="budget-item-heading">
            <span class="budget-category-icon" :style="{ color: category(budget.category).color, background: `${category(budget.category).color}18` }"><iconify-icon :icon="category(budget.category).icon"></iconify-icon></span><div class="budget-category-copy">
              <strong>{{ budget.label }}</strong><small>{{ money(budget.current_total) }} gastados de {{ money(budget.monthly_limit) }}</small>
            </div><strong class="budget-percent" :class="{ exceeded: Number(budget.current_total) > Number(budget.monthly_limit) }">{{ Math.round(Number(budget.current_total) / Math.max(0.01, Number(budget.monthly_limit)) * 100) }}%</strong>
          </div>
          <div class="budget-track">
            <span :class="{ exceeded: Number(budget.current_total) > Number(budget.monthly_limit) }" :style="{ width: `${Math.min(100, Number(budget.current_total) / Math.max(0.01, Number(budget.monthly_limit)) * 100)}%` }"></span>
          </div>
          <div class="budget-item-footer">
            <small>{{ Number(budget.current_total) > Number(budget.monthly_limit) ? `Te has pasado ${money(Number(budget.current_total) - Number(budget.monthly_limit))}` : `Quedan ${money(Number(budget.monthly_limit) - Number(budget.current_total))}` }}</small><div class="feature-row-actions">
              <button type="button" class="ghost small-action" @click="Object.assign(budgetDraft, { category: budget.category, monthly_limit: Number(budget.monthly_limit).toFixed(2) })">
                Editar
              </button><button type="button" class="danger-button small-action" @click="deleteBudget(budget.category)">
                Eliminar
              </button>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="feature-empty">
        <PhWallet :size="27" /><strong>Aún no hay presupuestos</strong><p>Crea el primero para controlar los gastos mensuales de una categoría.</p>
      </div>
    </section>
  </section>
</template>
