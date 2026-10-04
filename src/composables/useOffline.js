import { reactive } from 'vue'
import { API_BASE, networkRequest, setOfflineClient, getJson } from '../lib/api.js'
import { createOfflineStorage } from '../lib/offlineStorage.js'
import { createOfflineClient } from '../lib/offlineClient.js'

export function useOffline({ user, group, expenses, settlements, stats, quickExpenseTemplates, notifications, unreadNotificationCount, freshToken, error }) {
  const offline = reactive({ offline: false, serverUnavailable: false, ready: false, pending: 0, syncing: false, savedAt: null, syncError: '', storageError: '', shellReady: false })
  let client = null
  let channel = null
  let session = 0

  function hydrate(snapshot) {
    if (!snapshot) return
    if (snapshot.group) group.value = snapshot.group
    if (snapshot.expenses) expenses.value = snapshot.expenses
    if (snapshot.settlements) settlements.value = snapshot.settlements
    if (snapshot.stats) stats.value = snapshot.stats
    if (snapshot.templates) quickExpenseTemplates.value = snapshot.templates
    if (snapshot.notifications) notifications.value = snapshot.notifications
    if (snapshot.unread_count !== undefined) unreadNotificationCount.value = snapshot.unread_count
  }

  function stopOffline() {
    session++
    client?.stop()
    client = null
    channel?.close()
    channel = null
    setOfflineClient(null)
    Object.assign(offline, { ready: false, pending: 0, syncing: false, syncError: '', storageError: '', serverUnavailable: false })
  }

  async function startOffline() {
    stopOffline()
    const currentSession = session
    const uid = user.value.uid
    offline.offline = navigator.onLine === false
    if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(`gastoteca:${API_BASE}:${uid}`)
    const currentClient = createOfflineClient({
      uid,
      storage: createOfflineStorage(`${API_BASE}:${uid}`),
      transport: networkRequest,
      getToken: () => freshToken(true, true),
      onChange: state => {
        if (currentSession !== session || user.value?.uid !== uid) return
        const { snapshot, ...status } = state
        Object.assign(offline, status)
        hydrate(snapshot)
      },
      broadcast: () => channel?.postMessage('changed'),
    })
    client = currentClient
    setOfflineClient(currentClient)
    if (channel) channel.onmessage = () => currentClient.refresh().catch(() => {})
    try {
      const snapshot = await currentClient.refresh()
      // Recover the queue independently of optional settings and icon loading.
      if (currentSession === session && offline.pending && navigator.onLine !== false) currentClient.retry().catch(reason => {
        if (currentSession === session) offline.syncError = reason.message
      })
      return snapshot
    } catch {
      offline.storageError = 'No se puede preparar el almacenamiento sin conexión en este navegador.'
      return null
    }
  }

  async function prepareOfflineData() {
    const uid = user.value?.uid
    if (!uid) return
    try {
      const token = await freshToken()
      await getJson('gastoteca/bootstrap', token)
      if (user.value?.uid !== uid) return
      await Promise.allSettled([
        'gastoteca/quick_expense_templates', 'gastoteca/telegram_settings', 'menudiario/telegram_status',
        'gastoteca/notification_settings', 'gastoteca/backup_settings', 'gastoteca/summary_settings',
      ].map(path => getJson(path, token)))
      if (user.value?.uid !== uid) return
      const icons = [
        ...Object.values(group.value?.category_icons || {}),
        ...(group.value?.establishments || []).map(item => item.icon),
        ...quickExpenseTemplates.value.map(item => item.icon),
      ].filter(Boolean)
      customElements.get('iconify-icon')?.loadIcons([...new Set(icons)])
    } catch { /* The current route still reports any unavailable data. */ }
  }

  async function syncOffline() {
    offline.offline = navigator.onLine === false
    try { await client?.retry() } catch (reason) { error.value = reason.message }
  }

  async function exportOfflineChanges() {
    try {
      const data = await client?.exportPending()
      if (!data) return
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `gastoteca-pendientes-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { error.value = reason.message }
  }

  async function discardOfflineChanges() {
    if (!window.confirm(`Se descartarán ${offline.pending} cambios pendientes de este dispositivo. Puedes descargar una copia antes de continuar. ¿Descartar los cambios?`)) return
    try { await client?.discardPending() } catch (reason) { error.value = reason.message }
  }

  return { offline, startOffline, stopOffline, prepareOfflineData, syncOffline, exportOfflineChanges, discardOfflineChanges }
}
