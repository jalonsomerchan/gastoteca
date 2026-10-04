<script setup>
import { computed, ref, watch } from 'vue'
import { PhPlus, PhHandshake, PhMagnifyingGlass, PhPencilSimple } from '@phosphor-icons/vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { useDataEditor } from '../composables/useDataEditor.js'
import { useDataSearch } from '../composables/useDataSearch.js'
import DataEditorDialog from '../components/dialogs/DataEditorDialog.vue'
import ConfirmDialog from '../components/dialogs/ConfirmDialog.vue'
import DataSearch from '../components/forms/DataSearch.vue'

const {
  saving, error, dataEditorOpen, debts, debtDraft, pendingDebtTotal, debtStatuses, debtStatusLabel,
  memberOptions, memberLabel, money, startDebt, saveDebt, deleteDebt,
} = useGastotecaContext()

const statusFilter = ref('')
const deletingDebt = ref(null)
const personLabel = (debt, side) => memberOptions.value.some(member => member.uid === debt[`${side}_uid`])
  ? memberLabel(debt[`${side}_uid`]) : debt[`${side}_name`] || memberLabel(debt[`${side}_uid`])
const { search, filteredItems } = useDataSearch(debts, debt => `${debt.concept} ${personLabel(debt, 'source')} ${personLabel(debt, 'target')} ${debtStatusLabel(debt.status)}`)
const visibleDebts = computed(() => filteredItems.value.filter(debt => !statusFilter.value || debt.status === statusFilter.value))
const pendingCount = computed(() => debts.value.filter(debt => debt.status === 'pending').length)
const canCreate = computed(() => memberOptions.value.length >= 2)
const { editorOpen, openEditor, closeEditor, submitEditor } = useDataEditor({ reset: startDebt, save: saveDebt })
const editingDebt = computed(() => debts.value.find(debt => debt.id === debtDraft.id))
const departedPerson = side => editingDebt.value && !memberOptions.value.some(member => member.uid === editingDebt.value[`${side}_uid`])
watch(deletingDebt, debt => { dataEditorOpen.value = Boolean(debt) || editorOpen.value })

async function confirmDelete() {
  if (await deleteDebt(deletingDebt.value)) deletingDebt.value = null
}

function clearSearch() {
  search.value = ''
  statusFilter.value = ''
}
</script>

