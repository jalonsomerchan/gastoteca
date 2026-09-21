<script setup>
import { reactive, watch } from 'vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { focusElement } from '../utils/focus.js'
import { normalizeName } from '../utils/formatters.js'
import { PhMapPin, PhTag, PhCheck, PhPlus, PhPencilSimple, PhX } from '@phosphor-icons/vue'

const {
  route,
  router,
  saving,
  expenses,
  catalogDraft,
  openIconPicker,
  saveCatalogIcons,
  saveCatalogItem,
} = useGastotecaContext()

const itemDraft = reactive({ id: '', name: '', icon: route.name === 'establishments' ? 'mdi:store-outline' : 'mdi:tag-outline' })

function isEstablishments() {
  return route.name === 'establishments'
}

function beginEdit(item) {
  Object.assign(itemDraft, {
    id: isEstablishments() ? item.name : item.key,
    name: isEstablishments() ? item.name : item.label,
    icon: item.icon || (isEstablishments() ? 'mdi:store-outline' : 'mdi:tag-outline'),
  })
  focusElement('#catalog-item-name')
}

function cancelEdit() {
  Object.assign(itemDraft, { id: '', name: '', icon: isEstablishments() ? 'mdi:store-outline' : 'mdi:tag-outline' })
}

watch(() => route.name, cancelEdit)

async function submitCatalogItem() {
  const saved = await saveCatalogItem(isEstablishments() ? 'establishment' : 'category', itemDraft.id, itemDraft.name, itemDraft.icon)
  if (saved) cancelEdit()
}

function expenseCountForEstablishment(name) {
  return expenses.value.filter((expense) => expense.transaction_type === 'expense' && normalizeName(expense.place || '') === normalizeName(name)).length
}

function expenseCountForCategory(key) {
  return expenses.value.filter((expense) => expense.transaction_type === 'expense' && expense.category === key).length
}

function expenseCountLabel(count) {
  return `${count} ${count === 1 ? 'gasto' : 'gastos'}`
}

function establishmentExpenseSummary(name) {
  return expenseCountLabel(expenseCountForEstablishment(name))
}

function categoryExpenseSummary(key) {
  return expenseCountLabel(expenseCountForCategory(key))
}
</script>

<template>
  <section class="page-heading catalog-heading">
    <div>
      <p class="eyebrow">PERSONALIZA TU GRUPO</p>
      <h1>{{ route.name === 'establishments' ? 'Establecimientos' : 'Categorías' }}</h1>
      <p>Crea, renombra y elige un icono para reconocer cada {{ route.name === 'establishments' ? 'lugar' : 'categoría' }} de un vistazo.</p>
    </div>
    <div class="catalog-tabs" aria-label="Catálogos">
      <button type="button" :class="{ active: route.name === 'establishments' }" :aria-current="route.name === 'establishments' ? 'page' : undefined" @click="router.push({ name: 'establishments' })">
        <PhMapPin aria-hidden="true" :size="17" /> Establecimientos
      </button>
      <button type="button" :class="{ active: route.name === 'categories' }" :aria-current="route.name === 'categories' ? 'page' : undefined" @click="router.push({ name: 'categories' })">
        <PhTag aria-hidden="true" :size="17" /> Categorías
      </button>
    </div>
  </section>
  <section class="catalog-panel">
    <form class="catalog-item-form" :aria-busy="saving" @submit.prevent="submitCatalogItem">
      <label for="catalog-item-name">{{ itemDraft.id ? 'Editar nombre' : `Nuevo ${route.name === 'establishments' ? 'establecimiento' : 'categoría'}` }}</label>
      <input id="catalog-item-name" v-model="itemDraft.name" :maxlength="route.name === 'establishments' ? 160 : 80" :placeholder="route.name === 'establishments' ? 'Por ejemplo: Cafetería Central' : 'Por ejemplo: Mascotas'" required />
      <button type="button" class="catalog-item-form-icon" :aria-label="`Elegir icono para ${itemDraft.name || (route.name === 'establishments' ? 'el establecimiento' : 'la categoría')}`" @click="openIconPicker(itemDraft)">
        <iconify-icon aria-hidden="true" :icon="itemDraft.icon"></iconify-icon>
      </button>
      <button class="primary" :disabled="saving"><PhCheck v-if="itemDraft.id" aria-hidden="true" :size="17" /><PhPlus v-else aria-hidden="true" :size="17" />{{ saving ? 'Guardando…' : itemDraft.id ? 'Guardar cambios' : 'Crear' }}</button>
      <button v-if="itemDraft.id" type="button" class="ghost" :disabled="saving" @click="cancelEdit"><PhX aria-hidden="true" :size="16" /> Cancelar</button>
    </form>

    <div v-if="route.name === 'establishments' && catalogDraft.establishments.length" class="catalog-editor-list">
      <article v-for="item in catalogDraft.establishments" :key="item.name" class="catalog-editor-item">
        <button type="button" class="catalog-item-preview" :aria-label="`Cambiar icono de ${item.name}`" :title="`Cambiar icono de ${item.name}`" @click="openIconPicker(item)">
          <iconify-icon aria-hidden="true" :icon="item.icon"></iconify-icon>
        </button>
        <div class="catalog-item-name"><strong>{{ item.name }}</strong><small>{{ establishmentExpenseSummary(item.name) }}</small></div>
        <button type="button" class="ghost small-action" :aria-label="`Editar establecimiento ${item.name}`" @click="beginEdit(item)"><PhPencilSimple aria-hidden="true" :size="15" /> Editar</button>
      </article>
    </div>
    <div v-else-if="route.name === 'categories' && catalogDraft.categories.length" class="catalog-editor-list">
      <article v-for="item in catalogDraft.categories" :key="item.key" class="catalog-editor-item">
        <button type="button" class="catalog-item-preview" :aria-label="`Cambiar icono de ${item.label}`" :title="`Cambiar icono de ${item.label}`" @click="openIconPicker(item)">
          <iconify-icon aria-hidden="true" :icon="item.icon"></iconify-icon>
        </button>
        <div class="catalog-item-name"><strong>{{ item.label }}</strong><small>{{ categoryExpenseSummary(item.key) }}</small></div>
        <button type="button" class="ghost small-action" :aria-label="`Editar categoría ${item.label}`" @click="beginEdit(item)"><PhPencilSimple aria-hidden="true" :size="15" /> Editar</button>
      </article>
    </div>
    <div v-else class="catalog-empty">
      <iconify-icon aria-hidden="true" :icon="route.name === 'establishments' ? 'mdi:store-outline' : 'mdi:tag-outline'"></iconify-icon>
      <strong>{{ route.name === 'establishments' ? 'Aún no hay establecimientos' : 'Aún no hay categorías personalizadas' }}</strong>
      <p>{{ route.name === 'establishments' ? 'Crea un establecimiento aquí o se añadirá automáticamente al guardar un movimiento.' : 'Crea una categoría aquí o al escribirla en un movimiento.' }}</p>
    </div>
    <footer class="catalog-footer">
      <button class="primary" :disabled="saving" @click="saveCatalogIcons"><PhCheck aria-hidden="true" :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar cambios de iconos' }}</button>
    </footer>
  </section>
</template>
