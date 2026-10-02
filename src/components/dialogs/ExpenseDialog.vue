<script setup>
import { computed, watch } from 'vue'
import { focusElement } from '../../utils/focus.js'
import FormError from '../forms/FormError.vue'
import BaseDialog from './BaseDialog.vue'
import { normalizeName } from '../../utils/formatters.js'
import { syncTypedOption } from '../../utils/selects.js'
import { useGastotecaContext } from '../../composables/gastotecaContext.js'
import { PhX, PhClockCounterClockwise, PhCheck, PhArrowDown, PhArrowUp, PhLightning, PhCrosshair, PhArrowRight, PhCaretUpDown, PhTrash } from '@phosphor-icons/vue'
import Multiselect from '@vueform/multiselect'

const {
  saving,
  error,
  user,
  modalOpen,
  quickExpenseMode,
  quickAmount,
  quickAmountInput,
  quickExpenseTemplates,
  quickTemplateEditorOpen,
  quickTemplatePromptOpen,
  quickTemplateDraft,
  quickTemplatePrompt,
  tagInput,
  deleteTarget,
  expenseHistoryForId,
  expenseHistoryEntries,
  expenseHistoryLoading,
  detectingCity,
  locationStatus,
  paymentMethods,
  draft,
  memberOptions,
  categoryOptions,
  tagOptions,
  splitMembers,
  cityOptions,
  establishmentOptions,
  frequentNames,
  frequentEstablishments,
  frequentCities,
  money,
  dateLabel,
  detectCurrentCity,
  closeExpenseModal,
  loadExpenseHistory,
  historyChangeEntries,
  historyValue,
  startQuickExpense,
  saveQuickExpense,
  saveQuickExpenseTemplate,
  cancelQuickTemplateEditor,
  applyQuickExpenseTemplate,
  saveQuickExpenseTemplatePrompt,
  openIconPicker,
  selectFrequentName,
  setShareMode,
  shareValue,
  addDraftTag,
  saveExpense,
  confirmExpense,
} = useGastotecaContext()
const activeQuickExpenseTemplates = computed(() => quickExpenseTemplates.value
  .map((template, index) => ({ template, index, order: template.sort_order === undefined ? index : Number(template.sort_order) }))
  .filter(item => item.template.active !== false)
  .sort((a, b) => a.order - b.order || a.index - b.index)
  .map(item => item.template))
const splitTotal = computed(() => splitMembers.value.reduce((total, member) => total + (Number(draft.participant_shares[member.uid]) || 0), 0))
const splitTarget = computed(() => draft.share_mode === 'percent' ? 100 : Number(draft.amount) || 0)
const payerChoice = computed({
  get: () => draft.paid_by_type === 'all' ? 'all' : draft.paid_by_uid,
  set: value => {
    draft.paid_by_type = value === 'all' ? 'all' : 'person'
    if (value !== 'all') draft.paid_by_uid = value
  },
})
const quickTemplatePayerChoice = computed({
  get: () => quickTemplateDraft.paid_by_type === 'all' ? 'all' : quickTemplateDraft.paid_by_uid,
  set: value => {
    quickTemplateDraft.paid_by_type = value === 'all' ? 'all' : 'person'
    quickTemplateDraft.paid_by_uid = value === 'all' ? '' : value
  },
})
const quickTemplatePromptPayerChoice = computed({
  get: () => quickTemplatePrompt.paid_by_type === 'all' ? 'all' : quickTemplatePrompt.paid_by_uid,
  set: value => {
    quickTemplatePrompt.paid_by_type = value === 'all' ? 'all' : 'person'
    quickTemplatePrompt.paid_by_uid = value === 'all' ? '' : value
  },
})

function participantSelected(uid) {
  return draft.applies_to_all || draft.participant_uids.includes(uid)
}

function toggleParticipant(uid) {
  const selected = new Set(draft.applies_to_all ? memberOptions.value.map(member => member.uid) : draft.participant_uids)
  if (selected.has(uid)) selected.delete(uid)
  else selected.add(uid)
  const selectedUids = memberOptions.value.map(member => member.uid).filter(memberUid => selected.has(memberUid))
  draft.applies_to_all = selectedUids.length === memberOptions.value.length
  draft.participant_uids = draft.applies_to_all ? [] : selectedUids
}

function templateParticipantSelected(uid) {
  return quickTemplateDraft.applies_to_all || quickTemplateDraft.participant_uids.includes(uid)
}

