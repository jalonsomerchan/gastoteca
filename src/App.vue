<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PhArrowRight,
  PhChartDonut,
  PhCheck,
  PhCoins,
  PhGoogleLogo,
  PhHouse,
  PhMapPin,
  PhPencilSimple,
  PhPlus,
  PhReceipt,
  PhSignOut,
  PhTag,
  PhTrash,
  PhUsers,
  PhWallet,
  PhX,
} from '@phosphor-icons/vue'
import { getJson, postJson } from './lib/api'
import { hasFirebaseConfig, observeAuth, signInWithGoogle, signOut } from './lib/firebase'

const route = useRoute()
const router = useRouter()
const brandIconUrl = `${import.meta.env.BASE_URL}icons/gastoteca.svg`
const loading = ref(true)
const signingIn = ref(false)
const saving = ref(false)
const user = ref(null)
const token = ref('')
const error = ref('')
const notice = ref('')
const expenses = ref([])
const group = ref(null)
const stats = ref({ total: 0, count: 0, average: 0, by_category: [], by_member: [], monthly: [] })
const modalOpen = ref(false)
const deleteTarget = ref(null)
const filters = reactive({ search: '', category: '', from: '', to: '' })
const inviteEmail = ref('')
const joinCode = ref('')

const categories = [
  { id: 'food', label: 'Alimentación', icon: '🍲', color: '#d36b47' },
  { id: 'home', label: 'Hogar', icon: '🏠', color: '#527a68' },
  { id: 'transport', label: 'Transporte', icon: '🚗', color: '#4b7193' },
  { id: 'leisure', label: 'Ocio', icon: '🎟️', color: '#8d6597' },
  { id: 'health', label: 'Salud', icon: '🩺', color: '#c25d69' },
  { id: 'shopping', label: 'Compras', icon: '🛍️', color: '#bd7d3b' },
  { id: 'bills', label: 'Facturas', icon: '💡', color: '#86743e' },
  { id: 'travel', label: 'Viajes', icon: '✈️', color: '#3f8890' },
  { id: 'other', label: 'Otros', icon: '✨', color: '#757a78' },
]

const emptyDraft = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return { id: '', name: '', category: 'food', place: '', occurred_at: local, amount: '', paid_by_type: 'person', paid_by_uid: user.value?.uid || '', applies_to_all: true, participant_uids: [] }
}
const draft = reactive(emptyDraft())

const memberOptions = computed(() => group.value?.members || [])
const currentMember = computed(() => memberOptions.value.find((member) => member.uid === user.value?.uid))
const maxCategoryTotal = computed(() => Math.max(1, ...stats.value.by_category.map((item) => Number(item.total))))
const filteredExpenses = computed(() => expenses.value.filter((expense) => {
  const term = filters.search.trim().toLowerCase()
  return (!term || `${expense.name} ${expense.place}`.toLowerCase().includes(term)) &&
    (!filters.category || expense.category === filters.category) &&
    (!filters.from || expense.occurred_at.slice(0, 10) >= filters.from) &&
    (!filters.to || expense.occurred_at.slice(0, 10) <= filters.to)
}))

const category = (id) => categories.find((item) => item.id === id) || categories.at(-1)
const memberLabel = (uid) => memberOptions.value.find((item) => item.uid === uid)?.name || memberOptions.value.find((item) => item.uid === uid)?.email || 'Miembro'
const money = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0))
const dateLabel = (value) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value.replace(' ', 'T')))
const monthLabel = (value) => new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(new Date(`${value}-01T12:00:00`))

function flash(message) {
  notice.value = message
  window.setTimeout(() => { if (notice.value === message) notice.value = '' }, 3200)
}

async function freshToken(force = false) {
  if (!user.value) throw new Error('Debes iniciar sesión.')
  token.value = await user.value.getIdToken(force)
  return token.value
}

async function loadData() {
  const authToken = await freshToken()
  const data = await getJson('gastoteca/bootstrap', authToken)
  expenses.value = data.expenses || []
  group.value = data.group
  stats.value = data.stats
}

