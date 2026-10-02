<script setup>
import { computed, ref } from 'vue'
import { PhArrowDown, PhArrowUp, PhLightning, PhPencilSimple, PhPlus } from '@phosphor-icons/vue'
import ConfirmDialog from '../components/dialogs/ConfirmDialog.vue'
import FormError from '../components/forms/FormError.vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'

const {
  saving,
  error,
  quickExpenseTemplates,
  ownedQuickExpenseTemplates,
  canEditQuickExpenseTemplate,
  memberLabel,
  openQuickTemplateEditor,
  saveQuickExpenseTemplates,
  deleteQuickExpenseTemplate,
} = useGastotecaContext()

const deletingTemplate = ref(null)
const orderedTemplates = computed(() => quickExpenseTemplates.value
  .map((template, index) => ({ template, index, order: template.sort_order === undefined ? index : Number(template.sort_order) }))
  .sort((a, b) => Number(canEditQuickExpenseTemplate(b.template)) - Number(canEditQuickExpenseTemplate(a.template)) || a.order - b.order || a.index - b.index)
  .map(item => item.template))
const activeTemplateCount = computed(() => quickExpenseTemplates.value.filter(template => template.active !== false).length)
const fieldLabels = {
  name: 'nombre',
  amount: 'importe',
  category: 'categoría',
  place: 'establecimiento',
  city: 'ciudad',
  occurred_at: 'fecha',
  paid_by_type: 'quién paga',
  participants: 'reparto',
  payment_method: 'método de pago',
  details: 'detalles',
  tags: 'etiquetas',
  recurrence: 'repetición',
}

function templateFields(template) {
  return (template.fields || []).map(field => fieldLabels[field] || field).join(' · ')
}

async function moveTemplate(template, offset) {
  if (!canEditQuickExpenseTemplate(template)) return
  const templates = orderedTemplates.value.filter(canEditQuickExpenseTemplate)
  const currentIndex = templates.findIndex(item => item.id === template.id)
  const nextIndex = currentIndex + offset
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= templates.length || saving.value) return
  const [item] = templates.splice(currentIndex, 1)
  templates.splice(nextIndex, 0, item)
  await saveQuickExpenseTemplates(templates, 'Orden de los gastos rápidos actualizado.')
}

async function toggleTemplate(template) {
  if (!canEditQuickExpenseTemplate(template)) return
  const templates = orderedTemplates.value.filter(canEditQuickExpenseTemplate).map(item => item.id === template.id
    ? { ...item, active: item.active === false }
    : item)
  await saveQuickExpenseTemplates(templates, template.active === false ? 'Gasto rápido activado.' : 'Gasto rápido desactivado.')
}

async function confirmDelete() {
  if (!deletingTemplate.value) return
  error.value = ''
  const deleted = await deleteQuickExpenseTemplate(deletingTemplate.value)
  if (deleted) deletingTemplate.value = null
}
</script>

<template>
  <section class="page-heading quick-expenses-heading">
    <div>
      <p class="eyebrow">ATAJOS PARA AÑADIR GASTOS</p>
      <h1>Gastos rápidos</h1>
      <p>Crea plantillas para ti o compártelas con todo el grupo.</p>
    </div>
    <button type="button" class="primary" :disabled="saving || ownedQuickExpenseTemplates.length >= 12" @click="openQuickTemplateEditor(null, true)">
      <PhPlus aria-hidden="true" :size="18" /> {{ ownedQuickExpenseTemplates.length >= 12 ? 'Máximo de 12 propias' : 'Nuevo gasto rápido' }}
    </button>
  </section>

  <section class="feature-panel quick-expenses-panel" aria-label="Plantillas de gastos rápidos" :aria-busy="saving">
    <div class="feature-panel-heading">
      <div>
        <p class="eyebrow">DISPONIBLES AL AÑADIR UN GASTO</p>
        <h2>Plantillas disponibles</h2>
      </div>
      <span class="feature-count">{{ activeTemplateCount }} activas · {{ ownedQuickExpenseTemplates.length }}/12 propias</span>
    </div>
    <FormError :message="error" />

    <div v-if="orderedTemplates.length" class="quick-template-management-list">
      <article v-for="(template, index) in orderedTemplates" :key="`${template.created_by || 'own'}:${template.id}`" class="quick-template-management-item" :class="{ disabled: template.active === false }">
        <div class="quick-template-reorder" aria-label="Cambiar orden">
          <button v-if="canEditQuickExpenseTemplate(template)" type="button" class="icon-button" :disabled="saving || index === 0" :aria-label="`Subir ${template.title}`" title="Subir" @click="moveTemplate(template, -1)"><PhArrowUp aria-hidden="true" :size="17" /></button>
          <button v-if="canEditQuickExpenseTemplate(template)" type="button" class="icon-button" :disabled="saving || index === ownedQuickExpenseTemplates.length - 1" :aria-label="`Bajar ${template.title}`" title="Bajar" @click="moveTemplate(template, 1)"><PhArrowDown aria-hidden="true" :size="17" /></button>
        </div>
        <span class="quick-template-management-icon"><iconify-icon aria-hidden="true" :icon="template.icon || 'mdi:lightning-bolt-outline'"></iconify-icon></span>
        <div class="quick-template-management-copy">
          <strong>{{ template.title }}</strong>
          <small>{{ templateFields(template) }}</small>
          <small>{{ template.visibility === 'group' ? 'Todo el grupo' : 'Solo para mí' }}<template v-if="!canEditQuickExpenseTemplate(template)"> · Creado por {{ memberLabel(template.created_by) }}</template></small>
        </div>
        <span class="quick-template-management-status" :class="{ paused: template.active === false }">{{ template.active === false ? 'Desactivado' : 'Activo' }}</span>
        <div v-if="canEditQuickExpenseTemplate(template)" class="feature-row-actions quick-template-management-actions">
          <button type="button" class="ghost small-action" :disabled="saving" @click="openQuickTemplateEditor(template, true)"><PhPencilSimple aria-hidden="true" :size="15" /> Editar</button>
          <button type="button" class="ghost small-action" :disabled="saving" @click="toggleTemplate(template)">{{ template.active === false ? 'Activar' : 'Desactivar' }}</button>
          <button type="button" class="danger-button small-action" :disabled="saving" :aria-label="`Eliminar ${template.title}`" @click="error = ''; deletingTemplate = template">Eliminar</button>
        </div>
      </article>
    </div>

    <div v-else class="feature-empty quick-template-management-empty">
      <PhLightning aria-hidden="true" :size="29" />
      <strong>Aún no tienes gastos rápidos</strong>
      <p>Crea una plantilla y elige qué datos se rellenan automáticamente cada vez que la uses.</p>
      <button type="button" class="primary" :disabled="saving" @click="openQuickTemplateEditor(null, true)"><PhPlus aria-hidden="true" :size="17" /> Configurar el primero</button>
    </div>
  </section>

  <ConfirmDialog v-if="deletingTemplate" title-id="delete-quick-template-title" :title="`¿Eliminar «${deletingTemplate.title}»?`" :error="error" :saving="saving" @cancel="deletingTemplate = null" @confirm="confirmDelete">
    <template v-if="deletingTemplate.visibility === 'group'">Dejará de estar disponible para todos los miembros del grupo. </template>
    Esta plantilla dejará de aparecer al añadir un gasto rápido. Los gastos que ya hayas creado no cambiarán.
  </ConfirmDialog>
</template>
