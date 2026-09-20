<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PhArrowRight,
  PhChartDonut,
  PhCaretDown,
  PhCheck,
  PhCoins,
  PhCrosshair,
  PhArrowDown,
  PhArrowUp,
  PhFunnel,
  PhGoogleLogo,
  PhHouse,
  PhList,
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
import Multiselect from '@vueform/multiselect'
import '@vueform/multiselect/themes/default.css'
import { getJson, postJson } from './lib/api'
import { hasFirebaseConfig, observeAuth, signInWithGoogle, signOut } from './lib/firebase'

const route = useRoute()
const router = useRouter()
const brandIconUrl = `${import.meta.env.BASE_URL}icons/gastoteca.svg`
const menuOpen = ref(false)
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
const filtersOpen = ref(false)
const visibleExpenseCount = ref(20)
const loadMoreSentinel = ref(null)
const inviteEmail = ref('')
const joinCode = ref('')
const defaultCityDraft = ref('')
const detectingCity = ref(false)
const locationStatus = ref('')
const detectedCity = ref('')
let expenseObserver = null

const builtInCategories = [
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

const customCategoryColor = (label) => {
  const palette = ['#5f7296', '#987052', '#6f7e4c', '#8b6387', '#477e78', '#9b625a']
  const hash = [...label].reduce((total, character) => total + character.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

const categories = computed(() => [
  ...builtInCategories,
  ...(group.value?.custom_categories || []).map((label) => ({ id: label, label, icon: '🏷️', color: customCategoryColor(label) })),
])

const emptyDraft = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return { id: '', transaction_type: '', name: '', category: 'food', place: '', city: '', occurred_at: local, amount: '', paid_by_type: 'person', paid_by_uid: user.value?.uid || '', applies_to_all: true, participant_uids: [] }
}
const draft = reactive(emptyDraft())

const memberOptions = computed(() => group.value?.members || [])
const currentMember = computed(() => memberOptions.value.find((member) => member.uid === user.value?.uid))
const maxCategoryTotal = computed(() => Math.max(1, ...stats.value.by_category.map((item) => Number(item.total))))
const categoryOptions = computed(() => categories.value.map((item) => ({ value: item.id, label: `${item.icon} ${item.label}` })))
const cityOptions = computed(() => [...new Set([
  group.value?.default_city,
  detectedCity.value,
  ...expenses.value.map((item) => item.city),
].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')))
const establishmentOptions = computed(() => {
  const selectedCity = normalizeName(draft.city || '')
  const ordered = [...expenses.value].sort((a, b) => {
    const aMatches = selectedCity && normalizeName(a.city || '') === selectedCity ? 1 : 0
    const bMatches = selectedCity && normalizeName(b.city || '') === selectedCity ? 1 : 0
    return bMatches - aMatches
  })
  return [...new Set(ordered.map((item) => item.place).filter(Boolean))]
})
const filteredExpenses = computed(() => expenses.value.filter((expense) => {
  const term = filters.search.trim().toLowerCase()
  return (!term || `${expense.name} ${expense.place} ${expense.city || ''}`.toLowerCase().includes(term)) &&
    (!filters.category || expense.category === filters.category) &&
    (!filters.from || expense.occurred_at.slice(0, 10) >= filters.from) &&
    (!filters.to || expense.occurred_at.slice(0, 10) <= filters.to)
}))

const defaultSuggestions = {
  expense: [
    { name: 'Desayuno', category: 'food', place: '' },
    { name: 'Compra', category: 'shopping', place: '' },
    { name: 'Comida', category: 'food', place: '' },
    { name: 'Gasolina', category: 'transport', place: '' },
    { name: 'Cena', category: 'food', place: '' },
    { name: 'Supermercado', category: 'food', place: '' },
  ],
  income: [
    { name: 'Nómina', category: 'other', place: '' },
    { name: 'Bizum recibido', category: 'other', place: '' },
    { name: 'Reembolso', category: 'other', place: '' },
    { name: 'Venta', category: 'shopping', place: '' },
  ],
}

const normalizeName = (value) => value.trim().toLocaleLowerCase('es-ES')
const frequentNames = computed(() => {
  const grouped = new Map()
  expenses.value
    .filter((item) => (item.transaction_type || 'expense') === draft.transaction_type && (!draft.id || item.id !== draft.id))
    .forEach((item) => {
      const key = normalizeName(item.name)
      if (!grouped.has(key)) grouped.set(key, { name: item.name, count: 0, items: [], isHistory: true })
      const groupItem = grouped.get(key)
      groupItem.count += 1
      groupItem.items.push(item)
    })

  const suggestions = [...grouped.values()].sort((a, b) => b.count - a.count)
  for (const item of (defaultSuggestions[draft.transaction_type] || [])) {
    if (!grouped.has(normalizeName(item.name))) suggestions.push({ ...item, count: 0, isHistory: false })
  }
  return suggestions.slice(0, 6)
})

function mostUsedValues(field) {
  const matchingType = expenses.value.filter((item) =>
    (item.transaction_type || 'expense') === draft.transaction_type && item[field] && (!draft.id || item.id !== draft.id))
  const matchingName = draft.name.trim()
    ? matchingType.filter((item) => normalizeName(item.name) === normalizeName(draft.name))
    : []
  const source = matchingName.length ? matchingName : matchingType
  const grouped = new Map()
  source.forEach((item) => {
    const value = item[field].trim()
    const key = normalizeName(value)
    if (!grouped.has(key)) grouped.set(key, { value, count: 0 })
    grouped.get(key).count += 1
  })
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es')).slice(0, 5)
}

const frequentEstablishments = computed(() => mostUsedValues('place'))
const frequentCities = computed(() => mostUsedValues('city'))
const visibleExpenses = computed(() => filteredExpenses.value.slice(0, visibleExpenseCount.value))
const hasMoreExpenses = computed(() => visibleExpenseCount.value < filteredExpenses.value.length)
const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length)
const balanceSummary = computed(() => expenses.value.reduce((balance, expense) => {
  if ((expense.transaction_type || 'expense') !== 'expense' || expense.paid_by_type !== 'person') return balance

  const ownShare = Number(expense.participants?.find((participant) => participant.uid === user.value?.uid)?.share_amount || 0)
  if (expense.paid_by_uid === user.value?.uid) {
    balance.owedToYou += Math.max(0, Number(expense.amount) - ownShare)
  } else if (ownShare > 0) {
    balance.youOwe += ownShare
  }
  return balance
}, { owedToYou: 0, youOwe: 0 }))

const navigationItems = [
  { route: 'expenses', label: 'Gastos', path: '/', icon: PhReceipt },
  { route: 'stats', label: 'Estadísticas', path: '/estadisticas', icon: PhChartDonut },
  { route: 'group', label: 'Grupo', path: '/grupo', icon: PhUsers },
]

const category = (id) => categories.value.find((item) => item.id === id) || { id, label: id || 'Otros', icon: '🏷️', color: '#757a78' }
const memberLabel = (uid) => memberOptions.value.find((item) => item.uid === uid)?.name || memberOptions.value.find((item) => item.uid === uid)?.email || 'Miembro'
const money = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0))
const dateLabel = (value) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value.replace(' ', 'T')))
const monthLabel = (value) => new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(new Date(`${value}-01T12:00:00`))
const expenseLocation = (expense) => [expense.place || 'Sin establecimiento', expense.city].filter(Boolean).join(' · ')

