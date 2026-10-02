<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { useDataEditor } from '../composables/useDataEditor.js'
import { useDataSearch } from '../composables/useDataSearch.js'
import DataEditorDialog from '../components/dialogs/DataEditorDialog.vue'
import DataSearch from '../components/forms/DataSearch.vue'
import { PhPlus, PhPencilSimple, PhTag, PhMagnifyingGlass } from '@phosphor-icons/vue'

const {
  saving,
  error,
  group,
  tagDeleteTarget,
  tagDraft,
  dateLabel,
  saveTag,
} = useGastotecaContext()

const { search, filteredItems } = useDataSearch(() => group.value?.tags, tag => tag.name)
const { editorOpen, openEditor, closeEditor, submitEditor } = useDataEditor({
  reset: tag => Object.assign(tagDraft, { id: tag?.id || '', name: tag?.name || '' }),
  save: saveTag,
})
</script>

<template>
  <section class="page-heading catalog-heading">
    <div>
      <p class="eyebrow">ORGANIZA TUS MOVIMIENTOS</p>
      <h1>Etiquetas</h1>
      <p>Crea y renombra etiquetas para encontrar mejor tus gastos e ingresos.</p>
    </div>
    <button type="button" class="primary" :disabled="saving" @click="openEditor()"><PhPlus aria-hidden="true" :size="18" /> Nueva etiqueta</button>
  </section>
  <section class="catalog-panel">
    <DataSearch id="tag-search" v-model="search" label="Buscar etiquetas" placeholder="Buscar etiquetas…" :count="filteredItems.length" :total="group?.tags?.length || 0" />

    <div v-if="filteredItems.length" class="catalog-editor-list">
      <article v-for="tag in filteredItems" :key="tag.id" class="catalog-editor-item tag-catalog-item">
        <span class="catalog-item-preview tag-catalog-preview"><PhTag aria-hidden="true" :size="19" /></span>
        <div class="catalog-item-name">
          <strong>{{ tag.name }}</strong>
          <small>{{ tag.usage_count }} {{ tag.usage_count === 1 ? 'movimiento' : 'movimientos' }} · Último uso {{ tag.last_used_at ? dateLabel(tag.last_used_at) : 'Sin uso todavía' }}</small>
        </div>
        <div class="feature-row-actions">
          <button type="button" class="ghost small-action" :disabled="saving" @click="openEditor(tag)" :aria-label="`Editar etiqueta ${tag.name}`"> <PhPencilSimple aria-hidden="true" :size="15" /> Editar</button>
          <button type="button" class="danger-button small-action" :disabled="saving" @click="error = ''; tagDeleteTarget = tag" :aria-label="`Eliminar etiqueta ${tag.name}`">Eliminar</button>
        </div>
      </article>
    </div>
    <div v-else-if="group?.tags?.length" class="catalog-empty">
      <PhMagnifyingGlass aria-hidden="true" :size="28" />
      <strong>No hay resultados para esta búsqueda</strong>
      <p>Prueba con otro nombre o limpia la búsqueda para ver todas las etiquetas.</p>
      <button type="button" class="secondary" @click="search = ''">Limpiar búsqueda</button>
    </div>
    <div v-else class="catalog-empty">
      <PhTag aria-hidden="true" />
      <strong>Aún no hay etiquetas</strong>
      <p>Crea una etiqueta aquí o al añadir un movimiento.</p>
      <button type="button" class="secondary" :disabled="saving" @click="openEditor()">Crear etiqueta</button>
    </div>
  </section>
  <DataEditorDialog v-if="editorOpen" title-id="tag-editor-title" :title="tagDraft.id ? 'Editar etiqueta' : 'Nueva etiqueta'" :save-label="tagDraft.id ? 'Guardar cambios' : 'Crear etiqueta'" :saving="saving" :error="error" @close="closeEditor" @submit="submitEditor">
    <label class="data-editor-label" for="tag-name"><span>Nombre *</span><input id="tag-name" v-model="tagDraft.name" data-initial-focus maxlength="40" placeholder="Por ejemplo: vacaciones" required /></label>
  </DataEditorDialog>
</template>
