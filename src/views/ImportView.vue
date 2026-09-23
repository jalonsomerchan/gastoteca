<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { postJson } from '../lib/api.js'
import { readXlsxRows } from '../lib/xlsx.js'
import { parseBankinterRows } from '../domain/bankinter.js'
import { normalizeName } from '../utils/formatters.js'
import FormError from '../components/forms/FormError.vue'
import { PhArrowDown, PhArrowUp, PhCheck, PhFileArrowUp, PhUsers } from '@phosphor-icons/vue'
import Multiselect from '@vueform/multiselect'

const {
  group,
  user,
  stats,
  expenses,
  notice,
  categoryOptions,
  establishmentOptions,
  memberOptions,
  money,
  dateLabel,
} = useGastotecaContext()

const fileInput = ref(null)
const fileType = ref('bankinter')
const fileName = ref('')
const movements = ref([])
const parsing = ref(false)
const importing = ref(false)
const importError = ref('')
const importProgress = ref(0)
const paidByUid = ref('')
const appliesToAll = ref(true)
const participantUids = ref([])
const defaultCategory = ref('other')
const paidByType = ref('person')

const selectedMovements = computed(() => movements.value.filter((movement) => movement.selected))
const selectedCount = computed(() => selectedMovements.value.length)
const availableMovements = computed(() => movements.value.filter((movement) => !movement.duplicate))
const duplicateCount = computed(() => movements.value.filter((movement) => movement.duplicate).length)
const allSelected = computed(() => Boolean(availableMovements.value.length) && selectedCount.value === availableMovements.value.length)
const participantOptions = computed(() => memberOptions.value)
const canImport = computed(() => selectedCount.value > 0 && (paidByType.value === 'all' || Boolean(paidByUid.value)) && (appliesToAll.value || participantUids.value.length > 0) && !importing.value)

watch(memberOptions, (members) => {
  if (!paidByUid.value || !members.some((member) => member.uid === paidByUid.value)) paidByUid.value = members[0]?.uid || ''
  if (!participantUids.value.length) participantUids.value = members.map((member) => member.uid)
}, { immediate: true })

function chooseFile() {
  fileInput.value?.click()
}

function setAllParticipants() {
  participantUids.value = appliesToAll.value ? memberOptions.value.map((member) => member.uid) : participantUids.value
}

function toggleParticipant(uid) {
  participantUids.value = participantUids.value.includes(uid)
    ? participantUids.value.filter((item) => item !== uid)
    : [...participantUids.value, uid]
}

function toggleAll() {
  const selected = !allSelected.value
  movements.value.forEach((movement) => {
    if (!movement.duplicate) movement.selected = selected
  })
}

function isAlreadyImported(movement, importKey) {
  const exactKey = `Importado desde Bankinter · ${importKey}`
  return expenses.value.some((expense) => {
    const details = String(expense.details || '')
    if (details.includes(exactKey)) return true
    return normalizeName(details).startsWith('importado desde bankinter') &&
      normalizeName(expense.name || '') === normalizeName(movement.name) &&
      expense.transaction_type === movement.transaction_type &&
      Math.round(Number(expense.amount) * 100) === Math.round(Number(movement.amount) * 100) &&
      String(expense.occurred_at || '').slice(0, 10) === movement.occurred_at.slice(0, 10)
  })
}

async function readFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  parsing.value = true
  importError.value = ''
  movements.value = []
  fileName.value = file.name
  try {
    if (fileType.value !== 'bankinter') throw new Error('Selecciona un tipo de fichero compatible.')
    movements.value = parseBankinterRows(await readXlsxRows(file)).map((movement) => {
      const duplicate = isAlreadyImported(movement, movement.import_key)
      return { ...movement, duplicate, selected: !duplicate }
    })
    await nextTick()
    document.querySelector('.import-table-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (reason) {
    fileName.value = ''
    importError.value = reason.message || 'No se pudo leer el fichero.'
  } finally {
    parsing.value = false
    event.target.value = ''
  }
}