<template>
  <section class="page-heading debts-heading">
    <div>
      <p class="eyebrow">CUENTAS ENTRE PERSONAS</p>
      <h1>Deudas</h1>
      <p>Consulta quién debe, a quién hay que pagar y el estado de cada deuda.</p>
    </div>
    <button type="button" class="primary" :disabled="saving || !canCreate" @click="openEditor()"><PhPlus aria-hidden="true" :size="18" /> Nueva deuda</button>
  </section>
  <section class="debt-summary" aria-label="Resumen de deudas">
    <div><span>Importe pendiente</span><strong>{{ money(pendingDebtTotal) }}</strong></div>
    <div><span>Deudas pendientes</span><strong>{{ pendingCount }}</strong></div>
    <div><span>Total de deudas</span><strong>{{ debts.length }}</strong></div>
  </section>
  <section class="feature-panel debts-panel" aria-label="Listado de deudas">
    <DataSearch id="debt-search" v-model="search" label="Buscar deudas" placeholder="Buscar por concepto o persona…" :count="visibleDebts.length" :total="debts.length" />
    <label class="debt-status-filter" for="debt-status-filter"><span>Estado</span><select id="debt-status-filter" v-model="statusFilter">
      <option value="">Todos los estados</option>
      <option v-for="status in debtStatuses" :key="status.value" :value="status.value">{{ status.label }}</option>
    </select></label>
    <p v-if="!canCreate" class="debt-group-hint">Para crear una deuda necesitas al menos dos personas en el grupo. Añade miembros desde la página Grupo.</p>
    <div v-if="visibleDebts.length" class="debt-list">
      <article v-for="debt in visibleDebts" :key="debt.id" class="debt-item">
        <div class="debt-item-heading">
          <h2>{{ debt.concept }}</h2>
          <span class="debt-status" :class="`debt-status-${debt.status}`">{{ debtStatusLabel(debt.status) }}</span>
          <strong class="debt-amount">{{ money(debt.amount) }}</strong>
        </div>
        <dl class="debt-people">
          <div><dt>Origen · A quien pagar</dt><dd>{{ personLabel(debt, 'source') }}</dd></div>
          <div><dt>Destino · Quien debe</dt><dd>{{ personLabel(debt, 'target') }}</dd></div>
        </dl>
        <div class="feature-row-actions">
          <button type="button" class="ghost small-action" :disabled="saving" :aria-label="`Editar deuda: ${debt.concept}`" @click="openEditor(debt)"><PhPencilSimple aria-hidden="true" :size="15" /> Editar</button>
          <button type="button" class="danger-button small-action" :disabled="saving" :aria-label="`Eliminar deuda: ${debt.concept}`" @click="error = ''; deletingDebt = debt">Eliminar</button>
        </div>
      </article>
    </div>
    <div v-else-if="debts.length" class="feature-empty">
      <PhMagnifyingGlass aria-hidden="true" :size="28" /><strong>No hay deudas con estos filtros</strong><p>Prueba con otro concepto, persona o estado.</p>
      <button type="button" class="secondary" @click="clearSearch">Limpiar filtros</button>
    </div>
    <div v-else class="feature-empty">
      <PhHandshake aria-hidden="true" :size="28" /><strong>Aún no hay deudas</strong><p>Crea la primera para llevar un registro de los importes entre personas.</p>
      <button type="button" class="secondary" :disabled="saving || !canCreate" @click="openEditor()">Crear deuda</button>
    </div>
  </section>
  <DataEditorDialog v-if="editorOpen" title-id="debt-editor-title" :title="debtDraft.id ? 'Editar deuda' : 'Nueva deuda'" save-label="Guardar deuda" :saving="saving" :error="error" @close="closeEditor" @submit="submitEditor">
    <div class="data-editor-stack">
      <label class="data-editor-label" for="debt-concept"><span>Concepto *</span><input id="debt-concept" v-model="debtDraft.concept" data-initial-focus maxlength="160" placeholder="Por ejemplo: préstamo para el viaje" required /></label>
      <div class="feature-fields">
        <label class="data-editor-label" for="debt-status"><span>Estado *</span><select id="debt-status" v-model="debtDraft.status" required>
          <option v-for="status in debtStatuses" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select></label>
        <label class="data-editor-label" for="debt-amount"><span>Importe *</span><div class="money-input"><input id="debt-amount" v-model="debtDraft.amount" type="number" inputmode="decimal" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div></label>
      </div>
      <label class="data-editor-label" for="debt-source"><span>Persona origen · A quien hay que pagar *</span><select id="debt-source" v-model="debtDraft.source_uid" required>
        <option disabled value="">Selecciona una persona</option>
        <option v-if="departedPerson('source')" :value="editingDebt.source_uid">{{ personLabel(editingDebt, 'source') }} (ya no está en el grupo)</option>
        <option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option>
      </select></label>
      <label class="data-editor-label" for="debt-target"><span>Persona destino · Quien tiene la deuda *</span><select id="debt-target" v-model="debtDraft.target_uid" required>
        <option disabled value="">Selecciona una persona</option>
        <option v-if="departedPerson('target')" :value="editingDebt.target_uid">{{ personLabel(editingDebt, 'target') }} (ya no está en el grupo)</option>
        <option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option>
      </select></label>
    </div>
  </DataEditorDialog>
  <ConfirmDialog v-if="deletingDebt" title-id="debt-delete-title" title="Eliminar deuda" :saving="saving" :error="error" @cancel="deletingDebt = null" @confirm="confirmDelete">
    Se eliminará la deuda «{{ deletingDebt.concept }}» de {{ money(deletingDebt.amount) }}.
  </ConfirmDialog>
</template>
