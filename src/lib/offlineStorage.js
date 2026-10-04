const DATABASE = 'gastoteca-offline-v1'
const STORE = 'accounts'
let databasePromise

function database() {
  databasePromise ||= new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Este navegador no permite guardar datos sin conexión.'))
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); databasePromise = null }
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Cierra las otras pestañas para preparar los datos sin conexión.'))
  }).catch(reason => { databasePromise = null; throw reason })
  return databasePromise
}

export function createOfflineStorage(key) {
  async function transact(mode, change) {
    const db = await database()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const store = transaction.objectStore(STORE)
      const request = store.get(key)
      let result
      request.onsuccess = () => {
        try {
          result = change(request.result)
          if (mode === 'readwrite') store.put(result, key)
        } catch (reason) { transaction.abort(); reject(reason) }
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar el cambio en este dispositivo.'))
    })
  }
  return {
    read: () => transact('readonly', value => value),
    update: change => transact('readwrite', change),
  }
}
