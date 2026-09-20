<script setup>
import { useGastotecaContext } from '../../composables/gastotecaContext.js'
import ConfirmDialog from './ConfirmDialog.vue'

const {
  saving,
  deleteTarget,
  recurringDeleteTarget,
  tagDeleteTarget,
  removeRecurring,
  removeTag,
  removeExpense,
} = useGastotecaContext()
</script>

<template>
  <ConfirmDialog
    v-if="recurringDeleteTarget"
    title-id="recurring-delete-title"
    title="Eliminar programación"
    :saving="saving"
    @cancel="recurringDeleteTarget = null"
    @confirm="removeRecurring"
  >
    “{{ recurringDeleteTarget.name }}” dejará de generar nuevos movimientos; los ya creados se conservarán.
  </ConfirmDialog>
  <ConfirmDialog
    v-if="tagDeleteTarget"
    title-id="tag-delete-title"
    title="Eliminar etiqueta"
    :saving="saving"
    @cancel="tagDeleteTarget = null"
    @confirm="removeTag"
  >
    “{{ tagDeleteTarget.name }}” se quitará de los movimientos asociados, pero no eliminará esos movimientos.
  </ConfirmDialog>
  <ConfirmDialog
    v-if="deleteTarget"
    title-id="expense-delete-title"
    title="Eliminar movimiento"
    :saving="saving"
    @cancel="deleteTarget = null"
    @confirm="removeExpense"
  >
    “{{ deleteTarget.name }}” desaparecerá del grupo y de las estadísticas.
  </ConfirmDialog>
</template>