function toggleTemplateParticipant(uid) {
  const selected = new Set(quickTemplateDraft.applies_to_all ? memberOptions.value.map(member => member.uid) : quickTemplateDraft.participant_uids)
  if (selected.has(uid)) selected.delete(uid)
  else selected.add(uid)
  const selectedUids = memberOptions.value.map(member => member.uid).filter(memberUid => selected.has(memberUid))
  quickTemplateDraft.applies_to_all = selectedUids.length === memberOptions.value.length
  quickTemplateDraft.participant_uids = quickTemplateDraft.applies_to_all ? [] : selectedUids
}

function quickTemplateHint(template) {
  const fields = new Set(template.fields || [])
  if (!fields.has('name')) return 'Completar en el formulario'
  const prompts = []
  if (!fields.has('amount')) prompts.push('importe')
  if (!fields.has('paid_by_type')) prompts.push('quién paga')
  if (prompts.length) return `Pedir ${prompts.join(' y ')}`
  if (fields.has('amount')) return `${money(template.amount)} · Guardar con un toque`
  return 'Completar los datos que faltan'
}

function equalShare(member) {
  const index = splitMembers.value.findIndex(item => item.uid === member.uid)
  return money(shareValue(member, index))
}

watch(() => draft.transaction_type, type => {
  if (modalOpen.value && type) focusElement('#expense-name')
})
watch(() => quickTemplateEditorOpen.value, isOpen => {
  if (isOpen) focusElement('.quick-template-title input')
  else if (modalOpen.value) focusElement('#expense-title')
})
watch(() => quickTemplatePromptOpen.value, isOpen => {
  if (isOpen) focusElement(quickTemplatePrompt.askAmount ? '#quick-template-prompt-amount' : '#quick-template-prompt-payer')
  else if (modalOpen.value) focusElement('#expense-title')
})
</script>

