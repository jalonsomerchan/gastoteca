import { computed } from 'vue'
import { isPositiveAmount } from '../domain/validation.js'
import { postJson } from '../lib/api.js'

export const debtStatuses = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'paid', label: 'Pagada' },
  { value: 'cancelled', label: 'Cancelada' },
]

export const debtStatusLabel = status => debtStatuses.find(item => item.value === status)?.label || status

export function useDebts({ error, saving, freshToken, debtDraft, group, memberOptions, currentMember, flash }) {
  const debts = computed(() => group.value?.debts || [])
  const pendingDebtTotal = computed(() => debts.value.filter(debt => debt.status === 'pending')
    .reduce((total, debt) => total + Math.round(Number(debt.amount) * 100), 0) / 100)

  function startDebt(debt = null) {
    const targetUid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
    Object.assign(debtDraft, {
      id: debt?.id || '',
      concept: debt?.concept || '',
      status: debt?.status || 'pending',
      source_uid: debt?.source_uid || memberOptions.value.find(member => member.uid !== targetUid)?.uid || '',
      target_uid: debt?.target_uid || targetUid,
      amount: debt ? Number(debt.amount).toFixed(2) : '',
    })
  }

  async function saveDebt() {
    if (saving.value) return false
    error.value = ''
    if (!debtDraft.concept.trim()) {
      error.value = 'Añade un concepto para la deuda.'
      return false
    }
    if (!isPositiveAmount(debtDraft.amount) || Math.round(Number(debtDraft.amount) * 100) < 1) {
      error.value = 'El importe debe ser al menos 0,01 € y no superar 99.999.999 €.'
      return false
    }
    if (!debtStatuses.some(item => item.value === debtDraft.status)) {
      error.value = 'Selecciona un estado válido.'
      return false
    }
    const existing = debts.value.find(debt => debt.id === debtDraft.id)
    if (!['source', 'target'].every(side => memberOptions.value.some(member => member.uid === debtDraft[`${side}_uid`]) || existing?.[`${side}_uid`] === debtDraft[`${side}_uid`])) {
      error.value = 'Selecciona dos personas del grupo.'
      return false
    }
    if (debtDraft.source_uid === debtDraft.target_uid) {
      error.value = 'La persona a quien pagar y la persona que debe deben ser distintas.'
      return false
    }
    const wasEditing = Boolean(debtDraft.id)
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_debt', await freshToken(true), {
        ...debtDraft, concept: debtDraft.concept.trim(), amount: Number(debtDraft.amount),
      })
      group.value = data.group
      flash(wasEditing ? 'Deuda actualizada.' : 'Deuda creada.')
      return true
    } catch (reason) {
      error.value = reason.message
      return false
    } finally { saving.value = false }
  }

  async function deleteDebt(debt) {
    if (saving.value) return false
    saving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/delete_debt', await freshToken(true), { id: debt.id })
      group.value = data.group
      flash('Deuda eliminada.')
      return true
    } catch (reason) {
      error.value = reason.message
      return false
    } finally { saving.value = false }
  }

  return { debts, pendingDebtTotal, startDebt, saveDebt, deleteDebt }
}
