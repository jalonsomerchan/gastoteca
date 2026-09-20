<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhCheck, PhTag } from '@phosphor-icons/vue'

const {
  saving,
  group,
  tagDeleteTarget,
  tagDraft,
  dateLabel,
  saveTag,
} = useGastotecaContext()
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        ORGANIZA TUS MOVIMIENTOS
      </p><h1>Etiquetas</h1><p>Crea y renombra etiquetas para encontrar mejor tus gastos e ingresos.</p>
    </div>
  </section>
  <section class="feature-layout tag-layout">
    <form class="feature-panel feature-form tag-editor" @submit.prevent="saveTag">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            {{ tagDraft.id ? 'EDITAR ETIQUETA' : 'NUEVA ETIQUETA' }}
          </p><h2>{{ tagDraft.id ? 'Cambia su nombre' : 'Crea una etiqueta' }}</h2>
        </div>
      </div>
      <label><span>Nombre *</span><input v-model="tagDraft.name"
                                         maxlength="40"
                                         placeholder="Por ejemplo: vacaciones"
                                         required
      /></label>
      <p class="feature-hint">
        Las etiquetas recientes también aparecen al registrar un movimiento.
      </p>
      <div class="feature-form-actions">
        <button v-if="tagDraft.id"
                type="button"
                class="ghost"
                @click="Object.assign(tagDraft, { id: '', name: '' })"
        >
          Cancelar
        </button><span v-else></span><button class="primary" :disabled="saving">
          <PhCheck :size="17" /> {{ saving ? 'Guardando…' : tagDraft.id ? 'Guardar cambios' : 'Crear etiqueta' }}
        </button>
      </div>
    </form>
    <section class="feature-panel feature-list-panel">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            CATÁLOGO DEL GRUPO
          </p><h2>Etiquetas disponibles</h2>
        </div><span class="feature-count">{{ group?.tags?.length || 0 }}</span>
      </div>
      <div v-if="group?.tags?.length" class="feature-list">
        <article v-for="tag in group.tags" :key="tag.id" class="feature-list-row">
          <div class="feature-list-main">
            <span class="tag-chip"><PhTag :size="15" /> {{ tag.name }}</span><small>{{ tag.usage_count }} {{ tag.usage_count === 1 ? 'movimiento' : 'movimientos' }} · Último uso {{ dateLabel(tag.last_used_at) }}</small>
          </div>
          <div class="feature-row-actions">
            <button type="button" class="ghost small-action" @click="Object.assign(tagDraft, { id: tag.id, name: tag.name })">
              Editar
            </button><button type="button" class="danger-button small-action" @click="tagDeleteTarget = tag">
              Eliminar
            </button>
          </div>
        </article>
      </div>
      <div v-else class="feature-empty">
        <PhTag :size="27" /><strong>Aún no hay etiquetas</strong><p>Crea una etiqueta aquí o al añadir un movimiento.</p>
      </div>
    </section>
  </section>
</template>
