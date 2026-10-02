<script setup>
import { useDataEditor } from '../composables/useDataEditor.js'
import { useDataSearch } from '../composables/useDataSearch.js'
import DataEditorDialog from '../components/dialogs/DataEditorDialog.vue'
import DataSearch from '../components/forms/DataSearch.vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { syncTypedOption } from '../utils/selects.js'
import { PhPlus, PhLightning, PhMagnifyingGlass } from '@phosphor-icons/vue'
import Multiselect from '@vueform/multiselect'

const {
  saving,
  error,
  category,
  group,
  recurringDeleteTarget,
  paymentMethods,
  paymentMethodLabel,
  categories,
  cityOptions,
  establishmentOptions,
  memberOptions,
  recurringDraft,
  recurringSplitMembers,
  money,
  dateLabel,
  toggleRecurring,
  startRecurringRule,
  resetRecurringShares,
  setRecurringShareMode,
  saveRecurring,
} = useGastotecaContext()
const { search, filteredItems } = useDataSearch(() => group.value?.recurring, rule => [
  rule.name, rule.payload?.place, rule.payload?.city, category(rule.category).label, ...(rule.payload?.tags || []),
].join(' '))
const { editorOpen, openEditor, closeEditor, submitEditor } = useDataEditor({ reset: startRecurringRule, save: saveRecurring })
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        AUTOMATIZACIONES DEL GRUPO
      </p><h1>Gastos recurrentes</h1><p>Configura gastos e ingresos que se añadirán automáticamente cuando llegue su fecha.</p>
    </div>
    <button type="button" class="primary" :disabled="saving" @click="openEditor()"><PhPlus aria-hidden="true" :size="18" /> Nueva programación</button>
  </section>
  <section class="feature-panel feature-list-panel">
    <div class="feature-panel-heading">
      <div>
        <p class="eyebrow">
          PROGRAMACIONES
        </p><h2>Movimientos automáticos</h2>
      </div><span class="feature-count">{{ group?.recurring?.length || 0 }}</span>
    </div>
    <DataSearch id="recurring-search" v-model="search" label="Buscar programaciones" placeholder="Buscar por nombre, categoría o lugar…" :count="filteredItems.length" :total="group?.recurring?.length || 0" />
    <div v-if="filteredItems.length" class="feature-list">
      <article v-for="rule in filteredItems" :key="rule.id" class="feature-list-row">
        <div class="feature-list-main">
          <span class="feature-status-dot" :class="{ paused: !rule.active }"></span><div><strong>{{ rule.name }}</strong><small>{{ rule.transaction_type === 'income' ? 'Ingreso' : 'Gasto' }} · {{ money(rule.amount) }} · {{ paymentMethodLabel(rule.payload?.payment_method) }} · {{ rule.frequency === 'weekly' ? 'Semanal' : rule.frequency === 'monthly' ? 'Mensual' : 'Anual' }}{{ rule.requires_confirmation ? ' · Necesita confirmación' : '' }}</small><small v-if="rule.payload?.place || rule.payload?.city">{{ [rule.payload?.place, rule.payload?.city].filter(Boolean).join(' · ') }}</small><small>{{ rule.active ? 'Próximo: ' : 'Pausado · Próximo: ' }}{{ dateLabel(rule.next_at) }}</small></div>
        </div>
        <div class="feature-row-actions">
          <button type="button" class="ghost small-action" :disabled="saving" @click="openEditor(rule)" :aria-label="`Editar programación ${rule.name}`">
            Editar
          </button><button type="button" class="secondary small-action" @click="toggleRecurring(rule)" :disabled="saving" :aria-label="`${rule.active ? 'Pausar' : 'Reactivar'} programación ${rule.name}`">
            {{ rule.active ? 'Pausar' : 'Reactivar' }}
          </button>
          <button type="button" class="danger-button small-action" :disabled="saving" :aria-label="`Eliminar programación ${rule.name}`" @click="error = ''; recurringDeleteTarget = rule">Eliminar</button>
        </div>
      </article>
    </div>
    <div v-else-if="group?.recurring?.length" class="feature-empty">
      <PhMagnifyingGlass aria-hidden="true" :size="28" /><strong>No hay resultados para esta búsqueda</strong><p>Prueba con otro nombre o limpia la búsqueda.</p>
      <button type="button" class="secondary" @click="search = ''">Limpiar búsqueda</button>
    </div>
    <div v-else class="feature-empty">
      <PhLightning aria-hidden="true" :size="27" /><strong>Aún no hay programaciones</strong><p>Configura aquí el alquiler, las suscripciones o los ingresos que se repiten.</p>
      <button type="button" class="secondary" :disabled="saving" @click="openEditor()">Crear programación</button>
    </div>
  </section>
  <DataEditorDialog v-if="editorOpen" title-id="recurring-editor-title" :title="recurringDraft.id ? 'Editar programación' : 'Nueva programación'" save-label="Guardar programación" wide :saving="saving" :error="error" @close="closeEditor" @submit="submitEditor">
      <p class="required-hint">Los campos con * son obligatorios.</p>
      <div class="feature-fields">
        <label><span>Tipo *</span><select v-model="recurringDraft.transaction_type" required>
          <option value="expense">Gasto</option><option value="income">Ingreso</option>
        </select></label>
        <label><span>Frecuencia *</span><select v-model="recurringDraft.frequency" required>
          <option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option>
        </select></label>
        <label class="feature-field-wide">
          <span>Nombre *</span><input id="recurring-name" data-initial-focus v-model="recurringDraft.name"
                                      maxlength="160"
                                      :placeholder="recurringDraft.transaction_type === 'income' ? 'Nómina o ingreso recurrente' : 'Alquiler, suscripción…'"
                                      required
          />
        </label>
        <label><span>Importe *</span><div class="money-input">
          <input v-model="recurringDraft.amount"
                 type="number" inputmode="decimal"
                 min="0.01"
                 max="99999999"
                 step="0.01"
                 placeholder="0,00"
                 required
          /><b>€</b>
        </div></label>
        <label><span>Categoría *</span><select v-model="recurringDraft.category" required>
          <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select></label>
        <label class="feature-field-wide">
          <span>Método de pago *</span><select v-model="recurringDraft.payment_method" required>
            <option v-if="recurringDraft.payment_method === 'unspecified'" value="unspecified">Sin especificar</option><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option>
          </select>
        </label>
        <label class="feature-field-wide">
          <span>Aplicar desde *</span><input v-model="recurringDraft.next_at" type="datetime-local" required />
        </label>
        <label>
          <span id="recurring-place-label">Establecimiento</span><Multiselect id="recurring-place-select" v-model="recurringDraft.place"
                                                   class="smart-select"
                                                   :options="establishmentOptions"
                                                   :disabled="saving"
                                                   searchable
                                                   create-option
                                                   allow-absent
                                                   @search-change="query => syncTypedOption(recurringDraft, 'place', query, establishmentOptions)"
                                                   :can-clear="Boolean(recurringDraft.place)"
                                                   :aria="{ 'aria-label': 'Establecimiento', 'aria-labelledby': 'recurring-place-label' }"
                                                   placeholder="Busca o escribe un establecimiento"
                                                   no-options-text="Escribe un establecimiento nuevo"
                                                   no-results-text="Se guardará al guardar la programación"
          /></label>
        <label>
          <span id="recurring-city-label">Ciudad</span><Multiselect id="recurring-city-select" v-model="recurringDraft.city"
                                          class="smart-select"
                                          :options="cityOptions"
                                          :disabled="saving"
                                          searchable
                                          create-option
                                          allow-absent
                                          @search-change="query => syncTypedOption(recurringDraft, 'city', query, cityOptions)"
                                          :can-clear="Boolean(recurringDraft.city)"
                                          :aria="{ 'aria-label': 'Ciudad', 'aria-labelledby': 'recurring-city-label' }"
                                          placeholder="Busca o escribe una ciudad"
                                          no-options-text="Escribe una ciudad nueva"
                                          no-results-text="Se guardará al guardar la programación"
          /></label>
        <label class="feature-field-wide">
          <span>Detalles</span><textarea v-model="recurringDraft.details" maxlength="1000" rows="3" placeholder="Añade algún detalle (opcional)"></textarea>
        </label>
      </div>
      <p class="feature-field-hint">Si eliges una fecha pasada, se crearán al guardar los movimientos vencidos desde esa fecha.</p>
      <label class="recurring-confirmation-option"><input v-model="recurringDraft.requires_confirmation" type="checkbox" /><span><strong>Necesita confirmación</strong><small>Cada movimiento quedará pendiente hasta que lo confirme quien creó esta programación. Mientras tanto, solo lo verá esa persona.</small></span></label>
      <fieldset class="feature-fieldset">
        <legend>{{ recurringDraft.transaction_type === 'income' ? 'Quién lo recibe' : 'Quién lo paga' }} *</legend>
        <div class="feature-choice-row">
          <label><input v-model="recurringDraft.paid_by_type" type="radio" name="recurringDraft-paid_by_type" value="person" /> Una persona</label><label><input v-model="recurringDraft.paid_by_type" type="radio" name="recurringDraft-paid_by_type" value="all" /> Todo el grupo</label>
        </div>
        <select v-if="recurringDraft.paid_by_type === 'person'" v-model="recurringDraft.paid_by_uid" class="feature-select" aria-label="Persona que paga o recibe el movimiento" required>
          <option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option>
        </select>
      </fieldset>
      <fieldset class="feature-fieldset">
        <legend>A quién se aplica *</legend>
        <div class="feature-choice-row">
          <label><input v-model="recurringDraft.applies_to_all"
                        type="radio" name="recurringDraft-applies_to_all"
                        :value="true"
                        @change="resetRecurringShares"
          /> Todo el grupo</label><label><input v-model="recurringDraft.applies_to_all"
                                                type="radio" name="recurringDraft-applies_to_all"
                                                :value="false"
                                                @change="resetRecurringShares"
          /> Algunas personas</label>
        </div>
        <div v-if="!recurringDraft.applies_to_all" class="check-members">
          <label v-for="member in memberOptions" :key="member.uid">
            <input v-model="recurringDraft.participant_uids"
                   type="checkbox"
                   :value="member.uid"
                   @change="resetRecurringShares"
            /><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span>{{ member.name || member.email }}
          </label>
        </div>
        <div class="feature-split-heading">
          <span>Reparto *</span><label><input :checked="recurringDraft.share_mode === 'equal'" type="radio" name="recurringDraft-share_mode" @change="setRecurringShareMode('equal')" /> Por igual</label><label><input :checked="recurringDraft.share_mode === 'amount'" type="radio" name="recurringDraft-share_mode" @change="setRecurringShareMode('amount')" /> Por cantidades</label><label><input :checked="recurringDraft.share_mode === 'percent'" type="radio" name="recurringDraft-share_mode" @change="setRecurringShareMode('percent')" /> Por porcentajes</label>
        </div>
        <div v-if="recurringDraft.share_mode !== 'equal'" class="feature-share-list">
          <label v-for="member in recurringSplitMembers" :key="member.uid">
            <span>{{ member.name || member.email }}</span><div class="money-input">
              <input v-model="recurringDraft.participant_shares[member.uid]"
                     type="number" inputmode="decimal"
                     min="0"
                     step="0.01"
                     :aria-label="`Parte de ${member.name || member.email}`"
              /><b>{{ recurringDraft.share_mode === 'percent' ? '%' : '€' }}</b>
            </div>
          </label>
        </div>
      </fieldset>
      <fieldset v-if="group?.tags?.length" class="feature-fieldset">
        <legend>Etiquetas</legend>
        <div class="feature-tag-options">
          <label v-for="tag in group.tags" :key="tag.id">
            <input v-model="recurringDraft.tags" type="checkbox" :value="tag.name" /> {{ tag.name }}
          </label>
        </div>
      </fieldset>
  </DataEditorDialog>
</template>
