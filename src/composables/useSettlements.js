import { postJson } from '../lib/api.js'

export function useSettlements({
  settlementTarget,
  settlementDraft,
  user,
  group,
  error,
  saving,
  freshToken,
  settlements,
  flash,
}) {
  function openSettlement(entry, isOwedToYou) {
    settlementTarget.value = entry
    settlementDraft.payer_uid = isOwedToYou ? entry.counterpartyUid : user.value?.uid || ''
    settlementDraft.payee_uid = isOwedToYou ? user.value?.uid || '' : entry.counterpartyUid
    settlementDraft.amount = Number(entry.amount).toFixed(2)
    settlementDraft.payment_method = group.value?.default_payment_method || 'card'
  }

  async function saveSettlement() {
    error.value = ''
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_settlement', await freshToken(true), { ...settlementDraft })
      settlements.value = data.settlements || []
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
