import { isPositiveAmount, splitValidation } from '../domain/validation.js'
import { postJson } from '../lib/api.js'
import { historyFieldLabels, paymentMethodLabel } from '../domain/catalogs.js'
import { money, dateLabel, normalizeName } from '../utils/formatters.js'
import { computed, nextTick } from 'vue'

function equalShareCents(amount, count, index) {
  const totalCents = Math.round((Number(amount) || 0) * 100)
  if (count <= 0) return totalCents
  const regularShare = Math.round(totalCents / count)
  return index === count - 1 ? totalCents - regularShare * (count - 1) : regularShare
}

function hasEqualParticipantShares(expense) {
  const participants = expense.participants || []
  if (!participants.length) return false

  const count = participants.length
  const expected = Array.from({ length: count }, (_, index) => equalShareCents(expense.amount, count, index)).sort((a, b) => a - b)
  const actual = participants.map(participant => Math.round(Number(participant.share_amount) * 100)).sort((a, b) => a - b)
  return actual.length === expected.length && actual.every((amount, index) => amount === expected[index])
}

function participantSharesForDraft(expense, shareMode) {
  const participants = expense.participants || []
  if (shareMode !== 'percent') {
    return Object.fromEntries(participants.map(participant => [participant.uid, Number(participant.share_amount).toFixed(2)]))
  }

  const total = Number(expense.amount) || 0
  const totalCents = Math.round(total * 100)
  const percentages = participants.map((participant, index) => {
    const exactUnits = totalCents > 0 ? Math.round(Number(participant.share_amount) * 100) / totalCents * 10000 : 0
    const units = Math.floor(exactUnits)
    return { uid: participant.uid, index, units, remainder: exactUnits - units }
  })
  let remainingUnits = 10000 - percentages.reduce((sum, item) => sum + item.units, 0)
  percentages.slice().sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .slice(0, remainingUnits)
    .forEach(item => { item.units += 1 })
  return Object.fromEntries(percentages.map(item => [item.uid, (item.units / 100).toFixed(2)]))
}

