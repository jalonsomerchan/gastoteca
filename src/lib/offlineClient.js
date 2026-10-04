import { offlineActions, projectOffline, resolveReferences } from '../domain/offline.js'

const clone = value => structuredClone(value)
const unavailable = reason => reason.status === 0 || reason.status >= 500 || reason.status === 408 || reason.status === 429
const cacheKey = (path, options) => `${path}:${options.body || ''}`
const emptyDocument = () => ({ snapshot: {}, cache: {}, queue: [], mappings: {}, savedAt: null, syncVersion: 0, revision: 0 })

export function createOfflineClient({ uid, storage, transport, getToken, isOnline = () => globalThis.navigator?.onLine !== false, onChange = () => {}, broadcast = () => {} }) {
  let stopped = false
  let syncing = null
  let reachable = true
  let storageError = ''

  function publish(document, syncError = '') {
    if (stopped) return
    onChange({
      uid, snapshot: projectOffline(document, uid), pending: document.queue.length,
      syncing: Boolean(syncing), offline: !isOnline(), serverUnavailable: !reachable,
      savedAt: document.savedAt, ready: Boolean(document.snapshot.group && document.snapshot.expenses),
      syncError: syncError || document.queue.find(item => item.error)?.error || '', storageError,
    })
  }

  async function read() { return await storage.read() || emptyDocument() }
  async function update(change) {
    try {
      const document = await storage.update(value => change(value || emptyDocument()))
      storageError = ''
      publish(document)
      broadcast()
      return document
    } catch {
      storageError = 'No se pueden guardar cambios sin conexión en este dispositivo. Revisa el espacio disponible y los permisos del navegador.'
      throw new Error(storageError)
    }
  }

  function merge(document, path, data, options = {}) {
    if (data.group && document.snapshot.group?.id !== data.group.id) {
      if (document.queue.length && document.snapshot.group) return document
      document.snapshot = {}
      document.cache = {}
      document.mappings = {}
    }
    if (path.endsWith('/expense_history')) {
      document.cache[cacheKey(path, options)] = clone(data)
      const keys = Object.keys(document.cache)
      if (keys.length > 100) delete document.cache[keys[0]]
    }
    const snapshot = document.snapshot
    for (const key of ['group', 'expenses', 'settlements', 'stats', 'templates', 'notifications', 'unread_count', 'new_expense_ids']) {
      if (Object.hasOwn(data, key)) snapshot[key] = clone(data[key])
    }
    const action = path.split('/').pop()
    const settings = action.replace(/^save_/, '')
    if (['telegram_settings', 'notification_settings', 'backup_settings', 'summary_settings', 'telegram_status'].includes(settings)) snapshot[settings] = clone(data)
    if (data.offline_sync_version) document.syncVersion = data.offline_sync_version
    document.savedAt = new Date().toISOString()
    return document
  }

  function cached(document, path, options = {}) {
    const snapshot = projectOffline(document, uid)
    const action = path.split('/').pop()
    if (action === 'group' && snapshot.group) return { group: snapshot.group }
    if (['bootstrap', 'expenses', 'expense_feed'].includes(action) && snapshot.group && snapshot.expenses) return { ...snapshot, user_uid: uid }
    if (action === 'statistics' && snapshot.stats) return { stats: snapshot.stats }
    if (action === 'quick_expense_templates' && snapshot.group) return { templates: snapshot.templates || [] }
    if (action === 'notifications' && snapshot.group) return { notifications: snapshot.notifications || [], unread_count: snapshot.unread_count || 0 }
    if (snapshot[action]) return clone(snapshot[action])
    if (action === 'expense_history' && String(JSON.parse(options.body).id).startsWith('local-')) return { history: [] }
    const value = document.cache[cacheKey(path, options)]
    if (value) return clone(value)
    throw new Error('Estos datos todavía no están disponibles sin conexión. Ábrelos cuando el servidor vuelva a responder.')
  }

  async function network(path, token, options) {
    if (!isOnline()) {
      const error = new Error('Esta acción necesita conexión.')
      error.status = 0
      throw error
    }
    try {
      const result = await transport(path, token, options)
      reachable = true
      return result
    } catch (reason) {
      if (unavailable(reason)) reachable = false
      throw reason
    }
  }

  async function flush() {
    if (stopped || !isOnline()) { publish(await read()); return }
    if (syncing) return syncing
    const execute = async () => {
      while (!stopped && isOnline()) {
        const document = await read()
        const operation = document.queue[0]
        if (!operation) return
        publish(document)
        try {
          const token = await getToken()
          if (stopped) return
          const result = await network('gastoteca/sync_operation', token, {
            method: 'POST', body: JSON.stringify({
              operation_id: operation.id, group_id: operation.groupId, action: operation.action,
              body: resolveReferences(operation.body, document.mappings),
              expected_updated_at: operation.expectedUpdatedAt || null,
            }),
          })
          if (!result || !Object.hasOwn(result, 'entity_id') || !result.data || typeof result.data !== 'object') throw Object.assign(new Error('El servidor no confirmó el cambio. Se conservará para reintentarlo.'), { status: 0 })
          await update(current => {
            if (!current.queue.some(item => item.id === operation.id)) return current
            if (operation.localId && result.entity_id !== null && result.entity_id !== undefined) current.mappings[operation.localId] = result.entity_id
            for (const tag of result.data?.group?.tags || []) current.mappings[`tag-${operation.id}-${tag.name}`] = tag.id
            current.queue = current.queue.filter(item => item.id !== operation.id)
            current.revision = (current.revision || 0) + 1
            merge(current, `gastoteca/${operation.action}`, result.data || {})
            return current
          })
        } catch (reason) {
          if (!unavailable(reason)) await update(current => {
            const item = current.queue.find(item => item.id === operation.id)
            if (item) { item.error = reason.message; item.errorCode = reason.code || '' }
            return current
          })
          publish(await read(), reason.message)
          return
        }
      }
    }
    syncing = execute()
    try { await syncing } finally { syncing = null; if (!stopped) publish(await read()) }
  }

  async function request(path, token, options = {}) {
    if (stopped) throw new Error('La sesión ha cambiado. Vuelve a abrir la pantalla.')
    const action = path.split('/').pop()
    const mutation = options.method === 'POST' && action !== 'expense_history'
    let document
    try { document = await read() } catch {
      storageError = 'El almacenamiento sin conexión no está disponible en este navegador.'
      onChange({ storageError })
      return network(path, token, options)
    }
    if (action === 'expense_history' && options.body) options = { ...options, body: JSON.stringify(resolveReferences(JSON.parse(options.body), document.mappings)) }
    if (mutation && path.startsWith('gastoteca/') && offlineActions.has(action) && document.syncVersion >= 1 && document.snapshot.group) {
      const body = JSON.parse(options.body || '{}')
      if (action === 'update_group_settings' && document.snapshot.group.owner_uid !== uid) throw new Error('Solo el propietario puede cambiar las preferencias del grupo.')
      const id = crypto.randomUUID()
      const previous = document.snapshot.expenses?.find(item => item.id === body.id)
      const operation = {
        id, action, body, groupId: document.snapshot.group.id,
        localId: !body.id && ['save_expense', 'save_debt', 'save_recurring', 'save_tag', 'save_settlement', 'save_catalog_item'].includes(action) ? `local-${id}` : null,
        createdAt: new Date().toISOString(),
        expectedUpdatedAt: previous && !document.queue.some(item => item.body.id === body.id) && ['save_expense', 'delete_expense'].includes(action) ? previous.updated_at : null,
      }
      await update(current => { current.queue.push(operation); current.revision = (current.revision || 0) + 1; return current })
      if (isOnline() && reachable) await flush()
      if (stopped) throw new Error('La sesión ha cambiado.')
      document = await read()
      const pending = document.queue.find(item => item.id === id)
      if (pending?.error && document.queue.length === 1) {
        // A new rejected operation has no dependent changes and can retain the existing editor flow.
        await update(current => { current.queue = current.queue.filter(item => item.id !== id); return current })
        throw new Error(pending.error)
      }
      const snapshot = projectOffline(document, uid)
      return { ...snapshot, ...(snapshot[action.replace(/^save_/, '')] || {}), offline_pending: Boolean(pending) }
    }
    if (mutation && document.queue.length && ['join_group', 'leave_group'].includes(action)) throw new Error('Sincroniza los cambios pendientes antes de cambiar de grupo.')
    if (mutation && (!isOnline() || !reachable)) throw new Error('Esta acción necesita que el servidor responda. Inténtalo cuando vuelva la conexión.')
    if (!mutation && (document.queue.length || !isOnline() || !reachable)) {
      const value = cached(document, path, options)
      publish(document)
      return value
    }
    try {
      const data = await network(path, token, options)
      if (stopped) throw new Error('La sesión ha cambiado.')
      let refreshed
      try { refreshed = await update(current => (current.revision || 0) !== (document.revision || 0) && !mutation ? current : merge(current, path, data, options)) } catch { /* Online operations still work when local storage is full. */ }
      if (!mutation && refreshed && (refreshed.revision || 0) !== (document.revision || 0)) return cached(refreshed, path, options)
      return data
    } catch (reason) {
      if (mutation || !unavailable(reason)) throw reason
      publish(document)
      return cached(document, path, options)
    }
  }

  async function refresh() { const document = await read(); publish(document); return projectOffline(document, uid) }
  async function retry() {
    reachable = true
    await flush()
    if (stopped || !isOnline()) return
    const document = await read()
    if (!document.queue.length) {
      try {
        const data = await network('gastoteca/bootstrap', await getToken(), {})
        await update(current => merge(current, 'gastoteca/bootstrap', data))
      } catch (reason) { publish(await read(), unavailable(reason) ? '' : reason.message) }
    }
  }
  return {
    request, refresh, retry,
    stop: () => { stopped = true },
    exportPending: async () => ({ version: 1, uid, ...(await read()) }),
    discardPending: async () => {
      if (syncing) throw new Error('Espera a que termine la sincronización.')
      await update(current => { current.queue = []; current.mappings = {}; current.revision = (current.revision || 0) + 1; return current })
      await retry()
    },
  }
}
