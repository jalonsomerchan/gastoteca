import { isPositiveAmount, splitValidation } from '../domain/validation.js'
import { postJson } from '../lib/api.js'

export function useRecurring({
  freshToken,
  group,
  flash,
  error,
  memberOptions,
  recurringDraft,
  emptyDraft,
  currentMember,
  recurringSplitMembers,
  saving,
  recurringDeleteTarget,
}) {
  async function toggleRecurring(rule) {
    if (saving.value) return
    saving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/toggle_recurring', await freshToken(true), { id: rule.id, active: !rule.active })
      group.value = data.group
      flash(rule.active ? 'Repetición pausada.' : 'Repetición reactivada.')
    } catch (reason) { error.value = reason.message }
    finally { saving.value = false }
  }

  function startRecurringRule(rule = null) {
    const payload = rule?.payload || {}
    const validParticipants = (payload.participant_uids || []).filter((uid) => memberOptions.value.some((member) => member.uid === uid))
    Object.assign(recurringDraft, {
      id: rule?.id || '',
      transaction_type: payload.transaction_type || 'expense',
      name: payload.name || '',
      amount: payload.amount ? Number(payload.amount).toFixed(2) : '',
      category: payload.category || 'bills',
      frequency: rule?.frequency || 'monthly',
      next_at: (rule?.next_at || emptyDraft().occurred_at).replace(' ', 'T').slice(0, 16),
      payment_method: payload.payment_method || group.value?.default_payment_method || 'card',
      paid_by_type: payload.paid_by_type || 'person',
      paid_by_uid: memberOptions.value.some((member) => member.uid === payload.paid_by_uid) ? payload.paid_by_uid : (currentMember.value?.uid || memberOptions.value[0]?.uid || ''),
      applies_to_all: payload.applies_to_all ?? true,
      participant_uids: validParticipants,
      participant_shares: Object.fromEntries(Object.entries(payload.participant_shares || {}).map(([uid, amount]) => [uid, Number(amount).toFixed(2)])),
      share_mode: rule && Object.keys(payload.participant_shares || {}).length ? 'amount' : 'equal',
      tags: [...(payload.tags || [])],
    })
    if (!recurringDraft.applies_to_all && !recurringDraft.participant_uids.length) recurringDraft.applies_to_all = true
    error.value = ''
  }

  function recurringShareValue(member, index) {
    const value = recurringDraft.participant_shares[member.uid]
    if (value !== undefined) return value
    const count = Math.max(1, recurringSplitMembers.value.length)
    const amount = Number(recurringDraft.amount) || 0
    return (index === count - 1 ? amount - (amount / count) * index : amount / count).toFixed(2)
  }

  function resetRecurringShares() {
    const members = recurringSplitMembers.value
    const amount = Number(recurringDraft.amount) || 0
    let used = 0
    recurringDraft.participant_shares = Object.fromEntries(members.map((member, index) => {
      const share = index === members.length - 1 ? amount - used : Math.round((amount / Math.max(1, members.length)) * 100) / 100
      used += share
      return [member.uid, Math.max(0, share).toFixed(2)]
    }))
  }

  function setRecurringShareMode(mode) {
    recurringDraft.share_mode = mode
    if (mode === 'amount') resetRecurringShares()
  }

  async function saveRecurring() {
    if (saving.value) return
    error.value = ''
    if (!recurringDraft.name.trim() || !isPositiveAmount(recurringDraft.amount)) {
      error.value = 'Añade un nombre y un importe mayor que cero.'
      return
    }
    if (!recurringDraft.applies_to_all && !recurringDraft.participant_uids.length) {
      error.value = 'Selecciona al menos una persona a la que se aplica el movimiento.'
      return
    }
    if (recurringDraft.paid_by_type === 'person' && !memberOptions.value.some(member => member.uid === recurringDraft.paid_by_uid)) {
      error.value = 'Selecciona quién paga o recibe este movimiento.'
      return
    }
    if (recurringDraft.share_mode === 'amount') {
      error.value = splitValidation(recurringSplitMembers.value.map((member, index) => recurringShareValue(member, index)), recurringDraft.amount)
      if (error.value) return
    }
    const wasEditing = Boolean(recurringDraft.id)
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_recurring', await freshToken(true), {
        ...recurringDraft,
        amount: Number(recurringDraft.amount),
        participant_shares: Object.fromEntries(recurringSplitMembers.value.map((member, index) => [member.uid, Number(recurringShareValue(member, index)) || 0])),
      })
      group.value = data.group
      startRecurringRule()
      flash(wasEditing ? 'Programación actualizada.' : 'Movimiento recurrente guardado.')
    } catch (reason) { error.value = reason.message }
    finally { saving.value = false }
  }

  async function removeRecurring() {
    if (saving.value) return
    if (!recurringDeleteTarget.value) return
    saving.value = true
    try {
      const data = await postJson('gastoteca/delete_recurring', await freshToken(true), { id: recurringDeleteTarget.value.id })
      group.value = data.group
      recurringDeleteTarget.value = null
      if (recurringDraft.id && !group.value.recurring.some((rule) => rule.id === recurringDraft.id)) startRecurringRule()
      flash('Programación eliminada.')
    } catch (reason) { error.value = reason.message }
    finally { saving.value = false }
  }

  return { toggleRecurring, startRecurringRule, recurringShareValue, resetRecurringShares, setRecurringShareMode, saveRecurring, removeRecurring }
}
