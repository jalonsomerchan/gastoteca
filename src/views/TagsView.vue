<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { focusElement } from '../utils/focus.js'
import { PhCheck, PhPlus, PhPencilSimple, PhTag, PhX } from '@phosphor-icons/vue'

const {
  saving,
  group,
  tagDeleteTarget,
  tagDraft,
  dateLabel,
  saveTag,
} = useGastotecaContext()

function beginEdit(tag) {
  Object.assign(tagDraft, { id: tag.id, name: tag.name })
  focusElement('#tag-name')
}

function cancelEdit() {
  Object.assign(tagDraft, { id: '', name: '' })
}
</script>

<template>
  <section class="page-heading catalog-heading">
    <div>
      <p class="eyebrow">ORGANIZA TUS MOVIMIENTOS</p>
      <h1>Etiquetas</h1>
      <p>Crea y renombra etiquetas para encontrar mejor tus gastos e ingresos.</p>
    </div>
  </section>
  <section class="catalog-panel">
    <form :aria-busy="saving" class="catalog-item-form tag-catalog-form" @submit.prevent="saveTag">
      <label for="tag-name">{{ tagDraft.id ? 'Editar etiqueta' : 'Nueva etiqueta' }}</label>
      <input id="tag-name" v-model="tagDraft.name" maxlength="40" placeholder="Por ejemplo: vacaciones" required />
      <button class="primary" :disabled="saving"><PhCheck v-if="tagDraft.id" aria-hidden="true" :size="17" /><PhPlus v-else aria-hidden="true" :size="17" />{{ saving ? 'Guardando…' : tagDraft.id ? 'Guardar cambios' : 'Crear etiqueta' }}</button>
      <button v-if="tagDraft.id" type="button" class="ghost" :disabled="saving" @click="cancelEdit"><PhX aria-hidden="true" :size="16" /> Cancelar</button>
    </form>

    <div v-if="group?.tags?.length" class="catalog-editor-list">
      <article v-for="tag in group.tags" :key="tag.id" class="catalog-editor-item tag-catalog-item">
        <span class="catalog-item-preview tag-catalog-preview"><PhTag aria-hidden="true" :size="19" /></span>
        <div class="catalog-item-name">
          <strong>{{ tag.name }}</strong>
          <small>{{ tag.usage_count }} {{ tag.usage_count === 1 ? 'movimiento' : 'movimientos' }} · Último uso {{ tag.last_used_at ? dateLabel(tag.last_used_at) : 'Sin uso todavía' }}</small>
        </div>
        <div class="feature-row-actions">
          <button type="button" class="ghost small-action" @click="beginEdit(tag)" :aria-label="`Editar etiqueta ${tag.name}`"> <PhPencilSimple aria-hidden="true" :size="15" /> Editar</button>
          <button type="button" class="danger-button small-action" @click="tagDeleteTarget = tag" :aria-label="`Eliminar etiqueta ${tag.name}`">Eliminar</button>
        </div>
      </article>
    </div>
    <div v-else class="catalog-empty">
      <PhTag aria-hidden="true" />
      <strong>Aún no hay etiquetas</strong>
      <p>Crea una etiqueta aquí o al añadir un movimiento.</p>
    </div>
  </section>
</template>
