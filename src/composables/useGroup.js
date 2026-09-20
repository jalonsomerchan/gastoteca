import { postJson } from '../lib/api.js'

export function useGroup({
  inviteEmail,
  error,
  inviteSending,
  freshToken,
  group,
  flash,
  saving,
  defaultCityDraft,
  defaultPaymentMethodDraft,
  catalogDraft,
  catalogEstablishments,
  categories,
  joinCode,
  expenses,
  stats,
  settlements,
  loadNotifications,
}) {
  async function invite() {
    const email = inviteEmail.value.trim()
    error.value = ''
    inviteSending.value = true
    try {
      const data = await postJson('gastoteca/invite_email', await freshToken(true), { email })
      group.value = data.group
      inviteEmail.value = ''
      flash(`Invitación enviada a ${email}.`)
    } catch (reason) {
      error.value = reason.message
    } finally {
      inviteSending.value = false
    }
  }

  async function saveGroupSettings() {
    saving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/update_group_settings', await freshToken(true), { default_city: defaultCityDraft.value, default_payment_method: defaultPaymentMethodDraft.value })
      group.value = data.group
      flash('Preferencias del grupo actualizadas.')
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  function prepareCatalogDraft() {
    catalogDraft.establishments = catalogEstablishments.value.map((item) => ({ ...item }))
    catalogDraft.categories = categories.value.map((item) => ({ key: item.id, label: item.label, icon: item.icon }))
  }

  async function saveCatalogIcons() {
    error.value = ''
    const allIcons = [...catalogDraft.establishments, ...catalogDraft.categories]
    if (allIcons.some((item) => !/^[a-z0-9][a-z0-9-]*:[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(item.icon))) {
      error.value = 'Usa el formato de Iconify, por ejemplo mdi:store-outline.'
      return
    }
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_catalog_icons', await freshToken(true), {
        establishments: catalogDraft.establishments,
        categories: catalogDraft.categories,
      })
      group.value = data.group
      prepareCatalogDraft()
      flash('Iconos guardados para todo el grupo.')
    } catch (reason) {
      error.value = reason.message
    } finally {
      saving.value = false
    }
  }

  async function joinGroup() {
    try {
      const data = await postJson('gastoteca/join_group', await freshToken(true), { invite_code: joinCode.value })
      group.value = data.group
      expenses.value = data.expenses
      stats.value = data.stats
      settlements.value = data.settlements || []
      joinCode.value = ''
      await loadNotifications()
      flash('Ya formas parte del grupo.')
    } catch (reason) { error.value = reason.message }
  }

  async function leaveGroup() {
    try {
      const data = await postJson('gastoteca/leave_group', await freshToken(true), {})
      group.value = data.group
      expenses.value = data.expenses
      stats.value = data.stats
      settlements.value = data.settlements || []
      await loadNotifications()
      flash('Has creado un nuevo grupo personal.')
    } catch (reason) { error.value = reason.message }
  }

  return { invite, saveGroupSettings, prepareCatalogDraft, saveCatalogIcons, joinGroup, leaveGroup }
}
