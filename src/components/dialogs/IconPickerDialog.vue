<script setup>
import BaseDialog from './BaseDialog.vue'
import { useGastotecaContext } from '../../composables/gastotecaContext.js'
import { PhX, PhMagnifyingGlass } from '@phosphor-icons/vue'

const {
  
  iconPickerOpen,
  iconPickerTarget,
  iconPickerSearch,
  iconPickerCollectionCategory,
  iconPickerCollection,
  iconPickerData,
  iconPickerResults,
  iconPickerSearchHasMore,
  iconPickerLoading,
  iconPickerError,
  iconPickerLimit,
  iconPickerCollectionCategories,
  iconPickerVisibleCollections,
  iconPickerGroups,
  iconPickerSearchCollections,
  setIconPickerCategory,
  setIconPickerCollection,
  chooseIcon,
  loadMoreIconPickerSearchResults,
  closeIconPicker,
} = useGastotecaContext()
</script>

<template>
  <BaseDialog v-if="iconPickerOpen" labelled-by="icon-picker-title" @close="closeIconPicker">
    <section class="icon-picker-modal"
             @mousedown.stop
    >
      <header class="icon-picker-header">
        <div>
          <p id="icon-picker-title" tabindex="-1" data-initial-focus class="eyebrow modal-title">
            Elige un icono
          </p><p>Busca o explora una colección. Muchos iconos usan nombres en inglés: coffee, home o car.</p>
        </div><button type="button"
                      class="icon-button"
                      aria-label="Cerrar selector de iconos"
                      @click="closeIconPicker"
        >
          <PhX aria-hidden="true" :size="22" />
        </button>
      </header>
      <div class="icon-picker-content">
        <label class="icon-picker-search">
          <PhMagnifyingGlass aria-hidden="true" :size="19" /><input v-model="iconPickerSearch"
                                                 type="search"
                                                 aria-label="Buscar iconos en Iconify"
                                                 placeholder="Buscar iconos, por ejemplo café, casa o transporte…"
                                                 autofocus
          />
        </label>
        <p v-if="iconPickerSearch.trim().length === 1" class="icon-picker-hint">
          Escribe al menos dos letras para buscar en Iconify.
        </p>
        <div v-if="iconPickerSearch.trim().length >= 2" class="icon-picker-results">
          <p v-if="iconPickerResults.length" class="icon-picker-count" role="status">
            {{ iconPickerResults.length }} iconos encontrados · {{ iconPickerSearch.trim() }}
          </p>
          <div class="icon-picker-grid">
            <button v-for="icon in iconPickerResults"
                    :key="icon"
                    type="button"
                    class="icon-picker-option"
                    :class="{ selected: iconPickerTarget?.icon === icon }"
                    :title="icon" :aria-label="`Elegir icono ${icon}`" :aria-pressed="iconPickerTarget?.icon === icon"
                    @click="chooseIcon(icon)"
            >
              <iconify-icon aria-hidden="true" :icon="icon"></iconify-icon><span>{{ iconPickerSearchCollections[icon.split(':')[0]] || icon.split(':')[0] }} · {{ icon.split(':')[1] }}</span>
            </button>
          </div>
          <button v-if="iconPickerSearchHasMore"
                  type="button"
                  class="icon-picker-more"
                  :disabled="iconPickerLoading"
                  @click="loadMoreIconPickerSearchResults"
          >
            Mostrar más resultados
          </button>
          <p v-if="!iconPickerLoading && !iconPickerResults.length && !iconPickerError" class="icon-picker-empty">
            No hay iconos con ese nombre. Prueba con otra búsqueda.
          </p>
        </div>
        <template v-else>
          <div class="icon-picker-browse-controls">
            <label><span>Categoría de colecciones</span><select :value="iconPickerCollectionCategory" @change="setIconPickerCategory($event.target.value)">
              <option v-for="categoryName in iconPickerCollectionCategories" :key="categoryName" :value="categoryName">{{ categoryName }}</option>
            </select></label>
            <label><span>Colección</span><select :value="iconPickerCollection" @change="setIconPickerCollection($event.target.value)">
              <option v-for="collection in iconPickerVisibleCollections" :key="collection.prefix" :value="collection.prefix">{{ collection.name }} · {{ collection.total.toLocaleString('es-ES') }}</option>
            </select></label>
          </div>
          <p v-if="iconPickerData?.title" class="icon-picker-count" role="status">
            {{ iconPickerData.title }} · {{ (iconPickerData.total || 0).toLocaleString('es-ES') }} iconos
          </p>
          <div v-if="iconPickerGroups.length" class="icon-picker-groups">
            <section v-for="groupItem in iconPickerGroups" :key="groupItem.label" class="icon-picker-group">
              <h3>{{ groupItem.label }}</h3><div class="icon-picker-grid">
                <button v-for="name in groupItem.names"
                        :key="name"
                        type="button"
                        class="icon-picker-option"
                        :class="{ selected: iconPickerTarget?.icon === `${iconPickerCollection}:${name}` }"
                        :title="`${iconPickerCollection}:${name}`" :aria-label="`Elegir icono ${name}`" :aria-pressed="iconPickerTarget?.icon === `${iconPickerCollection}:${name}`"
                        @click="chooseIcon(`${iconPickerCollection}:${name}`)"
                >
                  <iconify-icon aria-hidden="true" :icon="`${iconPickerCollection}:${name}`"></iconify-icon><span>{{ name }}</span>
                </button>
              </div>
            </section>
          </div>
          <button v-if="iconPickerData && iconPickerGroups.reduce((total, groupItem) => total + groupItem.remaining, 0)"
                  type="button"
                  class="icon-picker-more"
                  @click="iconPickerLimit += 240"
          >
            Mostrar más iconos
          </button>
        </template>
        <div v-if="iconPickerLoading" class="icon-picker-status" role="status">
          <span class="loader"></span><span>{{ iconPickerSearch.trim().length >= 2 ? 'Buscando iconos…' : 'Cargando iconos…' }}</span>
        </div>
        <p v-if="iconPickerError" class="icon-picker-error" role="alert">
          {{ iconPickerError }}
        </p>
      </div>
    </section>
  </BaseDialog>
</template>
