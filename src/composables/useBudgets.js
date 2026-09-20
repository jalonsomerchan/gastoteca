import { isPositiveAmount } from '../domain/validation.js'
import { postJson } from '../lib/api.js'

export function useBudgets({ error, saving, freshToken, budgetDraft, group, flash }) {
  async function saveBudget() {
    if (saving.value) return
    error.value = ''
    if (!isPositiveAmount(budgetDraft.monthly_limit)) {
      error.value = 'Añade un límite mensual mayor que cero.'
      return
    }
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_budget', await freshToken(true), { ...budgetDraft })
      group.value = data.group
      budgetDraft.monthly_limit = ''
      flash('Presupuesto mensual guardado.')
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  async function deleteBudget(categoryKey) {
    if (saving.value) return
    saving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/delete_budget', await freshToken(true), { category: categoryKey })
      group.value = data.group
      flash('Presupuesto eliminado.')
    } catch (reason) { error.value = reason.message }
    finally { saving.value = false }
  }

  return { saveBudget, deleteBudget }
}
