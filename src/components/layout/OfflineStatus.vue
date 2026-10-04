<script setup>
import { computed } from 'vue'
import { PhWifiSlash, PhCloudSlash, PhArrowsClockwise, PhDownloadSimple, PhTrash } from '@phosphor-icons/vue'
import { useGastotecaContext } from '../../composables/gastotecaContext.js'

const { offline, syncOffline, exportOfflineChanges, discardOfflineChanges } = useGastotecaContext()
const visible = computed(() => offline.offline || offline.serverUnavailable || offline.pending || offline.syncError || offline.storageError)
const title = computed(() => offline.storageError ? 'Almacenamiento local no disponible'
  : offline.syncError ? 'Hay cambios que requieren revisión'
    : offline.syncing ? 'Sincronizando cambios'
      : offline.offline ? 'Sin conexión'
        : offline.serverUnavailable ? 'El servidor no responde' : 'Cambios pendientes')
const savedDate = computed(() => offline.savedAt ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(offline.savedAt)) : '')
</script>

<template>
  <section v-if="visible" class="offline-status" aria-label="Estado de conexión">
    <PhWifiSlash v-if="offline.offline" :size="21" aria-hidden="true" />
    <PhCloudSlash v-else :size="21" aria-hidden="true" />
    <div class="offline-status-copy" role="status" aria-live="polite">
      <strong>{{ title }}</strong>
      <p v-if="offline.storageError">{{ offline.storageError }}</p>
      <p v-else-if="offline.syncError">{{ offline.syncError }}</p>
      <p v-else-if="offline.pending">{{ offline.pending }} {{ offline.pending === 1 ? 'cambio guardado' : 'cambios guardados' }} en este dispositivo, {{ offline.pending === 1 ? 'pendiente' : 'pendientes' }} de enviar.</p>
      <p v-else-if="offline.ready">Datos guardados en este dispositivo<span v-if="savedDate">: {{ savedDate }}</span>.</p>
      <p v-else>Aún no hay una copia completa de tus datos en este dispositivo.</p>
    </div>
    <div class="offline-status-actions">
      <button v-if="!offline.offline" type="button" class="icon-button" :disabled="offline.syncing" title="Reintentar conexión y sincronizar" aria-label="Reintentar conexión y sincronizar" @click="syncOffline"><PhArrowsClockwise :size="20" aria-hidden="true" /></button>
      <button v-if="offline.pending" type="button" class="icon-button" title="Descargar copia de los cambios pendientes" aria-label="Descargar copia de los cambios pendientes" @click="exportOfflineChanges"><PhDownloadSimple :size="20" aria-hidden="true" /></button>
      <button v-if="offline.pending && offline.syncError" type="button" class="icon-button" :disabled="offline.syncing" title="Descartar cambios pendientes" aria-label="Descartar cambios pendientes" @click="discardOfflineChanges"><PhTrash :size="20" aria-hidden="true" /></button>
    </div>
  </section>
</template>
