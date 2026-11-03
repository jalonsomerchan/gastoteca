import { isPositiveAmount } from '../domain/validation.js'
import { postJson } from '../lib/api.js'
import { toCents } from '../domain/money.js'

export function useSettlements({
  settlementTarget,
  settlementDraft,
  user,
  group,
  error,
  saving,
  freshToken,
  settlements,
  pairBalances,
  flash,
}) {
  function openSettlement(entry, isOwedToYou) {
    error.value = ''
    settlementTarget.value = entry
    settlementDraft.payer_uid = isOwedToYou ? entry.counterpartyUid : user.value?.uid || ''
    settlementDraft.payee_uid = isOwedToYou ? user.value?.uid || '' : entry.counterpartyUid
    settlementDraft.amount = Number(entry.amount).toFixed(2)
    settlementDraft.payment_method = group.value?.default_payment_method || 'card'
  }

  async function saveSettlement() {
    if (saving.value) return
    error.value = ''
    if (!settlementDraft.payer_uid || !settlementDraft.payee_uid || settlementDraft.payer_uid === settlementDraft.payee_uid) {
      error.value = 'Elige dos personas diferentes: quién paga y quién recibe.'
      return
    }
    if (!settlementTarget.value || !isPositiveAmount(settlementDraft.amount) || toCents(settlementDraft.amount) > toCents(settlementTarget.value.amount)) {
      error.value = 'El importe debe ser mayor que cero y no superar la deuda pendiente.'
      return
    }
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_settlement', await freshToken(true), { ...settlementDraft })
      settlements.value = data.settlements || []
      pairBalances.value = Array.isArray(data.pair_balances) ? data.pair_balances : null
      settlementTarget.value = null
      flash('Pago registrado; el balance pendiente se ha actualizado.')
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  return { openSettlement, saveSettlement }
}
