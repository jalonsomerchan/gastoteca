import { postJson } from '../lib/api.js'

export function useBudgets({ error, saving, freshToken, budgetDraft, group, flash }) {
  async function saveBudget() {
    error.value = ''
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
    try {
      const data = await postJson('gastoteca/delete_budget', await freshToken(true), { category: categoryKey })
      group.value = data.group
      flash('Presupuesto eliminado.')
    } catch (reason) { error.value = reason.message }
  }

  return { saveBudget, deleteBudget }
}