export function useExpenses({
  error,
  expenseHistoryForId,
  expenseHistoryEntries,
  quickExpenseMode,
  quickAmount,
  quickExpenseTemplates,
  quickTemplateEditorOpen,
  quickTemplateEditorReturnToManager,
  quickTemplatePromptOpen,
  quickTemplateDraft,
  quickTemplatePrompt,
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
  loadNotifications,
}) {
  let expenseHistoryRequestId = 0
  const ownedQuickExpenseTemplates = computed(() => quickExpenseTemplates.value.filter(canEditQuickExpenseTemplate))

  function canEditQuickExpenseTemplate(template) {
    return template.can_edit !== false && (!template.created_by || template.created_by === currentMember.value?.uid)
  }

  function requireOwnQuickExpenseTemplate(template) {
    if (canEditQuickExpenseTemplate(template)) return true
    error.value = 'Solo quien creó este gasto rápido puede modificarlo.'
    return false
  }

  function openExpense(expense = null) {
    error.value = ''
    expenseHistoryForId.value = 0
    expenseHistoryEntries.value = []
    quickExpenseMode.value = false
    quickTemplateEditorOpen.value = false
    quickTemplatePromptOpen.value = false
    quickAmount.value = ''
    tagInput.value = ''
    const defaultPayerUid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
    const shareMode = expense
      ? ['equal', 'amount', 'percent'].includes(expense.share_mode)
        ? expense.share_mode
        : hasEqualParticipantShares(expense) ? 'equal' : 'amount'
      : 'equal'
    const participantShares = expense ? participantSharesForDraft(expense, shareMode) : {}
    Object.assign(draft, emptyDraft(), expense ? {
      ...expense,
      transaction_type: expense.transaction_type || 'expense',
      amount: Number(expense.amount).toFixed(2),
      occurred_at: expense.occurred_at.replace(' ', 'T').slice(0, 16),
      participant_uids: [...(expense.participant_uids || [])],
      participant_shares: participantShares,
      share_mode: shareMode,
      tags: [...(expense.tags || [])],
      recurrence: 'none',
    } : {
      paid_by_type: 'person',
      paid_by_uid: defaultPayerUid,
    })
    if (!draft.paid_by_uid) draft.paid_by_uid = defaultPayerUid
    if (!expense) draft.city = group.value?.default_city || ''
    modalOpen.value = true
    locationStatus.value = ''
  }

  function closeExpenseModal() {
    modalOpen.value = false
    quickExpenseMode.value = false
    quickTemplateEditorOpen.value = false
    quickTemplateEditorReturnToManager.value = false
    quickTemplatePromptOpen.value = false
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
    if (field === 'share_mode') return ({ equal: 'Dividir igualmente', amount: 'Por cantidad', percent: 'Por porcentaje' })[value] || String(value)
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
    quickTemplateEditorOpen.value = false
    quickTemplatePromptOpen.value = false
    quickExpenseMode.value = true
    quickAmount.value = ''
    nextTick(() => quickAmountInput.value?.focus())
  }

  function openQuickTemplateEditor(template = null, returnToManager = false) {
    error.value = ''
    if (template && !requireOwnQuickExpenseTemplate(template)) return
    quickTemplateEditorReturnToManager.value = returnToManager
    if (returnToManager) modalOpen.value = true
    quickExpenseMode.value = false
    quickTemplatePromptOpen.value = false
    quickTemplateEditorOpen.value = true
    const defaultPayerUid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
    Object.assign(quickTemplateDraft, {
      id: template?.id || '',
      title: template?.title || '',
      icon: template?.icon || 'mdi:lightning-bolt-outline',
      visibility: template?.visibility === 'group' ? 'group' : 'private',
      active: template?.active !== false,
      sort_order: template?.sort_order ?? ownedQuickExpenseTemplates.value.length,
      fields: [...(template?.fields || ['name', 'amount', 'category', 'paid_by_type'])],
      name: template?.name || '',
      amount: template?.amount ?? '',
      category: template?.category || 'other',
      place: template?.place || '',
      city: template?.city || group.value?.default_city || '',
      details: template?.details || '',
      payment_method: template?.payment_method || group.value?.default_payment_method || 'card',
      paid_by_type: template?.paid_by_type || 'person',
      paid_by_uid: template?.paid_by_uid || defaultPayerUid,
      applies_to_all: template?.applies_to_all ?? true,
      participant_uids: [...(template?.participant_uids || [])],
      share_mode: template?.share_mode || 'equal',
      participant_shares: { ...(template?.participant_shares || {}) },
      tags_text: (template?.tags || []).join(', '),
      recurrence: template?.recurrence || 'none',
      occurred_at: template?.occurred_at || '',
    })
  }

  function cancelQuickTemplateEditor() {
    if (quickTemplateEditorReturnToManager.value) closeExpenseModal()
    else quickTemplateEditorOpen.value = false
  }

  async function saveQuickExpenseTemplates(templates, notice = '') {
    if (saving.value) return false
    saving.value = true
    error.value = ''
    const orderedTemplates = templates.filter(canEditQuickExpenseTemplate).map((template, sort_order) => ({
      ...template,
      active: template.active !== false,
      sort_order,
    }))
    try {
      const data = await postJson('gastoteca/save_quick_expense_templates', await freshToken(true), { templates: orderedTemplates })
      quickExpenseTemplates.value = data.templates || [...orderedTemplates, ...quickExpenseTemplates.value.filter(template => !canEditQuickExpenseTemplate(template))]
      if (notice) flash(notice)
      return true
    } catch (reason) {
      error.value = reason.message
      return false
    } finally {
      saving.value = false
    }
  }

  async function saveQuickExpenseTemplate() {
    if (saving.value) return
    error.value = ''
    const template = quickTemplateDraft
    const cleanText = value => String(value ?? '').trim()
    const fields = [...new Set(template.fields)]
    const title = cleanText(template.title).slice(0, 60)
    const name = cleanText(template.name)
    if (!title) {
      error.value = 'Pon un nombre para este gasto rápido.'
      return
    }
    if (!fields.length) {
      error.value = 'Elige al menos un campo para guardar automáticamente.'
      return
    }
    if (fields.includes('name') && !name) {
      error.value = 'Añade el nombre del gasto o desmarca ese campo.'
      return
    }
    if (fields.includes('amount') && !isPositiveAmount(template.amount)) {
      error.value = 'Añade un importe válido o desmarca ese campo.'
      return
    }
    if (fields.includes('paid_by_type') && template.paid_by_type === 'person' && !memberOptions.value.some(member => member.uid === template.paid_by_uid)) {
      error.value = 'Selecciona quién paga este gasto rápido.'
      return
    }
    const participantUids = template.applies_to_all
      ? memberOptions.value.map(member => member.uid)
      : template.participant_uids.filter(uid => memberOptions.value.some(member => member.uid === uid))
    if (fields.includes('participants') && !participantUids.length) {
      error.value = 'Selecciona al menos una persona para repartir este gasto.'
      return
    }
    if (!template.id && ownedQuickExpenseTemplates.value.length >= 12) {
      error.value = 'Ya has creado el máximo de 12 gastos rápidos.'
      return
    }

    const savedTemplate = {
      id: template.id || globalThis.crypto?.randomUUID?.() || `quick-${Date.now()}`,
      title,
      icon: template.icon || 'mdi:lightning-bolt-outline',
      visibility: template.visibility === 'group' ? 'group' : 'private',
      created_by: currentMember.value?.uid || '',
      fields,
      name,
      amount: template.amount === '' ? '' : Number(template.amount).toFixed(2),
      category: template.category || 'other',
      place: cleanText(template.place),
      city: cleanText(template.city),
      details: cleanText(template.details),
      payment_method: template.payment_method,
      paid_by_type: template.paid_by_type,
      paid_by_uid: template.paid_by_type === 'person' ? template.paid_by_uid : '',
      applies_to_all: template.applies_to_all,
      participant_uids: template.applies_to_all ? [] : participantUids,
      share_mode: template.share_mode,
      participant_shares: template.share_mode === 'equal' ? {} : { ...template.participant_shares },
      tags: cleanText(template.tags_text).split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 10),
      recurrence: template.recurrence,
      occurred_at: template.occurred_at,
      active: template.active !== false,
      sort_order: Number.isInteger(template.sort_order) ? template.sort_order : ownedQuickExpenseTemplates.value.length,
    }

    const templates = [...ownedQuickExpenseTemplates.value]
    const existingIndex = templates.findIndex(item => item.id === savedTemplate.id)
    if (existingIndex >= 0) templates[existingIndex] = savedTemplate
    else templates.push(savedTemplate)
    if (!await saveQuickExpenseTemplates(templates)) return
    quickTemplateEditorOpen.value = false
    if (quickTemplateEditorReturnToManager.value) closeExpenseModal()
    flash('Gasto rápido guardado.')
  }

  async function deleteQuickExpenseTemplate(template) {
    if (!requireOwnQuickExpenseTemplate(template)) return false
    const templates = ownedQuickExpenseTemplates.value.filter(item => item.id !== template.id)
    return saveQuickExpenseTemplates(templates, `«${template.title}» eliminado.`)
  }

  async function applyQuickExpenseTemplate(template) {
    quickTemplateEditorOpen.value = false
    quickTemplatePromptOpen.value = false
    const fields = new Set(template.fields || [])
    const defaultPayerUid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
    Object.assign(draft, emptyDraft(), {
      transaction_type: 'expense',
      name: fields.has('name') ? template.name : '',
      amount: fields.has('amount') ? String(template.amount) : '',
      category: fields.has('category') ? template.category : 'other',
      place: fields.has('place') ? template.place : '',
      city: fields.has('city') ? template.city : (group.value?.default_city || ''),
      details: fields.has('details') ? template.details : '',
      payment_method: fields.has('payment_method') ? template.payment_method : (group.value?.default_payment_method || 'card'),
      paid_by_type: fields.has('paid_by_type') ? template.paid_by_type : 'person',
      paid_by_uid: fields.has('paid_by_type') && template.paid_by_type === 'person' && memberOptions.value.some(member => member.uid === template.paid_by_uid)
        ? template.paid_by_uid
        : defaultPayerUid,
      applies_to_all: fields.has('participants') ? Boolean(template.applies_to_all) : true,
      participant_uids: fields.has('participants') && !template.applies_to_all
        ? template.participant_uids.filter(uid => memberOptions.value.some(member => member.uid === uid))
        : [],
      participant_shares: fields.has('participants') ? { ...(template.participant_shares || {}) } : {},
      share_mode: fields.has('participants') ? (template.share_mode || 'equal') : 'equal',
      tags: fields.has('tags') ? [...(template.tags || [])] : [],
      recurrence: fields.has('recurrence') ? template.recurrence : 'none',
      occurred_at: fields.has('occurred_at') && template.occurred_at ? template.occurred_at : emptyDraft().occurred_at,
      is_quick: false,
    })
    quickExpenseMode.value = false
    modalOpen.value = true
    locationStatus.value = ''
    if (!fields.has('name')) return

    const askAmount = !fields.has('amount')
    const askPayer = !fields.has('paid_by_type')
    if (askAmount || askPayer) {
      Object.assign(quickTemplatePrompt, {
        templateId: template.id,
        title: template.title,
        askAmount,
        askPayer,
        amount: '',
        paid_by_type: 'person',
        paid_by_uid: currentMember.value?.uid || memberOptions.value[0]?.uid || '',
      })
      quickTemplatePromptOpen.value = true
      return
    }
    await saveExpense()
  }

  async function saveQuickExpenseTemplatePrompt() {
    if (saving.value) return
    error.value = ''
    if (quickTemplatePrompt.askAmount) {
      if (!isPositiveAmount(quickTemplatePrompt.amount)) {
        error.value = 'Añade un importe mayor que cero.'
        return
      }
      draft.amount = Number(quickTemplatePrompt.amount).toFixed(2)
    }
    if (quickTemplatePrompt.askPayer) {
      if (quickTemplatePrompt.paid_by_type === 'person' && !memberOptions.value.some(member => member.uid === quickTemplatePrompt.paid_by_uid)) {
        error.value = 'Selecciona quién ha pagado el gasto.'
        return
      }
      draft.paid_by_type = quickTemplatePrompt.paid_by_type === 'all' ? 'all' : 'person'
      draft.paid_by_uid = draft.paid_by_type === 'all' ? '' : quickTemplatePrompt.paid_by_uid
    }
    await saveExpense()
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
    if (draft.share_mode === 'equal') {
      return (equalShareCents(draft.amount, splitMembers.value.length, index) / 100).toFixed(2)
    }
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

  async function confirmExpense(expenseId) {
    if (saving.value) return
    saving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/confirm_expense', await freshToken(true), { id: expenseId })
      expenses.value = data.expenses || expenses.value
      stats.value = data.stats || stats.value
      if (data.group) group.value = data.group
      closeExpenseModal()
      await loadNotifications()
      flash('Movimiento confirmado y compartido con el grupo.')
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  return { openExpense, closeExpenseModal, loadExpenseHistory, historyChangeEntries, historyValue, startQuickExpense, saveQuickExpense, ownedQuickExpenseTemplates, canEditQuickExpenseTemplate, openQuickTemplateEditor, saveQuickExpenseTemplate, saveQuickExpenseTemplates, cancelQuickTemplateEditor, applyQuickExpenseTemplate, saveQuickExpenseTemplatePrompt, deleteQuickExpenseTemplate, selectFrequentName, setShareMode, shareValue, addDraftTag, saveExpense, confirmExpense, removeExpense }
}
