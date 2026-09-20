<script setup>
import { builtInCategories } from '../domain/catalogs.js'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhMapPin, PhTag, PhArrowRight, PhCheck } from '@phosphor-icons/vue'

const {
  route,
  router,
  saving,
  catalogDraft,
  openIconPicker,
  saveCatalogIcons,
} = useGastotecaContext()
</script>

<template>
  <section class="page-heading catalog-heading">
    <div>
      <p class="eyebrow">
        PERSONALIZA TU GRUPO
      </p><h1>{{ route.name === 'establishments' ? 'Establecimientos' : 'Categorías' }}</h1><p>Elige un icono para reconocer cada {{ route.name === 'establishments' ? 'lugar' : 'categoría' }} de un vistazo.</p>
    </div>
    <div class="catalog-tabs" aria-label="Catálogos">
      <button type="button" :class="{ active: route.name === 'establishments' }" :aria-current="route.name === 'establishments' ? 'page' : undefined" @click="router.push({ name: 'establishments' })">
        <PhMapPin aria-hidden="true" :size="17" /> Establecimientos
      </button><button type="button" :class="{ active: route.name === 'categories' }" :aria-current="route.name === 'categories' ? 'page' : undefined" @click="router.push({ name: 'categories' })">
        <PhTag aria-hidden="true" :size="17" /> Categorías
      </button>
    </div>
  </section>
  <section class="catalog-panel">
    <div class="catalog-intro">
      <div><strong>{{ route.name === 'establishments' ? catalogDraft.establishments.length : catalogDraft.categories.length }} {{ route.name === 'establishments' ? 'establecimientos' : 'categorías' }}</strong><p>Pulsa un icono para buscar y elegir entre las colecciones de Iconify. Los cambios se comparten con tu grupo.</p></div><a href="https://icon-sets.iconify.design/" target="_blank" rel="noreferrer">
        Explorar Iconify <PhArrowRight aria-hidden="true" :size="15" />
      </a>
    </div>
    <div v-if="route.name === 'establishments' && catalogDraft.establishments.length" class="catalog-editor-list">
      <article v-for="item in catalogDraft.establishments" :key="item.name" class="catalog-editor-item">
        <button type="button"
                class="catalog-item-preview"
                :aria-label="`Cambiar icono de ${item.name}`"
                :title="`Cambiar icono de ${item.name}`"
                @click="openIconPicker(item)"
        >
          <iconify-icon aria-hidden="true" :icon="item.icon"></iconify-icon>
        </button><div class="catalog-item-name">
          <strong>{{ item.name }}</strong><small>Establecimiento · Pulsa el icono para cambiarlo</small>
        </div>
      </article>
    </div>
    <div v-else-if="route.name === 'categories' && catalogDraft.categories.length" class="catalog-editor-list">
      <article v-for="item in catalogDraft.categories" :key="item.key" class="catalog-editor-item">
        <button type="button"
                class="catalog-item-preview"
                :aria-label="`Cambiar icono de ${item.label}`"
                :title="`Cambiar icono de ${item.label}`"
                @click="openIconPicker(item)"
        >
          <iconify-icon aria-hidden="true" :icon="item.icon"></iconify-icon>
        </button><div class="catalog-item-name">
          <strong>{{ item.label }}</strong><small>{{ builtInCategories.some((categoryItem) => categoryItem.id === item.key) ? 'Categoría predeterminada' : 'Categoría personalizada' }} · Pulsa el icono para cambiarlo</small>
        </div>
      </article>
    </div>
    <div v-else class="catalog-empty">
      <iconify-icon aria-hidden="true" :icon="route.name === 'establishments' ? 'mdi:store-outline' : 'mdi:tag-outline'"></iconify-icon><strong>{{ route.name === 'establishments' ? 'Aún no hay establecimientos' : 'Aún no hay categorías personalizadas' }}</strong><p>{{ route.name === 'establishments' ? 'Se añadirán automáticamente al guardar movimientos con un establecimiento.' : 'Las categorías personalizadas aparecen aquí al usarlas en un movimiento.' }}</p>
    </div>
    <footer class="catalog-footer">
      <span>La vista previa usa la biblioteca <a href="https://iconify.design/" target="_blank" rel="noreferrer">Iconify</a>.</span><button class="primary" :disabled="saving" @click="saveCatalogIcons">
        <PhCheck aria-hidden="true" :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </footer>
  </section>
</template>
