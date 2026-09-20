<script setup>
import { useGastotecaContext } from '../../composables/gastotecaContext.js'
import { PhX, PhCheck } from '@phosphor-icons/vue'

const {
  saving,
  error,
  settlementTarget,
  settlementDraft,
  paymentMethods,
  memberOptions,
  money,
  saveSettlement,
} = useGastotecaContext()
</script>

<template>
  <div v-if="settlementTarget" class="modal-backdrop" @mousedown.self="settlementTarget = null">
    <section class="modal settlement-modal"
             role="dialog"
             aria-modal="true"
             aria-labelledby="settlement-title"
    >
      <header>
        <p class="eyebrow modal-title" id="settlement-title">
          Registrar un pago
        </p><button class="icon-button" aria-label="Cerrar" @click="settlementTarget = null">
          <PhX :size="22" />
        </button>
      </header>
      <p v-if="error" class="inline-error modal-error">
        {{ error }}
      </p>
      <form @submit.prevent="saveSettlement">
        <label><span>Quién paga *</span><select v-model="settlementDraft.payer_uid" required>
          <option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option>
        </select></label>
        <label><span>Quién recibe *</span><select v-model="settlementDraft.payee_uid" required>
          <option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option>
        </select></label>
        <label><span>Importe pagado (máximo {{ money(settlementTarget.amount) }}) *</span><div class="money-input">
          <input v-model="settlementDraft.amount"
                 type="number"
                 min="0.01"
                 :max="settlementTarget.amount"
                 step="0.01"
                 required
          /><b>€</b>
        </div></label>
        <label><span>Método de pago *</span><select v-model="settlementDraft.payment_method" required>
          <option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option>
        </select></label>
        <footer>
          <button type="button" class="ghost" @click="settlementTarget = null">
            Cancelar
          </button><button class="primary" :disabled="saving">
            <PhCheck :size="18" /> Guardar pago
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>