async function login() {
  error.value = ''
  signingIn.value = true
  try {
    const result = await signInWithGoogle()
    const idToken = await result.user.getIdToken(true)
    await postJson('auth/login', idToken, { id_token: idToken })
  } catch (reason) {
    error.value = reason.message || 'No se pudo iniciar sesión.'
  } finally {
    signingIn.value = false
  }
}

function openExpense(expense = null) {
  Object.assign(draft, emptyDraft(), expense ? {
    ...expense,
    amount: Number(expense.amount).toFixed(2),
    occurred_at: expense.occurred_at.replace(' ', 'T').slice(0, 16),
    participant_uids: [...expense.participant_uids],
  } : {})
  if (!draft.paid_by_uid) draft.paid_by_uid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
  modalOpen.value = true
}

async function saveExpense() {
  error.value = ''
  if (!draft.name.trim() || !draft.amount || Number(draft.amount) <= 0) {
    error.value = 'Añade un nombre y un importe mayor que cero.'
    return
  }
  if (!draft.applies_to_all && !draft.participant_uids.length) {
    error.value = 'Selecciona al menos una persona a la que se aplica el gasto.'
    return
  }
  saving.value = true
  try {
    const data = await postJson('gastoteca/save_expense', await freshToken(true), { ...draft })
    expenses.value = data.expenses
    stats.value = data.stats
    modalOpen.value = false
    flash(draft.id ? 'Gasto actualizado.' : 'Gasto añadido.')
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

async function removeExpense() {
  if (!deleteTarget.value) return
  saving.value = true
  try {
    const data = await postJson('gastoteca/delete_expense', await freshToken(true), { id: deleteTarget.value.id })
    expenses.value = data.expenses
    stats.value = data.stats
    deleteTarget.value = null
    flash('Gasto eliminado.')
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

async function invite() {
  try {
    const data = await postJson('gastoteca/invite_email', await freshToken(true), { email: inviteEmail.value })
    group.value = data.group
    inviteEmail.value = ''
    flash('Invitación guardada.')
  } catch (reason) { error.value = reason.message }
}

async function joinGroup() {
  try {
    const data = await postJson('gastoteca/join_group', await freshToken(true), { invite_code: joinCode.value })
    group.value = data.group
    expenses.value = data.expenses
    stats.value = data.stats
    joinCode.value = ''
    flash('Ya formas parte del grupo.')
  } catch (reason) { error.value = reason.message }
}

async function leaveGroup() {
  try {
    const data = await postJson('gastoteca/leave_group', await freshToken(true), {})
    group.value = data.group
    expenses.value = data.expenses
    stats.value = data.stats
    flash('Has creado un nuevo grupo personal.')
  } catch (reason) { error.value = reason.message }
}

watch(() => route.name, () => { error.value = ''; window.scrollTo({ top: 0, behavior: 'smooth' }) })

onMounted(async () => {
  if (!hasFirebaseConfig()) {
    error.value = 'Falta configurar Firebase en .env.local.'
    loading.value = false
    return
  }
  try {
    await observeAuth(async (firebaseUser) => {
      user.value = firebaseUser
      error.value = ''
      if (firebaseUser) {
        try { await loadData() } catch (reason) { error.value = reason.message }
      } else {
        expenses.value = []
        group.value = null
      }
      loading.value = false
    })
  } catch (reason) {
    error.value = reason.message
    loading.value = false
  }
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <button class="brand" type="button" @click="router.push('/')">
        <img class="brand-icon" :src="brandIconUrl" alt="" />
        <span><strong>La Gastoteca</strong><small>Cuentas claras, siempre</small></span>
      </button>
      <nav v-if="user" class="main-nav" aria-label="Navegación principal">
        <button :class="{ active: route.name === 'expenses' }" @click="router.push('/')"><PhReceipt :size="19" /> Gastos</button>
        <button :class="{ active: route.name === 'stats' }" @click="router.push('/estadisticas')"><PhChartDonut :size="19" /> Estadísticas</button>
        <button :class="{ active: route.name === 'group' }" @click="router.push('/grupo')"><PhUsers :size="19" /> Grupo</button>
      </nav>
      <div v-if="user" class="account">
        <img v-if="user.photoURL" :src="user.photoURL" alt="" />
        <span>{{ user.displayName || user.email }}</span>
        <button class="icon-button" title="Cerrar sesión" @click="signOut"><PhSignOut :size="21" /></button>
      </div>
    </header>

    <div v-if="loading" class="loading-screen"><span class="loader"></span><p>Preparando tus gastos…</p></div>

    <main v-else-if="!user" class="welcome">
      <div class="welcome-art"><PhCoins :size="64" weight="duotone" /></div>
      <p class="eyebrow">GASTOS COMPARTIDOS, SIN LÍOS</p>
      <h1>Todo lo que gastáis.<br /><em>Claro para todos.</em></h1>
      <p>Guarda los gastos del grupo, reparte cada compra entre quien corresponda y entiende en qué se va el dinero.</p>
      <button class="primary big" :disabled="signingIn" @click="login"><PhGoogleLogo :size="20" weight="bold" /> {{ signingIn ? 'Conectando…' : 'Continuar con Google' }}</button>
      <p v-if="error" class="inline-error">{{ error }}</p>
    </main>

    <main v-else>
      <div v-if="notice" class="toast"><PhCheck :size="18" weight="bold" /> {{ notice }}</div>
      <div v-if="error" class="alert"><span>{{ error }}</span><button @click="error = ''"><PhX :size="18" /></button></div>

      <template v-if="route.name === 'expenses'">
        <section class="page-heading">
          <div><p class="eyebrow">{{ group?.name || 'MI GRUPO' }}</p><h1>Gastos</h1><p>Un registro común para que nadie pierda la cuenta.</p></div>
          <button class="primary" @click="openExpense()"><PhPlus :size="19" weight="bold" /> Añadir gasto</button>
        </section>

        <section class="summary-strip">
          <div><span>Total del grupo</span><strong>{{ money(stats.total) }}</strong></div>
          <div><span>Movimientos</span><strong>{{ stats.count }}</strong></div>
          <div><span>Gasto medio</span><strong>{{ money(stats.average) }}</strong></div>
          <div class="summary-accent"><span>Este mes</span><strong>{{ money(stats.current_month_total) }}</strong></div>
        </section>

        <section class="filters">
          <label class="search"><PhReceipt :size="18" /><input v-model="filters.search" placeholder="Buscar gasto o lugar…" /></label>
          <select v-model="filters.category"><option value="">Todas las categorías</option><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.label }}</option></select>
          <input v-model="filters.from" type="date" title="Desde" />
          <input v-model="filters.to" type="date" title="Hasta" />
        </section>

        <section v-if="filteredExpenses.length" class="expense-list">
          <article v-for="expense in filteredExpenses" :key="expense.id" class="expense-card">
            <span class="category-icon" :style="{ background: `${category(expense.category).color}18`, color: category(expense.category).color }">{{ category(expense.category).icon }}</span>
            <div class="expense-main"><strong>{{ expense.name }}</strong><span><PhMapPin :size="14" /> {{ expense.place || 'Sin lugar' }} · {{ dateLabel(expense.occurred_at) }}</span></div>
            <span class="category-pill" :style="{ color: category(expense.category).color }"><PhTag :size="13" /> {{ category(expense.category).label }}</span>
            <div class="expense-people"><span>Pagó</span><strong>{{ expense.paid_by_type === 'all' ? 'Todo el grupo' : memberLabel(expense.paid_by_uid) }}</strong><small>Para {{ expense.applies_to_all ? 'todo el grupo' : expense.participant_uids.map(memberLabel).join(', ') }}</small></div>
            <strong class="expense-amount">{{ money(expense.amount) }}</strong>
            <div class="row-actions"><button title="Editar" @click="openExpense(expense)"><PhPencilSimple :size="18" /></button><button class="danger" title="Eliminar" @click="deleteTarget = expense"><PhTrash :size="18" /></button></div>
          </article>
        </section>
        <section v-else class="empty-state"><div>🧾</div><h2>{{ expenses.length ? 'No hay resultados' : 'Tu primer gasto empieza aquí' }}</h2><p>{{ expenses.length ? 'Prueba a cambiar los filtros.' : 'Añade una compra, una factura o una cena y repártela con el grupo.' }}</p><button v-if="!expenses.length" class="secondary" @click="openExpense()"><PhPlus :size="18" /> Añadir el primero</button></section>
      </template>

      <template v-else-if="route.name === 'stats'">
        <section class="page-heading"><div><p class="eyebrow">UNA MIRADA AL CONJUNTO</p><h1>Estadísticas</h1><p>Descubre dónde, cuándo y entre quién se reparte el gasto.</p></div></section>
        <section class="stats-grid">
          <article class="chart-card wide">
            <div class="card-title"><div><p class="eyebrow">EVOLUCIÓN</p><h2>Gasto por mes</h2></div><PhChartDonut :size="27" /></div>
            <div v-if="stats.monthly.length" class="month-chart">
              <div v-for="item in stats.monthly" :key="item.month" class="month-column"><strong>{{ money(item.total) }}</strong><div><span :style="{ height: `${Math.max(8, Number(item.total) / Math.max(1, ...stats.monthly.map(x => Number(x.total))) * 100)}%` }"></span></div><small>{{ monthLabel(item.month) }}</small></div>
            </div><p v-else class="muted">Añade gastos para ver su evolución.</p>
          </article>
          <article class="chart-card">
            <div class="card-title"><div><p class="eyebrow">CATEGORÍAS</p><h2>En qué gastáis</h2></div></div>
            <div class="bar-list"><div v-for="item in stats.by_category" :key="item.category" class="bar-item"><span>{{ category(item.category).icon }}</span><div><p><strong>{{ category(item.category).label }}</strong><b>{{ money(item.total) }}</b></p><i><em :style="{ width: `${Number(item.total) / maxCategoryTotal * 100}%`, background: category(item.category).color }"></em></i></div></div><p v-if="!stats.by_category.length" class="muted">Aún no hay datos.</p></div>
          </article>
          <article class="chart-card">
            <div class="card-title"><div><p class="eyebrow">PERSONAS</p><h2>Quién ha pagado</h2></div></div>
            <div class="member-stat"><div v-for="item in stats.by_member" :key="item.uid || 'all'"><span class="avatar">{{ item.uid ? memberLabel(item.uid).slice(0, 1).toUpperCase() : '∑' }}</span><p><strong>{{ item.uid ? memberLabel(item.uid) : 'Todo el grupo' }}</strong><small>{{ item.count }} gastos</small></p><b>{{ money(item.total) }}</b></div><p v-if="!stats.by_member.length" class="muted">Aún no hay datos.</p></div>
          </article>
        </section>
      </template>

      <template v-else>
        <section class="page-heading"><div><p class="eyebrow">ESPACIO COMPARTIDO</p><h1>Tu grupo</h1><p>Invita a las personas con las que compartes gastos.</p></div></section>
        <section class="group-grid">
          <article class="group-card group-hero"><span class="group-mark"><PhHouse :size="28" weight="duotone" /></span><div><p class="eyebrow">GRUPO ACTUAL</p><h2>{{ group?.name }}</h2><p>{{ memberOptions.length }} {{ memberOptions.length === 1 ? 'persona' : 'personas' }}</p></div><div class="invite-code"><span>Código de invitación</span><strong>{{ group?.invite_code }}</strong></div></article>
          <article class="group-card"><p class="eyebrow">MIEMBROS</p><h2>Personas del grupo</h2><div class="members"><div v-for="member in memberOptions" :key="member.uid"><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span><p><strong>{{ member.name || member.email }}</strong><small>{{ member.uid === group?.owner_uid ? 'Propietario' : member.email }}</small></p><span v-if="member.uid === user.uid" class="you-pill">Tú</span></div></div></article>
          <article v-if="group?.owner_uid === user.uid" class="group-card"><p class="eyebrow">INVITAR</p><h2>Sumar una persona</h2><p class="muted">Se unirá automáticamente cuando acceda con este email.</p><form class="inline-form" @submit.prevent="invite"><input v-model="inviteEmail" type="email" placeholder="persona@ejemplo.com" required /><button class="primary">Invitar <PhArrowRight :size="17" /></button></form><div v-if="group.pending_emails?.length" class="pending"><span v-for="email in group.pending_emails" :key="email">{{ email }} · pendiente</span></div></article>
          <article class="group-card"><p class="eyebrow">OTRO GRUPO</p><h2>Unirte con un código</h2><p class="muted">Al unirte saldrás de tu grupo actual si no eres su propietario.</p><form class="inline-form" @submit.prevent="joinGroup"><input v-model="joinCode" maxlength="8" placeholder="ABCD2345" required /><button class="secondary">Unirme</button></form><button v-if="group?.owner_uid !== user.uid" class="text-danger" @click="leaveGroup">Salir del grupo actual</button></article>
        </section>
      </template>
    </main>

    <div v-if="modalOpen" class="modal-backdrop" @mousedown.self="modalOpen = false">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title">
        <header><div><p class="eyebrow">{{ draft.id ? 'EDITAR MOVIMIENTO' : 'NUEVO MOVIMIENTO' }}</p><h2 id="expense-title">{{ draft.id ? 'Editar gasto' : 'Añadir gasto' }}</h2></div><button class="icon-button" @click="modalOpen = false"><PhX :size="22" /></button></header>
        <form @submit.prevent="saveExpense">
          <div class="form-grid">
            <label class="full"><span>Nombre del gasto</span><input v-model="draft.name" maxlength="160" placeholder="Cena, compra semanal, gasolina…" autofocus required /></label>
            <label><span>Categoría</span><select v-model="draft.category"><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.label }}</option></select></label>
            <label><span>Importe</span><div class="money-input"><input v-model="draft.amount" type="number" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div></label>
            <label><span>Lugar</span><input v-model="draft.place" maxlength="160" placeholder="Mercadona, Casa, Madrid…" /></label>
            <label><span>Fecha y hora</span><input v-model="draft.occurred_at" type="datetime-local" required /></label>
          </div>
          <fieldset><legend>¿Quién lo ha pagado?</legend><div class="choice-grid"><label :class="{ selected: draft.paid_by_type === 'person' }"><input v-model="draft.paid_by_type" type="radio" value="person" /><PhWallet :size="22" /><span><strong>Una persona</strong><small>Selecciona quién adelantó el dinero</small></span></label><label :class="{ selected: draft.paid_by_type === 'all' }"><input v-model="draft.paid_by_type" type="radio" value="all" /><PhUsers :size="22" /><span><strong>Entre todos</strong><small>El grupo lo pagó en conjunto</small></span></label></div><select v-if="draft.paid_by_type === 'person'" v-model="draft.paid_by_uid" class="member-select"><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option></select></fieldset>
          <fieldset><legend>¿A quién se aplica?</legend><div class="choice-grid"><label :class="{ selected: draft.applies_to_all }"><input v-model="draft.applies_to_all" type="radio" :value="true" /><PhUsers :size="22" /><span><strong>A todo el grupo</strong><small>Se reparte por igual</small></span></label><label :class="{ selected: !draft.applies_to_all }"><input v-model="draft.applies_to_all" type="radio" :value="false" /><PhCheck :size="22" /><span><strong>Solo a algunas</strong><small>Elige las personas</small></span></label></div><div v-if="!draft.applies_to_all" class="check-members"><label v-for="member in memberOptions" :key="member.uid"><input v-model="draft.participant_uids" type="checkbox" :value="member.uid" /><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span>{{ member.name || member.email }}</label></div></fieldset>
          <footer><button type="button" class="ghost" @click="modalOpen = false">Cancelar</button><button class="primary" :disabled="saving"><PhCheck :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar gasto' }}</button></footer>
        </form>
      </section>
    </div>

    <div v-if="deleteTarget" class="modal-backdrop" @mousedown.self="deleteTarget = null"><section class="confirm-dialog"><span class="danger-mark"><PhTrash :size="25" /></span><h2>¿Eliminar este gasto?</h2><p>“{{ deleteTarget.name }}” desaparecerá del grupo y de las estadísticas.</p><div><button class="ghost" @click="deleteTarget = null">Cancelar</button><button class="danger-button" :disabled="saving" @click="removeExpense">Sí, eliminar</button></div></section></div>
  </div>
</template>