function payloadFor(movement) {
  const participants = appliesToAll.value ? memberOptions.value.map((member) => member.uid) : participantUids.value
  return {
    transaction_type: movement.transaction_type,
    name: movement.name.trim() || movement.description,
    details: `Importado desde Bankinter · ${movement.import_key}`,
    category: movement.category || defaultCategory.value,
    place: '',
    city: group.value?.default_city || 'Sin ciudad',
    occurred_at: movement.occurred_at,
    amount: Number(movement.amount).toFixed(2),
    payment_method: group.value?.default_payment_method || 'card',
    paid_by_type: paidByType.value,
    paid_by_uid: paidByType.value === 'person' ? paidByUid.value : '',
    applies_to_all: appliesToAll.value,
    participant_uids: participants,
    participant_shares: {},
    share_mode: 'equal',
    tags: [],
  }
}

async function importSelected() {
  if (!canImport.value) return
  importError.value = ''
  importing.value = true
  importProgress.value = 0
  let imported = 0
  try {
    const token = await user.value.getIdToken(true)
    for (const movement of selectedMovements.value) {
      const data = await postJson('gastoteca/save_expense', token, payloadFor(movement))
      if (data.expenses) expenses.value = data.expenses
      if (data.stats) stats.value = data.stats
      if (data.group) group.value = data.group
      movement.duplicate = true
      movement.selected = false
      imported += 1
      importProgress.value = imported
    }
    notice.value = `${imported} ${imported === 1 ? 'movimiento importado' : 'movimientos importados'}.`
  } catch (reason) {
    importError.value = imported
      ? `Se importaron ${imported} movimientos, pero el siguiente falló: ${reason.message}`
      : reason.message
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <section class="page-heading import-heading">
    <div>
      <p class="eyebrow">AÑADE MOVIMIENTOS SIN TECLEARLOS</p>
      <h1>Importar gastos</h1>
      <p>Selecciona un fichero bancario, revisa sus movimientos y decide cómo repartirlos en tu grupo.</p>
    </div>
    <PhFileArrowUp aria-hidden="true" :size="52" weight="thin" />
  </section>

  <section class="import-layout">
    <article class="feature-panel import-setup-panel">
      <div class="feature-panel-heading"><div><p class="eyebrow">PASO 1</p><h2>Elige el fichero</h2></div><span class="feature-count">1</span></div>
      <div class="import-file-fields">
        <label><span>Tipo de fichero</span><select v-model="fileType"><option value="bankinter">Bankinter · Excel (.xlsx)</option><option value="other" disabled>Otros formatos · Próximamente</option></select></label>
        <label><span>Fichero</span><button type="button" class="import-file-button" @click="chooseFile"><PhFileArrowUp aria-hidden="true" :size="19" /> {{ fileName || 'Seleccionar Excel' }}</button><input ref="fileInput" class="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="readFile" /></label>
      </div>
      <p class="feature-hint">Se leerán la fecha contable, la descripción, el importe, el saldo y la divisa. Los importes negativos se crearán como gastos y los positivos como ingresos.</p>
      <div v-if="parsing" class="import-status"><span class="loader" aria-hidden="true"></span> Leyendo {{ fileName }}…</div>
      <FormError :message="importError" />
    </article>

    <article v-if="movements.length" class="feature-panel import-settings-panel">
      <div class="feature-panel-heading"><div><p class="eyebrow">PASO 2</p><h2>Asignación del grupo</h2></div><span class="feature-count">2</span></div>
      <div class="import-settings-grid">
        <label><span>¿De quién es el movimiento?</span><select v-model="paidByType"><option value="all">Entre todos</option><option value="person">Una persona</option></select><select v-if="paidByType === 'person'" v-model="paidByUid" class="import-payer-select"><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option></select></label>
        <label><span>Categoría por defecto</span><select v-model="defaultCategory"><option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
      </div>
      <fieldset class="import-participants"><legend>¿A quién aplica?</legend><label class="import-all-choice"><input v-model="appliesToAll" type="checkbox" @change="setAllParticipants" /> A todo el grupo</label><div v-if="!appliesToAll" class="import-member-list"><label v-for="member in participantOptions" :key="member.uid"><input type="checkbox" :checked="participantUids.includes(member.uid)" @change="toggleParticipant(member.uid)" /> {{ member.name || member.email }}</label></div></fieldset>
      <p class="feature-hint">Esta configuración se aplicará a todos los movimientos que mantengas seleccionados.</p>
    </article>
  </section>

  <section v-if="movements.length" class="import-table-panel" aria-label="Movimientos del fichero">
    <header class="import-table-heading"><div><p class="eyebrow">PASO 3 · {{ movements.length }} MOVIMIENTOS ENCONTRADOS</p><h2>Revisa antes de importar</h2></div><div class="import-summary"><strong>{{ selectedCount }}</strong><span>seleccionados</span></div></header>
    <div class="import-table-toolbar"><label><input type="checkbox" :checked="allSelected" :disabled="!availableMovements.length" @change="toggleAll" /> {{ allSelected ? 'Quitar todos' : 'Seleccionar todos' }}</label><span v-if="importing">Importando {{ importProgress }} de {{ selectedCount + importProgress }}…</span><span v-else-if="duplicateCount">{{ duplicateCount }} ya {{ duplicateCount === 1 ? 'está' : 'están' }} importado{{ duplicateCount === 1 ? '' : 's' }}</span><span v-else></span><button v-if="!importing" type="button" class="primary" :disabled="!canImport" @click="importSelected"><PhCheck aria-hidden="true" :size="18" weight="bold" /> Importar {{ selectedCount ? `${selectedCount} movimientos` : 'movimientos' }}</button></div>
    <div class="import-table-scroll"><table class="import-table"><thead><tr><th>Incluir</th><th>Movimiento</th><th>Fecha</th><th>Tipo</th><th>Importe</th><th>Categoría</th><th>Establecimiento</th><th>Saldo</th></tr></thead><tbody><tr v-for="movement in movements" :key="movement.id" :class="{ selected: movement.selected, duplicate: movement.duplicate }"><td data-label="Incluir"><input v-model="movement.selected" type="checkbox" :disabled="movement.duplicate || importing" :aria-label="`Incluir ${movement.name}`" /></td><td data-label="Movimiento"><input v-model="movement.name" class="import-name-input" :disabled="!movement.selected || movement.duplicate || importing" type="text" maxlength="160" aria-label="Nombre del movimiento" /><small v-if="movement.duplicate" class="import-duplicate-label">Ya importado · fila {{ movement.sourceRow }}</small><small v-else>Fila {{ movement.sourceRow }} · {{ movement.currency }}</small></td><td data-label="Fecha">{{ dateLabel(movement.occurred_at) }}</td><td data-label="Tipo"><span class="import-type" :class="movement.transaction_type"><PhArrowDown v-if="movement.transaction_type === 'expense'" aria-hidden="true" :size="14" /><PhArrowUp v-else aria-hidden="true" :size="14" />{{ movement.transaction_type === 'expense' ? 'Gasto' : 'Ingreso' }}</span></td><td data-label="Importe" class="import-amount" :class="movement.transaction_type">{{ movement.transaction_type === 'income' ? '+' : '−' }}{{ money(movement.amount) }}</td><td data-label="Categoría"><select v-model="movement.category" :disabled="!movement.selected || movement.duplicate || importing" aria-label="Categoría del movimiento"><option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></td><td data-label="Establecimiento"><Multiselect v-model="movement.place" class="smart-select import-place-select" :options="establishmentOptions" searchable create-option allow-absent :can-clear="Boolean(movement.place)" :disabled="!movement.selected || movement.duplicate || importing" placeholder="Sin establecimiento" aria-label="Establecimiento del movimiento" /></td><td data-label="Saldo">{{ movement.balance === null ? '—' : money(movement.balance) }}</td></tr></tbody></table></div>
  </section>

  <section v-else-if="!parsing" class="import-empty"><PhUsers aria-hidden="true" :size="34" /><strong>Selecciona un Excel para empezar</strong><p>La primera integración disponible es Bankinter.</p></section>
</template>
