<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhArrowLeft } from '@phosphor-icons/vue'

const {
  router,
  
  settlements,
  group,
  paymentMethodLabel,
  balanceSummary,
  netBalance,
  netBalanceTitle,
  balanceBreakdown,
  memberLabel,
  money,
  dateLabel,
  openSettlement,
} = useGastotecaContext()
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        {{ group?.name || 'MI GRUPO' }}
      </p><h1>Balance</h1><p>Desglose de los gastos que has adelantado y los que te corresponden.</p>
    </div>
    <button type="button" class="ghost" @click="router.push({ name: 'expenses' })">
      <PhArrowLeft :size="17" /> Volver a movimientos
    </button>
  </section>
  <section class="balance-card balance-detail-total" :class="netBalance < 0 ? 'balance-negative' : 'balance-positive'">
    <span>{{ netBalanceTitle }}</span>
    <strong>{{ money(Math.abs(netBalance)) }}</strong>
    <small>{{ netBalance === 0 ? 'No tienes un saldo pendiente con el grupo.' : 'Saldo neto de tus gastos compartidos.' }}</small>
  </section>
  <section class="balance-breakdown-grid" aria-label="Desglose de saldos">
    <article class="chart-card balance-breakdown-card">
      <div class="card-title">
        <div>
          <p class="eyebrow">
            TE DEBEN
          </p><h2>{{ money(balanceSummary.owedToYou) }}</h2>
        </div>
      </div>
      <div v-if="balanceBreakdown.owedToYou.length" class="balance-entry-list">
        <article v-for="entry in balanceBreakdown.owedToYou" :key="entry.id" class="balance-entry">
          <span class="avatar">{{ memberLabel(entry.counterpartyUid).slice(0, 1).toUpperCase() }}</span>
          <div class="balance-entry-main">
            <strong>{{ memberLabel(entry.counterpartyUid) }} te debe</strong><small>Deuda neta pendiente</small>
          </div>
          <div class="balance-entry-actions">
            <b>{{ money(entry.amount) }}</b><button type="button" class="secondary small-action" @click="openSettlement(entry, true)">
              Registrar pago
            </button>
          </div>
        </article>
      </div>
      <p v-else class="muted">
        No tienes importes pendientes de recibir.
      </p>
    </article>
    <article class="chart-card balance-breakdown-card">
      <div class="card-title">
        <div>
          <p class="eyebrow">
            DEBES
          </p><h2>{{ money(balanceSummary.youOwe) }}</h2>
        </div>
      </div>
      <div v-if="balanceBreakdown.youOwe.length" class="balance-entry-list">
        <article v-for="entry in balanceBreakdown.youOwe" :key="entry.id" class="balance-entry">
          <span class="avatar">{{ memberLabel(entry.counterpartyUid).slice(0, 1).toUpperCase() }}</span>
          <div class="balance-entry-main">
            <strong>Debes a {{ memberLabel(entry.counterpartyUid) }}</strong><small>Deuda neta pendiente</small>
          </div>
          <div class="balance-entry-actions">
            <b>{{ money(entry.amount) }}</b><button type="button" class="secondary small-action" @click="openSettlement(entry, false)">
              Registrar pago
            </button>
          </div>
        </article>
      </div>
      <p v-else class="muted">
        No tienes importes pendientes de pagar.
      </p>
    </article>
  </section>
  <section v-if="settlements.length" class="chart-card settlement-history">
    <div class="card-title">
      <div>
        <p class="eyebrow">
          HISTORIAL
        </p><h2>Pagos registrados</h2>
      </div>
    </div>
    <div class="settlement-history-list">
      <p v-for="item in settlements.slice(0, 8)" :key="item.id">
        <span><strong>{{ memberLabel(item.payer_uid) }}</strong> pagó a <strong>{{ memberLabel(item.payee_uid) }}</strong></span><small>{{ dateLabel(item.paid_at) }} · {{ paymentMethodLabel(item.payment_method) }}</small><b>{{ money(item.amount) }}</b>
      </p>
    </div>
  </section>
</template>
