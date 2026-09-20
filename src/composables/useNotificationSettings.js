import { postJson, getJson } from '../lib/api.js'

export function useNotificationSettings({
  telegramSaving,
  error,
  freshToken,
  telegramNotificationTypes,
  flash,
  notificationSaving,
  appNotificationTypes,
  telegramLinkUrl,
  telegramConfigured,
  telegramConnected,
  telegramUsername,
}) {
  async function saveTelegramSettings() {
    if (telegramSaving.value) return
    telegramSaving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/save_telegram_settings', await freshToken(true), { notification_types: telegramNotificationTypes.value })
      telegramNotificationTypes.value = data.notification_types || []
      flash('Preferencias de Telegram guardadas.')
    } catch (reason) { error.value = reason.message }
    finally { telegramSaving.value = false }
  }

  async function saveNotificationSettings() {
    if (notificationSaving.value) return
    notificationSaving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/save_notification_settings', await freshToken(true), { notification_types: appNotificationTypes.value })
      appNotificationTypes.value = data.notification_types || []
      flash('Preferencias de notificaciones guardadas.')
    } catch (reason) { error.value = reason.message }
    finally { notificationSaving.value = false }
  }

  async function beginTelegramLink() {
    error.value = ''
    try {
      const data = await postJson('menudiario/telegram_link', await freshToken(true), {})
      telegramLinkUrl.value = data.url || ''
      telegramConfigured.value = true
    } catch (reason) { error.value = reason.message }
  }

  async function refreshTelegramStatus() {
    try {
      const data = await getJson('menudiario/telegram_status', await freshToken(true))
      telegramConnected.value = Boolean(data.telegram?.connected)
      telegramUsername.value = data.telegram?.username || data.telegram?.first_name || ''
    } catch (reason) { error.value = reason.message }
  }

  return { saveTelegramSettings, saveNotificationSettings, beginTelegramLink, refreshTelegramStatus }
}