function flash(message) {
  notice.value = message
  window.setTimeout(() => { if (notice.value === message) notice.value = '' }, 3200)
}

function clearFilters() {
  Object.assign(filters, { search: '', category: '', from: '', to: '' })
}

function browserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'))
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 })
  })
}

async function detectCurrentCity() {
  if (detectedCity.value) {
    draft.city = detectedCity.value
    locationStatus.value = 'Ciudad detectada automáticamente.'
    return
  }
  detectingCity.value = true
  locationStatus.value = 'Detectando tu ciudad…'
  try {
    const position = await browserPosition()
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(position.coords.latitude),
      lon: String(position.coords.longitude),
      zoom: '10',
      'accept-language': 'es',
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`)
    if (!response.ok) throw new Error('No se pudo consultar la ciudad')
    const result = await response.json()
    const address = result.address || {}
    const city = address.city || address.town || address.village || address.municipality || address.county || ''
    if (!city) throw new Error('No se pudo identificar la ciudad')
    detectedCity.value = city
    draft.city = city
    locationStatus.value = 'Ciudad detectada automáticamente.'
  } catch {
    draft.city = draft.city || group.value?.default_city || ''
    locationStatus.value = group.value?.default_city
      ? 'Usando la ciudad predeterminada del grupo.'
      : 'No se pudo detectar. Puedes escribir la ciudad.'
  } finally {
    detectingCity.value = false
  }
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
    transaction_type: expense.transaction_type || 'expense',
    amount: Number(expense.amount).toFixed(2),
    occurred_at: expense.occurred_at.replace(' ', 'T').slice(0, 16),
    participant_uids: [...(expense.participant_uids || [])],
  } : {})
  if (!draft.paid_by_uid) draft.paid_by_uid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
  if (!expense) draft.city = group.value?.default_city || ''
  modalOpen.value = true
  locationStatus.value = ''
  if (!expense) detectCurrentCity()
}

function selectFrequentName(suggestion) {
  let profile = suggestion
  if (suggestion.items?.length) {
    const configurations = new Map()
    suggestion.items.forEach((item) => {
      const key = JSON.stringify([
        item.category,
        item.paid_by_type,
        item.paid_by_uid || '',
        Boolean(item.applies_to_all),
        item.participant_uids || [],
      ])
      if (!configurations.has(key)) configurations.set(key, { item, count: 0 })
      configurations.get(key).count += 1
    })
    profile = [...configurations.values()].sort((a, b) => b.count - a.count)[0].item
  }

  draft.name = suggestion.name
  draft.category = profile.category || 'other'
  draft.paid_by_type = profile.paid_by_type || 'person'
  draft.paid_by_uid = memberOptions.value.some((member) => member.uid === profile.paid_by_uid)
    ? profile.paid_by_uid
    : (currentMember.value?.uid || memberOptions.value[0]?.uid || '')
  draft.applies_to_all = profile.applies_to_all ?? true
  const validParticipants = (profile.participant_uids || []).filter((uid) => memberOptions.value.some((member) => member.uid === uid))
  draft.participant_uids = validParticipants
  if (!draft.applies_to_all && !validParticipants.length) draft.applies_to_all = true
}

async function saveExpense() {
  error.value = ''
  if (!draft.transaction_type) {
    error.value = 'Selecciona si es un gasto o un ingreso.'
    return
  }
  if (!draft.city.trim()) {
    error.value = 'Selecciona o escribe la ciudad del movimiento.'
    return
  }
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
    if (data.group) group.value = data.group
    modalOpen.value = false
    const movement = draft.transaction_type === 'income' ? 'Ingreso' : 'Gasto'
    flash(draft.id ? `${movement} actualizado.` : `${movement} añadido.`)
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

async function removeExpense() {
  if (!deleteTarget.value) return
  const movement = deleteTarget.value.transaction_type === 'income' ? 'Ingreso' : 'Gasto'
  saving.value = true
  try {
    const data = await postJson('gastoteca/delete_expense', await freshToken(true), { id: deleteTarget.value.id })
    expenses.value = data.expenses
    stats.value = data.stats
    deleteTarget.value = null
    flash(`${movement} eliminado.`)
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

async function saveGroupSettings() {
  saving.value = true
  error.value = ''
  try {
    const data = await postJson('gastoteca/update_group_settings', await freshToken(true), { default_city: defaultCityDraft.value })
    group.value = data.group
    flash('Ciudad predeterminada actualizada.')
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
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

watch(() => route.name, () => {
  menuOpen.value = false
  error.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
watch(() => group.value?.default_city, (city) => { defaultCityDraft.value = city || '' }, { immediate: true })
watch(() => [filters.search, filters.category, filters.from, filters.to], () => { visibleExpenseCount.value = 20 })
watch(loadMoreSentinel, (element) => {
  expenseObserver?.disconnect()
  if (!element) return
  expenseObserver = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && hasMoreExpenses.value) visibleExpenseCount.value += 20
  }, { rootMargin: '300px 0px' })
  expenseObserver.observe(element)
})

onBeforeUnmount(() => {
  expenseObserver?.disconnect()
  window.removeEventListener('keydown', handleHeaderEscape)
})

function dismissHeaderMenu() {
  menuOpen.value = false
}

function handleHeaderEscape(event) {
  if (event.key !== 'Escape' || !menuOpen.value) return
  dismissHeaderMenu()
  document.querySelector('.menu-trigger')?.focus()
}

function navigateTo(path) {
  menuOpen.value = false
  router.push(path)
}

onMounted(async () => {
  window.addEventListener('keydown', handleHeaderEscape)
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
  <div class="app-shell" @click="dismissHeaderMenu">
    <header class="topbar">
      <button class="brand" type="button" @click="router.push('/')">
        <img class="brand-icon" :src="brandIconUrl" alt="" />
        <span><strong>La Gastoteca</strong><small>Cuentas claras, siempre</small></span>
      </button>
      <div v-if="user" class="navigation-menu" @click.stop>
        <button
          type="button"
          class="menu-trigger"
          :aria-expanded="menuOpen"
          :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'"
          aria-controls="main-navigation"
          @click="menuOpen = !menuOpen"
        >
          <PhList :size="22" weight="regular" /><span>Menú</span>
        </button>
        <nav
          v-if="menuOpen"
          id="main-navigation"
          class="navigation-panel"
          aria-label="Navegación principal"
        >
          <button
            v-for="item in navigationItems"
            :key="item.route"
            type="button"
            :class="{ active: route.name === item.route }"
            :aria-current="route.name === item.route ? 'page' : undefined"
            @click="navigateTo(item.path)"
          >
            <component :is="item.icon" :size="19" weight="regular" /><span>{{ item.label }}</span>
          </button>
        </nav>
      </div>
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
        <section class="balance-section" aria-label="Tu balance">
          <p class="eyebrow">{{ group?.name || 'MI GRUPO' }}</p>
          <div class="balance-grid">
            <article class="balance-card balance-positive"><span>Te deben</span><strong>{{ money(balanceSummary.owedToYou) }}</strong></article>
            <article class="balance-card balance-negative"><span>Debes</span><strong>{{ money(balanceSummary.youOwe) }}</strong></article>
          </div>
        </section>

        <section class="filter-accordion">
          <button class="filter-toggle" type="button" :aria-expanded="filtersOpen" aria-controls="expense-filters" @click="filtersOpen = !filtersOpen">
            <span><PhFunnel :size="18" /> Filtros <b v-if="activeFilterCount">{{ activeFilterCount }}</b></span>
            <PhCaretDown :size="18" :class="{ rotated: filtersOpen }" />
          </button>
          <div v-if="filtersOpen" id="expense-filters" class="filter-content">
            <div class="filters">
              <label class="search"><PhReceipt :size="18" /><input v-model="filters.search" placeholder="Buscar movimiento, establecimiento o ciudad…" /></label>
              <select v-model="filters.category"><option value="">Todas las categorías</option><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.icon }} {{ item.label }}</option></select>
              <input v-model="filters.from" type="date" title="Desde" aria-label="Desde" />
              <input v-model="filters.to" type="date" title="Hasta" aria-label="Hasta" />
            </div>
            <button v-if="activeFilterCount" class="clear-filters" type="button" @click="clearFilters">Limpiar filtros</button>
          </div>
        </section>

        <section v-if="filteredExpenses.length" class="expense-list">
          <div class="expense-list-heading"><h1>Movimientos</h1><span>{{ filteredExpenses.length }}</span></div>
          <article v-for="expense in visibleExpenses" :key="expense.id" class="expense-card">
            <span class="category-icon" :style="{ background: `${category(expense.category).color}18`, color: category(expense.category).color }">{{ category(expense.category).icon }}</span>
            <div class="expense-main"><strong>{{ expense.name }} <em v-if="expense.transaction_type === 'income'" class="movement-type">Ingreso</em></strong><span><PhMapPin :size="14" /> {{ expenseLocation(expense) }} · {{ dateLabel(expense.occurred_at) }}</span></div>
            <span class="category-pill" :style="{ color: category(expense.category).color }"><PhTag :size="13" /> {{ category(expense.category).label }}</span>
            <div class="expense-people"><span>{{ expense.transaction_type === 'income' ? 'Recibió' : 'Pagó' }}</span><strong>{{ expense.paid_by_type === 'all' ? 'Todo el grupo' : memberLabel(expense.paid_by_uid) }}</strong><small>Para {{ expense.applies_to_all ? 'todo el grupo' : expense.participant_uids.map(memberLabel).join(', ') }}</small></div>
            <strong class="expense-amount" :class="{ income: expense.transaction_type === 'income' }">{{ expense.transaction_type === 'income' ? '+' : '' }}{{ money(expense.amount) }}</strong>
            <div class="row-actions"><button title="Editar" @click="openExpense(expense)"><PhPencilSimple :size="18" /></button><button class="danger" title="Eliminar" @click="deleteTarget = expense"><PhTrash :size="18" /></button></div>
          </article>
          <div v-if="hasMoreExpenses" ref="loadMoreSentinel" class="load-more" aria-label="Cargando más gastos"><span class="loader"></span></div>
        </section>
        <section v-else class="empty-state"><div>🧾</div><h2>{{ expenses.length ? 'No hay resultados' : 'Tu primer gasto empieza aquí' }}</h2><p>{{ expenses.length ? 'Prueba a cambiar los filtros.' : 'Pulsa el botón + para añadir una compra, una factura o una cena.' }}</p></section>
        <button class="floating-add" type="button" title="Añadir movimiento" aria-label="Añadir movimiento" @click="openExpense()"><PhPlus :size="30" weight="bold" /></button>
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
          <article class="group-card group-hero"><span class="group-mark"><PhHouse :size="28" weight="duotone" /></span><div><p class="eyebrow">GRUPO ACTUAL</p><h2>{{ group?.name }}</h2><p>{{ memberOptions.length }} {{ memberOptions.length === 1 ? 'persona' : 'personas' }}<template v-if="group?.default_city"> · {{ group.default_city }}</template></p></div><div class="invite-code"><span>Código de invitación</span><strong>{{ group?.invite_code }}</strong></div></article>
          <article class="group-card"><p class="eyebrow">MIEMBROS</p><h2>Personas del grupo</h2><div class="members"><div v-for="member in memberOptions" :key="member.uid"><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span><p><strong>{{ member.name || member.email }}</strong><small>{{ member.uid === group?.owner_uid ? 'Propietario' : member.email }}</small></p><span v-if="member.uid === user.uid" class="you-pill">Tú</span></div></div></article>
          <article v-if="group?.owner_uid === user.uid" class="group-card"><p class="eyebrow">INVITAR</p><h2>Sumar una persona</h2><p class="muted">Se unirá automáticamente cuando acceda con este email.</p><form class="inline-form" @submit.prevent="invite"><input v-model="inviteEmail" type="email" placeholder="persona@ejemplo.com" required /><button class="primary">Invitar <PhArrowRight :size="17" /></button></form><div v-if="group.pending_emails?.length" class="pending"><span v-for="email in group.pending_emails" :key="email">{{ email }} · pendiente</span></div></article>
          <article v-if="group?.owner_uid === user.uid" class="group-card"><p class="eyebrow">UBICACIÓN</p><h2>Ciudad predeterminada</h2><p class="muted">Se usará cuando no podamos detectar la ubicación del dispositivo.</p><form class="group-setting-form" @submit.prevent="saveGroupSettings"><Multiselect v-model="defaultCityDraft" class="smart-select" :options="cityOptions" searchable create-option allow-absent :can-clear="Boolean(defaultCityDraft)" :aria="{ 'aria-label': 'Ciudad predeterminada' }" placeholder="Escribe o busca una ciudad" no-options-text="Escribe una ciudad nueva" no-results-text="Sin coincidencias" /><button class="primary" :disabled="saving">Guardar</button></form></article>
          <article class="group-card"><p class="eyebrow">OTRO GRUPO</p><h2>Unirte con un código</h2><p class="muted">Al unirte saldrás de tu grupo actual si no eres su propietario.</p><form class="inline-form" @submit.prevent="joinGroup"><input v-model="joinCode" maxlength="8" placeholder="ABCD2345" required /><button class="secondary">Unirme</button></form><button v-if="group?.owner_uid !== user.uid" class="text-danger" @click="leaveGroup">Salir del grupo actual</button></article>
        </section>
      </template>
    </main>

    <div v-if="modalOpen" class="modal-backdrop" @mousedown.self="modalOpen = false">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title">
        <header><div><p class="eyebrow">{{ draft.id ? 'EDITAR MOVIMIENTO' : 'NUEVO MOVIMIENTO' }}</p><h2 id="expense-title">{{ draft.id ? 'Editar movimiento' : 'Añadir movimiento' }}</h2></div><button class="icon-button" @click="modalOpen = false"><PhX :size="22" /></button></header>
        <form @submit.prevent="saveExpense">
          <fieldset class="transaction-type"><legend>Primero, selecciona el tipo</legend><div class="choice-grid"><label :class="{ selected: draft.transaction_type === 'expense' }"><input v-model="draft.transaction_type" type="radio" value="expense" required /><PhArrowDown :size="22" /><span><strong>Gasto</strong><small>Dinero que ha salido</small></span></label><label :class="{ selected: draft.transaction_type === 'income' }"><input v-model="draft.transaction_type" type="radio" value="income" required /><PhArrowUp :size="22" /><span><strong>Ingreso</strong><small>Dinero que ha entrado</small></span></label></div></fieldset>
          <template v-if="draft.transaction_type">
          <div class="form-grid">
            <label class="full name-field"><span>Nombre del {{ draft.transaction_type === 'income' ? 'ingreso' : 'gasto' }}</span><input v-model="draft.name" maxlength="160" :placeholder="draft.transaction_type === 'income' ? 'Nómina, reembolso, venta…' : 'Cena, compra semanal, gasolina…'" autofocus required /><span class="frequent-label">Más usados</span><span class="frequent-names"><button v-for="suggestion in frequentNames" :key="suggestion.name" type="button" :class="{ active: normalizeName(draft.name) === normalizeName(suggestion.name) }" @click="selectFrequentName(suggestion)">{{ suggestion.name }}<small v-if="suggestion.count">{{ suggestion.count }}</small></button></span></label>
            <label><span>Categoría</span><Multiselect v-model="draft.category" class="smart-select" :options="categoryOptions" searchable create-option allow-absent :can-clear="false" :aria="{ 'aria-label': 'Categoría' }" placeholder="Busca o crea una categoría" no-options-text="Escribe una categoría nueva" no-results-text="Pulsa Intro para crearla" /></label>
            <label><span>Importe</span><div class="money-input"><input v-model="draft.amount" type="number" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div></label>
            <label><span>Establecimiento</span><Multiselect v-model="draft.place" class="smart-select" :options="establishmentOptions" searchable create-option allow-absent :can-clear="Boolean(draft.place)" :aria="{ 'aria-label': 'Establecimiento' }" placeholder="Busca o escribe un establecimiento" no-options-text="Escribe un establecimiento nuevo" no-results-text="Pulsa Intro para añadirlo" /><template v-if="frequentEstablishments.length"><span class="frequent-label">Más usados</span><span class="frequent-names"><button v-for="item in frequentEstablishments" :key="item.value" type="button" :class="{ active: normalizeName(draft.place || '') === normalizeName(item.value) }" @click="draft.place = item.value">{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span></template></label>
            <label><span>Ciudad</span><Multiselect v-model="draft.city" class="smart-select" :options="cityOptions" searchable create-option allow-absent :can-clear="Boolean(draft.city)" :aria="{ 'aria-label': 'Ciudad' }" placeholder="Busca o escribe una ciudad" no-options-text="Escribe una ciudad nueva" no-results-text="Pulsa Intro para añadirla" /><template v-if="frequentCities.length"><span class="frequent-label">Más usadas</span><span class="frequent-names"><button v-for="item in frequentCities" :key="item.value" type="button" :class="{ active: normalizeName(draft.city || '') === normalizeName(item.value) }" @click="draft.city = item.value">{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span></template><span class="location-status"><small>{{ locationStatus }}</small><button type="button" :disabled="detectingCity" @click="detectCurrentCity"><PhCrosshair :size="14" /> {{ detectingCity ? 'Detectando…' : 'Usar mi ubicación' }}</button></span></label>
            <label class="full"><span>Fecha y hora</span><input v-model="draft.occurred_at" type="datetime-local" required /></label>
          </div>
          <fieldset><legend>{{ draft.transaction_type === 'income' ? '¿Quién lo ha recibido?' : '¿Quién lo ha pagado?' }}</legend><div class="choice-grid"><label :class="{ selected: draft.paid_by_type === 'person' }"><input v-model="draft.paid_by_type" type="radio" value="person" /><PhWallet :size="22" /><span><strong>Una persona</strong><small>{{ draft.transaction_type === 'income' ? 'Selecciona quién recibió el dinero' : 'Selecciona quién adelantó el dinero' }}</small></span></label><label :class="{ selected: draft.paid_by_type === 'all' }"><input v-model="draft.paid_by_type" type="radio" value="all" /><PhUsers :size="22" /><span><strong>Entre todos</strong><small>Corresponde al grupo en conjunto</small></span></label></div><select v-if="draft.paid_by_type === 'person'" v-model="draft.paid_by_uid" class="member-select"><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option></select></fieldset>
          <fieldset><legend>{{ draft.transaction_type === 'income' ? '¿A quién corresponde?' : '¿A quién se aplica?' }}</legend><div class="choice-grid"><label :class="{ selected: draft.applies_to_all }"><input v-model="draft.applies_to_all" type="radio" :value="true" /><PhUsers :size="22" /><span><strong>A todo el grupo</strong><small>Se reparte por igual</small></span></label><label :class="{ selected: !draft.applies_to_all }"><input v-model="draft.applies_to_all" type="radio" :value="false" /><PhCheck :size="22" /><span><strong>Solo a algunas</strong><small>Elige las personas</small></span></label></div><div v-if="!draft.applies_to_all" class="check-members"><label v-for="member in memberOptions" :key="member.uid"><input v-model="draft.participant_uids" type="checkbox" :value="member.uid" /><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span>{{ member.name || member.email }}</label></div></fieldset>
          <footer><button type="button" class="ghost" @click="modalOpen = false">Cancelar</button><button class="primary" :disabled="saving"><PhCheck :size="18" weight="bold" /> {{ saving ? 'Guardando…' : `Guardar ${draft.transaction_type === 'income' ? 'ingreso' : 'gasto'}` }}</button></footer>
          </template>
        </form>
      </section>
    </div>

    <div v-if="deleteTarget" class="modal-backdrop" @mousedown.self="deleteTarget = null"><section class="confirm-dialog"><span class="danger-mark"><PhTrash :size="25" /></span><h2>¿Eliminar este movimiento?</h2><p>“{{ deleteTarget.name }}” desaparecerá del grupo y de las estadísticas.</p><div><button class="ghost" @click="deleteTarget = null">Cancelar</button><button class="danger-button" :disabled="saving" @click="removeExpense">Sí, eliminar</button></div></section></div>
  </div>
</template>
