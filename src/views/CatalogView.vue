<script setup>
import { computed, reactive, watch } from 'vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { useDataEditor } from '../composables/useDataEditor.js'
import { useDataSearch } from '../composables/useDataSearch.js'
import DataEditorDialog from '../components/dialogs/DataEditorDialog.vue'
import DataSearch from '../components/forms/DataSearch.vue'
import { normalizeName } from '../utils/formatters.js'
import { PhMapPin, PhTag, PhPlus, PhPencilSimple, PhMagnifyingGlass } from '@phosphor-icons/vue'

const { route, router, saving, error, expenses, catalogDraft, openIconPicker, saveCatalogItem } = useGastotecaContext()
const isEstablishments = computed(() => route.name === 'establishments')
const itemDraft = reactive({ id: '', name: '', icon: 'mdi:store-outline' })
const items = computed(() => isEstablishments.value ? catalogDraft.establishments : catalogDraft.categories)
const { search, filteredItems } = useDataSearch(items, item => item.name || item.label)
const { editorOpen, openEditor, closeEditor, submitEditor } = useDataEditor({
  reset(item) {
    Object.assign(itemDraft, {
      id: item ? (isEstablishments.value ? item.name : item.key) : '',
      name: item ? (isEstablishments.value ? item.name : item.label) : '',
      icon: item?.icon || (isEstablishments.value ? 'mdi:store-outline' : 'mdi:tag-outline'),
    })
  },
  save: () => saveCatalogItem(isEstablishments.value ? 'establishment' : 'category', itemDraft.id, itemDraft.name, itemDraft.icon),
})

watch(() => route.name, () => { closeEditor(); search.value = '' })

function expenseSummary(item) {
  const count = expenses.value.filter(expense => expense.transaction_type === 'expense' && (isEstablishments.value
    ? normalizeName(expense.place || '') === normalizeName(item.name)
    : expense.category === item.key)).length
  return `${count} ${count === 1 ? 'gasto' : 'gastos'}`
}
</script>

<template>
  <section class="page-heading catalog-heading">
    <div>
      <p class="eyebrow">PERSONALIZA TU GRUPO</p>
      <h1>{{ isEstablishments ? 'Establecimientos' : 'Categorías' }}</h1>
      <p>Crea, renombra y elige un icono para reconocer cada {{ isEstablishments ? 'lugar' : 'categoría' }} de un vistazo.</p>
    </div>
    <button type="button" class="primary" :disabled="saving" @click="openEditor()"><PhPlus aria-hidden="true" :size="18" /> {{ isEstablishments ? 'Nuevo establecimiento' : 'Nueva categoría' }}</button>
  </section>
  <div class="catalog-tabs data-catalog-tabs" aria-label="Catálogos">
    <button type="button" :class="{ active: isEstablishments }" :aria-current="isEstablishments ? 'page' : undefined" @click="router.push({ name: 'establishments' })"><PhMapPin aria-hidden="true" :size="17" /> Establecimientos</button>
    <button type="button" :class="{ active: !isEstablishments }" :aria-current="!isEstablishments ? 'page' : undefined" @click="router.push({ name: 'categories' })"><PhTag aria-hidden="true" :size="17" /> Categorías</button>
  </div>
  <section class="catalog-panel">
    <DataSearch id="catalog-search" v-model="search" :label="isEstablishments ? 'Buscar establecimientos' : 'Buscar categorías'" :placeholder="isEstablishments ? 'Buscar establecimientos…' : 'Buscar categorías…'" :count="filteredItems.length" :total="items.length" />
    <div v-if="filteredItems.length" class="catalog-editor-list">
      <article v-for="item in filteredItems" :key="item.key || item.name" class="catalog-editor-item">
        <button type="button" class="catalog-item-preview" :disabled="saving" :aria-label="`Editar nombre e icono de ${item.name || item.label}`" @click="openEditor(item)"><iconify-icon aria-hidden="true" :icon="item.icon"></iconify-icon></button>
        <div class="catalog-item-name"><strong>{{ item.name || item.label }}</strong><small>{{ expenseSummary(item) }}</small></div>
        <button type="button" class="ghost small-action" :disabled="saving" :aria-label="`Editar ${isEstablishments ? 'establecimiento' : 'categoría'} ${item.name || item.label}`" @click="openEditor(item)"><PhPencilSimple aria-hidden="true" :size="15" /> Editar</button>
      </article>
    </div>
    <div v-else-if="items.length" class="catalog-empty">
      <PhMagnifyingGlass aria-hidden="true" :size="28" />
      <strong>No hay resultados para esta búsqueda</strong>
      <p>Prueba con otro nombre o limpia la búsqueda para ver el listado completo.</p>
      <button type="button" class="secondary" @click="search = ''">Limpiar búsqueda</button>
    </div>
    <div v-else class="catalog-empty">
      <iconify-icon aria-hidden="true" :icon="isEstablishments ? 'mdi:store-outline' : 'mdi:tag-outline'"></iconify-icon>
      <strong>{{ isEstablishments ? 'Aún no hay establecimientos' : 'Aún no hay categorías' }}</strong>
      <p>{{ isEstablishments ? 'Crea un establecimiento o se añadirá automáticamente al guardar un movimiento.' : 'Crea una categoría aquí o al escribirla en un movimiento.' }}</p>
      <button type="button" class="secondary" :disabled="saving" @click="openEditor()">{{ isEstablishments ? 'Crear establecimiento' : 'Crear categoría' }}</button>
    </div>
  </section>
  <DataEditorDialog v-if="editorOpen" title-id="catalog-editor-title" :title="itemDraft.id ? (isEstablishments ? 'Editar establecimiento' : 'Editar categoría') : (isEstablishments ? 'Nuevo establecimiento' : 'Nueva categoría')" :save-label="itemDraft.id ? 'Guardar cambios' : (isEstablishments ? 'Crear establecimiento' : 'Crear categoría')" :saving="saving" :error="error" @close="closeEditor" @submit="submitEditor">
    <label class="data-editor-label" for="catalog-item-name"><span>Nombre *</span><input id="catalog-item-name" v-model="itemDraft.name" data-initial-focus :maxlength="isEstablishments ? 160 : 80" :placeholder="isEstablishments ? 'Por ejemplo: Cafetería Central' : 'Por ejemplo: Mascotas'" required /></label>
    <div class="data-icon-field"><span class="data-icon-preview"><iconify-icon aria-hidden="true" :icon="itemDraft.icon"></iconify-icon></span><div><strong>Icono</strong><p>Elige cómo aparecerá en tus movimientos.</p></div><button type="button" class="secondary" :disabled="saving" @click="openIconPicker(itemDraft)">Elegir icono</button></div>
  </DataEditorDialog>
</template>