<template>
  <BaseDialog v-if="modalOpen" labelled-by="expense-title" :busy="saving" @close="closeExpenseModal">
    <section class="modal"
    >
      <header>
        <p id="expense-title" tabindex="-1" data-initial-focus class="eyebrow modal-title">
          {{ quickExpenseMode ? 'Gasto rápido' : quickTemplatePromptOpen ? quickTemplatePrompt.title : quickTemplateEditorOpen ? 'Configurar gasto rápido' : draft.id ? 'Editar movimiento' : draft.transaction_type ? (draft.transaction_type === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto') : 'Nuevo movimiento' }}
        </p><button class="icon-button" aria-label="Cerrar diálogo" :disabled="saving" @click="closeExpenseModal">
          <PhX aria-hidden="true" :size="22" />
        </button>
      </header>
      <FormError :message="error" />
      <div v-if="draft.id && !quickExpenseMode" class="expense-history-toolbar">
        <span>Consulta quién modificó este movimiento y qué cambió.</span>
        <button type="button"
                class="secondary"
                :disabled="expenseHistoryLoading"
                @click="loadExpenseHistory(draft.id)"
        >
          <PhClockCounterClockwise aria-hidden="true" :size="17" /> {{ expenseHistoryLoading ? 'Cargando…' : expenseHistoryForId === Number(draft.id) ? 'Actualizar historial' : 'Ver historial' }}
        </button>
      </div>
      <form :aria-busy="saving" v-if="quickExpenseMode" @submit.prevent="saveQuickExpense">
        <div class="quick-entry">
          <label for="quick-amount">
            <span>¿Cuánto has gastado? *</span><div class="money-input">
              <input id="quick-amount"
                     ref="quickAmountInput"
                     v-model="quickAmount"
                     type="number"
                     inputmode="decimal"
                     enterkeyhint="done"
                     min="0.01"
                     max="99999999"
                     step="0.01"
                     placeholder="0,00"
                     autofocus
                     required
              /><b>€</b>
            </div><small>El gasto quedará guardado para que completes los detalles más tarde.</small>
          </label>
        </div>
        <footer>
          <button type="button" class="ghost" @click="quickExpenseMode = false; focusElement('#expense-title')" :disabled="saving">
            Volver
          </button><button class="primary" :disabled="saving">
            <PhCheck aria-hidden="true" :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar gasto' }}
          </button>
        </footer>
      </form>
      <section v-else-if="quickTemplatePromptOpen" class="quick-template-prompt">
        <p class="quick-template-intro">Completa lo que falta para guardar este gasto rápido.</p>
        <label v-if="quickTemplatePrompt.askAmount" for="quick-template-prompt-amount" class="quick-template-prompt-field">
          <span>Importe *</span><div class="money-input"><input id="quick-template-prompt-amount" v-model="quickTemplatePrompt.amount" type="number" inputmode="decimal" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div>
        </label>
        <label v-if="quickTemplatePrompt.askPayer" for="quick-template-prompt-payer" class="quick-template-prompt-field">
          <span>¿Quién ha pagado? *</span><select id="quick-template-prompt-payer" v-model="quickTemplatePromptPayerChoice" required><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option><option value="all">Entre todos</option></select>
        </label>
        <p class="quick-template-prompt-note">El resto de los datos configurados se añadirá automáticamente.</p>
        <footer>
          <button type="button" class="ghost" :disabled="saving" @click="quickTemplatePromptOpen = false">Volver</button>
          <button type="button" class="primary" :disabled="saving" @click="saveQuickExpenseTemplatePrompt"><PhCheck aria-hidden="true" :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Añadir gasto' }}</button>
        </footer>
      </section>
      <section v-else-if="quickTemplateEditorOpen" class="quick-template-editor">
        <p class="quick-template-intro">Elige qué datos se rellenarán automáticamente. Si incluyes nombre e importe, podrás guardar el gasto con un toque.</p>
        <label class="quick-template-title">
          <span>Nombre del botón *</span><input v-model="quickTemplateDraft.title" maxlength="60" placeholder="Café, compra semanal…" required />
        </label>
        <label class="quick-template-title" for="quick-template-visibility">
          <span>¿Quién puede usar este gasto rápido?</span>
          <select id="quick-template-visibility" v-model="quickTemplateDraft.visibility" :disabled="saving" aria-describedby="quick-template-visibility-hint">
            <option value="private">Solo para mí</option>
            <option value="group">Todo el grupo</option>
          </select>
          <small id="quick-template-visibility-hint">{{ quickTemplateDraft.visibility === 'group' ? 'Todos los miembros podrán usar esta plantilla. Tú podrás editarla o dejar de compartirla.' : 'Esta plantilla solo aparecerá en tus gastos rápidos.' }}</small>
        </label>
        <div class="quick-template-icon-setting">
          <span class="quick-template-icon-preview"><iconify-icon aria-hidden="true" :icon="quickTemplateDraft.icon || 'mdi:lightning-bolt-outline'"></iconify-icon></span>
          <button type="button" class="secondary" @click="openIconPicker(quickTemplateDraft)">Elegir icono</button>
          <small>Se mostrará junto al nombre del gasto rápido.</small>
        </div>
        <fieldset class="quick-template-settings">
          <legend>Campos que se guardan automáticamente</legend>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="name" /> Nombre del gasto</label>
            <input v-model="quickTemplateDraft.name" :disabled="!quickTemplateDraft.fields.includes('name')" maxlength="160" placeholder="Comida, billete, café…" aria-label="Nombre del gasto rápido" />
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="amount" /> Importe</label>
            <div class="money-input"><input v-model="quickTemplateDraft.amount" :disabled="!quickTemplateDraft.fields.includes('amount')" type="number" min="0.01" max="99999999" step="0.01" placeholder="Preguntar al usarlo" aria-label="Importe del gasto rápido" /><b>€</b></div>
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="category" /> Categoría</label>
            <Multiselect id="quick-template-category-select" v-model="quickTemplateDraft.category"
                         class="smart-select"
                         :options="categoryOptions"
                         :disabled="!quickTemplateDraft.fields.includes('category')"
                         searchable
                         create-option
                         allow-absent
                         @search-change="query => syncTypedOption(quickTemplateDraft, 'category', query, categoryOptions)"
                         :can-clear="false"
                         :aria="{ 'aria-label': 'Categoría del gasto rápido' }"
                         placeholder="Busca o crea una categoría"
                         no-options-text="Escribe una categoría nueva"
                         no-results-text="Se guardará al guardar la plantilla"
            />
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="place" /> Establecimiento</label>
            <Multiselect id="quick-template-place-select" v-model="quickTemplateDraft.place"
                         class="smart-select"
                         :options="establishmentOptions"
                         :disabled="!quickTemplateDraft.fields.includes('place')"
                         searchable
                         create-option
                         allow-absent
                         @search-change="query => syncTypedOption(quickTemplateDraft, 'place', query, establishmentOptions)"
                         :can-clear="Boolean(quickTemplateDraft.place)"
                         :aria="{ 'aria-label': 'Establecimiento del gasto rápido' }"
                         placeholder="Busca o escribe un establecimiento"
                         no-options-text="Escribe un establecimiento nuevo"
                         no-results-text="Se guardará al guardar la plantilla"
            />
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="city" /> Ciudad</label>
            <Multiselect id="quick-template-city-select" v-model="quickTemplateDraft.city"
                         class="smart-select"
                         :options="cityOptions"
                         :disabled="!quickTemplateDraft.fields.includes('city')"
                         searchable
                         create-option
                         allow-absent
                         @search-change="query => syncTypedOption(quickTemplateDraft, 'city', query, cityOptions)"
                         :can-clear="Boolean(quickTemplateDraft.city)"
                         :aria="{ 'aria-label': 'Ciudad del gasto rápido' }"
                         placeholder="Busca o escribe una ciudad"
                         no-options-text="Escribe una ciudad nueva"
                         no-results-text="Se guardará al guardar la plantilla"
            />
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="occurred_at" /> Fecha y hora</label>
            <input v-model="quickTemplateDraft.occurred_at" :disabled="!quickTemplateDraft.fields.includes('occurred_at')" type="datetime-local" aria-label="Fecha y hora del gasto rápido" />
            <small v-if="quickTemplateDraft.fields.includes('occurred_at')">Déjalo vacío para usar el momento en que añadas el gasto.</small>
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="paid_by_type" /> Quién paga</label>
            <select v-model="quickTemplatePayerChoice" :disabled="!quickTemplateDraft.fields.includes('paid_by_type')" aria-label="Persona que paga el gasto rápido"><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option><option value="all">Entre todos</option></select>
          </div>
          <div class="quick-template-setting quick-template-participants">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="participants" /> Reparto entre</label>
            <label class="template-all-members"><input v-model="quickTemplateDraft.applies_to_all" :disabled="!quickTemplateDraft.fields.includes('participants')" type="checkbox" /> Todo el grupo</label>
            <div v-if="!quickTemplateDraft.applies_to_all" class="template-member-list">
              <label v-for="member in memberOptions" :key="member.uid"><input type="checkbox" :checked="templateParticipantSelected(member.uid)" :disabled="!quickTemplateDraft.fields.includes('participants')" @change="toggleTemplateParticipant(member.uid)" />{{ member.name || member.email }}</label>
            </div>
            <select v-model="quickTemplateDraft.share_mode" :disabled="!quickTemplateDraft.fields.includes('participants')" aria-label="Modo de reparto"><option value="equal">Dividir igualmente</option><option value="amount">Por cantidades</option><option value="percent">Por porcentajes</option></select>
            <div v-if="quickTemplateDraft.fields.includes('participants') && quickTemplateDraft.share_mode !== 'equal'" class="template-share-values">
              <label v-for="member in memberOptions.filter(item => quickTemplateDraft.applies_to_all || quickTemplateDraft.participant_uids.includes(item.uid))" :key="member.uid">{{ member.name || member.email }}<input v-model="quickTemplateDraft.participant_shares[member.uid]" type="number" min="0" step="0.01" :aria-label="`Parte de ${member.name || member.email}`" /></label>
              <small>Las cantidades o porcentajes deben sumar el total o el 100 % al guardar.</small>
            </div>
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="payment_method" /> Método de pago</label>
            <select v-model="quickTemplateDraft.payment_method" :disabled="!quickTemplateDraft.fields.includes('payment_method')" aria-label="Método de pago del gasto rápido"><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option></select>
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="details" /> Detalles</label>
            <textarea v-model="quickTemplateDraft.details" :disabled="!quickTemplateDraft.fields.includes('details')" maxlength="1000" rows="2" placeholder="Notas que se añadirán al gasto" aria-label="Detalles del gasto rápido"></textarea>
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="tags" /> Etiquetas</label>
            <input v-model="quickTemplateDraft.tags_text" :disabled="!quickTemplateDraft.fields.includes('tags')" maxlength="420" placeholder="Separadas por comas" aria-label="Etiquetas del gasto rápido" />
          </div>
          <div class="quick-template-setting">
            <label><input v-model="quickTemplateDraft.fields" type="checkbox" value="recurrence" /> Repetir automáticamente</label>
            <select v-model="quickTemplateDraft.recurrence" :disabled="!quickTemplateDraft.fields.includes('recurrence')" aria-label="Frecuencia del gasto rápido"><option value="none">No repetir</option><option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select>
          </div>
        </fieldset>
        <footer>
          <button type="button" class="ghost" :disabled="saving" @click="cancelQuickTemplateEditor">Cancelar</button>
          <button type="button" class="primary" :disabled="saving" @click="saveQuickExpenseTemplate"><PhCheck aria-hidden="true" :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar gasto rápido' }}</button>
        </footer>
      </section>
      <form :aria-busy="saving" v-else @submit.prevent="saveExpense">
        <fieldset v-if="!draft.id && !draft.transaction_type" class="transaction-type" aria-label="Tipo de movimiento">
          <div class="choice-grid transaction-options">
            <label :class="{ selected: draft.transaction_type === 'expense' }">
              <input v-model="draft.transaction_type"
                     type="radio" name="draft-transaction_type"
                     value="expense"
                     required
              /><PhArrowDown aria-hidden="true" :size="22" /><span><strong>Gasto</strong><small>Dinero que ha salido</small></span>
            </label><label :class="{ selected: draft.transaction_type === 'income' }">
              <input v-model="draft.transaction_type"
                     type="radio" name="draft-transaction_type"
                     value="income"
                     required
              /><PhArrowUp aria-hidden="true" :size="22" /><span><strong>Ingreso</strong><small>Dinero que ha entrado</small></span>
            </label><button type="button" class="quick-expense-choice" @click="startQuickExpense">
              <PhLightning aria-hidden="true" :size="22" weight="fill" /><span><strong>Gasto rápido</strong></span>
            </button>
            <p class="quick-expense-section-label saved-quick-expenses-label">Plantillas</p>
            <p v-if="!activeQuickExpenseTemplates.length" class="quick-template-empty-hint">{{ quickExpenseTemplates.length ? 'No hay plantillas activas.' : 'Aún no tienes plantillas.' }}</p>
            <div v-else class="saved-quick-expenses-grid">
              <button v-for="template in activeQuickExpenseTemplates" :key="`${template.created_by || user?.uid}:${template.id}`" type="button" class="quick-expense-choice saved-quick-expense" :title="`${template.title} · ${quickTemplateHint(template)}`" :disabled="saving" @click="applyQuickExpenseTemplate(template)">
                <iconify-icon aria-hidden="true" :icon="template.icon || 'mdi:lightning-bolt-outline'"></iconify-icon><span class="saved-quick-expense-copy"><strong class="saved-quick-expense-name">{{ template.title }}</strong><span v-if="template.fields?.includes('amount') && Number(template.amount) > 0" class="saved-quick-expense-amount">{{ money(template.amount) }}</span></span>
              </button>
            </div>
          </div>
        </fieldset>
        <template v-if="draft.transaction_type">
          <aside v-if="draft.confirmation_pending" class="quick-edit-notice confirmation-needed-notice">
            <PhClockCounterClockwise aria-hidden="true" :size="18" /><span><strong>Pendiente de confirmar</strong><small>Solo tú puedes verlo. Al confirmarlo, se compartirá con el grupo.</small></span>
          </aside>
          <aside v-if="draft.is_quick" class="quick-edit-notice">
            <PhLightning aria-hidden="true" :size="18" weight="fill" /><span><strong>Gasto rápido pendiente</strong><small>El importe ya está guardado. Añade un nombre más descriptivo y los datos que quieras.</small></span>
          </aside>
          <div class="form-grid">
            <label class="full name-field">
              <span>Nombre del {{ draft.transaction_type === 'income' ? 'ingreso' : 'gasto' }} *</span><input id="expense-name" v-model="draft.name" :aria-label="draft.transaction_type === 'income' ? 'Nombre del ingreso' : 'Nombre del gasto'"
                                                                                                              maxlength="160"
                                                                                                              :placeholder="draft.transaction_type === 'income' ? 'Nómina, reembolso, venta…' : 'Cena, compra semanal, gasolina…'"
                                                                                                              :autofocus="!draft.id"
                                                                                                              required
              /><span class="frequent-names"><button v-for="suggestion in frequentNames"
                                                     :key="suggestion.name"
                                                     type="button"
                                                     :class="{ active: normalizeName(draft.name) === normalizeName(suggestion.name) }"
                                                     @click="selectFrequentName(suggestion)"
              >{{ suggestion.name }}<small v-if="suggestion.count">{{ suggestion.count }}</small></button></span>
            </label>
            <label class="full">
              <span>Importe *</span><div class="money-input">
                <input v-model="draft.amount"
                       type="number"
                       inputmode="decimal"
                       enterkeyhint="done"
                       min="0.01"
                       max="99999999"
                       step="0.01"
                       placeholder="0,00"
                       required
                /><b>€</b>
              </div>
            </label>
            <label><span id="expense-category-label">Categoría</span><Multiselect id="expense-category-select" v-model="draft.category"
                                                      class="smart-select"
                                                      :options="categoryOptions"
                                                      searchable
                                                      create-option
                                                      allow-absent
                                                      @search-change="query => syncTypedOption(draft, 'category', query, categoryOptions)"
                                                      :can-clear="false"
                                                      :aria="{ 'aria-label': 'Categoría', 'aria-labelledby': 'expense-category-label' }"
                                                      placeholder="Busca o crea una categoría"
                                                      no-options-text="Escribe una categoría nueva"
                                                      no-results-text="Se añadirá al guardar"
            >
              <template #clear="{ clear }"><button type="button" class="accessible-select-clear" aria-label="Borrar categoría" @mousedown.prevent @click.stop="clear"><PhX aria-hidden="true" :size="18" /></button></template>
            </Multiselect></label>
            <label><span id="expense-place-label">Establecimiento</span><Multiselect id="expense-place-select" v-model="draft.place"
                                                            class="smart-select"
                                                            :options="establishmentOptions"
                                                            searchable
                                                            create-option
                                                            allow-absent
                                                            @search-change="query => syncTypedOption(draft, 'place', query, establishmentOptions)"
                                                            :can-clear="Boolean(draft.place)"
                                                            :aria="{ 'aria-label': 'Establecimiento', 'aria-labelledby': 'expense-place-label' }"
                                                            placeholder="Busca o escribe un establecimiento"
                                                            no-options-text="Escribe un establecimiento nuevo"
                                                            no-results-text="Se añadirá al guardar"
            >
              <template #clear="{ clear }"><button type="button" class="accessible-select-clear" aria-label="Borrar establecimiento" @mousedown.prevent @click.stop="clear"><PhX aria-hidden="true" :size="18" /></button></template>
            </Multiselect><template v-if="frequentEstablishments.length">
              <span class="frequent-names"><button v-for="item in frequentEstablishments"
                                                   :key="item.value"
                                                   type="button"
                                                   :class="{ active: normalizeName(draft.place || '') === normalizeName(item.value) }"
                                                   @click="draft.place = item.value"
              >{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span>
            </template></label>
            <label><span id="expense-city-label">Ciudad</span><Multiselect id="expense-city-select" v-model="draft.city"
                                                   class="smart-select"
                                                   :options="cityOptions"
                                                   searchable
                                                   create-option
                                                   allow-absent
                                                   @search-change="query => syncTypedOption(draft, 'city', query, cityOptions)"
                                                   :can-clear="Boolean(draft.city)"
                                                   :aria="{ 'aria-label': 'Ciudad', 'aria-labelledby': 'expense-city-label' }"
                                                   placeholder="Busca o escribe una ciudad"
                                                   no-options-text="Escribe una ciudad nueva"
                                                   no-results-text="Se añadirá al guardar"
            >
              <template #clear="{ clear }"><button type="button" class="accessible-select-clear" aria-label="Borrar ciudad" @mousedown.prevent @click.stop="clear"><PhX aria-hidden="true" :size="18" /></button></template>
            </Multiselect><template v-if="frequentCities.length">
              <span class="frequent-names"><button v-for="item in frequentCities"
                                                   :key="item.value"
                                                   type="button"
                                                   :class="{ active: normalizeName(draft.city || '') === normalizeName(item.value) }"
                                                   @click="draft.city = item.value"
              >{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span>
            </template><span class="location-status"><small>{{ locationStatus }}</small><button type="button" :disabled="detectingCity" @click="detectCurrentCity"><PhCrosshair aria-hidden="true" :size="14" /> {{ detectingCity ? 'Detectando…' : 'Usar mi ubicación' }}</button></span></label>
          </div>
          <div class="expense-quick-fields" aria-label="Datos principales del movimiento">
            <label class="quick-field">
              <span>{{ draft.transaction_type === 'income' ? 'Recibido por' : 'Pagado por' }}</span>
              <span class="select-shell">
                <select v-model="payerChoice" aria-label="Persona que paga o recibe" required>
                  <option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option>
                  <option value="all">Entre todos</option>
                </select><PhCaretUpDown aria-hidden="true" :size="20" />
              </span>
            </label>
            <label class="quick-field">
              <span>Método de pago</span>
              <span class="select-shell">
                <select v-model="draft.payment_method" aria-label="Método de pago">
                  <option v-if="draft.payment_method === 'unspecified'" value="unspecified">Sin especificar</option><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option>
                </select><PhCaretUpDown aria-hidden="true" :size="20" />
              </span>
            </label>
          </div>
          <fieldset class="split-fieldset">
            <div class="split-heading"><legend>Dividir</legend><label class="split-mode-select"><span class="sr-only">Modo de reparto</span><select name="draft-share_mode" :value="draft.share_mode" aria-label="Modo de reparto" @change="setShareMode($event.target.value)"><option value="equal">Igualmente</option><option value="amount">Por cantidad</option><option value="percent">Por porcentaje</option></select><PhCaretUpDown aria-hidden="true" :size="18" /></label></div>
            <div class="split-members-card" role="group" :aria-label="`Personas a las que se aplica el movimiento de ${money(draft.amount)}`">
              <label v-for="member in memberOptions" :key="member.uid" class="split-member-row" :class="{ selected: participantSelected(member.uid) }">
                <input type="checkbox" :checked="participantSelected(member.uid)" :aria-label="`Incluir a ${member.name || member.email}`" @change="toggleParticipant(member.uid)" />
                <span class="split-check" aria-hidden="true"><PhCheck :size="16" weight="bold" /></span>
                <span class="split-member-name">{{ member.name || member.email }}<small v-if="member.uid === user?.uid">Tú</small></span>
                <span v-if="participantSelected(member.uid) && draft.share_mode === 'equal'" class="split-member-amount">{{ equalShare(member) }}</span>
                <span v-else-if="participantSelected(member.uid)" class="money-input split-member-input">
                  <input v-model="draft.participant_shares[member.uid]" aria-describedby="expense-split-summary"
                         type="number" inputmode="decimal"
                         min="0"
                         max="99999999"
                         step="0.01"
                         :aria-label="`Parte de ${member.name || member.email}`"
                  /><b>{{ draft.share_mode === 'percent' ? '%' : '€' }}</b>
                </span><span v-else class="split-member-muted">No participa</span>
              </label>
              <p v-if="!memberOptions.length" class="split-empty">Añade miembros al grupo para poder repartir este movimiento.</p>
            </div>
            <small v-if="draft.share_mode !== 'equal'" class="split-help">{{ draft.share_mode === 'percent' ? 'Los porcentajes deben sumar 100 %.' : 'Las cantidades deben sumar el importe total.' }}</small>
            <p v-if="draft.share_mode !== 'equal'" id="expense-split-summary" class="split-summary" :class="{ invalid: Math.round(splitTotal * 100) !== Math.round(splitTarget * 100) }" role="status">
              Asignado: {{ draft.share_mode === 'percent' ? `${splitTotal.toFixed(2)} % de 100 %` : `${money(splitTotal)} de ${money(splitTarget)}` }}.
              {{ Math.round(splitTotal * 100) === Math.round(splitTarget * 100) ? 'Reparto completo.' : 'Revisa las cantidades antes de guardar.' }}
            </p>
          </fieldset>
          <div class="form-grid details-grid">
            <label class="full">
              <span>Detalles</span><textarea v-model="draft.details"
                                             maxlength="1000"
                                             rows="3"
                                             placeholder="Añade notas o información adicional…"
              ></textarea>
            </label>
            <label class="full tag-field">
              <span>Etiquetas</span><div class="tag-entry">
                <input v-model="tagInput" aria-label="Nueva etiqueta"
                       maxlength="40"
                       placeholder="Escribe una etiqueta y pulsa Intro"
                       @keydown.enter.prevent="addDraftTag()"
                /><button type="button"
                          class="secondary"
                          :disabled="!tagInput.trim() || draft.tags.length >= 10"
                          @click="addDraftTag()"
                >
                  Añadir
                </button>
              </div><div v-if="draft.tags.length" class="selected-tags">
                <button v-for="tag in draft.tags"
                        :key="tag"
                        type="button"
                        @click="draft.tags = draft.tags.filter((item) => item !== tag)" :aria-label="`Quitar etiqueta ${tag}`"
                >
                  {{ tag }} <PhX aria-hidden="true" :size="13" />
                </button>
              </div><div v-if="tagOptions.length" class="tag-suggestions">
                <span>Usadas recientemente</span><button v-for="tag in tagOptions.filter((item) => !draft.tags.includes(item)).slice(0, 8)"
                                                         :key="tag"
                                                         type="button"
                                                         @click="addDraftTag(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </label>
            <label v-if="!draft.id" class="full">
              <span>Repetir automáticamente</span><select v-model="draft.recurrence">
                <option value="none">No repetir</option><option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option>
              </select>
            </label>
          </div>
          <div v-if="draft.confirmation_pending && draft.created_by === user?.uid" class="confirmation-action-row">
            <button type="button"
                    class="secondary confirmation-action"
                    :disabled="saving"
                    @click="confirmExpense(draft.id)"
            >
              <PhCheck aria-hidden="true" :size="18" weight="bold" /> {{ saving ? 'Confirmando…' : 'Confirmar movimiento' }}
            </button>
          </div>
          <footer class="expense-form-footer">
            <button v-if="draft.id"
                    type="button"
                    class="danger-button modal-delete"
                    :aria-label="`Eliminar ${draft.transaction_type === 'income' ? 'ingreso' : 'gasto'}`"
                    :title="`Eliminar ${draft.transaction_type === 'income' ? 'ingreso' : 'gasto'}`"
                    :disabled="saving"
                    @click="deleteTarget = { id: draft.id, name: draft.name, transaction_type: draft.transaction_type }"
            >
              <PhTrash aria-hidden="true" :size="20" />
            </button><button type="button" class="ghost" :disabled="saving" @click="closeExpenseModal">
              Cancelar
            </button><button class="primary" :disabled="saving">
              <PhCheck aria-hidden="true" :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
          </footer>
        </template>
      </form>
      <section v-if="expenseHistoryForId === Number(draft.id) && draft.id"
               class="expense-history-panel"
               aria-live="polite"
               aria-label="Historial de cambios"
      >
        <header class="expense-history-heading">
          <div>
            <p class="eyebrow">
              AUDITORÍA
            </p><h2>Historial de cambios</h2>
          </div><button type="button"
                        class="icon-button"
                        aria-label="Cerrar historial"
                        @click="expenseHistoryForId = 0"
          >
            <PhX aria-hidden="true" :size="19" />
          </button>
        </header>
        <div v-if="expenseHistoryLoading" class="expense-history-empty">
          <span class="loader"></span><p>Cargando cambios…</p>
        </div>
        <div v-else-if="!expenseHistoryEntries.length" class="expense-history-empty">
          <PhClockCounterClockwise aria-hidden="true" :size="24" /><p>Aún no hay cambios registrados para este movimiento. Guardaremos los cambios que se hagan a partir de ahora.</p>
        </div>
        <ol v-else class="expense-history-list">
          <li v-for="entry in expenseHistoryEntries" :key="entry.id" class="expense-history-entry">
            <div class="expense-history-entry-heading">
              <span class="expense-history-event" :class="entry.event_type">{{ entry.event_type === 'created' ? 'Creado' : entry.event_type === 'deleted' ? 'Eliminado' : 'Actualizado' }}</span><time>{{ dateLabel(entry.created_at) }}</time>
            </div>
            <p class="expense-history-actor">
              {{ entry.actor_name || 'Miembro' }} <span v-if="entry.event_type === 'created'">creó el movimiento</span><span v-else-if="entry.event_type === 'deleted'">eliminó el movimiento</span><span v-else>hizo cambios</span>
            </p>
            <dl v-if="historyChangeEntries(entry).length" class="expense-history-changes">
              <div v-for="change in historyChangeEntries(entry)" :key="change.field">
                <dt>{{ change.label }}</dt><dd><span v-if="change.from !== null && change.from !== undefined" class="history-old-value">{{ historyValue(change.field, change.from) }}</span><PhArrowRight aria-hidden="true" v-if="change.from !== null && change.from !== undefined && change.to !== null && change.to !== undefined" :size="13" /><strong v-if="change.to !== null && change.to !== undefined">{{ historyValue(change.field, change.to) }}</strong><span v-if="change.from === null && change.to === null" class="muted">Sin valor</span></dd>
              </div>
            </dl>
          </li>
        </ol>
      </section>
    </section>
  </BaseDialog>
</template>
