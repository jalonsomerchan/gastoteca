<script setup>
import { ref } from 'vue'
import ConfirmDialog from '../components/dialogs/ConfirmDialog.vue'
import { useDataEditor } from '../composables/useDataEditor.js'
import { useDataSearch } from '../composables/useDataSearch.js'
import DataEditorDialog from '../components/dialogs/DataEditorDialog.vue'
import DataSearch from '../components/forms/DataSearch.vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhPlus, PhWallet, PhMagnifyingGlass } from '@phosphor-icons/vue'

const {
  saving,
  error,
  group,
  budgetDraft,
  categories,
  budgetSummary,
  category,
  money,
  saveBudget,
  deleteBudget,
} = useGastotecaContext()
const deletingBudget = ref(null)
const editingBudget = ref(false)
const { search, filteredItems } = useDataSearch(() => group.value?.budgets, budget => budget.label || category(budget.category).label)
const { editorOpen, openEditor, closeEditor, submitEditor } = useDataEditor({
  reset(budget) {
    editingBudget.value = Boolean(budget)
    Object.assign(budgetDraft, {
      category: budget?.category || categories.value.find(item => !group.value?.budgets?.some(budget => budget.category === item.id))?.id || categories.value[0]?.id || 'food',
      monthly_limit: budget ? Number(budget.monthly_limit).toFixed(2) : '',
    })
  },
  save: saveBudget,
})
function selectBudgetCategory() {
  const budget = group.value?.budgets?.find(item => item.category === budgetDraft.category)
  budgetDraft.monthly_limit = budget ? Number(budget.monthly_limit).toFixed(2) : ''
}
async function confirmDeleteBudget() {
  await deleteBudget(deletingBudget.value.category)
  if (!error.value) deletingBudget.value = null
}
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        PLANIFICA EL MES
      </p><h1>Presupuestos</h1><p>Define cuánto queréis gastar en cada categoría y sigue el avance del mes.</p>
    </div>
    <button type="button" class="primary" :disabled="saving" @click="openEditor()"><PhPlus aria-hidden="true" :size="18" /> Nuevo presupuesto</button>
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
  <section class="feature-panel feature-list-panel budget-list-panel">
    <div class="feature-panel-heading">
      <div>
        <p class="eyebrow">
          SEGUIMIENTO MENSUAL
        </p><h2>Uso por categoría</h2>
      </div><span class="feature-count">{{ group?.budgets?.length || 0 }}</span>
    </div>
    <DataSearch id="budget-search" v-model="search" label="Buscar presupuestos" placeholder="Buscar por categoría…" :count="filteredItems.length" :total="group?.budgets?.length || 0" />
    <div v-if="filteredItems.length" class="budget-list">
      <article v-for="budget in filteredItems" :key="budget.category" class="budget-item">
        <div class="budget-item-heading">
          <span class="budget-category-icon" :style="{ color: category(budget.category).color, background: `${category(budget.category).color}18` }"><iconify-icon aria-hidden="true" :icon="category(budget.category).icon"></iconify-icon></span><div class="budget-category-copy">
            <strong>{{ budget.label || category(budget.category).label }}</strong><small>{{ money(budget.current_total) }} gastados de {{ money(budget.monthly_limit) }}</small>
          </div><strong class="budget-percent" :class="{ exceeded: Number(budget.current_total) > Number(budget.monthly_limit) }">{{ Math.round(Number(budget.current_total) / Math.max(0.01, Number(budget.monthly_limit)) * 100) }}%</strong>
        </div>
        <div class="budget-track" role="meter" aria-valuemin="0" :aria-valuemax="Number(budget.monthly_limit)" :aria-valuenow="Math.min(Number(budget.current_total), Number(budget.monthly_limit))" :aria-label="`Presupuesto de ${budget.label || category(budget.category).label}`" :aria-valuetext="`${money(budget.current_total)} gastados de ${money(budget.monthly_limit)}`">
          <span :class="{ exceeded: Number(budget.current_total) > Number(budget.monthly_limit) }" :style="{ width: `${Math.min(100, Number(budget.current_total) / Math.max(0.01, Number(budget.monthly_limit)) * 100)}%` }"></span>
        </div>
        <div class="budget-item-footer">
          <small>{{ Number(budget.current_total) > Number(budget.monthly_limit) ? `Te has pasado ${money(Number(budget.current_total) - Number(budget.monthly_limit))}` : `Quedan ${money(Number(budget.monthly_limit) - Number(budget.current_total))}` }}</small><div class="feature-row-actions">
            <button type="button" class="ghost small-action" :disabled="saving" @click="openEditor(budget)" :aria-label="`Editar presupuesto de ${budget.label || category(budget.category).label}`">
              Editar
            </button><button type="button" class="danger-button small-action" @click="error = ''; deletingBudget = budget" :disabled="saving" :aria-label="`Eliminar presupuesto de ${budget.label || category(budget.category).label}`">
              Eliminar
            </button>
          </div>
        </div>
      </article>
    </div>
    <div v-else-if="group?.budgets?.length" class="feature-empty">
      <PhMagnifyingGlass aria-hidden="true" :size="28" /><strong>No hay resultados para esta búsqueda</strong><p>Prueba con otra categoría o limpia la búsqueda.</p>
      <button type="button" class="secondary" @click="search = ''">Limpiar búsqueda</button>
    </div>
    <div v-else class="feature-empty">
      <PhWallet aria-hidden="true" :size="27" /><strong>Aún no hay presupuestos</strong><p>Crea el primero para controlar los gastos mensuales de una categoría.</p>
      <button type="button" class="secondary" :disabled="saving" @click="openEditor()">Crear presupuesto</button>
    </div>
  </section>
  <DataEditorDialog v-if="editorOpen" title-id="budget-editor-title" :title="editingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'" save-label="Guardar presupuesto" :saving="saving" :error="error" @close="closeEditor" @submit="submitEditor">
    <div class="data-editor-stack">
      <label class="data-editor-label"><span>Categoría *</span><select v-model="budgetDraft.category" :data-initial-focus="!editingBudget || undefined" :disabled="editingBudget" required @change="selectBudgetCategory">
        <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select></label>
      <label class="data-editor-label"><span>Límite mensual *</span><div class="money-input"><input id="budget-limit" v-model="budgetDraft.monthly_limit" :data-initial-focus="editingBudget || undefined" type="number" inputmode="decimal" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div></label>
      <p class="feature-hint">Si la categoría ya tiene un presupuesto, guardar actualizará su límite.</p>
    </div>
  </DataEditorDialog>
  <ConfirmDialog v-if="deletingBudget" title-id="budget-delete-title" title="Eliminar presupuesto" :saving="saving" :error="error" @cancel="deletingBudget = null" @confirm="confirmDeleteBudget">
    Se eliminará el límite de {{ deletingBudget.label || category(deletingBudget.category).label }}. Los movimientos se conservarán.
  </ConfirmDialog>
</template>
