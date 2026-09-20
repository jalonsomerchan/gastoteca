<script setup>
import { focusElement } from '../utils/focus.js'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhCheck, PhLightning } from '@phosphor-icons/vue'

const {
  saving,
  group,
  recurringDeleteTarget,
  paymentMethods,
  paymentMethodLabel,
  categories,
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
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        AUTOMATIZACIONES DEL GRUPO
      </p><h1>Gastos recurrentes</h1><p>Configura gastos e ingresos que se añadirán automáticamente cuando llegue su fecha.</p>
    </div>
    <button v-if="recurringDraft.id"
            type="button"
            class="ghost"
            @click="startRecurringRule()"
    >
      Nueva programación
    </button>
  </section>
  <section class="feature-layout">
    <form :aria-busy="saving" class="feature-panel feature-form" @submit.prevent="saveRecurring">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            {{ recurringDraft.id ? 'EDITAR PROGRAMACIÓN' : 'NUEVA PROGRAMACIÓN' }}
          </p><h2>{{ recurringDraft.id ? 'Ajusta los detalles' : 'Añade un movimiento' }}</h2>
        </div>
      </div>
      <p class="required-hint">Los campos con * son obligatorios.</p>
      <div class="feature-fields">
        <label><span>Tipo *</span><select v-model="recurringDraft.transaction_type" required>
          <option value="expense">Gasto</option><option value="income">Ingreso</option>
        </select></label>
        <label><span>Frecuencia *</span><select v-model="recurringDraft.frequency" required>
          <option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option>
        </select></label>
        <label class="feature-field-wide">
          <span>Nombre *</span><input id="recurring-name" v-model="recurringDraft.name"
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
          <span>Próxima fecha de aplicación *</span><input v-model="recurringDraft.next_at" type="datetime-local" required />
        </label>
      </div>
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
          <span>Reparto *</span><label><input :checked="recurringDraft.share_mode === 'equal'" type="radio" name="recurringDraft-share_mode" @change="setRecurringShareMode('equal')" /> Por igual</label><label><input :checked="recurringDraft.share_mode === 'amount'" type="radio" name="recurringDraft-share_mode" @change="setRecurringShareMode('amount')" /> Personalizado</label>
        </div>
        <div v-if="recurringDraft.share_mode === 'amount'" class="feature-share-list">
          <label v-for="member in recurringSplitMembers" :key="member.uid">
            <span>{{ member.name || member.email }}</span><div class="money-input">
              <input v-model="recurringDraft.participant_shares[member.uid]"
                     type="number" inputmode="decimal"
                     min="0"
                     step="0.01"
                     :aria-label="`Parte de ${member.name || member.email}`"
              /><b>€</b>
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
      <div class="feature-form-actions">
        <button v-if="recurringDraft.id"
                type="button"
                class="text-danger"
                @click="recurringDeleteTarget = { id: recurringDraft.id, name: recurringDraft.name }"
        >
          Eliminar programación
        </button><span></span><button v-if="recurringDraft.id"
                                      type="button"
                                      class="ghost"
                                      @click="startRecurringRule()"
        >
          Cancelar
        </button><button class="primary" :disabled="saving">
          <PhCheck aria-hidden="true" :size="17" /> {{ saving ? 'Guardando…' : 'Guardar programación' }}
        </button>
      </div>
    </form>
    <section class="feature-panel feature-list-panel">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            PROGRAMACIONES
          </p><h2>Movimientos automáticos</h2>
        </div><span class="feature-count">{{ group?.recurring?.length || 0 }}</span>
      </div>
      <div v-if="group?.recurring?.length" class="feature-list">
        <article v-for="rule in group.recurring" :key="rule.id" class="feature-list-row">
          <div class="feature-list-main">
            <span class="feature-status-dot" :class="{ paused: !rule.active }"></span><div><strong>{{ rule.name }}</strong><small>{{ rule.transaction_type === 'income' ? 'Ingreso' : 'Gasto' }} · {{ money(rule.amount) }} · {{ paymentMethodLabel(rule.payload?.payment_method) }} · {{ rule.frequency === 'weekly' ? 'Semanal' : rule.frequency === 'monthly' ? 'Mensual' : 'Anual' }}</small><small>{{ rule.active ? 'Próximo: ' : 'Pausado · Próximo: ' }}{{ dateLabel(rule.next_at) }}</small></div>
          </div>
          <div class="feature-row-actions">
            <button type="button" class="ghost small-action" @click="startRecurringRule(rule); focusElement('#recurring-name')" :aria-label="`Editar programación ${rule.name}`">
              Editar
            </button><button type="button" class="secondary small-action" @click="toggleRecurring(rule)" :disabled="saving" :aria-label="`${rule.active ? 'Pausar' : 'Reactivar'} programación ${rule.name}`">
              {{ rule.active ? 'Pausar' : 'Reactivar' }}
            </button>
          </div>
        </article>
      </div>
      <div v-else class="feature-empty">
        <PhLightning aria-hidden="true" :size="27" /><strong>Aún no hay programaciones</strong><p>Configura aquí el alquiler, las suscripciones o los ingresos que se repiten.</p>
      </div>
    </section>
  </section>
</template>
