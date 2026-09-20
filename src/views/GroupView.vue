<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhHouse, PhArrowRight } from '@phosphor-icons/vue'
import Multiselect from '@vueform/multiselect'

const {
  router,
  saving,
  user,
  group,
  inviteEmail,
  inviteSending,
  joinCode,
  defaultCityDraft,
  defaultPaymentMethodDraft,
  paymentMethods,
  memberOptions,
  cityOptions,
  money,
  dateLabel,
  toggleRecurring,
  invite,
  saveGroupSettings,
  joinGroup,
  leaveGroup,
} = useGastotecaContext()
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        ESPACIO COMPARTIDO
      </p><h1>Tu grupo</h1><p>Invita a las personas con las que compartes gastos.</p>
    </div>
  </section>
  <section class="group-grid">
    <article class="group-card group-hero">
      <span class="group-mark"><PhHouse :size="28" weight="duotone" /></span><div>
        <p class="eyebrow">
          GRUPO ACTUAL
        </p><h2>{{ group?.name }}</h2><p>
          {{ memberOptions.length }} {{ memberOptions.length === 1 ? 'persona' : 'personas' }}<template v-if="group?.default_city">
            · {{ group.default_city }}
          </template>
        </p>
      </div><div class="invite-code">
        <span>Código de invitación</span><strong>{{ group?.invite_code }}</strong>
      </div>
    </article>
    <article class="group-card">
      <p class="eyebrow">
        MIEMBROS
      </p><h2>Personas del grupo</h2><div class="members">
        <div v-for="member in memberOptions" :key="member.uid">
          <span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span><p><strong>{{ member.name || member.email }}</strong><small>{{ member.uid === group?.owner_uid ? 'Propietario' : member.email }}</small></p><span v-if="member.uid === user.uid" class="you-pill">Tú</span>
        </div>
      </div>
    </article>
    <article v-if="group?.owner_uid === user.uid" class="group-card">
      <p class="eyebrow">
        INVITAR
      </p><h2>Sumar una persona</h2><p class="muted">
        Enviaremos un correo. Al iniciar sesión con Google usando ese email, se unirá automáticamente.
      </p><form class="inline-form" @submit.prevent="invite">
        <label class="inline-form-field">
          <span>Correo electrónico *</span><input v-model="inviteEmail"
                                                  type="email"
                                                  placeholder="persona@ejemplo.com"
                                                  required
          />
        </label><button class="primary" :disabled="inviteSending">
          {{ inviteSending ? 'Enviando…' : 'Invitar' }} <PhArrowRight :size="17" />
        </button>
      </form><div v-if="group.pending_emails?.length" class="pending">
        <span v-for="email in group.pending_emails" :key="email">{{ email }} · pendiente</span>
      </div>
    </article>
    <article v-if="group?.owner_uid === user.uid" class="group-card">
      <p class="eyebrow">
        UBICACIÓN
      </p><h2>Ciudad predeterminada</h2><p class="muted">
        Se usará cuando no podamos detectar la ubicación del dispositivo.
      </p><form class="group-setting-form" @submit.prevent="saveGroupSettings">
        <Multiselect v-model="defaultCityDraft"
                     class="smart-select"
                     :options="cityOptions"
                     searchable
                     create-option
                     allow-absent
                     :can-clear="Boolean(defaultCityDraft)"
                     :aria="{ 'aria-label': 'Ciudad predeterminada' }"
                     placeholder="Escribe o busca una ciudad"
                     no-options-text="Escribe una ciudad nueva"
                     no-results-text="Sin coincidencias"
        /><button class="primary" :disabled="saving">
          Guardar
        </button>
      </form>
    </article>
    <article v-if="group?.owner_uid === user.uid" class="group-card">
      <p class="eyebrow">
        PAGOS
      </p><h2>Método predeterminado</h2><p class="muted">
        Se preseleccionará al añadir gastos y registrar pagos para este grupo.
      </p><form class="group-setting-form payment-method-setting" @submit.prevent="saveGroupSettings">
        <select v-model="defaultPaymentMethodDraft" aria-label="Método de pago predeterminado">
          <option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option>
        </select><button class="primary" :disabled="saving">
          Guardar
        </button>
      </form>
    </article>
    <article class="group-card recurring-card">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            AUTOMATIZACIONES
          </p><h2>Movimientos recurrentes</h2>
        </div><button type="button" class="ghost small-action" @click="router.push({ name: 'recurring' })">
          Configurar
        </button>
      </div>
      <div v-if="group?.recurring?.length" class="recurring-list">
        <div v-for="rule in group.recurring" :key="rule.id" class="recurring-item">
          <span><strong>{{ rule.name }}</strong><small>{{ money(rule.amount) }} · {{ rule.transaction_type === 'income' ? 'Ingreso' : 'Gasto' }} · {{ rule.frequency === 'weekly' ? 'Semanal' : rule.frequency === 'monthly' ? 'Mensual' : 'Anual' }} · Próximo: {{ dateLabel(rule.next_at) }}</small></span><button type="button" class="secondary small-action" @click="toggleRecurring(rule)">
            {{ rule.active ? 'Pausar' : 'Reactivar' }}
          </button>
        </div>
      </div>
      <p v-else class="muted">
        Al crear un movimiento, puedes elegir si quieres repetirlo.
      </p>
    </article>
    <article class="group-card">
      <p class="eyebrow">
        OTRO GRUPO
      </p><h2>Unirte con un código</h2><p class="muted">
        Al unirte saldrás de tu grupo actual si no eres su propietario.
      </p><form class="inline-form" @submit.prevent="joinGroup">
        <label class="inline-form-field">
          <span>Código de invitación *</span><input v-model="joinCode"
                                                    maxlength="8"
                                                    placeholder="ABCD2345"
                                                    required
          />
        </label><button class="secondary">
          Unirme
        </button>
      </form><button v-if="group?.owner_uid !== user.uid" class="text-danger" @click="leaveGroup">
        Salir del grupo actual
      </button>
    </article>
  </section>
</template>
