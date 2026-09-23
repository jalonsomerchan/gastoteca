<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { postJson } from '../lib/api.js'
import { focusElement } from '../utils/focus.js'
import BaseDialog from '../components/dialogs/BaseDialog.vue'
import FormError from '../components/forms/FormError.vue'
import { PhCheck, PhFunnel, PhMagnifyingGlass, PhPencilSimple, PhPlus, PhTag, PhX } from '@phosphor-icons/vue'
import Multiselect from '@vueform/multiselect'

const {
  expenses,
  group,
  user,
  stats,
  notice,
  category,
  categoryOptions,
  memberLabel,
  money,
  dateLabel,
} = useGastotecaContext()

const filters = reactive({ search: '', category: '', transactionType: '', from: '', to: '' })
const selectedIds = ref([])
const bulkEditOpen = ref(false)
const bulkSaving = ref(false)
const bulkError = ref('')
const tagInput = ref('')
const addTags = ref([])
const removeTags = ref([])
const editDraft = reactive({ category: '', cityAction: 'unchanged', city: '', placeAction: 'unchanged', place: '' })

const cityOptions = computed(() => [...new Set([group.value?.default_city, ...expenses.value.map(expense => expense.city)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')))
const placeOptions = computed(() => [...new Set([...(group.value?.establishments || []).map(item => item.name), ...expenses.value.map(expense => expense.place)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')))
const filterCategoryOptions = computed(() => [{ value: '', label: 'Todas las categorías' }, ...categoryOptions.value])
const transactionTypeOptions = [
  { value: '', label: 'Gastos e ingresos' },
  { value: 'expense', label: 'Solo gastos' },
  { value: 'income', label: 'Solo ingresos' },
]
const cityActionOptions = [{ value: 'unchanged', label: 'No cambiar' }, { value: 'set', label: 'Cambiar ciudad' }]
const placeActionOptions = [{ value: 'unchanged', label: 'No cambiar' }, { value: 'set', label: 'Cambiar establecimiento' }]
const editCategoryOptions = computed(() => [{ value: '', label: 'No cambiar' }, ...categoryOptions.value])
const filteredExpenses = computed(() => {
  const term = filters.search.trim().toLocaleLowerCase('es')
  return expenses.value.filter(expense => {
    const searchable = [expense.name, expense.place, expense.city, expense.details, ...(expense.tags || [])].filter(Boolean).join(' ').toLocaleLowerCase('es')
    return (!term || searchable.includes(term)) &&
      (!filters.category || expense.category === filters.category) &&
      (!filters.transactionType || expense.transaction_type === filters.transactionType) &&
      (!filters.from || expense.occurred_at.slice(0, 10) >= filters.from) &&
      (!filters.to || expense.occurred_at.slice(0, 10) <= filters.to)
  })
})
const selectedExpenses = computed(() => expenses.value.filter(expense => selectedIds.value.includes(expense.id)))
const selectedCount = computed(() => selectedIds.value.length)
const visibleSelectedCount = computed(() => filteredExpenses.value.filter(expense => selectedIds.value.includes(expense.id)).length)
const allVisibleSelected = computed(() => Boolean(filteredExpenses.value.length) && visibleSelectedCount.value === filteredExpenses.value.length)
const allSelectedTags = computed(() => [...new Set(selectedExpenses.value.flatMap(expense => expense.tags || []))].sort((a, b) => a.localeCompare(b, 'es')))
const hasChanges = computed(() => Boolean(editDraft.category || editDraft.cityAction === 'set' || editDraft.placeAction === 'set' || addTags.value.length || removeTags.value.length))

function categoryLabel(expense) {
  return category(expense.category).label
}

function toggleSelected(id) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(selectedId => selectedId !== id)
    : [...selectedIds.value, id]
}

function toggleVisibleSelection() {
  const visibleIds = filteredExpenses.value.map(expense => expense.id)
  selectedIds.value = allVisibleSelected.value
    ? selectedIds.value.filter(id => !visibleIds.includes(id))
    : [...new Set([...selectedIds.value, ...visibleIds])]
}

function clearSelection() {
  selectedIds.value = []
}

function resetEditor() {
  Object.assign(editDraft, { category: '', cityAction: 'unchanged', city: '', placeAction: 'unchanged', place: '' })
  addTags.value = []
  removeTags.value = []
  tagInput.value = ''
  bulkError.value = ''
}

function openEditor(expenseId = null) {
  if (expenseId !== null && !selectedIds.value.includes(expenseId)) selectedIds.value = [expenseId]
  if (!selectedIds.value.length) return
  resetEditor()
  bulkEditOpen.value = true
  nextTick(() => focusElement('#bulk-category'))
}

function closeEditor() {
  if (bulkSaving.value) return
  bulkEditOpen.value = false
  bulkError.value = ''
}

function addBulkTag() {
  const tag = tagInput.value.trim().slice(0, 40)
  if (!tag || addTags.value.some(item => item.toLocaleLowerCase('es') === tag.toLocaleLowerCase('es'))) return
  addTags.value.push(tag)
  removeTags.value = removeTags.value.filter(item => item !== tag)
  tagInput.value = ''
}

function toggleRemoveTag(tag) {
  removeTags.value = removeTags.value.includes(tag)
    ? removeTags.value.filter(item => item !== tag)
    : [...removeTags.value, tag]
  addTags.value = addTags.value.filter(item => item !== tag)
}

function payloadFor(expense) {
  const selectedTags = [...new Set([...(expense.tags || []), ...addTags.value])].filter(tag => !removeTags.value.includes(tag))
  const participantUids = [...(expense.participant_uids || (expense.participants || []).map(participant => participant.uid))]
  const participantShares = Object.fromEntries((expense.participants || []).map(participant => [participant.uid, Number(participant.share_amount) || 0]))
  return {
    ...expense,
    id: expense.id,
    amount: Number(expense.amount).toFixed(2),
    occurred_at: (expense.occurred_at || '').replace(' ', 'T').slice(0, 16),
    category: editDraft.category || expense.category,
    city: editDraft.cityAction === 'set' ? editDraft.city.trim() : expense.city,
    place: editDraft.placeAction === 'set' ? editDraft.place.trim() : expense.place,
    tags: selectedTags,
    participant_uids: participantUids,
    participant_shares: participantShares,
    share_mode: 'amount',
    details: expense.details || '',
    payment_method: expense.payment_method || 'unspecified',
    paid_by_type: expense.paid_by_type || 'person',
    paid_by_uid: expense.paid_by_uid || '',
    applies_to_all: Boolean(expense.applies_to_all),
    is_quick: Boolean(expense.is_quick),
  }
}

async function saveBulkEdit() {
  if (bulkSaving.value || !selectedExpenses.value.length || !hasChanges.value) return
  bulkError.value = ''
  if (editDraft.cityAction === 'set' && !editDraft.city.trim()) {
    bulkError.value = 'Escribe la ciudad que quieres aplicar.'
    return
  }
  if (editDraft.placeAction === 'set' && !editDraft.place.trim()) {
    bulkError.value = 'Escribe el establecimiento que quieres aplicar.'
    return
  }

  bulkSaving.value = true
  const targets = selectedExpenses.value.map(expense => ({ ...expense, tags: [...(expense.tags || [])], participant_uids: [...(expense.participant_uids || [])], participants: [...(expense.participants || [])] }))
  let applied = 0
  try {
    const token = await user.value.getIdToken(true)
    for (const expense of targets) {
      const data = await postJson('gastoteca/save_expense', token, payloadFor(expense))
      if (data.expenses) expenses.value = data.expenses
      if (data.stats) stats.value = data.stats
      if (data.group) group.value = data.group
      applied += 1
    }
    notice.value = `${applied} ${applied === 1 ? 'movimiento actualizado' : 'movimientos actualizados'}.`
    selectedIds.value = []
    bulkEditOpen.value = false
  } catch (reason) {
    bulkError.value = applied ? `Se actualizaron ${applied} movimientos, pero el siguiente falló: ${reason.message}` : reason.message
  } finally {
    bulkSaving.value = false
  }
}
</script>

<template>
  <section class="page-heading bulk-edit-heading">
    <div>
      <p class="eyebrow">ORGANIZA TUS MOVIMIENTOS</p>
      <h1>Edición masiva</h1>
      <p>Selecciona varios movimientos y corrige categorías, etiquetas, ciudades o establecimientos de una sola vez.</p>
    </div>
    <button type="button" class="primary" :disabled="!selectedCount" @click="openEditor()">
      <PhPencilSimple aria-hidden="true" :size="18" /> Editar seleccionados <span v-if="selectedCount">({{ selectedCount }})</span>
    </button>
  </section>

  <section class="bulk-edit-panel">
    <div class="bulk-edit-toolbar">
      <label class="bulk-search" for="bulk-expense-search">
        <PhMagnifyingGlass aria-hidden="true" :size="18" />
        <span class="sr-only">Buscar movimientos</span>
        <input id="bulk-expense-search" v-model="filters.search" type="search" placeholder="Buscar por nombre, lugar, ciudad o etiqueta" />
      </label>
      <label><span class="sr-only">Filtrar por categoría</span><Multiselect v-model="filters.category" class="smart-select bulk-smart-select" :options="filterCategoryOptions" :can-clear="Boolean(filters.category)" :aria-label="'Filtrar por categoría'" /></label>
      <label><span class="sr-only">Filtrar por tipo</span><Multiselect v-model="filters.transactionType" class="smart-select bulk-smart-select" :options="transactionTypeOptions" :can-clear="Boolean(filters.transactionType)" :aria-label="'Filtrar por tipo'" /></label>
      <label><span class="sr-only">Filtrar desde</span><input v-model="filters.from" type="date" aria-label="Desde" /></label>
      <label><span class="sr-only">Filtrar hasta</span><input v-model="filters.to" type="date" aria-label="Hasta" /></label>
    </div>
    <div class="bulk-edit-actions">
      <span><PhFunnel aria-hidden="true" :size="16" /> {{ filteredExpenses.length }} movimientos visibles · {{ selectedCount }} seleccionados</span>
      <button type="button" class="ghost small-action" @click="toggleVisibleSelection">{{ allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles' }}</button>
      <button v-if="selectedCount" type="button" class="ghost small-action" @click="clearSelection">Limpiar selección</button>
    </div>
  </section>

  <section class="bulk-table-panel" aria-label="Movimientos para editar">
    <div v-if="filteredExpenses.length" class="bulk-table-scroll">
      <table class="bulk-table">
        <thead>
          <tr><th><input type="checkbox" :checked="allVisibleSelected" :aria-label="allVisibleSelected ? 'Quitar selección de movimientos visibles' : 'Seleccionar movimientos visibles'" @change="toggleVisibleSelection" /></th><th>Movimiento</th><th>Importe</th><th>Categoría</th><th>Etiquetas</th><th>Ubicación</th><th><span class="sr-only">Acciones</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="expense in filteredExpenses" :key="expense.id" :class="{ selected: selectedIds.includes(expense.id) }">
            <td data-label="Seleccionar"><input type="checkbox" :checked="selectedIds.includes(expense.id)" :aria-label="`Seleccionar ${expense.name}`" @change="toggleSelected(expense.id)" /></td>
            <td data-label="Movimiento"><strong>{{ expense.name }}</strong><small>{{ expense.transaction_type === 'income' ? 'Ingreso' : 'Gasto' }} · {{ dateLabel(expense.occurred_at) }} · {{ memberLabel(expense.paid_by_uid) }}</small></td>
            <td data-label="Importe" class="bulk-amount" :class="{ income: expense.transaction_type === 'income' }">{{ expense.transaction_type === 'income' ? '+' : '' }}{{ money(expense.amount) }}</td>
            <td data-label="Categoría"><span class="bulk-category-pill" :style="{ color: category(expense.category).color }">{{ categoryLabel(expense) }}</span></td>
            <td data-label="Etiquetas"><span v-if="expense.tags?.length" class="bulk-tags"><em v-for="tag in expense.tags" :key="tag">{{ tag }}</em></span><span v-else class="bulk-muted">Sin etiquetas</span></td>
            <td data-label="Ubicación"><span class="bulk-location">{{ expense.place || 'Sin establecimiento' }}<small>{{ expense.city || 'Sin ciudad' }}</small></span></td>
            <td class="bulk-row-action"><button type="button" class="ghost small-action" @click="openEditor(expense.id)"><PhPencilSimple aria-hidden="true" :size="15" /> Editar</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="bulk-empty">
      <PhMagnifyingGlass aria-hidden="true" :size="34" /><strong>No hay movimientos con estos filtros</strong><p>Prueba a cambiar la búsqueda o los filtros.</p>
    </div>
  </section>

  <BaseDialog v-if="bulkEditOpen" labelled-by="bulk-edit-title" :busy="bulkSaving" @close="closeEditor">
    <section class="modal bulk-edit-modal">
      <header><div><p class="eyebrow">EDICIÓN MASIVA</p><h2 id="bulk-edit-title">Editar {{ selectedCount }} movimientos</h2></div><button type="button" class="icon-button" aria-label="Cerrar diálogo" :disabled="bulkSaving" @click="closeEditor"><PhX aria-hidden="true" :size="21" /></button></header>
      <form :aria-busy="bulkSaving" @submit.prevent="saveBulkEdit">
        <p class="bulk-modal-intro">Solo se modificarán los campos que elijas. El resto de datos se conserva.</p>
        <FormError :message="bulkError" />
        <fieldset class="bulk-modal-fieldset">
          <legend>Datos del movimiento</legend>
          <div class="bulk-modal-fields">
            <label><span>Categoría</span><Multiselect id="bulk-category" v-model="editDraft.category" class="smart-select bulk-smart-select" :options="editCategoryOptions" :can-clear="Boolean(editDraft.category)" aria-label="Categoría a aplicar" /></label>
            <label><span>Ciudad</span><Multiselect v-model="editDraft.cityAction" class="smart-select bulk-smart-select" :options="cityActionOptions" :can-clear="false" aria-label="Acción para la ciudad" /></label>
            <label v-if="editDraft.cityAction === 'set'" class="bulk-field-wide"><span>Nueva ciudad</span><Multiselect v-model="editDraft.city" class="smart-select bulk-smart-select" :options="cityOptions" searchable create-option allow-absent :can-clear="false" placeholder="Escribe o elige una ciudad" aria-label="Nueva ciudad" /></label>
            <label><span>Establecimiento</span><Multiselect v-model="editDraft.placeAction" class="smart-select bulk-smart-select" :options="placeActionOptions" :can-clear="false" aria-label="Acción para el establecimiento" /></label>
            <label v-if="editDraft.placeAction === 'set'" class="bulk-field-wide"><span>Nuevo establecimiento</span><Multiselect v-model="editDraft.place" class="smart-select bulk-smart-select" :options="placeOptions" searchable create-option allow-absent :can-clear="false" placeholder="Escribe o elige un establecimiento" aria-label="Nuevo establecimiento" /></label>
          </div>
        </fieldset>
        <fieldset class="bulk-modal-fieldset">
          <legend>Etiquetas</legend>
          <div class="bulk-tag-entry"><input v-model="tagInput" maxlength="40" placeholder="Añadir una etiqueta" @keydown.enter.prevent="addBulkTag" /><button type="button" class="secondary" :disabled="!tagInput.trim()" @click="addBulkTag"><PhPlus aria-hidden="true" :size="16" /> Añadir</button></div>
          <div v-if="addTags.length" class="bulk-tag-chips"><button v-for="tag in addTags" :key="`add-${tag}`" type="button" class="bulk-tag-chip added" @click="addTags = addTags.filter(item => item !== tag)">+ {{ tag }} <PhX aria-hidden="true" :size="13" /></button></div>
          <p class="bulk-modal-hint"><PhTag aria-hidden="true" :size="15" /> Marca las etiquetas que quieres quitar de los movimientos seleccionados.</p>
          <div v-if="allSelectedTags.length" class="bulk-tag-chips"><button v-for="tag in allSelectedTags" :key="`remove-${tag}`" type="button" class="bulk-tag-chip" :class="{ removed: removeTags.includes(tag) }" :aria-pressed="removeTags.includes(tag)" @click="toggleRemoveTag(tag)">{{ removeTags.includes(tag) ? 'Quitar' : 'Conservar' }}: {{ tag }}</button></div>
          <p v-else class="bulk-modal-hint">Los movimientos seleccionados no tienen etiquetas todavía.</p>
        </fieldset>
        <footer><button type="button" class="ghost" :disabled="bulkSaving" @click="closeEditor">Cancelar</button><button class="primary" :disabled="bulkSaving || !hasChanges"><PhCheck aria-hidden="true" :size="17" /> {{ bulkSaving ? 'Aplicando…' : `Aplicar cambios a ${selectedCount}` }}</button></footer>
      </form>
    </section>
  </BaseDialog>
</template>
