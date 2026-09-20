import { isPositiveAmount, splitValidation } from '../domain/validation.js'
import { postJson } from '../lib/api.js'
import { historyFieldLabels, paymentMethodLabel } from '../domain/catalogs.js'
import { money, dateLabel, normalizeName } from '../utils/formatters.js'
import { nextTick } from 'vue'

export function useExpenses({
  error,
  expenseHistoryForId,
  expenseHistoryEntries,
  quickExpenseMode,
  quickAmount,
  tagInput,
  draft,
  emptyDraft,
  currentMember,
  memberOptions,
  group,
  modalOpen,
  locationStatus,
  expenseHistoryLoading,
  freshToken,
  category,
  memberLabel,
  quickAmountInput,
  saving,
  expenses,
  stats,
  settlements,
  flash,
  splitMembers,
  deleteTarget,
}) {
  let expenseHistoryRequestId = 0

  function openExpense(expense = null) {
    error.value = ''
    expenseHistoryForId.value = 0
    expenseHistoryEntries.value = []
    quickExpenseMode.value = false
    quickAmount.value = ''
    tagInput.value = ''
    Object.assign(draft, emptyDraft(), expense ? {
      ...expense,
      transaction_type: expense.transaction_type || 'expense',
      amount: Number(expense.amount).toFixed(2),
      occurred_at: expense.occurred_at.replace(' ', 'T').slice(0, 16),
      participant_uids: [...(expense.participant_uids || [])],
      participant_shares: Object.fromEntries((expense.participants || []).map((participant) => [participant.uid, Number(participant.share_amount).toFixed(2)])),
      share_mode: 'amount',
      tags: [...(expense.tags || [])],
      recurrence: 'none',
    } : {})
    if (!draft.paid_by_uid) draft.paid_by_uid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
    if (!expense) draft.city = group.value?.default_city || ''
    modalOpen.value = true
    locationStatus.value = ''
  }

  function closeExpenseModal() {
    modalOpen.value = false
    quickExpenseMode.value = false
    quickAmount.value = ''
    expenseHistoryForId.value = 0
    expenseHistoryEntries.value = []
  }

  async function loadExpenseHistory(expenseId) {
    const requestId = ++expenseHistoryRequestId
    expenseHistoryForId.value = Number(expenseId)
    expenseHistoryEntries.value = []
    expenseHistoryLoading.value = true
    try {
      const data = await postJson('gastoteca/expense_history', await freshToken(true), { id: expenseId })
      if (requestId === expenseHistoryRequestId) expenseHistoryEntries.value = data.history || []
    } catch (reason) {
      error.value = reason.message
      expenseHistoryForId.value = 0
    } finally {
      if (requestId === expenseHistoryRequestId) expenseHistoryLoading.value = false
    }
  }

  function historyChangeEntries(entry) {
    return Object.entries(entry.changes || {}).map(([field, values]) => ({ field, label: historyFieldLabels[field] || field, ...values }))
  }

  function historyValue(field, value) {
    if (value === null || value === undefined || value === '') return '—'
    if (field === 'amount') return money(value)
    if (field === 'transaction_type') return value === 'income' ? 'Ingreso' : 'Gasto'
    if (field === 'category') return category(value).label
    if (field === 'occurred_at') return dateLabel(value)
    if (field === 'payment_method') return paymentMethodLabel(value)
    if (field === 'paid_by_type') return value === 'all' ? 'Todo el grupo' : 'Una persona'
    if (field === 'paid_by_uid') return memberLabel(value)
    if (field === 'applies_to_all' || field === 'is_quick') return value ? 'Sí' : 'No'
    if (field === 'participant_uids') return value.length ? value.map(memberLabel).join(', ') : 'Nadie'
    if (field === 'participants') return value.length ? value.map((item) => `${memberLabel(item.uid)}: ${money(item.share_amount)}`).join(' · ') : 'Sin reparto'
    if (field === 'tags') return value.length ? value.join(', ') : 'Sin etiquetas'
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  function startQuickExpense() {
    quickExpenseMode.value = true
    quickAmount.value = ''
    nextTick(() => quickAmountInput.value?.focus())
  }

  async function saveQuickExpense() {
    if (saving.value) return
    error.value = ''
    const amount = Number(quickAmount.value)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999) {
      error.value = 'Añade un importe mayor que cero.'
      return
    }

    saving.value = true
    try {
      const quickDraft = {
        ...emptyDraft(),
        transaction_type: 'expense',
        name: 'Gasto rápido',
        category: 'other',
        city: group.value?.default_city || 'Sin ciudad',
        amount: amount.toFixed(2),
        paid_by_type: 'person',
        paid_by_uid: currentMember.value?.uid || memberOptions.value[0]?.uid || '',
        applies_to_all: true,
        participant_uids: [],
        is_quick: true,
      }
      const data = await postJson('gastoteca/save_expense', await freshToken(true), quickDraft)
      expenses.value = data.expenses
      stats.value = data.stats
      settlements.value = data.settlements || settlements.value
      if (data.group) group.value = data.group
      closeExpenseModal()
      flash('Gasto rápido guardado. Puedes completarlo desde la lista.')
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  function selectFrequentName(suggestion) {
    let profile = suggestion
    if (suggestion.items?.length) {
      const configurations = new Map()
      suggestion.items.forEach((item) => {
        const key = JSON.stringify([
          item.category,
          item.paid_by_type,
          item.paid_by_uid || '',
          Boolean(item.applies_to_all),
          item.participant_uids || [],
        ])
        if (!configurations.has(key)) configurations.set(key, { item, count: 0 })
        configurations.get(key).count += 1
      })
      profile = [...configurations.values()].sort((a, b) => b.count - a.count)[0].item
    }

    draft.name = suggestion.name
    draft.category = profile.category || 'other'
    draft.paid_by_type = profile.paid_by_type || 'person'
    draft.paid_by_uid = memberOptions.value.some((member) => member.uid === profile.paid_by_uid)
      ? profile.paid_by_uid
      : (currentMember.value?.uid || memberOptions.value[0]?.uid || '')
    draft.applies_to_all = profile.applies_to_all ?? true
    const validParticipants = (profile.participant_uids || []).filter((uid) => memberOptions.value.some((member) => member.uid === uid))
    draft.participant_uids = validParticipants
    if (!draft.applies_to_all && !validParticipants.length) draft.applies_to_all = true
  }

  function setShareMode(mode) {
    const previousMode = draft.share_mode
    const members = splitMembers.value
    const amount = Number(draft.amount) || 0
    const previousValues = Object.fromEntries(members.map((member, index) => [member.uid, Number(shareValue(member, index)) || 0]))
    draft.share_mode = mode
    if (mode === 'equal') return
    let used = 0
    members.forEach((member, index) => {
      const last = index === members.length - 1
      if (mode === 'percent') {
        const percent = previousMode === 'percent'
          ? previousValues[member.uid]
          : last ? 100 - used : amount > 0 ? previousValues[member.uid] / amount * 100 : 100 / Math.max(1, members.length)
        draft.participant_shares[member.uid] = Math.max(0, percent).toFixed(2)
        used += Number(draft.participant_shares[member.uid])
      } else {
        const share = previousMode === 'amount'
          ? previousValues[member.uid]
          : last ? amount - used : previousMode === 'percent' ? amount * previousValues[member.uid] / 100 : amount / Math.max(1, members.length)
        draft.participant_shares[member.uid] = Math.max(0, share).toFixed(2)
        used += Number(draft.participant_shares[member.uid])
      }
    })
  }

  function shareValue(member, index) {
    const value = draft.participant_shares[member.uid]
    if (value !== undefined) return value
    const count = Math.max(1, splitMembers.value.length)
    if (draft.share_mode === 'percent') return (100 / count).toFixed(2)
    const total = Number(draft.amount) || 0
    return (index === count - 1 ? total - (total / count) * index : total / count).toFixed(2)
  }

  function addDraftTag(value = tagInput.value) {
    const name = String(value || '').trim().slice(0, 40)
    if (!name || draft.tags.some((tag) => normalizeName(tag) === normalizeName(name)) || draft.tags.length >= 10) return
    draft.tags.push(name)
    tagInput.value = ''
  }

  async function saveExpense() {
    if (saving.value) return
    error.value = ''
    if (!draft.transaction_type) {
      error.value = 'Selecciona si es un gasto o un ingreso.'
      return
    }
    if (!draft.name.trim() || !isPositiveAmount(draft.amount)) {
      error.value = 'Añade un nombre y un importe mayor que cero.'
      return
    }
    if (!draft.applies_to_all && !draft.participant_uids.length) {
      error.value = 'Selecciona al menos una persona a la que se aplica el movimiento.'
      return
    }
    if (draft.share_mode !== 'equal' && !splitMembers.value.length) {
      error.value = 'Selecciona participantes antes de personalizar el reparto.'
      return
    }
    if (draft.paid_by_type === 'person' && !memberOptions.value.some(member => member.uid === draft.paid_by_uid)) {
      error.value = 'Selecciona quién ha pagado o recibido el movimiento.'
      return
    }
    if (draft.share_mode !== 'equal') {
      error.value = splitValidation(splitMembers.value.map((member, index) => shareValue(member, index)), draft.share_mode === 'percent' ? 100 : draft.amount, draft.share_mode === 'percent')
      if (error.value) return
    }
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_expense', await freshToken(true), {
        ...draft,
        city: draft.city || group.value?.default_city || 'Sin ciudad',
        details: draft.details || '',
        occurred_at: draft.occurred_at || emptyDraft().occurred_at,
        participant_shares: Object.fromEntries(splitMembers.value.map((member, index) => [member.uid, Number(shareValue(member, index)) || 0])),
        is_quick: false,
      })
      expenses.value = data.expenses
      stats.value = data.stats
      settlements.value = data.settlements || settlements.value
      if (data.group) group.value = data.group
      closeExpenseModal()
      const movement = draft.transaction_type === 'income' ? 'Ingreso' : 'Gasto'
      flash(draft.id ? `${movement} actualizado.` : `${movement} añadido.`)
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  async function removeExpense() {
    if (saving.value) return
    const target = deleteTarget.value
    if (!target) return
    const movement = target.transaction_type === 'income' ? 'Ingreso' : 'Gasto'
    saving.value = true
    try {
      const data = await postJson('gastoteca/delete_expense', await freshToken(true), { id: target.id })
      expenses.value = data.expenses
      stats.value = data.stats
      settlements.value = data.settlements || settlements.value
      deleteTarget.value = null
      closeExpenseModal()
      flash(`${movement} eliminado.`)
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  return { openExpense, closeExpenseModal, loadExpenseHistory, historyChangeEntries, historyValue, startQuickExpense, saveQuickExpense, selectFrequentName, setShareMode, shareValue, addDraftTag, saveExpense, removeExpense }
}
