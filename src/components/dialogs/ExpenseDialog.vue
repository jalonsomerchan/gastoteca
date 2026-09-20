<script setup>
import { normalizeName } from '../../utils/formatters.js'
import { useGastotecaContext } from '../../composables/gastotecaContext.js'
import { PhX, PhClockCounterClockwise, PhCheck, PhArrowDown, PhArrowUp, PhLightning, PhCrosshair, PhWallet, PhUsers, PhArrowRight } from '@phosphor-icons/vue'
import Multiselect from '@vueform/multiselect'

const {
  
  saving,
  error,
  
  modalOpen,
  quickExpenseMode,
  quickAmount,
  quickAmountInput,
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
  selectFrequentName,
  setShareMode,
  addDraftTag,
  saveExpense,
} = useGastotecaContext()
</script>

<template>
  <div v-if="modalOpen" class="modal-backdrop" @mousedown.self="closeExpenseModal">
    <section class="modal"
             role="dialog"
             aria-modal="true"
             aria-labelledby="expense-title"
    >
      <header>
        <p id="expense-title" class="eyebrow modal-title">
          {{ quickExpenseMode ? 'Gasto rápido' : draft.id ? 'Editar movimiento' : draft.transaction_type ? (draft.transaction_type === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto') : 'Nuevo movimiento' }}
        </p><button class="icon-button" aria-label="Cerrar" @click="closeExpenseModal">
          <PhX :size="22" />
        </button>
      </header>
      <p v-if="error" class="inline-error modal-error">
        {{ error }}
      </p>
      <div v-if="draft.id && !quickExpenseMode" class="expense-history-toolbar">
        <span>Consulta quién modificó este movimiento y qué cambió.</span>
        <button type="button"
                class="secondary"
                :disabled="expenseHistoryLoading"
                @click="loadExpenseHistory(draft.id)"
        >
          <PhClockCounterClockwise :size="17" /> {{ expenseHistoryLoading ? 'Cargando…' : expenseHistoryForId === Number(draft.id) ? 'Actualizar historial' : 'Ver historial' }}
        </button>
      </div>
      <form v-if="quickExpenseMode" @submit.prevent="saveQuickExpense">
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
          <button type="button" class="ghost" @click="quickExpenseMode = false">
            Volver
          </button><button class="primary" :disabled="saving">
            <PhCheck :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar gasto' }}
          </button>
        </footer>
      </form>
      <form v-else @submit.prevent="saveExpense">
        <fieldset v-if="!draft.id && !draft.transaction_type" class="transaction-type">
          <legend>Primero, selecciona el tipo *</legend><div class="choice-grid transaction-options">
            <label :class="{ selected: draft.transaction_type === 'expense' }">
              <input v-model="draft.transaction_type"
                     type="radio"
                     value="expense"
                     required
              /><PhArrowDown :size="22" /><span><strong>Gasto</strong><small>Dinero que ha salido</small></span>
            </label><label :class="{ selected: draft.transaction_type === 'income' }">
              <input v-model="draft.transaction_type"
                     type="radio"
                     value="income"
                     required
              /><PhArrowUp :size="22" /><span><strong>Ingreso</strong><small>Dinero que ha entrado</small></span>
            </label><button type="button" class="quick-expense-choice" @click="startQuickExpense">
              <PhLightning :size="22" weight="fill" /><span><strong>Gasto rápido</strong><small>Guardar solo el importe</small></span>
            </button>
          </div>
        </fieldset>
        <template v-if="draft.transaction_type">
          <aside v-if="draft.is_quick" class="quick-edit-notice">
            <PhLightning :size="18" weight="fill" /><span><strong>Gasto rápido pendiente</strong><small>El importe ya está guardado. Añade un nombre más descriptivo y los datos que quieras.</small></span>
          </aside>
          <div class="form-grid">
            <label class="full name-field">
              <span>Nombre del {{ draft.transaction_type === 'income' ? 'ingreso' : 'gasto' }} *</span><input v-model="draft.name"
                                                                                                              maxlength="160"
                                                                                                              :placeholder="draft.transaction_type === 'income' ? 'Nómina, reembolso, venta…' : 'Cena, compra semanal, gasolina…'"
                                                                                                              autofocus
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
            <label><span>Categoría</span><Multiselect v-model="draft.category"
                                                      class="smart-select"
                                                      :options="categoryOptions"
                                                      searchable
                                                      create-option
                                                      allow-absent
                                                      :can-clear="false"
                                                      :aria="{ 'aria-label': 'Categoría' }"
                                                      placeholder="Busca o crea una categoría"
                                                      no-options-text="Escribe una categoría nueva"
                                                      no-results-text="Pulsa Intro para crearla"
            /></label>
            <label><span>Fecha y hora</span><input v-model="draft.occurred_at" type="datetime-local" /></label>
            <label><span>Establecimiento</span><Multiselect v-model="draft.place"
                                                            class="smart-select"
                                                            :options="establishmentOptions"
                                                            searchable
                                                            create-option
                                                            allow-absent
                                                            :can-clear="Boolean(draft.place)"
                                                            :aria="{ 'aria-label': 'Establecimiento' }"
                                                            placeholder="Busca o escribe un establecimiento"
                                                            no-options-text="Escribe un establecimiento nuevo"
                                                            no-results-text="Pulsa Intro para añadirlo"
            /><template v-if="frequentEstablishments.length">
              <span class="frequent-names"><button v-for="item in frequentEstablishments"
                                                   :key="item.value"
                                                   type="button"
                                                   :class="{ active: normalizeName(draft.place || '') === normalizeName(item.value) }"
                                                   @click="draft.place = item.value"
              >{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span>
            </template></label>
            <label><span>Ciudad</span><Multiselect v-model="draft.city"
                                                   class="smart-select"
                                                   :options="cityOptions"
                                                   searchable
                                                   create-option
                                                   allow-absent
                                                   :can-clear="Boolean(draft.city)"
                                                   :aria="{ 'aria-label': 'Ciudad' }"
                                                   placeholder="Busca o escribe una ciudad"
                                                   no-options-text="Escribe una ciudad nueva"
                                                   no-results-text="Pulsa Intro para añadirla"
            /><template v-if="frequentCities.length">
              <span class="frequent-names"><button v-for="item in frequentCities"
                                                   :key="item.value"
                                                   type="button"
                                                   :class="{ active: normalizeName(draft.city || '') === normalizeName(item.value) }"
                                                   @click="draft.city = item.value"
              >{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span>
            </template><span class="location-status"><small>{{ locationStatus }}</small><button type="button" :disabled="detectingCity" @click="detectCurrentCity"><PhCrosshair :size="14" /> {{ detectingCity ? 'Detectando…' : 'Usar mi ubicación' }}</button></span></label>
          </div>
          <fieldset>
            <legend>{{ draft.transaction_type === 'income' ? '¿Quién lo ha recibido?' : '¿Quién lo ha pagado?' }}</legend><div class="choice-grid">
              <label :class="{ selected: draft.paid_by_type === 'person' }">
                <input v-model="draft.paid_by_type" type="radio" value="person" /><PhWallet :size="22" /><span><strong>Una persona</strong><small>{{ draft.transaction_type === 'income' ? 'Selecciona quién recibió el dinero' : 'Selecciona quién adelantó el dinero' }}</small></span>
              </label><label :class="{ selected: draft.paid_by_type === 'all' }">
                <input v-model="draft.paid_by_type" type="radio" value="all" /><PhUsers :size="22" /><span><strong>Entre todos</strong><small>Corresponde al grupo en conjunto</small></span>
              </label>
            </div><select v-if="draft.paid_by_type === 'person'" v-model="draft.paid_by_uid" class="member-select">
              <option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option>
            </select><label class="payment-method-field">
              <span>Método de pago</span><select v-model="draft.payment_method" class="member-select">
                <option v-if="draft.payment_method === 'unspecified'" value="unspecified">Sin especificar</option><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option>
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>{{ draft.transaction_type === 'income' ? '¿A quién corresponde?' : '¿A quién se aplica?' }}</legend><div class="choice-grid">
              <label :class="{ selected: draft.applies_to_all }">
                <input v-model="draft.applies_to_all" type="radio" :value="true" /><PhUsers :size="22" /><span><strong>A todo el grupo</strong><small>Se reparte por igual</small></span>
              </label><label :class="{ selected: !draft.applies_to_all }">
                <input v-model="draft.applies_to_all" type="radio" :value="false" /><PhCheck :size="22" /><span><strong>Solo a algunas</strong><small>Elige las personas</small></span>
              </label>
            </div><div v-if="!draft.applies_to_all" class="check-members">
              <label v-for="member in memberOptions" :key="member.uid">
                <input v-model="draft.participant_uids" type="checkbox" :value="member.uid" /><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span>{{ member.name || member.email }}
              </label>
            </div>
          </fieldset>
          <fieldset class="split-fieldset">
            <legend>Cómo repartir {{ money(draft.amount) }}</legend><div class="choice-grid split-modes">
              <label :class="{ selected: draft.share_mode === 'equal' }">
                <input :checked="draft.share_mode === 'equal'" type="radio" @change="setShareMode('equal')" /><span><strong>Por igual</strong></span>
              </label><label :class="{ selected: draft.share_mode === 'amount' }">
                <input :checked="draft.share_mode === 'amount'" type="radio" @change="setShareMode('amount')" /><span><strong>Por cantidad</strong></span>
              </label><label :class="{ selected: draft.share_mode === 'percent' }">
                <input :checked="draft.share_mode === 'percent'" type="radio" @change="setShareMode('percent')" /><span><strong>Por porcentaje</strong></span>
              </label>
            </div><div v-if="draft.share_mode !== 'equal'" class="share-editor">
              <label v-for="member in splitMembers" :key="member.uid">
                <span>{{ member.name || member.email }}</span><div class="money-input">
                  <input v-model="draft.participant_shares[member.uid]"
                         type="number"
                         min="0"
                         max="99999999"
                         step="0.01"
                         :aria-label="`Parte de ${member.name || member.email}`"
                  /><b>{{ draft.share_mode === 'percent' ? '%' : '€' }}</b>
                </div>
              </label><small>{{ draft.share_mode === 'percent' ? 'Los porcentajes deben sumar 100 %.' : 'Las cantidades deben sumar el importe total.' }}</small>
            </div>
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
                <input v-model="tagInput"
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
                        @click="draft.tags = draft.tags.filter((item) => item !== tag)"
                >
                  {{ tag }} <PhX :size="13" />
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
          <footer>
            <button v-if="draft.id"
                    type="button"
                    class="danger-button modal-delete"
                    @click="deleteTarget = { id: draft.id, name: draft.name, transaction_type: draft.transaction_type }"
            >
              Eliminar {{ draft.transaction_type === 'income' ? 'ingreso' : 'gasto' }}
            </button><button type="button" class="ghost" @click="closeExpenseModal">
              Cancelar
            </button><button class="primary" :disabled="saving">
              <PhCheck :size="18" weight="bold" /> {{ saving ? 'Guardando…' : `Guardar ${draft.transaction_type === 'income' ? 'ingreso' : 'gasto'}` }}
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
            <PhX :size="19" />
          </button>
        </header>
        <div v-if="expenseHistoryLoading" class="expense-history-empty">
          <span class="loader"></span><p>Cargando cambios…</p>
        </div>
        <div v-else-if="!expenseHistoryEntries.length" class="expense-history-empty">
          <PhClockCounterClockwise :size="24" /><p>Aún no hay cambios registrados para este movimiento. Guardaremos los cambios que se hagan a partir de ahora.</p>
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
                <dt>{{ change.label }}</dt><dd><span v-if="change.from !== null && change.from !== undefined" class="history-old-value">{{ historyValue(change.field, change.from) }}</span><PhArrowRight v-if="change.from !== null && change.from !== undefined && change.to !== null && change.to !== undefined" :size="13" /><strong v-if="change.to !== null && change.to !== undefined">{{ historyValue(change.field, change.to) }}</strong><span v-if="change.from === null && change.to === null" class="muted">Sin valor</span></dd>
              </div>
            </dl>
          </li>
        </ol>
      </section>
    </section>
  </div>
</template>
