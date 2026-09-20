<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PhArrowRight,
  PhArrowLeft,
  PhChartDonut,
  PhCaretDown,
  PhCheck,
  PhClockCounterClockwise,
  PhCoins,
  PhCrosshair,
  PhArrowDown,
  PhArrowUp,
  PhBell,
  PhFunnel,
  PhGear,
  PhGoogleLogo,
  PhHouse,
  PhList,
  PhLightning,
  PhMagnifyingGlass,
  PhMapPin,
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
const routeLoading = ref(false)
const signingIn = ref(false)
const saving = ref(false)
const user = ref(null)
const token = ref('')
const error = ref('')
const notice = ref('')
const expenses = ref([])
const settlements = ref([])
const notifications = ref([])
const unreadNotificationCount = ref(0)
const notificationsOpen = ref(false)
const markingNotificationIds = ref([])
const markingAllNotifications = ref(false)
const group = ref(null)
const stats = ref({ total: 0, count: 0, average: 0, by_category: [], by_member: [], monthly: [] })
const modalOpen = ref(false)
const quickExpenseMode = ref(false)
const quickAmount = ref('')
const quickAmountInput = ref(null)
const tagInput = ref('')
const deleteTarget = ref(null)
const settlementTarget = ref(null)
const recurringDeleteTarget = ref(null)
const tagDeleteTarget = ref(null)
const expenseHistoryForId = ref(0)
const expenseHistoryEntries = ref([])
const expenseHistoryLoading = ref(false)
const settlementDraft = reactive({ payer_uid: '', payee_uid: '', amount: '', payment_method: 'card' })
const budgetDraft = reactive({ category: 'food', monthly_limit: '' })
const tagDraft = reactive({ id: '', name: '' })
const telegramNotificationTypes = ref([])
const appNotificationTypes = ref([])
const telegramConfigured = ref(false)
const telegramConnected = ref(false)
const telegramUsername = ref('')
const telegramLinkUrl = ref('')
const telegramSaving = ref(false)
const notificationSaving = ref(false)
const filters = reactive({ search: '', category: '', from: '', to: '' })
const filtersOpen = ref(false)
const visibleExpenseCount = ref(20)
const loadMoreSentinel = ref(null)
const inviteEmail = ref('')
const inviteSending = ref(false)
const joinCode = ref('')
const defaultCityDraft = ref('')
const defaultPaymentMethodDraft = ref('card')
const detectingCity = ref(false)
const locationStatus = ref('')
const detectedCity = ref('')
const catalogDraft = reactive({ establishments: [], categories: [] })
const iconPickerOpen = ref(false)
const iconPickerTarget = ref(null)
const iconPickerSearch = ref('')
const iconPickerCollections = ref([])
const iconPickerCollectionCategory = ref('General')
const iconPickerCollection = ref('mdi')
const iconPickerData = ref(null)
const iconPickerResults = ref([])
const iconPickerSearchHasMore = ref(false)
const iconPickerLoading = ref(false)
const iconPickerError = ref('')
const iconPickerLimit = ref(180)
let iconPickerSearchTimer = null
let iconPickerSearchRequestId = 0
let iconPickerCollectionRequestId = 0
const iconPickerCollectionCache = new Map()
let expenseObserver = null
let routeDataRequestId = 0
let notificationsPollTimer = null
let expenseHistoryRequestId = 0

const builtInCategories = [
  { id: 'food', label: 'Alimentación', icon: 'mdi:food-apple-outline', color: '#d36b47' },
  { id: 'home', label: 'Hogar', icon: 'mdi:home-outline', color: '#527a68' },
  { id: 'transport', label: 'Transporte', icon: 'mdi:car-outline', color: '#4b7193' },
  { id: 'leisure', label: 'Ocio', icon: 'mdi:ticket-outline', color: '#8d6597' },
  { id: 'health', label: 'Salud', icon: 'mdi:medical-bag', color: '#c25d69' },
  { id: 'shopping', label: 'Compras', icon: 'mdi:shopping-outline', color: '#bd7d3b' },
  { id: 'bills', label: 'Facturas', icon: 'mdi:lightning-bolt-outline', color: '#86743e' },
  { id: 'travel', label: 'Viajes', icon: 'mdi:airplane', color: '#3f8890' },
  { id: 'other', label: 'Otros', icon: 'mdi:shape-outline', color: '#757a78' },
]

const notificationOptions = [
  { value: 'expense_created', label: 'Nuevos gastos e ingresos', description: 'Cuando alguien añade un movimiento al grupo.' },
  { value: 'expense_updated', label: 'Movimientos editados', description: 'Cuando se modifica un gasto o ingreso.' },
  { value: 'expense_deleted', label: 'Movimientos eliminados', description: 'Cuando alguien elimina un movimiento.' },
  { value: 'settlement', label: 'Pagos entre miembros', description: 'Cuando se registra un pago para saldar una deuda.' },
  { value: 'member_joined', label: 'Nuevos miembros', description: 'Cuando una persona se une a tu grupo.' },
]

const paymentMethods = [
  { value: 'card', label: 'Tarjeta' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia bancaria' },
  { value: 'bizum', label: 'Bizum' },
  { value: 'other', label: 'Otro' },
]
const paymentMethodLabel = (value) => paymentMethods.find((method) => method.value === value)?.label || 'Sin especificar'

const customCategoryColor = (label) => {
  const palette = ['#5f7296', '#987052', '#6f7e4c', '#8b6387', '#477e78', '#9b625a']
  const hash = [...label].reduce((total, character) => total + character.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

const categories = computed(() => [
  ...builtInCategories.map((item) => ({ ...item, icon: group.value?.category_icons?.[item.id] || item.icon })),
  ...(group.value?.custom_categories || []).map((label) => ({ id: label, label, icon: group.value?.category_icons?.[label] || 'mdi:tag-outline', color: customCategoryColor(label) })),
])

const emptyDraft = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return { id: '', transaction_type: '', name: '', details: '', category: 'food', place: '', city: '', occurred_at: local, amount: '', payment_method: group.value?.default_payment_method || 'card', paid_by_type: 'person', paid_by_uid: user.value?.uid || '', applies_to_all: true, participant_uids: [], participant_shares: {}, share_mode: 'equal', tags: [], recurrence: 'none', is_quick: false }
}
const draft = reactive(emptyDraft())

const memberOptions = computed(() => group.value?.members || [])
const currentMember = computed(() => memberOptions.value.find((member) => member.uid === user.value?.uid))
const recurringDraft = reactive({ id: '', transaction_type: 'expense', name: '', amount: '', category: 'bills', frequency: 'monthly', next_at: emptyDraft().occurred_at, payment_method: group.value?.default_payment_method || 'card', paid_by_type: 'person', paid_by_uid: user.value?.uid || '', applies_to_all: true, participant_uids: [], participant_shares: {}, share_mode: 'equal', tags: [] })
const maxCategoryTotal = computed(() => Math.max(1, ...stats.value.by_category.map((item) => Number(item.total))))
const budgetSummary = computed(() => (group.value?.budgets || []).reduce((summary, budget) => {
  summary.limit += Number(budget.monthly_limit) || 0
  summary.spent += Number(budget.current_total) || 0
  return summary
}, { limit: 0, spent: 0 }))
const categoryOptions = computed(() => categories.value.map((item) => ({ value: item.id, label: item.label })))
const tagOptions = computed(() => (group.value?.tags || []).map((item) => item.name))
const splitMembers = computed(() => draft.applies_to_all ? memberOptions.value : memberOptions.value.filter((member) => draft.participant_uids.includes(member.uid)))
const recurringSplitMembers = computed(() => recurringDraft.applies_to_all ? memberOptions.value : memberOptions.value.filter((member) => recurringDraft.participant_uids.includes(member.uid)))
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
  return [...new Set([
    ...(group.value?.establishments || []).map((item) => item.name),
    ...ordered.map((item) => item.place),
  ].filter(Boolean))]
})
const filteredExpenses = computed(() => expenses.value.filter((expense) => {
  const term = filters.search.trim().toLowerCase()
  return (!term || `${expense.name} ${expense.details || ''} ${expense.place} ${expense.city || ''} ${(expense.tags || []).join(' ')}`.toLowerCase().includes(term)) &&
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
const catalogEstablishments = computed(() => group.value?.establishments || [])
const iconPickerCollectionCategories = computed(() => [...new Set(iconPickerCollections.value.map((item) => item.category || 'General'))].sort((a, b) => a.localeCompare(b, 'es')))
const iconPickerVisibleCollections = computed(() => iconPickerCollections.value.filter((item) => (item.category || 'General') === iconPickerCollectionCategory.value))
const iconPickerGroups = computed(() => {
  if (!iconPickerData.value) return []
  const aliases = new Set(Object.keys(iconPickerData.value.aliases || {}))
  const hidden = new Set(iconPickerData.value.hidden || [])
  const seen = new Set()
  const groups = Object.entries(iconPickerData.value.categories || {}).map(([label, names]) => ({ label, names }))
  if (iconPickerData.value.uncategorized?.length) groups.push({ label: 'Otros', names: iconPickerData.value.uncategorized })
  let remaining = iconPickerLimit.value
  return groups.map((groupItem) => {
    const names = groupItem.names.filter((name) => !aliases.has(name) && !hidden.has(name) && !seen.has(name) && seen.add(name))
    const visible = names.slice(0, remaining)
    remaining -= visible.length
    return { label: groupItem.label, names: visible, remaining: names.length - visible.length }
  }).filter((item) => item.names.length)
})
const iconPickerSearchCollections = computed(() => Object.fromEntries(iconPickerCollections.value.map((item) => [item.prefix, item.name])))
const visibleExpenses = computed(() => filteredExpenses.value.slice(0, visibleExpenseCount.value))
const hasMoreExpenses = computed(() => visibleExpenseCount.value < filteredExpenses.value.length)
const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length)
const pairBalances = computed(() => {
  const balances = new Map()
  const keyFor = (debtor, creditor) => `${debtor}::${creditor}`
  expenses.value.forEach((expense) => {
    if ((expense.transaction_type || 'expense') !== 'expense' || expense.paid_by_type !== 'person' || !expense.paid_by_uid) return
    ;(expense.participants || []).forEach((participant) => {
      if (participant.uid === expense.paid_by_uid) return
      const key = keyFor(participant.uid, expense.paid_by_uid)
      balances.set(key, (balances.get(key) || 0) + Number(participant.share_amount || 0))
    })
  })
  settlements.value.forEach((settlement) => {
    const key = keyFor(settlement.payer_uid, settlement.payee_uid)
    balances.set(key, (balances.get(key) || 0) - Number(settlement.amount || 0))
  })
  const entries = [...balances.entries()].filter(([, amount]) => Math.abs(amount) > 0.004)
  const handled = new Set()
  entries.forEach(([key, amount]) => {
    if (handled.has(key)) return
    const [debtor, creditor] = key.split('::')
    const reverseKey = keyFor(creditor, debtor)
    const reverseAmount = balances.get(reverseKey) || 0
    const net = amount - reverseAmount
    balances.set(key, Math.max(0, net))
    balances.set(reverseKey, Math.max(0, -net))
    handled.add(key)
    handled.add(reverseKey)
  })
  return [...balances.entries()].filter(([, amount]) => amount > 0.004).map(([key, amount]) => {
    const [debtorUid, creditorUid] = key.split('::')
    return { id: key, debtorUid, creditorUid, amount: Math.round(amount * 100) / 100 }
  })
})
const balanceSummary = computed(() => pairBalances.value.reduce((balance, pair) => {
  if (pair.creditorUid === user.value?.uid) balance.owedToYou += pair.amount
  if (pair.debtorUid === user.value?.uid) balance.youOwe += pair.amount
  return balance
}, { owedToYou: 0, youOwe: 0 }))
const netBalance = computed(() => Math.round((balanceSummary.value.owedToYou - balanceSummary.value.youOwe) * 100) / 100)
const netBalanceTitle = computed(() => netBalance.value > 0
  ? 'Te deben en total'
  : netBalance.value < 0
    ? 'Debes en total'
    : 'Balance equilibrado')
const balanceBreakdown = computed(() => {
  const currentUid = user.value?.uid
  const breakdown = { owedToYou: [], youOwe: [] }
  if (!currentUid) return breakdown

  pairBalances.value.forEach((pair) => {
    if (pair.creditorUid === currentUid) breakdown.owedToYou.push({ id: pair.id, counterpartyUid: pair.debtorUid, amount: pair.amount, payerUid: pair.debtorUid, payeeUid: pair.creditorUid })
    if (pair.debtorUid === currentUid) breakdown.youOwe.push({ id: pair.id, counterpartyUid: pair.creditorUid, amount: pair.amount, payerUid: pair.debtorUid, payeeUid: pair.creditorUid })
  })
  return breakdown
})

const navigationItems = [
  { route: 'expenses', label: 'Gastos', path: '/', icon: PhReceipt },
  { route: 'stats', label: 'Estadísticas', path: '/estadisticas', icon: PhChartDonut },
  { route: 'budgets', label: 'Presupuestos', path: '/presupuestos', icon: PhWallet },
  { route: 'recurring', label: 'Recurrentes', path: '/recurrentes', icon: PhLightning },
  { route: 'tags', label: 'Etiquetas', path: '/etiquetas', icon: PhTag },
  { route: 'establishments', label: 'Establecimientos', path: '/establecimientos', icon: PhMapPin },
  { route: 'categories', label: 'Categorías', path: '/categorias', icon: PhTag },
  { route: 'group', label: 'Grupo', path: '/grupo', icon: PhUsers },
  { route: 'settings', label: 'Ajustes', path: '/ajustes', icon: PhGear },
]

const category = (id) => categories.value.find((item) => item.id === id) || { id, label: id || 'Otros', icon: group.value?.category_icons?.[id] || 'mdi:tag-outline', color: '#757a78' }
const memberLabel = (uid) => memberOptions.value.find((item) => item.uid === uid)?.name || memberOptions.value.find((item) => item.uid === uid)?.email || 'Miembro'
const establishmentIcon = (place) => catalogEstablishments.value.find((item) => normalizeName(item.name) === normalizeName(place || ''))?.icon || ''
const money = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0))
const dateLabel = (value) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value.replace(' ', 'T')))
const notificationDateLabel = (value) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value.replace(' ', 'T')))
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
      : 'No se pudo detectar; puedes dejarla en blanco o escribirla.'
  } finally {
    detectingCity.value = false
  }
}

watch(() => draft.transaction_type, (transactionType) => {
  if (transactionType && !draft.id && !quickExpenseMode.value) detectCurrentCity()
})

async function freshToken(force = false) {
  if (!user.value) throw new Error('Debes iniciar sesión.')
  token.value = await user.value.getIdToken(force)
  return token.value
}

async function loadNotifications() {
  if (!user.value) return
  const requestedUid = user.value.uid
  try {
    const data = await getJson('gastoteca/notifications', await freshToken())
    if (user.value?.uid !== requestedUid) return
    notifications.value = data.notifications || []
    unreadNotificationCount.value = Number(data.unread_count) || 0
  } catch {
    // Notification polling should never block the rest of the app.
  }
}

async function markNotificationRead(notification) {
  if (!notification || notification.read_at || markingNotificationIds.value.includes(notification.id)) return
  markingNotificationIds.value.push(notification.id)
  try {
    const data = await postJson('gastoteca/mark_notification_read', await freshToken(true), { id: notification.id })
    notification.read_at = new Date().toISOString()
    unreadNotificationCount.value = Number(data.unread_count) || 0
  } catch (reason) {
    error.value = reason.message
  } finally {
    markingNotificationIds.value = markingNotificationIds.value.filter((id) => id !== notification.id)
  }
}

async function markAllNotificationsRead() {
  if (!unreadNotificationCount.value || markingAllNotifications.value) return
  markingAllNotifications.value = true
  try {
    await postJson('gastoteca/mark_all_notifications_read', await freshToken(true), {})
    const readAt = new Date().toISOString()
    notifications.value.forEach((notification) => { if (!notification.read_at) notification.read_at = readAt })
    unreadNotificationCount.value = 0
  } catch (reason) {
    error.value = reason.message
  } finally {
    markingAllNotifications.value = false
  }
}

async function openNotification(notification) {
  if (!notification.read_at) await markNotificationRead(notification)
  notificationsOpen.value = false
  menuOpen.value = false
  const target = notification.target || '/'
  if (route.fullPath !== target) await router.push(target)
}

async function loadRouteData(routeName) {
  if (!user.value) return

  const requestId = ++routeDataRequestId
  routeLoading.value = true
  error.value = ''

  try {
    const authToken = await freshToken()
    const requests = [getJson('gastoteca/group', authToken)]

    if (routeName === 'expenses' || routeName === 'balance') {
      requests.push(getJson('gastoteca/expenses', authToken))
    }
    if (routeName === 'stats') {
      requests.push(getJson('gastoteca/statistics', authToken))
    }
    const featureRequest = routeName === 'settings' ? Promise.all([
        getJson('gastoteca/telegram_settings', authToken),
        getJson('menudiario/telegram_status', authToken).catch(() => null),
        getJson('gastoteca/notification_settings', authToken),
      ]) : Promise.resolve(null)

    const [groupData, pageData] = await Promise.all(requests)
    const featureData = await featureRequest
    if (requestId !== routeDataRequestId || route.name !== routeName || !user.value) return

    group.value = groupData.group
    if (routeName === 'expenses' || routeName === 'balance') {
      expenses.value = pageData.expenses || []
      settlements.value = pageData.settlements || []
    }
    if (routeName === 'stats') stats.value = pageData.stats || { total: 0, count: 0, average: 0, by_category: [], by_member: [], monthly: [] }
    if (routeName === 'settings' && featureData) {
      telegramNotificationTypes.value = featureData[0]?.notification_types || []
      telegramConfigured.value = Boolean(featureData[0]?.telegram_configured)
      telegramConnected.value = Boolean(featureData[1]?.telegram?.connected)
      telegramUsername.value = featureData[1]?.telegram?.username || featureData[1]?.telegram?.first_name || ''
      appNotificationTypes.value = featureData[2]?.notification_types || notificationOptions.map((item) => item.value)
    }
    await loadNotifications()
  } catch (reason) {
    if (requestId === routeDataRequestId && route.name === routeName) error.value = reason.message
  } finally {
    if (requestId === routeDataRequestId) routeLoading.value = false
  }
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
  error.value = ''
  expenseHistoryForId.value = 0
  expenseHistoryEntries.value = []
  quickExpenseMode.value = false
  quickAmount.value = ''
  tagInput.value = ''
  Object.assign(draft, emptyDraft(), expense ? {
    ...expense,
    transaction_type: expense.transaction_type || 'expense',
    amount: Number(expense.amount).toFixed(2),
    occurred_at: expense.occurred_at.replace(' ', 'T').slice(0, 16),
    participant_uids: [...(expense.participant_uids || [])],
    participant_shares: Object.fromEntries((expense.participants || []).map((participant) => [participant.uid, Number(participant.share_amount).toFixed(2)])),
    share_mode: 'amount',
    tags: [...(expense.tags || [])],
    recurrence: 'none',
  } : {})
  if (!draft.paid_by_uid) draft.paid_by_uid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
  if (!expense) draft.city = group.value?.default_city || ''
  modalOpen.value = true
  locationStatus.value = ''
}

function closeExpenseModal() {
  modalOpen.value = false
  quickExpenseMode.value = false
  quickAmount.value = ''
  expenseHistoryForId.value = 0
  expenseHistoryEntries.value = []
}

async function loadExpenseHistory(expenseId) {
  const requestId = ++expenseHistoryRequestId
  expenseHistoryForId.value = Number(expenseId)
  expenseHistoryEntries.value = []
  expenseHistoryLoading.value = true
  try {
    const data = await postJson('gastoteca/expense_history', await freshToken(true), { id: expenseId })
    if (requestId === expenseHistoryRequestId) expenseHistoryEntries.value = data.history || []
  } catch (reason) {
    error.value = reason.message
    expenseHistoryForId.value = 0
  } finally {
    if (requestId === expenseHistoryRequestId) expenseHistoryLoading.value = false
  }
}

const historyFieldLabels = {
  transaction_type: 'Tipo',
  name: 'Nombre',
  details: 'Detalles',
  category: 'Categoría',
  place: 'Establecimiento',
  city: 'Ciudad',
  occurred_at: 'Fecha del movimiento',
  amount: 'Importe',
  payment_method: 'Método de pago',
  paid_by_type: 'Quién pagó/recibió',
  paid_by_uid: 'Pagador o receptor',
  applies_to_all: 'Se aplica a todo el grupo',
  participant_uids: 'Participantes',
  participants: 'Reparto',
  tags: 'Etiquetas',
  is_quick: 'Gasto rápido',
}

function historyChangeEntries(entry) {
  return Object.entries(entry.changes || {}).map(([field, values]) => ({ field, label: historyFieldLabels[field] || field, ...values }))
}

function historyValue(field, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'amount') return money(value)
  if (field === 'transaction_type') return value === 'income' ? 'Ingreso' : 'Gasto'
  if (field === 'category') return category(value).label
  if (field === 'occurred_at') return dateLabel(value)
  if (field === 'payment_method') return paymentMethodLabel(value)
  if (field === 'paid_by_type') return value === 'all' ? 'Todo el grupo' : 'Una persona'
  if (field === 'paid_by_uid') return memberLabel(value)
  if (field === 'applies_to_all' || field === 'is_quick') return value ? 'Sí' : 'No'
  if (field === 'participant_uids') return value.length ? value.map(memberLabel).join(', ') : 'Nadie'
  if (field === 'participants') return value.length ? value.map((item) => `${memberLabel(item.uid)}: ${money(item.share_amount)}`).join(' · ') : 'Sin reparto'
  if (field === 'tags') return value.length ? value.join(', ') : 'Sin etiquetas'
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function startQuickExpense() {
  quickExpenseMode.value = true
  quickAmount.value = ''
  nextTick(() => quickAmountInput.value?.focus())
}

async function saveQuickExpense() {
  error.value = ''
  const amount = Number(quickAmount.value)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999) {
    error.value = 'Añade un importe mayor que cero.'
    return
  }

  saving.value = true
  try {
    const quickDraft = {
      ...emptyDraft(),
      transaction_type: 'expense',
      name: 'Gasto rápido',
      category: 'other',
      city: group.value?.default_city || 'Sin ciudad',
      amount: amount.toFixed(2),
      paid_by_type: 'person',
      paid_by_uid: currentMember.value?.uid || memberOptions.value[0]?.uid || '',
      applies_to_all: true,
      participant_uids: [],
      is_quick: true,
    }
    const data = await postJson('gastoteca/save_expense', await freshToken(true), quickDraft)
    expenses.value = data.expenses
    stats.value = data.stats
    settlements.value = data.settlements || settlements.value
    if (data.group) group.value = data.group
    closeExpenseModal()
    flash('Gasto rápido guardado. Puedes completarlo desde la lista.')
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
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

function setShareMode(mode) {
  const previousMode = draft.share_mode
  const members = splitMembers.value
  const amount = Number(draft.amount) || 0
  const previousValues = Object.fromEntries(members.map((member, index) => [member.uid, Number(shareValue(member, index)) || 0]))
  draft.share_mode = mode
  if (mode === 'equal') return
  let used = 0
  members.forEach((member, index) => {
    const last = index === members.length - 1
    if (mode === 'percent') {
      const percent = previousMode === 'percent'
        ? previousValues[member.uid]
        : last ? 100 - used : amount > 0 ? previousValues[member.uid] / amount * 100 : 100 / Math.max(1, members.length)
      draft.participant_shares[member.uid] = Math.max(0, percent).toFixed(2)
      used += Number(draft.participant_shares[member.uid])
    } else {
      const share = previousMode === 'amount'
        ? previousValues[member.uid]
        : last ? amount - used : previousMode === 'percent' ? amount * previousValues[member.uid] / 100 : amount / Math.max(1, members.length)
      draft.participant_shares[member.uid] = Math.max(0, share).toFixed(2)
      used += Number(draft.participant_shares[member.uid])
    }
  })
}

function shareValue(member, index) {
  const value = draft.participant_shares[member.uid]
  if (value !== undefined) return value
  const count = Math.max(1, splitMembers.value.length)
  if (draft.share_mode === 'percent') return (100 / count).toFixed(2)
  const total = Number(draft.amount) || 0
  return (index === count - 1 ? total - (total / count) * index : total / count).toFixed(2)
}

function addDraftTag(value = tagInput.value) {
  const name = String(value || '').trim().slice(0, 40)
  if (!name || draft.tags.some((tag) => normalizeName(tag) === normalizeName(name)) || draft.tags.length >= 10) return
  draft.tags.push(name)
  tagInput.value = ''
}

function openSettlement(entry, isOwedToYou) {
  settlementTarget.value = entry
  settlementDraft.payer_uid = isOwedToYou ? entry.counterpartyUid : user.value?.uid || ''
  settlementDraft.payee_uid = isOwedToYou ? user.value?.uid || '' : entry.counterpartyUid
  settlementDraft.amount = Number(entry.amount).toFixed(2)
  settlementDraft.payment_method = group.value?.default_payment_method || 'card'
}

async function saveSettlement() {
  error.value = ''
  saving.value = true
  try {
    const data = await postJson('gastoteca/save_settlement', await freshToken(true), { ...settlementDraft })
    settlements.value = data.settlements || []
    settlementTarget.value = null
    flash('Pago registrado; el balance pendiente se ha actualizado.')
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

async function saveBudget() {
  error.value = ''
  saving.value = true
  try {
    const data = await postJson('gastoteca/save_budget', await freshToken(true), { ...budgetDraft })
    group.value = data.group
    budgetDraft.monthly_limit = ''
    flash('Presupuesto mensual guardado.')
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

async function deleteBudget(categoryKey) {
  try {
    const data = await postJson('gastoteca/delete_budget', await freshToken(true), { category: categoryKey })
    group.value = data.group
    flash('Presupuesto eliminado.')
  } catch (reason) { error.value = reason.message }
}

async function toggleRecurring(rule) {
  try {
    const data = await postJson('gastoteca/toggle_recurring', await freshToken(true), { id: rule.id, active: !rule.active })
    group.value = data.group
    flash(rule.active ? 'Repetición pausada.' : 'Repetición reactivada.')
  } catch (reason) { error.value = reason.message }
}

function startRecurringRule(rule = null) {
  const payload = rule?.payload || {}
  const validParticipants = (payload.participant_uids || []).filter((uid) => memberOptions.value.some((member) => member.uid === uid))
  Object.assign(recurringDraft, {
    id: rule?.id || '',
    transaction_type: payload.transaction_type || 'expense',
    name: payload.name || '',
    amount: payload.amount ? Number(payload.amount).toFixed(2) : '',
    category: payload.category || 'bills',
    frequency: rule?.frequency || 'monthly',
    next_at: (rule?.next_at || emptyDraft().occurred_at).replace(' ', 'T').slice(0, 16),
    payment_method: payload.payment_method || group.value?.default_payment_method || 'card',
    paid_by_type: payload.paid_by_type || 'person',
    paid_by_uid: memberOptions.value.some((member) => member.uid === payload.paid_by_uid) ? payload.paid_by_uid : (currentMember.value?.uid || memberOptions.value[0]?.uid || ''),
    applies_to_all: payload.applies_to_all ?? true,
    participant_uids: validParticipants,
    participant_shares: Object.fromEntries(Object.entries(payload.participant_shares || {}).map(([uid, amount]) => [uid, Number(amount).toFixed(2)])),
    share_mode: rule && Object.keys(payload.participant_shares || {}).length ? 'amount' : 'equal',
    tags: [...(payload.tags || [])],
  })
  if (!recurringDraft.applies_to_all && !recurringDraft.participant_uids.length) recurringDraft.applies_to_all = true
  error.value = ''
}

function recurringShareValue(member, index) {
  const value = recurringDraft.participant_shares[member.uid]
  if (value !== undefined) return value
  const count = Math.max(1, recurringSplitMembers.value.length)
  const amount = Number(recurringDraft.amount) || 0
  return (index === count - 1 ? amount - (amount / count) * index : amount / count).toFixed(2)
}

function resetRecurringShares() {
  const members = recurringSplitMembers.value
  const amount = Number(recurringDraft.amount) || 0
  let used = 0
  recurringDraft.participant_shares = Object.fromEntries(members.map((member, index) => {
    const share = index === members.length - 1 ? amount - used : Math.round((amount / Math.max(1, members.length)) * 100) / 100
    used += share
    return [member.uid, Math.max(0, share).toFixed(2)]
  }))
}

function setRecurringShareMode(mode) {
  recurringDraft.share_mode = mode
  if (mode === 'amount') resetRecurringShares()
}

async function saveRecurring() {
  error.value = ''
  if (!recurringDraft.name.trim() || Number(recurringDraft.amount) <= 0) {
    error.value = 'Añade un nombre y un importe mayor que cero.'
    return
  }
  if (!recurringDraft.applies_to_all && !recurringDraft.participant_uids.length) {
    error.value = 'Selecciona al menos una persona a la que se aplica el movimiento.'
    return
  }
  const wasEditing = Boolean(recurringDraft.id)
  saving.value = true
  try {
    const data = await postJson('gastoteca/save_recurring', await freshToken(true), {
      ...recurringDraft,
      amount: Number(recurringDraft.amount),
      participant_shares: Object.fromEntries(recurringSplitMembers.value.map((member, index) => [member.uid, Number(recurringShareValue(member, index)) || 0])),
    })
    group.value = data.group
    startRecurringRule()
    flash(wasEditing ? 'Programación actualizada.' : 'Movimiento recurrente guardado.')
  } catch (reason) { error.value = reason.message }
  finally { saving.value = false }
}

async function removeRecurring() {
  if (!recurringDeleteTarget.value) return
  saving.value = true
  try {
    const data = await postJson('gastoteca/delete_recurring', await freshToken(true), { id: recurringDeleteTarget.value.id })
    group.value = data.group
    recurringDeleteTarget.value = null
    if (recurringDraft.id && !group.value.recurring.some((rule) => rule.id === recurringDraft.id)) startRecurringRule()
    flash('Programación eliminada.')
  } catch (reason) { error.value = reason.message }
  finally { saving.value = false }
}

async function saveTag() {
  error.value = ''
  if (!tagDraft.name.trim()) {
    error.value = 'Escribe un nombre para la etiqueta.'
    return
  }
  saving.value = true
  try {
    const data = await postJson('gastoteca/save_tag', await freshToken(true), { ...tagDraft })
    group.value = data.group
    const wasEditing = Boolean(tagDraft.id)
    Object.assign(tagDraft, { id: '', name: '' })
    flash(wasEditing ? 'Etiqueta actualizada.' : 'Etiqueta creada.')
  } catch (reason) { error.value = reason.message }
  finally { saving.value = false }
}

async function removeTag() {
  if (!tagDeleteTarget.value) return
  saving.value = true
  try {
    const data = await postJson('gastoteca/delete_tag', await freshToken(true), { id: tagDeleteTarget.value.id })
    group.value = data.group
    if (tagDraft.id === tagDeleteTarget.value.id) Object.assign(tagDraft, { id: '', name: '' })
    tagDeleteTarget.value = null
    flash('Etiqueta eliminada de los movimientos.')
  } catch (reason) { error.value = reason.message }
  finally { saving.value = false }
}

async function saveTelegramSettings() {
  telegramSaving.value = true
  error.value = ''
  try {
    const data = await postJson('gastoteca/save_telegram_settings', await freshToken(true), { notification_types: telegramNotificationTypes.value })
    telegramNotificationTypes.value = data.notification_types || []
    flash('Preferencias de Telegram guardadas.')
  } catch (reason) { error.value = reason.message }
  finally { telegramSaving.value = false }
}

async function saveNotificationSettings() {
  notificationSaving.value = true
  error.value = ''
  try {
    const data = await postJson('gastoteca/save_notification_settings', await freshToken(true), { notification_types: appNotificationTypes.value })
    appNotificationTypes.value = data.notification_types || []
    flash('Preferencias de notificaciones guardadas.')
  } catch (reason) { error.value = reason.message }
  finally { notificationSaving.value = false }
}

async function beginTelegramLink() {
  error.value = ''
  try {
    const data = await postJson('menudiario/telegram_link', await freshToken(true), {})
    telegramLinkUrl.value = data.url || ''
    telegramConfigured.value = true
  } catch (reason) { error.value = reason.message }
}

async function refreshTelegramStatus() {
  try {
    const data = await getJson('menudiario/telegram_status', await freshToken(true))
    telegramConnected.value = Boolean(data.telegram?.connected)
    telegramUsername.value = data.telegram?.username || data.telegram?.first_name || ''
  } catch (reason) { error.value = reason.message }
}

async function saveExpense() {
  error.value = ''
  if (!draft.transaction_type) {
    error.value = 'Selecciona si es un gasto o un ingreso.'
    return
  }
  if (!draft.name.trim() || !draft.amount || Number(draft.amount) <= 0) {
    error.value = 'Añade un nombre y un importe mayor que cero.'
    return
  }
  if (!draft.applies_to_all && !draft.participant_uids.length) {
    error.value = 'Selecciona al menos una persona a la que se aplica el movimiento.'
    return
  }
  if (draft.share_mode !== 'equal' && !splitMembers.value.length) {
    error.value = 'Selecciona participantes antes de personalizar el reparto.'
    return
  }
  saving.value = true
  try {
    const data = await postJson('gastoteca/save_expense', await freshToken(true), {
      ...draft,
      city: draft.city || group.value?.default_city || 'Sin ciudad',
      details: draft.details || '',
      occurred_at: draft.occurred_at || emptyDraft().occurred_at,
      participant_shares: Object.fromEntries(splitMembers.value.map((member, index) => [member.uid, Number(shareValue(member, index)) || 0])),
      is_quick: false,
    })
    expenses.value = data.expenses
    stats.value = data.stats
    settlements.value = data.settlements || settlements.value
    if (data.group) group.value = data.group
    closeExpenseModal()
    const movement = draft.transaction_type === 'income' ? 'Ingreso' : 'Gasto'
    flash(draft.id ? `${movement} actualizado.` : `${movement} añadido.`)
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

async function removeExpense() {
  const target = deleteTarget.value
  if (!target) return
  const movement = target.transaction_type === 'income' ? 'Ingreso' : 'Gasto'
  saving.value = true
  try {
    const data = await postJson('gastoteca/delete_expense', await freshToken(true), { id: target.id })
    expenses.value = data.expenses
    stats.value = data.stats
    settlements.value = data.settlements || settlements.value
    deleteTarget.value = null
    closeExpenseModal()
    flash(`${movement} eliminado.`)
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

async function invite() {
  const email = inviteEmail.value.trim()
  error.value = ''
  inviteSending.value = true
  try {
    const data = await postJson('gastoteca/invite_email', await freshToken(true), { email })
    group.value = data.group
    inviteEmail.value = ''
    flash(`Invitación enviada a ${email}.`)
  } catch (reason) {
    error.value = reason.message
  } finally {
    inviteSending.value = false
  }
}

async function saveGroupSettings() {
  saving.value = true
  error.value = ''
  try {
    const data = await postJson('gastoteca/update_group_settings', await freshToken(true), { default_city: defaultCityDraft.value, default_payment_method: defaultPaymentMethodDraft.value })
    group.value = data.group
    flash('Preferencias del grupo actualizadas.')
  } catch (reason) {
    error.value = reason.message
  } finally {
    saving.value = false
  }
}

function prepareCatalogDraft() {
  catalogDraft.establishments = catalogEstablishments.value.map((item) => ({ ...item }))
  catalogDraft.categories = categories.value.map((item) => ({ key: item.id, label: item.label, icon: item.icon }))
}

async function iconifyJson(path) {
  const response = await fetch(`https://api.iconify.design/${path}`)
  if (!response.ok) throw new Error('No se pudo cargar la biblioteca de iconos. Inténtalo de nuevo.')
  return response.json()
}

async function loadIconPickerCollection(prefix) {
  const requestId = ++iconPickerCollectionRequestId
  iconPickerLoading.value = true
  iconPickerError.value = ''
  iconPickerData.value = null
  iconPickerLimit.value = 180
  try {
    const data = iconPickerCollectionCache.get(prefix) || await iconifyJson(`collection?prefix=${encodeURIComponent(prefix)}`)
    iconPickerCollectionCache.set(prefix, data)
    if (requestId === iconPickerCollectionRequestId) iconPickerData.value = data
  } catch (reason) {
    if (requestId === iconPickerCollectionRequestId) iconPickerError.value = reason.message
  } finally {
    if (requestId === iconPickerCollectionRequestId && !iconPickerSearch.value.trim()) iconPickerLoading.value = false
  }
}

async function openIconPicker(item) {
  iconPickerTarget.value = item
  iconPickerSearch.value = ''
  iconPickerResults.value = []
  iconPickerSearchHasMore.value = false
  iconPickerError.value = ''
  iconPickerOpen.value = true
  iconPickerLoading.value = true
  try {
    if (!iconPickerCollections.value.length) {
      const collections = await iconifyJson('collections')
      iconPickerCollections.value = Object.entries(collections)
        .map(([prefix, info]) => ({ prefix, name: info.name || prefix, total: info.total || 0, category: info.category || 'General' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }
    if (!iconPickerOpen.value) return
    const current = iconPickerCollections.value.find((itemInfo) => itemInfo.prefix === iconPickerCollection.value)
    const preferred = current || iconPickerCollections.value.find((itemInfo) => itemInfo.prefix === 'mdi') || iconPickerCollections.value[0]
    if (!preferred) throw new Error('Iconify no ha devuelto colecciones disponibles.')
    iconPickerCollectionCategory.value = preferred.category || 'General'
    iconPickerCollection.value = preferred.prefix
    await loadIconPickerCollection(preferred.prefix)
  } catch (reason) {
    iconPickerError.value = reason.message
    iconPickerLoading.value = false
  }
}

function setIconPickerCategory(categoryName) {
  iconPickerCollectionCategory.value = categoryName
  const firstCollection = iconPickerVisibleCollections.value[0]
  if (firstCollection) {
    iconPickerCollection.value = firstCollection.prefix
    loadIconPickerCollection(firstCollection.prefix)
  }
}

function setIconPickerCollection(prefix) {
  iconPickerCollection.value = prefix
  loadIconPickerCollection(prefix)
}

function chooseIcon(icon) {
  if (iconPickerTarget.value) iconPickerTarget.value.icon = icon
  iconPickerOpen.value = false
  iconPickerTarget.value = null
}

async function loadMoreIconPickerSearchResults() {
  const query = iconPickerSearch.value.trim()
  if (!query || iconPickerLoading.value || !iconPickerSearchHasMore.value) return
  const requestId = ++iconPickerSearchRequestId
  iconPickerLoading.value = true
  try {
    const result = await iconifyJson(`search?query=${encodeURIComponent(query)}&limit=128&start=${iconPickerResults.value.length}`)
    if (requestId === iconPickerSearchRequestId) {
      iconPickerResults.value.push(...(result.icons || []))
      iconPickerSearchHasMore.value = (result.icons || []).length >= result.limit
    }
  } catch (reason) {
    if (requestId === iconPickerSearchRequestId) iconPickerError.value = reason.message
  } finally {
    if (requestId === iconPickerSearchRequestId) iconPickerLoading.value = false
  }
}

function closeIconPicker() {
  iconPickerOpen.value = false
  iconPickerTarget.value = null
  window.clearTimeout(iconPickerSearchTimer)
  iconPickerSearchRequestId += 1
  iconPickerCollectionRequestId += 1
  iconPickerLoading.value = false
}

watch(iconPickerSearch, (value) => {
  window.clearTimeout(iconPickerSearchTimer)
  const query = value.trim()
  const requestId = ++iconPickerSearchRequestId
  iconPickerError.value = ''
  iconPickerResults.value = []
  iconPickerSearchHasMore.value = false
  if (!query || query.length < 2) {
    iconPickerLoading.value = false
    return
  }
  iconPickerLoading.value = true
  iconPickerSearchTimer = window.setTimeout(async () => {
    try {
      const result = await iconifyJson(`search?query=${encodeURIComponent(query)}&limit=128`)
      if (requestId === iconPickerSearchRequestId) {
        iconPickerResults.value = result.icons || []
        iconPickerSearchHasMore.value = (result.icons || []).length >= result.limit
      }
    } catch (reason) {
      if (requestId === iconPickerSearchRequestId) iconPickerError.value = reason.message
    } finally {
      if (requestId === iconPickerSearchRequestId) iconPickerLoading.value = false
    }
  }, 260)
})

async function saveCatalogIcons() {
  error.value = ''
  const allIcons = [...catalogDraft.establishments, ...catalogDraft.categories]
  if (allIcons.some((item) => !/^[a-z0-9][a-z0-9-]*:[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(item.icon))) {
    error.value = 'Usa el formato de Iconify, por ejemplo mdi:store-outline.'
    return
  }
  saving.value = true
  try {
    const data = await postJson('gastoteca/save_catalog_icons', await freshToken(true), {
      establishments: catalogDraft.establishments,
      categories: catalogDraft.categories,
    })
    group.value = data.group
    prepareCatalogDraft()
    flash('Iconos guardados para todo el grupo.')
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
    settlements.value = data.settlements || []
    joinCode.value = ''
    await loadNotifications()
    flash('Ya formas parte del grupo.')
  } catch (reason) { error.value = reason.message }
}

async function leaveGroup() {
  try {
    const data = await postJson('gastoteca/leave_group', await freshToken(true), {})
    group.value = data.group
    expenses.value = data.expenses
    stats.value = data.stats
    settlements.value = data.settlements || []
    await loadNotifications()
    flash('Has creado un nuevo grupo personal.')
  } catch (reason) { error.value = reason.message }
}

watch(() => route.name, () => {
  menuOpen.value = false
  notificationsOpen.value = false
  error.value = ''
  if (route.name === 'establishments' || route.name === 'categories') prepareCatalogDraft()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  if (user.value) loadRouteData(route.name)
})
watch(() => group.value, () => {
  if (route.name === 'establishments' || route.name === 'categories') prepareCatalogDraft()
  if (!recurringDraft.id && !recurringDraft.paid_by_uid) recurringDraft.paid_by_uid = currentMember.value?.uid || memberOptions.value[0]?.uid || ''
})
watch(() => group.value?.default_city, (city) => { defaultCityDraft.value = city || '' }, { immediate: true })
watch(() => group.value?.default_payment_method, (method) => {
  defaultPaymentMethodDraft.value = method || 'card'
  if (!recurringDraft.id) recurringDraft.payment_method = method || 'card'
}, { immediate: true })
watch(() => splitMembers.value.map((member) => member.uid).join('|'), () => {
  if (draft.share_mode === 'equal' || !splitMembers.value.length) return
  const members = splitMembers.value
  const target = draft.share_mode === 'percent' ? 100 : Number(draft.amount) || 0
  const values = members.map((member, index) => Number(shareValue(member, index)) || 0)
  const total = values.reduce((sum, value) => sum + value, 0)
  let remainder = target - total
  const lastIndex = values.length - 1
  if (values[lastIndex] + remainder >= 0) {
    values[lastIndex] += remainder
  } else if (total > 0) {
    let used = 0
    values.forEach((value, index) => {
      values[index] = index === lastIndex ? target - used : Math.round(value / total * target * 100) / 100
      used += values[index]
    })
  } else {
    values.fill(target / values.length)
    values[lastIndex] = target - values.slice(0, lastIndex).reduce((sum, value) => sum + value, 0)
  }
  members.forEach((member, index) => { draft.participant_shares[member.uid] = Math.max(0, values[index]).toFixed(2) })
})
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
  window.clearTimeout(iconPickerSearchTimer)
  window.clearInterval(notificationsPollTimer)
  window.removeEventListener('keydown', handleHeaderEscape)
  document.removeEventListener('visibilitychange', refreshNotificationsWhenVisible)
})

function refreshNotificationsWhenVisible() {
  if (document.visibilityState === 'visible' && user.value) loadNotifications()
}

function dismissHeaderMenu() {
  menuOpen.value = false
  notificationsOpen.value = false
}

function dismissSmartSelectOutside(event) {
  const activeElement = document.activeElement
  const activeSelect = activeElement?.closest?.('.smart-select')

  if (activeSelect && !activeSelect.contains(event.target)) {
    activeElement.blur()
  }
}

function handleHeaderEscape(event) {
  if (event.key !== 'Escape') return
  if (iconPickerOpen.value) {
    closeIconPicker()
    return
  }
  if (notificationsOpen.value) {
    notificationsOpen.value = false
    document.querySelector('.notification-trigger')?.focus()
    return
  }
  if (!menuOpen.value) return
  dismissHeaderMenu()
  document.querySelector('.menu-trigger')?.focus()
}

function navigateTo(path) {
  menuOpen.value = false
  notificationsOpen.value = false
  router.push(path)
}

onMounted(async () => {
  window.addEventListener('keydown', handleHeaderEscape)
  document.addEventListener('visibilitychange', refreshNotificationsWhenVisible)
  notificationsPollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && user.value) loadNotifications()
  }, 30000)
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
        await loadRouteData(route.name)
      } else {
        routeDataRequestId += 1
        routeLoading.value = false
        expenses.value = []
        settlements.value = []
        group.value = null
        notifications.value = []
        unreadNotificationCount.value = 0
        stats.value = { total: 0, count: 0, average: 0, by_category: [], by_member: [], monthly: [] }
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
  <div class="app-shell" @click="dismissHeaderMenu" @pointerdown.capture="dismissSmartSelectOutside">
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
      <div v-if="user" class="notification-center" @click.stop>
        <button
          type="button"
          class="icon-button notification-trigger"
          :aria-label="unreadNotificationCount ? `Notificaciones, ${unreadNotificationCount} sin leer` : 'Notificaciones'"
          :aria-expanded="notificationsOpen"
          aria-controls="notifications-panel"
          title="Notificaciones"
          @click="notificationsOpen = !notificationsOpen; menuOpen = false"
        >
          <PhBell :size="21" weight="regular" />
          <span v-if="unreadNotificationCount" class="notification-count">{{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}</span>
        </button>
        <section v-if="notificationsOpen" id="notifications-panel" class="notifications-panel" aria-label="Notificaciones recientes">
          <header class="notifications-heading">
            <div><strong>Notificaciones</strong><span v-if="unreadNotificationCount">{{ unreadNotificationCount }} sin leer</span></div>
            <button type="button" class="mark-all-read" :disabled="!unreadNotificationCount || markingAllNotifications" @click="markAllNotificationsRead">{{ markingAllNotifications ? 'Guardando…' : 'Marcar todas como leídas' }}</button>
          </header>
          <div v-if="!notifications.length" class="notifications-empty"><PhBell :size="23" /><span>Todo al día. Aquí verás la actividad de tu grupo.</span></div>
          <div v-else class="notifications-list">
            <article v-for="notification in notifications" :key="notification.id" class="notification-item" :class="{ unread: !notification.read_at }">
              <button type="button" class="notification-open" @click="openNotification(notification)">
                <span class="notification-unread-dot" :class="{ visible: !notification.read_at }"></span>
                <span class="notification-copy"><strong>{{ notification.title }}</strong><span>{{ notification.body }}</span><time>{{ notificationDateLabel(notification.created_at) }}</time></span>
              </button>
              <button v-if="!notification.read_at" type="button" class="notification-mark-read" :disabled="markingNotificationIds.includes(notification.id)" :aria-label="`Marcar como leída: ${notification.title}`" title="Marcar como leída" @click="markNotificationRead(notification)"><PhCheck :size="17" /></button>
            </article>
          </div>
        </section>
      </div>
      <div v-if="user" class="account">
        <img v-if="user.photoURL" :src="user.photoURL" alt="" />
        <span>{{ user.displayName || user.email }}</span>
        <button class="icon-button" title="Cerrar sesión" @click="signOut"><PhSignOut :size="21" /></button>
      </div>
    </header>

    <div v-if="loading || routeLoading" class="loading-screen"><span class="loader"></span><p>{{ loading ? 'Preparando tus gastos…' : 'Cargando…' }}</p></div>

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
          <div class="balance-grid single-balance">
            <button type="button" class="balance-card balance-summary-card" :class="netBalance < 0 ? 'balance-negative' : 'balance-positive'" :aria-label="`${netBalanceTitle}: ${money(Math.abs(netBalance))}. Ver desglose completo`" @click="router.push({ name: 'balance' })">
              <span>{{ netBalanceTitle }}</span>
              <strong>{{ money(Math.abs(netBalance)) }}</strong>
              <small>Ver desglose completo <PhArrowRight :size="16" /></small>
            </button>
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
          <article v-for="expense in visibleExpenses" :key="expense.id" class="expense-card" role="button" tabindex="0" :aria-label="`Editar movimiento: ${expense.name}`" @click="openExpense(expense)" @keydown.enter.prevent="openExpense(expense)" @keydown.space.prevent="openExpense(expense)">
            <span class="category-icon" :style="expense.place && establishmentIcon(expense.place) ? { background: '#e5efe8', color: 'var(--green)' } : { background: `${category(expense.category).color}18`, color: category(expense.category).color }"><iconify-icon v-if="expense.place && establishmentIcon(expense.place)" :icon="establishmentIcon(expense.place)"></iconify-icon><iconify-icon v-else :icon="category(expense.category).icon"></iconify-icon></span>
            <div class="expense-main"><strong>{{ expense.name }} <em v-if="expense.transaction_type === 'income'" class="movement-type">Ingreso</em><em v-if="expense.is_quick" class="quick-pending-pill">Por completar</em></strong><span><PhMapPin :size="14" /> {{ expenseLocation(expense) }} · {{ dateLabel(expense.occurred_at) }}</span><small class="expense-payment-method">{{ paymentMethodLabel(expense.payment_method) }}</small><small v-if="expense.details" class="expense-details">{{ expense.details }}</small><span v-if="expense.tags?.length" class="expense-tag-list"><em v-for="tag in expense.tags" :key="tag">{{ tag }}</em></span></div>
            <span class="category-pill" :style="{ color: category(expense.category).color }"><PhTag :size="13" /> {{ category(expense.category).label }}</span>
            <div class="expense-people"><span>{{ expense.transaction_type === 'income' ? 'Recibió' : 'Pagó' }}</span><strong>{{ expense.paid_by_type === 'all' ? 'Todo el grupo' : memberLabel(expense.paid_by_uid) }}</strong><small>Para {{ expense.applies_to_all ? 'todo el grupo' : expense.participant_uids.map(memberLabel).join(', ') }}</small></div>
            <strong class="expense-amount" :class="{ income: expense.transaction_type === 'income' }">{{ expense.transaction_type === 'income' ? '+' : '' }}{{ money(expense.amount) }}</strong>
          </article>
          <div v-if="hasMoreExpenses" ref="loadMoreSentinel" class="load-more" aria-label="Cargando más gastos"><span class="loader"></span></div>
        </section>
        <section v-else class="empty-state"><div>🧾</div><h2>{{ expenses.length ? 'No hay resultados' : 'Tu primer gasto empieza aquí' }}</h2><p>{{ expenses.length ? 'Prueba a cambiar los filtros.' : 'Pulsa el botón + para añadir una compra, una factura o una cena.' }}</p></section>
          <button class="floating-add" type="button" title="Nuevo movimiento" aria-label="Nuevo movimiento" @click="openExpense()"><PhPlus :size="30" weight="bold" /></button>
      </template>

      <template v-else-if="route.name === 'balance'">
        <section class="page-heading">
          <div><p class="eyebrow">{{ group?.name || 'MI GRUPO' }}</p><h1>Balance</h1><p>Desglose de los gastos que has adelantado y los que te corresponden.</p></div>
          <button type="button" class="ghost" @click="router.push({ name: 'expenses' })"><PhArrowLeft :size="17" /> Volver a movimientos</button>
        </section>
        <section class="balance-card balance-detail-total" :class="netBalance < 0 ? 'balance-negative' : 'balance-positive'">
          <span>{{ netBalanceTitle }}</span>
          <strong>{{ money(Math.abs(netBalance)) }}</strong>
          <small>{{ netBalance === 0 ? 'No tienes un saldo pendiente con el grupo.' : 'Saldo neto de tus gastos compartidos.' }}</small>
        </section>
        <section class="balance-breakdown-grid" aria-label="Desglose de saldos">
          <article class="chart-card balance-breakdown-card">
            <div class="card-title"><div><p class="eyebrow">TE DEBEN</p><h2>{{ money(balanceSummary.owedToYou) }}</h2></div></div>
            <div v-if="balanceBreakdown.owedToYou.length" class="balance-entry-list">
              <article v-for="entry in balanceBreakdown.owedToYou" :key="entry.id" class="balance-entry">
                <span class="avatar">{{ memberLabel(entry.counterpartyUid).slice(0, 1).toUpperCase() }}</span>
              <div class="balance-entry-main"><strong>{{ memberLabel(entry.counterpartyUid) }} te debe</strong><small>Deuda neta pendiente</small></div>
                <div class="balance-entry-actions"><b>{{ money(entry.amount) }}</b><button type="button" class="secondary small-action" @click="openSettlement(entry, true)">Registrar pago</button></div>
              </article>
            </div>
            <p v-else class="muted">No tienes importes pendientes de recibir.</p>
          </article>
          <article class="chart-card balance-breakdown-card">
            <div class="card-title"><div><p class="eyebrow">DEBES</p><h2>{{ money(balanceSummary.youOwe) }}</h2></div></div>
            <div v-if="balanceBreakdown.youOwe.length" class="balance-entry-list">
              <article v-for="entry in balanceBreakdown.youOwe" :key="entry.id" class="balance-entry">
                <span class="avatar">{{ memberLabel(entry.counterpartyUid).slice(0, 1).toUpperCase() }}</span>
                <div class="balance-entry-main"><strong>Debes a {{ memberLabel(entry.counterpartyUid) }}</strong><small>Deuda neta pendiente</small></div>
                <div class="balance-entry-actions"><b>{{ money(entry.amount) }}</b><button type="button" class="secondary small-action" @click="openSettlement(entry, false)">Registrar pago</button></div>
              </article>
            </div>
            <p v-else class="muted">No tienes importes pendientes de pagar.</p>
          </article>
        </section>
        <section v-if="settlements.length" class="chart-card settlement-history">
          <div class="card-title"><div><p class="eyebrow">HISTORIAL</p><h2>Pagos registrados</h2></div></div>
          <div class="settlement-history-list"><p v-for="item in settlements.slice(0, 8)" :key="item.id"><span><strong>{{ memberLabel(item.payer_uid) }}</strong> pagó a <strong>{{ memberLabel(item.payee_uid) }}</strong></span><small>{{ dateLabel(item.paid_at) }} · {{ paymentMethodLabel(item.payment_method) }}</small><b>{{ money(item.amount) }}</b></p></div>
        </section>
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
            <div class="bar-list"><div v-for="item in stats.by_category" :key="item.category" class="bar-item"><span><iconify-icon :icon="category(item.category).icon"></iconify-icon></span><div><p><strong>{{ category(item.category).label }}</strong><b>{{ money(item.total) }}</b></p><i><em :style="{ width: `${Number(item.total) / maxCategoryTotal * 100}%`, background: category(item.category).color }"></em></i></div></div><p v-if="!stats.by_category.length" class="muted">Aún no hay datos.</p></div>
          </article>
          <article class="chart-card">
            <div class="card-title"><div><p class="eyebrow">PERSONAS</p><h2>Quién ha pagado</h2></div></div>
            <div class="member-stat"><div v-for="item in stats.by_member" :key="item.uid || 'all'"><span class="avatar">{{ item.uid ? memberLabel(item.uid).slice(0, 1).toUpperCase() : '∑' }}</span><p><strong>{{ item.uid ? memberLabel(item.uid) : 'Todo el grupo' }}</strong><small>{{ item.count }} gastos</small></p><b>{{ money(item.total) }}</b></div><p v-if="!stats.by_member.length" class="muted">Aún no hay datos.</p></div>
          </article>
        </section>
      </template>

      <template v-else-if="route.name === 'budgets'">
        <section class="page-heading">
          <div><p class="eyebrow">PLANIFICA EL MES</p><h1>Presupuestos</h1><p>Define cuánto queréis gastar en cada categoría y sigue el avance del mes.</p></div>
        </section>
        <section class="budget-overview" aria-label="Resumen de presupuestos">
          <article class="budget-overview-card"><span>Categorías con límite</span><strong>{{ group?.budgets?.length || 0 }}</strong></article>
          <article class="budget-overview-card"><span>Gastado este mes</span><strong>{{ money(budgetSummary.spent) }}</strong></article>
          <article class="budget-overview-card"><span>Límite mensual total</span><strong>{{ money(budgetSummary.limit) }}</strong></article>
        </section>
        <section class="feature-layout budget-page-layout">
          <form class="feature-panel feature-form budget-editor" @submit.prevent="saveBudget">
            <div class="feature-panel-heading"><div><p class="eyebrow">{{ group?.budgets?.some((item) => item.category === budgetDraft.category) ? 'AJUSTA EL LÍMITE' : 'NUEVO PRESUPUESTO' }}</p><h2>Presupuesto por categoría</h2></div></div>
            <label><span>Categoría *</span><select v-model="budgetDraft.category" required @change="budgetDraft.monthly_limit = ''"><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
            <label><span>Límite mensual *</span><div class="money-input"><input v-model="budgetDraft.monthly_limit" type="number" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div></label>
            <p class="feature-hint">Si la categoría ya tiene un presupuesto, guardar actualizará su límite.</p>
            <div class="feature-form-actions"><button v-if="group?.budgets?.some((item) => item.category === budgetDraft.category)" type="button" class="ghost" @click="budgetDraft.monthly_limit = ''">Limpiar</button><span v-else></span><button class="primary" :disabled="saving"><PhPlus :size="17" /> {{ saving ? 'Guardando…' : 'Guardar presupuesto' }}</button></div>
          </form>
          <section class="feature-panel feature-list-panel budget-list-panel">
            <div class="feature-panel-heading"><div><p class="eyebrow">SEGUIMIENTO MENSUAL</p><h2>Uso por categoría</h2></div><span class="feature-count">{{ group?.budgets?.length || 0 }}</span></div>
            <div v-if="group?.budgets?.length" class="budget-list">
              <article v-for="budget in group.budgets" :key="budget.category" class="budget-item">
                <div class="budget-item-heading"><span class="budget-category-icon" :style="{ color: category(budget.category).color, background: `${category(budget.category).color}18` }"><iconify-icon :icon="category(budget.category).icon"></iconify-icon></span><div class="budget-category-copy"><strong>{{ budget.label }}</strong><small>{{ money(budget.current_total) }} gastados de {{ money(budget.monthly_limit) }}</small></div><strong class="budget-percent" :class="{ exceeded: Number(budget.current_total) > Number(budget.monthly_limit) }">{{ Math.round(Number(budget.current_total) / Math.max(0.01, Number(budget.monthly_limit)) * 100) }}%</strong></div>
                <div class="budget-track"><span :class="{ exceeded: Number(budget.current_total) > Number(budget.monthly_limit) }" :style="{ width: `${Math.min(100, Number(budget.current_total) / Math.max(0.01, Number(budget.monthly_limit)) * 100)}%` }"></span></div>
                <div class="budget-item-footer"><small>{{ Number(budget.current_total) > Number(budget.monthly_limit) ? `Te has pasado ${money(Number(budget.current_total) - Number(budget.monthly_limit))}` : `Quedan ${money(Number(budget.monthly_limit) - Number(budget.current_total))}` }}</small><div class="feature-row-actions"><button type="button" class="ghost small-action" @click="Object.assign(budgetDraft, { category: budget.category, monthly_limit: Number(budget.monthly_limit).toFixed(2) })">Editar</button><button type="button" class="danger-button small-action" @click="deleteBudget(budget.category)">Eliminar</button></div></div>
              </article>
            </div>
            <div v-else class="feature-empty"><PhWallet :size="27" /><strong>Aún no hay presupuestos</strong><p>Crea el primero para controlar los gastos mensuales de una categoría.</p></div>
          </section>
        </section>
      </template>

      <template v-else-if="route.name === 'establishments' || route.name === 'categories'">
        <section class="page-heading catalog-heading">
          <div><p class="eyebrow">PERSONALIZA TU GRUPO</p><h1>{{ route.name === 'establishments' ? 'Establecimientos' : 'Categorías' }}</h1><p>Elige un icono para reconocer cada {{ route.name === 'establishments' ? 'lugar' : 'categoría' }} de un vistazo.</p></div>
          <div class="catalog-tabs" aria-label="Catálogos"><button type="button" :class="{ active: route.name === 'establishments' }" @click="router.push({ name: 'establishments' })"><PhMapPin :size="17" /> Establecimientos</button><button type="button" :class="{ active: route.name === 'categories' }" @click="router.push({ name: 'categories' })"><PhTag :size="17" /> Categorías</button></div>
        </section>
        <section class="catalog-panel">
          <div class="catalog-intro"><div><strong>{{ route.name === 'establishments' ? catalogDraft.establishments.length : catalogDraft.categories.length }} {{ route.name === 'establishments' ? 'establecimientos' : 'categorías' }}</strong><p>Pulsa un icono para buscar y elegir entre las colecciones de Iconify. Los cambios se comparten con tu grupo.</p></div><a href="https://icon-sets.iconify.design/" target="_blank" rel="noreferrer">Explorar Iconify <PhArrowRight :size="15" /></a></div>
          <div v-if="route.name === 'establishments' && catalogDraft.establishments.length" class="catalog-editor-list">
            <article v-for="item in catalogDraft.establishments" :key="item.name" class="catalog-editor-item">
              <button type="button" class="catalog-item-preview" :aria-label="`Cambiar icono de ${item.name}`" :title="`Cambiar icono de ${item.name}`" @click="openIconPicker(item)"><iconify-icon :icon="item.icon"></iconify-icon></button><div class="catalog-item-name"><strong>{{ item.name }}</strong><small>Establecimiento · Pulsa el icono para cambiarlo</small></div>
            </article>
          </div>
          <div v-else-if="route.name === 'categories' && catalogDraft.categories.length" class="catalog-editor-list">
            <article v-for="item in catalogDraft.categories" :key="item.key" class="catalog-editor-item">
              <button type="button" class="catalog-item-preview" :aria-label="`Cambiar icono de ${item.label}`" :title="`Cambiar icono de ${item.label}`" @click="openIconPicker(item)"><iconify-icon :icon="item.icon"></iconify-icon></button><div class="catalog-item-name"><strong>{{ item.label }}</strong><small>{{ builtInCategories.some((categoryItem) => categoryItem.id === item.key) ? 'Categoría predeterminada' : 'Categoría personalizada' }} · Pulsa el icono para cambiarlo</small></div>
            </article>
          </div>
          <div v-else class="catalog-empty"><iconify-icon :icon="route.name === 'establishments' ? 'mdi:store-outline' : 'mdi:tag-outline'"></iconify-icon><strong>{{ route.name === 'establishments' ? 'Aún no hay establecimientos' : 'Aún no hay categorías personalizadas' }}</strong><p>{{ route.name === 'establishments' ? 'Se añadirán automáticamente al guardar movimientos con un establecimiento.' : 'Las categorías personalizadas aparecen aquí al usarlas en un movimiento.' }}</p></div>
          <footer class="catalog-footer"><span>La vista previa usa la biblioteca <a href="https://iconify.design/" target="_blank" rel="noreferrer">Iconify</a>.</span><button class="primary" :disabled="saving" @click="saveCatalogIcons"><PhCheck :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar cambios' }}</button></footer>
        </section>
      </template>

      <template v-else-if="route.name === 'recurring'">
        <section class="page-heading">
          <div><p class="eyebrow">AUTOMATIZACIONES DEL GRUPO</p><h1>Gastos recurrentes</h1><p>Configura gastos e ingresos que se añadirán automáticamente cuando llegue su fecha.</p></div>
          <button v-if="recurringDraft.id" type="button" class="ghost" @click="startRecurringRule()">Nueva programación</button>
        </section>
        <section class="feature-layout">
          <form class="feature-panel feature-form" @submit.prevent="saveRecurring">
            <div class="feature-panel-heading"><div><p class="eyebrow">{{ recurringDraft.id ? 'EDITAR PROGRAMACIÓN' : 'NUEVA PROGRAMACIÓN' }}</p><h2>{{ recurringDraft.id ? 'Ajusta los detalles' : 'Añade un movimiento' }}</h2></div></div>
            <div class="feature-fields">
              <label><span>Tipo *</span><select v-model="recurringDraft.transaction_type" required><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>
              <label><span>Frecuencia *</span><select v-model="recurringDraft.frequency" required><option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select></label>
              <label class="feature-field-wide"><span>Nombre *</span><input v-model="recurringDraft.name" maxlength="160" :placeholder="recurringDraft.transaction_type === 'income' ? 'Nómina o ingreso recurrente' : 'Alquiler, suscripción…'" required /></label>
              <label><span>Importe *</span><div class="money-input"><input v-model="recurringDraft.amount" type="number" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div></label>
              <label><span>Categoría *</span><select v-model="recurringDraft.category" required><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
              <label class="feature-field-wide"><span>Método de pago *</span><select v-model="recurringDraft.payment_method" required><option v-if="recurringDraft.payment_method === 'unspecified'" value="unspecified">Sin especificar</option><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option></select></label>
              <label class="feature-field-wide"><span>Próxima fecha de aplicación *</span><input v-model="recurringDraft.next_at" type="datetime-local" required /></label>
            </div>
            <fieldset class="feature-fieldset">
              <legend>{{ recurringDraft.transaction_type === 'income' ? 'Quién lo recibe' : 'Quién lo paga' }} *</legend>
              <div class="feature-choice-row"><label><input v-model="recurringDraft.paid_by_type" type="radio" value="person" /> Una persona</label><label><input v-model="recurringDraft.paid_by_type" type="radio" value="all" /> Todo el grupo</label></div>
              <select v-if="recurringDraft.paid_by_type === 'person'" v-model="recurringDraft.paid_by_uid" class="feature-select"><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option></select>
            </fieldset>
            <fieldset class="feature-fieldset">
              <legend>A quién se aplica *</legend>
              <div class="feature-choice-row"><label><input v-model="recurringDraft.applies_to_all" type="radio" :value="true" @change="resetRecurringShares" /> Todo el grupo</label><label><input v-model="recurringDraft.applies_to_all" type="radio" :value="false" @change="resetRecurringShares" /> Algunas personas</label></div>
              <div v-if="!recurringDraft.applies_to_all" class="check-members"><label v-for="member in memberOptions" :key="member.uid"><input v-model="recurringDraft.participant_uids" type="checkbox" :value="member.uid" @change="resetRecurringShares" /><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span>{{ member.name || member.email }}</label></div>
              <div class="feature-split-heading"><span>Reparto *</span><label><input :checked="recurringDraft.share_mode === 'equal'" type="radio" @change="setRecurringShareMode('equal')" /> Por igual</label><label><input :checked="recurringDraft.share_mode === 'amount'" type="radio" @change="setRecurringShareMode('amount')" /> Personalizado</label></div>
              <div v-if="recurringDraft.share_mode === 'amount'" class="feature-share-list"><label v-for="member in recurringSplitMembers" :key="member.uid"><span>{{ member.name || member.email }}</span><div class="money-input"><input v-model="recurringDraft.participant_shares[member.uid]" type="number" min="0" step="0.01" :aria-label="`Parte de ${member.name || member.email}`" /><b>€</b></div></label></div>
            </fieldset>
            <fieldset v-if="group?.tags?.length" class="feature-fieldset">
              <legend>Etiquetas</legend>
              <div class="feature-tag-options"><label v-for="tag in group.tags" :key="tag.id"><input v-model="recurringDraft.tags" type="checkbox" :value="tag.name" /> {{ tag.name }}</label></div>
            </fieldset>
            <div class="feature-form-actions"><button v-if="recurringDraft.id" type="button" class="text-danger" @click="recurringDeleteTarget = { id: recurringDraft.id, name: recurringDraft.name }">Eliminar programación</button><span></span><button v-if="recurringDraft.id" type="button" class="ghost" @click="startRecurringRule()">Cancelar</button><button class="primary" :disabled="saving"><PhCheck :size="17" /> {{ saving ? 'Guardando…' : 'Guardar' }}</button></div>
          </form>
          <section class="feature-panel feature-list-panel">
            <div class="feature-panel-heading"><div><p class="eyebrow">PROGRAMACIONES</p><h2>Movimientos automáticos</h2></div><span class="feature-count">{{ group?.recurring?.length || 0 }}</span></div>
            <div v-if="group?.recurring?.length" class="feature-list">
              <article v-for="rule in group.recurring" :key="rule.id" class="feature-list-row">
                <div class="feature-list-main"><span class="feature-status-dot" :class="{ paused: !rule.active }"></span><div><strong>{{ rule.name }}</strong><small>{{ rule.transaction_type === 'income' ? 'Ingreso' : 'Gasto' }} · {{ money(rule.amount) }} · {{ paymentMethodLabel(rule.payload?.payment_method) }} · {{ rule.frequency === 'weekly' ? 'Semanal' : rule.frequency === 'monthly' ? 'Mensual' : 'Anual' }}</small><small>{{ rule.active ? 'Próximo: ' : 'Pausado · Próximo: ' }}{{ dateLabel(rule.next_at) }}</small></div></div>
                <div class="feature-row-actions"><button type="button" class="ghost small-action" @click="startRecurringRule(rule)">Editar</button><button type="button" class="secondary small-action" @click="toggleRecurring(rule)">{{ rule.active ? 'Pausar' : 'Reactivar' }}</button></div>
              </article>
            </div>
            <div v-else class="feature-empty"><PhLightning :size="27" /><strong>Aún no hay programaciones</strong><p>Configura aquí el alquiler, las suscripciones o los ingresos que se repiten.</p></div>
          </section>
        </section>
      </template>

      <template v-else-if="route.name === 'tags'">
        <section class="page-heading"><div><p class="eyebrow">ORGANIZA TUS MOVIMIENTOS</p><h1>Etiquetas</h1><p>Crea y renombra etiquetas para encontrar mejor tus gastos e ingresos.</p></div></section>
        <section class="feature-layout tag-layout">
          <form class="feature-panel feature-form tag-editor" @submit.prevent="saveTag">
            <div class="feature-panel-heading"><div><p class="eyebrow">{{ tagDraft.id ? 'EDITAR ETIQUETA' : 'NUEVA ETIQUETA' }}</p><h2>{{ tagDraft.id ? 'Cambia su nombre' : 'Crea una etiqueta' }}</h2></div></div>
            <label><span>Nombre *</span><input v-model="tagDraft.name" maxlength="40" placeholder="Por ejemplo: vacaciones" required /></label>
            <p class="feature-hint">Las etiquetas recientes también aparecen al registrar un movimiento.</p>
            <div class="feature-form-actions"><button v-if="tagDraft.id" type="button" class="ghost" @click="Object.assign(tagDraft, { id: '', name: '' })">Cancelar</button><span v-else></span><button class="primary" :disabled="saving"><PhCheck :size="17" /> {{ saving ? 'Guardando…' : tagDraft.id ? 'Guardar cambios' : 'Crear etiqueta' }}</button></div>
          </form>
          <section class="feature-panel feature-list-panel">
            <div class="feature-panel-heading"><div><p class="eyebrow">CATÁLOGO DEL GRUPO</p><h2>Etiquetas disponibles</h2></div><span class="feature-count">{{ group?.tags?.length || 0 }}</span></div>
            <div v-if="group?.tags?.length" class="feature-list">
              <article v-for="tag in group.tags" :key="tag.id" class="feature-list-row">
                <div class="feature-list-main"><span class="tag-chip"><PhTag :size="15" /> {{ tag.name }}</span><small>{{ tag.usage_count }} {{ tag.usage_count === 1 ? 'movimiento' : 'movimientos' }} · Último uso {{ dateLabel(tag.last_used_at) }}</small></div>
                <div class="feature-row-actions"><button type="button" class="ghost small-action" @click="Object.assign(tagDraft, { id: tag.id, name: tag.name })">Editar</button><button type="button" class="danger-button small-action" @click="tagDeleteTarget = tag">Eliminar</button></div>
              </article>
            </div>
            <div v-else class="feature-empty"><PhTag :size="27" /><strong>Aún no hay etiquetas</strong><p>Crea una etiqueta aquí o al añadir un movimiento.</p></div>
          </section>
        </section>
      </template>

      <template v-else-if="route.name === 'settings'">
        <section class="page-heading"><div><p class="eyebrow">TU EXPERIENCIA</p><h1>Ajustes</h1><p>Elige qué avisos quieres recibir y cómo te llegan.</p></div></section>
        <section class="settings-layout">
          <form class="feature-panel feature-form settings-panel" @submit.prevent="saveNotificationSettings">
            <div class="feature-panel-heading"><div><p class="eyebrow">EN LA CAMPAÑITA</p><h2>Notificaciones de la app</h2></div></div>
            <p class="feature-hint settings-intro">Controla qué actividad aparece en tu bandeja de notificaciones. Los cambios solo afectan a tu cuenta.</p>
            <div class="settings-options">
              <label v-for="item in notificationOptions" :key="item.value"><input v-model="appNotificationTypes" type="checkbox" :value="item.value" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span></label>
            </div>
            <div class="feature-form-actions"><span></span><button class="primary" :disabled="notificationSaving"><PhCheck :size="17" /> {{ notificationSaving ? 'Guardando…' : 'Guardar preferencias' }}</button></div>
          </form>

          <form class="feature-panel feature-form settings-panel" @submit.prevent="saveTelegramSettings">
            <div class="feature-panel-heading"><div><p class="eyebrow">AVISOS EXTERNOS</p><h2>Telegram</h2></div><span class="settings-status" :class="{ connected: telegramConnected }">{{ telegramConnected ? 'Conectado' : telegramConfigured ? 'Sin conectar' : 'No disponible' }}</span></div>
            <p v-if="!telegramConfigured" class="muted">Telegram no está configurado en el servidor. Puedes seguir usando las notificaciones de la campanita.</p>
            <template v-else>
              <p class="feature-hint settings-intro">{{ telegramConnected ? `Tu cuenta está conectada${telegramUsername ? ` como ${telegramUsername}` : ''}. Elige qué avisos quieres recibir por Telegram.` : 'Conecta Telegram para recibir allí los avisos que selecciones.' }}</p>
              <div class="settings-connection-actions">
                <button v-if="!telegramConnected && !telegramLinkUrl" type="button" class="secondary" @click="beginTelegramLink">Conectar Telegram</button>
                <a v-if="telegramLinkUrl && !telegramConnected" class="telegram-link" :href="telegramLinkUrl" target="_blank" rel="noreferrer">Abrir Telegram para vincular <PhArrowRight :size="15" /></a>
                <button v-if="!telegramConnected && telegramLinkUrl" type="button" class="ghost" @click="refreshTelegramStatus">Ya lo he vinculado · comprobar</button>
                <button v-if="telegramConnected" type="button" class="ghost" @click="refreshTelegramStatus">Actualizar conexión</button>
              </div>
              <div class="settings-options">
                <label v-for="item in notificationOptions" :key="item.value"><input v-model="telegramNotificationTypes" type="checkbox" :value="item.value" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span></label>
              </div>
              <div class="feature-form-actions"><span></span><button class="primary" :disabled="telegramSaving"><PhCheck :size="17" /> {{ telegramSaving ? 'Guardando…' : 'Guardar preferencias' }}</button></div>
            </template>
          </form>

          <article class="feature-panel settings-account-panel">
            <div class="feature-panel-heading"><div><p class="eyebrow">CUENTA Y GRUPO</p><h2>Tu espacio</h2></div></div>
            <div class="settings-account-row"><span class="avatar">{{ (user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase() }}</span><div><strong>{{ user?.displayName || 'Tu cuenta' }}</strong><small>{{ user?.email }}</small></div></div>
            <div class="settings-account-row"><span class="settings-group-icon"><PhUsers :size="19" /></span><div><strong>{{ group?.name || 'Tu grupo' }}</strong><small>{{ memberOptions.length }} {{ memberOptions.length === 1 ? 'persona' : 'personas' }}</small></div><button type="button" class="ghost small-action" @click="navigateTo('/grupo')">Ver grupo</button></div>
          </article>
        </section>
      </template>

      <template v-else>
        <section class="page-heading"><div><p class="eyebrow">ESPACIO COMPARTIDO</p><h1>Tu grupo</h1><p>Invita a las personas con las que compartes gastos.</p></div></section>
        <section class="group-grid">
          <article class="group-card group-hero"><span class="group-mark"><PhHouse :size="28" weight="duotone" /></span><div><p class="eyebrow">GRUPO ACTUAL</p><h2>{{ group?.name }}</h2><p>{{ memberOptions.length }} {{ memberOptions.length === 1 ? 'persona' : 'personas' }}<template v-if="group?.default_city"> · {{ group.default_city }}</template></p></div><div class="invite-code"><span>Código de invitación</span><strong>{{ group?.invite_code }}</strong></div></article>
          <article class="group-card"><p class="eyebrow">MIEMBROS</p><h2>Personas del grupo</h2><div class="members"><div v-for="member in memberOptions" :key="member.uid"><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span><p><strong>{{ member.name || member.email }}</strong><small>{{ member.uid === group?.owner_uid ? 'Propietario' : member.email }}</small></p><span v-if="member.uid === user.uid" class="you-pill">Tú</span></div></div></article>
          <article v-if="group?.owner_uid === user.uid" class="group-card"><p class="eyebrow">INVITAR</p><h2>Sumar una persona</h2><p class="muted">Enviaremos un correo. Al iniciar sesión con Google usando ese email, se unirá automáticamente.</p><form class="inline-form" @submit.prevent="invite"><label class="inline-form-field"><span>Correo electrónico *</span><input v-model="inviteEmail" type="email" placeholder="persona@ejemplo.com" required /></label><button class="primary" :disabled="inviteSending">{{ inviteSending ? 'Enviando…' : 'Invitar' }} <PhArrowRight :size="17" /></button></form><div v-if="group.pending_emails?.length" class="pending"><span v-for="email in group.pending_emails" :key="email">{{ email }} · pendiente</span></div></article>
          <article v-if="group?.owner_uid === user.uid" class="group-card"><p class="eyebrow">UBICACIÓN</p><h2>Ciudad predeterminada</h2><p class="muted">Se usará cuando no podamos detectar la ubicación del dispositivo.</p><form class="group-setting-form" @submit.prevent="saveGroupSettings"><Multiselect v-model="defaultCityDraft" class="smart-select" :options="cityOptions" searchable create-option allow-absent :can-clear="Boolean(defaultCityDraft)" :aria="{ 'aria-label': 'Ciudad predeterminada' }" placeholder="Escribe o busca una ciudad" no-options-text="Escribe una ciudad nueva" no-results-text="Sin coincidencias" /><button class="primary" :disabled="saving">Guardar</button></form></article>
          <article v-if="group?.owner_uid === user.uid" class="group-card"><p class="eyebrow">PAGOS</p><h2>Método predeterminado</h2><p class="muted">Se preseleccionará al añadir gastos y registrar pagos para este grupo.</p><form class="group-setting-form payment-method-setting" @submit.prevent="saveGroupSettings"><select v-model="defaultPaymentMethodDraft" aria-label="Método de pago predeterminado"><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option></select><button class="primary" :disabled="saving">Guardar</button></form></article>
          <article class="group-card recurring-card">
            <div class="feature-panel-heading"><div><p class="eyebrow">AUTOMATIZACIONES</p><h2>Movimientos recurrentes</h2></div><button type="button" class="ghost small-action" @click="router.push({ name: 'recurring' })">Configurar</button></div>
            <div v-if="group?.recurring?.length" class="recurring-list">
              <div v-for="rule in group.recurring" :key="rule.id" class="recurring-item"><span><strong>{{ rule.name }}</strong><small>{{ money(rule.amount) }} · {{ rule.transaction_type === 'income' ? 'Ingreso' : 'Gasto' }} · {{ rule.frequency === 'weekly' ? 'Semanal' : rule.frequency === 'monthly' ? 'Mensual' : 'Anual' }} · Próximo: {{ dateLabel(rule.next_at) }}</small></span><button type="button" class="secondary small-action" @click="toggleRecurring(rule)">{{ rule.active ? 'Pausar' : 'Reactivar' }}</button></div>
            </div>
            <p v-else class="muted">Al crear un movimiento, puedes elegir si quieres repetirlo.</p>
          </article>
          <article class="group-card"><p class="eyebrow">OTRO GRUPO</p><h2>Unirte con un código</h2><p class="muted">Al unirte saldrás de tu grupo actual si no eres su propietario.</p><form class="inline-form" @submit.prevent="joinGroup"><label class="inline-form-field"><span>Código de invitación *</span><input v-model="joinCode" maxlength="8" placeholder="ABCD2345" required /></label><button class="secondary">Unirme</button></form><button v-if="group?.owner_uid !== user.uid" class="text-danger" @click="leaveGroup">Salir del grupo actual</button></article>
        </section>
      </template>
    </main>

    <div v-if="modalOpen" class="modal-backdrop" @mousedown.self="closeExpenseModal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title">
        <header><p id="expense-title" class="eyebrow modal-title">{{ quickExpenseMode ? 'Gasto rápido' : draft.id ? 'Editar movimiento' : draft.transaction_type ? (draft.transaction_type === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto') : 'Nuevo movimiento' }}</p><button class="icon-button" aria-label="Cerrar" @click="closeExpenseModal"><PhX :size="22" /></button></header>
        <p v-if="error" class="inline-error modal-error">{{ error }}</p>
        <div v-if="draft.id && !quickExpenseMode" class="expense-history-toolbar">
          <span>Consulta quién modificó este movimiento y qué cambió.</span>
          <button type="button" class="secondary" :disabled="expenseHistoryLoading" @click="loadExpenseHistory(draft.id)"><PhClockCounterClockwise :size="17" /> {{ expenseHistoryLoading ? 'Cargando…' : expenseHistoryForId === Number(draft.id) ? 'Actualizar historial' : 'Ver historial' }}</button>
        </div>
        <form v-if="quickExpenseMode" @submit.prevent="saveQuickExpense">
          <div class="quick-entry"><label for="quick-amount"><span>¿Cuánto has gastado? *</span><div class="money-input"><input id="quick-amount" ref="quickAmountInput" v-model="quickAmount" type="number" inputmode="decimal" enterkeyhint="done" min="0.01" max="99999999" step="0.01" placeholder="0,00" autofocus required /><b>€</b></div><small>El gasto quedará guardado para que completes los detalles más tarde.</small></label></div>
          <footer><button type="button" class="ghost" @click="quickExpenseMode = false">Volver</button><button class="primary" :disabled="saving"><PhCheck :size="18" weight="bold" /> {{ saving ? 'Guardando…' : 'Guardar gasto' }}</button></footer>
        </form>
        <form v-else @submit.prevent="saveExpense">
          <fieldset v-if="!draft.id && !draft.transaction_type" class="transaction-type"><legend>Primero, selecciona el tipo *</legend><div class="choice-grid transaction-options"><label :class="{ selected: draft.transaction_type === 'expense' }"><input v-model="draft.transaction_type" type="radio" value="expense" required /><PhArrowDown :size="22" /><span><strong>Gasto</strong><small>Dinero que ha salido</small></span></label><label :class="{ selected: draft.transaction_type === 'income' }"><input v-model="draft.transaction_type" type="radio" value="income" required /><PhArrowUp :size="22" /><span><strong>Ingreso</strong><small>Dinero que ha entrado</small></span></label><button type="button" class="quick-expense-choice" @click="startQuickExpense"><PhLightning :size="22" weight="fill" /><span><strong>Gasto rápido</strong><small>Guardar solo el importe</small></span></button></div></fieldset>
          <template v-if="draft.transaction_type">
          <aside v-if="draft.is_quick" class="quick-edit-notice"><PhLightning :size="18" weight="fill" /><span><strong>Gasto rápido pendiente</strong><small>El importe ya está guardado. Añade un nombre más descriptivo y los datos que quieras.</small></span></aside>
          <div class="form-grid">
            <label class="full name-field"><span>Nombre del {{ draft.transaction_type === 'income' ? 'ingreso' : 'gasto' }} *</span><input v-model="draft.name" maxlength="160" :placeholder="draft.transaction_type === 'income' ? 'Nómina, reembolso, venta…' : 'Cena, compra semanal, gasolina…'" autofocus required /><span class="frequent-names"><button v-for="suggestion in frequentNames" :key="suggestion.name" type="button" :class="{ active: normalizeName(draft.name) === normalizeName(suggestion.name) }" @click="selectFrequentName(suggestion)">{{ suggestion.name }}<small v-if="suggestion.count">{{ suggestion.count }}</small></button></span></label>
            <label class="full"><span>Importe *</span><div class="money-input"><input v-model="draft.amount" type="number" inputmode="decimal" enterkeyhint="done" min="0.01" max="99999999" step="0.01" placeholder="0,00" required /><b>€</b></div></label>
            <label><span>Categoría</span><Multiselect v-model="draft.category" class="smart-select" :options="categoryOptions" searchable create-option allow-absent :can-clear="false" :aria="{ 'aria-label': 'Categoría' }" placeholder="Busca o crea una categoría" no-options-text="Escribe una categoría nueva" no-results-text="Pulsa Intro para crearla" /></label>
            <label><span>Fecha y hora</span><input v-model="draft.occurred_at" type="datetime-local" /></label>
            <label><span>Establecimiento</span><Multiselect v-model="draft.place" class="smart-select" :options="establishmentOptions" searchable create-option allow-absent :can-clear="Boolean(draft.place)" :aria="{ 'aria-label': 'Establecimiento' }" placeholder="Busca o escribe un establecimiento" no-options-text="Escribe un establecimiento nuevo" no-results-text="Pulsa Intro para añadirlo" /><template v-if="frequentEstablishments.length"><span class="frequent-names"><button v-for="item in frequentEstablishments" :key="item.value" type="button" :class="{ active: normalizeName(draft.place || '') === normalizeName(item.value) }" @click="draft.place = item.value">{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span></template></label>
            <label><span>Ciudad</span><Multiselect v-model="draft.city" class="smart-select" :options="cityOptions" searchable create-option allow-absent :can-clear="Boolean(draft.city)" :aria="{ 'aria-label': 'Ciudad' }" placeholder="Busca o escribe una ciudad" no-options-text="Escribe una ciudad nueva" no-results-text="Pulsa Intro para añadirla" /><template v-if="frequentCities.length"><span class="frequent-names"><button v-for="item in frequentCities" :key="item.value" type="button" :class="{ active: normalizeName(draft.city || '') === normalizeName(item.value) }" @click="draft.city = item.value">{{ item.value }}<small v-if="item.count > 1">{{ item.count }}</small></button></span></template><span class="location-status"><small>{{ locationStatus }}</small><button type="button" :disabled="detectingCity" @click="detectCurrentCity"><PhCrosshair :size="14" /> {{ detectingCity ? 'Detectando…' : 'Usar mi ubicación' }}</button></span></label>
          </div>
          <fieldset><legend>{{ draft.transaction_type === 'income' ? '¿Quién lo ha recibido?' : '¿Quién lo ha pagado?' }}</legend><div class="choice-grid"><label :class="{ selected: draft.paid_by_type === 'person' }"><input v-model="draft.paid_by_type" type="radio" value="person" /><PhWallet :size="22" /><span><strong>Una persona</strong><small>{{ draft.transaction_type === 'income' ? 'Selecciona quién recibió el dinero' : 'Selecciona quién adelantó el dinero' }}</small></span></label><label :class="{ selected: draft.paid_by_type === 'all' }"><input v-model="draft.paid_by_type" type="radio" value="all" /><PhUsers :size="22" /><span><strong>Entre todos</strong><small>Corresponde al grupo en conjunto</small></span></label></div><select v-if="draft.paid_by_type === 'person'" v-model="draft.paid_by_uid" class="member-select"><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option></select><label class="payment-method-field"><span>Método de pago</span><select v-model="draft.payment_method" class="member-select"><option v-if="draft.payment_method === 'unspecified'" value="unspecified">Sin especificar</option><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option></select></label></fieldset>
          <fieldset><legend>{{ draft.transaction_type === 'income' ? '¿A quién corresponde?' : '¿A quién se aplica?' }}</legend><div class="choice-grid"><label :class="{ selected: draft.applies_to_all }"><input v-model="draft.applies_to_all" type="radio" :value="true" /><PhUsers :size="22" /><span><strong>A todo el grupo</strong><small>Se reparte por igual</small></span></label><label :class="{ selected: !draft.applies_to_all }"><input v-model="draft.applies_to_all" type="radio" :value="false" /><PhCheck :size="22" /><span><strong>Solo a algunas</strong><small>Elige las personas</small></span></label></div><div v-if="!draft.applies_to_all" class="check-members"><label v-for="member in memberOptions" :key="member.uid"><input v-model="draft.participant_uids" type="checkbox" :value="member.uid" /><span class="avatar">{{ (member.name || member.email).slice(0, 1).toUpperCase() }}</span>{{ member.name || member.email }}</label></div></fieldset>
          <fieldset class="split-fieldset"><legend>Cómo repartir {{ money(draft.amount) }}</legend><div class="choice-grid split-modes"><label :class="{ selected: draft.share_mode === 'equal' }"><input :checked="draft.share_mode === 'equal'" type="radio" @change="setShareMode('equal')" /><span><strong>Por igual</strong></span></label><label :class="{ selected: draft.share_mode === 'amount' }"><input :checked="draft.share_mode === 'amount'" type="radio" @change="setShareMode('amount')" /><span><strong>Por cantidad</strong></span></label><label :class="{ selected: draft.share_mode === 'percent' }"><input :checked="draft.share_mode === 'percent'" type="radio" @change="setShareMode('percent')" /><span><strong>Por porcentaje</strong></span></label></div><div v-if="draft.share_mode !== 'equal'" class="share-editor"><label v-for="member in splitMembers" :key="member.uid"><span>{{ member.name || member.email }}</span><div class="money-input"><input v-model="draft.participant_shares[member.uid]" type="number" min="0" max="99999999" step="0.01" :aria-label="`Parte de ${member.name || member.email}`" /><b>{{ draft.share_mode === 'percent' ? '%' : '€' }}</b></div></label><small>{{ draft.share_mode === 'percent' ? 'Los porcentajes deben sumar 100 %.' : 'Las cantidades deben sumar el importe total.' }}</small></div></fieldset>
          <div class="form-grid details-grid">
            <label class="full"><span>Detalles</span><textarea v-model="draft.details" maxlength="1000" rows="3" placeholder="Añade notas o información adicional…"></textarea></label>
            <label class="full tag-field"><span>Etiquetas</span><div class="tag-entry"><input v-model="tagInput" maxlength="40" placeholder="Escribe una etiqueta y pulsa Intro" @keydown.enter.prevent="addDraftTag()" /><button type="button" class="secondary" :disabled="!tagInput.trim() || draft.tags.length >= 10" @click="addDraftTag()">Añadir</button></div><div v-if="draft.tags.length" class="selected-tags"><button v-for="tag in draft.tags" :key="tag" type="button" @click="draft.tags = draft.tags.filter((item) => item !== tag)">{{ tag }} <PhX :size="13" /></button></div><div v-if="tagOptions.length" class="tag-suggestions"><span>Usadas recientemente</span><button v-for="tag in tagOptions.filter((item) => !draft.tags.includes(item)).slice(0, 8)" :key="tag" type="button" @click="addDraftTag(tag)">{{ tag }}</button></div></label>
            <label v-if="!draft.id" class="full"><span>Repetir automáticamente</span><select v-model="draft.recurrence"><option value="none">No repetir</option><option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select></label>
          </div>
          <footer><button v-if="draft.id" type="button" class="danger-button modal-delete" @click="deleteTarget = { id: draft.id, name: draft.name, transaction_type: draft.transaction_type }">Eliminar {{ draft.transaction_type === 'income' ? 'ingreso' : 'gasto' }}</button><button type="button" class="ghost" @click="closeExpenseModal">Cancelar</button><button class="primary" :disabled="saving"><PhCheck :size="18" weight="bold" /> {{ saving ? 'Guardando…' : `Guardar ${draft.transaction_type === 'income' ? 'ingreso' : 'gasto'}` }}</button></footer>
          </template>
        </form>
        <section v-if="expenseHistoryForId === Number(draft.id) && draft.id" class="expense-history-panel" aria-live="polite" aria-label="Historial de cambios">
          <header class="expense-history-heading"><div><p class="eyebrow">AUDITORÍA</p><h2>Historial de cambios</h2></div><button type="button" class="icon-button" aria-label="Cerrar historial" @click="expenseHistoryForId = 0"><PhX :size="19" /></button></header>
          <div v-if="expenseHistoryLoading" class="expense-history-empty"><span class="loader"></span><p>Cargando cambios…</p></div>
          <div v-else-if="!expenseHistoryEntries.length" class="expense-history-empty"><PhClockCounterClockwise :size="24" /><p>Aún no hay cambios registrados para este movimiento. Guardaremos los cambios que se hagan a partir de ahora.</p></div>
          <ol v-else class="expense-history-list">
            <li v-for="entry in expenseHistoryEntries" :key="entry.id" class="expense-history-entry">
              <div class="expense-history-entry-heading"><span class="expense-history-event" :class="entry.event_type">{{ entry.event_type === 'created' ? 'Creado' : entry.event_type === 'deleted' ? 'Eliminado' : 'Actualizado' }}</span><time>{{ dateLabel(entry.created_at) }}</time></div>
              <p class="expense-history-actor">{{ entry.actor_name || 'Miembro' }} <span v-if="entry.event_type === 'created'">creó el movimiento</span><span v-else-if="entry.event_type === 'deleted'">eliminó el movimiento</span><span v-else>hizo cambios</span></p>
              <dl v-if="historyChangeEntries(entry).length" class="expense-history-changes">
                <div v-for="change in historyChangeEntries(entry)" :key="change.field"><dt>{{ change.label }}</dt><dd><span v-if="change.from !== null && change.from !== undefined" class="history-old-value">{{ historyValue(change.field, change.from) }}</span><PhArrowRight v-if="change.from !== null && change.from !== undefined && change.to !== null && change.to !== undefined" :size="13" /><strong v-if="change.to !== null && change.to !== undefined">{{ historyValue(change.field, change.to) }}</strong><span v-if="change.from === null && change.to === null" class="muted">Sin valor</span></dd></div>
              </dl>
            </li>
          </ol>
        </section>
      </section>
    </div>

    <div v-if="settlementTarget" class="modal-backdrop" @mousedown.self="settlementTarget = null">
      <section class="modal settlement-modal" role="dialog" aria-modal="true" aria-labelledby="settlement-title">
        <header><p class="eyebrow modal-title" id="settlement-title">Registrar un pago</p><button class="icon-button" aria-label="Cerrar" @click="settlementTarget = null"><PhX :size="22" /></button></header>
        <p v-if="error" class="inline-error modal-error">{{ error }}</p>
        <form @submit.prevent="saveSettlement">
          <label><span>Quién paga *</span><select v-model="settlementDraft.payer_uid" required><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option></select></label>
          <label><span>Quién recibe *</span><select v-model="settlementDraft.payee_uid" required><option v-for="member in memberOptions" :key="member.uid" :value="member.uid">{{ member.name || member.email }}</option></select></label>
          <label><span>Importe pagado (máximo {{ money(settlementTarget.amount) }}) *</span><div class="money-input"><input v-model="settlementDraft.amount" type="number" min="0.01" :max="settlementTarget.amount" step="0.01" required /><b>€</b></div></label>
          <label><span>Método de pago *</span><select v-model="settlementDraft.payment_method" required><option v-for="method in paymentMethods" :key="method.value" :value="method.value">{{ method.label }}</option></select></label>
          <footer><button type="button" class="ghost" @click="settlementTarget = null">Cancelar</button><button class="primary" :disabled="saving"><PhCheck :size="18" /> Guardar pago</button></footer>
        </form>
      </section>
    </div>

    <div v-if="iconPickerOpen" class="icon-picker-backdrop" @mousedown.self="closeIconPicker">
      <section class="icon-picker-modal" role="dialog" aria-modal="true" aria-labelledby="icon-picker-title" @mousedown.stop>
        <header class="icon-picker-header"><div><p id="icon-picker-title" class="eyebrow modal-title">Elige un icono</p><p>Busca en todas las colecciones o explora una biblioteca por categorías.</p></div><button type="button" class="icon-button" aria-label="Cerrar selector de iconos" @click="closeIconPicker"><PhX :size="22" /></button></header>
        <div class="icon-picker-content">
          <label class="icon-picker-search"><PhMagnifyingGlass :size="19" /><input v-model="iconPickerSearch" type="search" aria-label="Buscar iconos en Iconify" placeholder="Buscar iconos, por ejemplo café, casa o transporte…" autofocus /></label>
          <p v-if="iconPickerSearch.trim().length === 1" class="icon-picker-hint">Escribe al menos dos letras para buscar en Iconify.</p>
          <div v-if="iconPickerSearch.trim().length >= 2" class="icon-picker-results">
            <p v-if="iconPickerResults.length" class="icon-picker-count">{{ iconPickerResults.length }} iconos encontrados · {{ iconPickerSearch.trim() }}</p>
            <div class="icon-picker-grid">
              <button v-for="icon in iconPickerResults" :key="icon" type="button" class="icon-picker-option" :class="{ selected: iconPickerTarget?.icon === icon }" :title="icon" @click="chooseIcon(icon)"><iconify-icon :icon="icon"></iconify-icon><span>{{ iconPickerSearchCollections[icon.split(':')[0]] || icon.split(':')[0] }} · {{ icon.split(':')[1] }}</span></button>
            </div>
            <button v-if="iconPickerSearchHasMore" type="button" class="icon-picker-more" :disabled="iconPickerLoading" @click="loadMoreIconPickerSearchResults">Mostrar más resultados</button>
            <p v-if="!iconPickerLoading && !iconPickerResults.length && !iconPickerError" class="icon-picker-empty">No hay iconos con ese nombre. Prueba con otra búsqueda.</p>
          </div>
          <template v-else>
            <div class="icon-picker-browse-controls">
              <label><span>Categoría de colecciones</span><select :value="iconPickerCollectionCategory" @change="setIconPickerCategory($event.target.value)"><option v-for="categoryName in iconPickerCollectionCategories" :key="categoryName" :value="categoryName">{{ categoryName }}</option></select></label>
              <label><span>Colección</span><select :value="iconPickerCollection" @change="setIconPickerCollection($event.target.value)"><option v-for="collection in iconPickerVisibleCollections" :key="collection.prefix" :value="collection.prefix">{{ collection.name }} · {{ collection.total.toLocaleString('es-ES') }}</option></select></label>
            </div>
            <p v-if="iconPickerData?.title" class="icon-picker-count">{{ iconPickerData.title }} · {{ (iconPickerData.total || 0).toLocaleString('es-ES') }} iconos</p>
            <div v-if="iconPickerGroups.length" class="icon-picker-groups">
              <section v-for="groupItem in iconPickerGroups" :key="groupItem.label" class="icon-picker-group"><h3>{{ groupItem.label }}</h3><div class="icon-picker-grid"><button v-for="name in groupItem.names" :key="name" type="button" class="icon-picker-option" :class="{ selected: iconPickerTarget?.icon === `${iconPickerCollection}:${name}` }" :title="`${iconPickerCollection}:${name}`" @click="chooseIcon(`${iconPickerCollection}:${name}`)"><iconify-icon :icon="`${iconPickerCollection}:${name}`"></iconify-icon><span>{{ name }}</span></button></div></section>
            </div>
            <button v-if="iconPickerData && iconPickerGroups.reduce((total, groupItem) => total + groupItem.remaining, 0)" type="button" class="icon-picker-more" @click="iconPickerLimit += 240">Mostrar más iconos</button>
          </template>
          <div v-if="iconPickerLoading" class="icon-picker-status"><span class="loader"></span><span>{{ iconPickerSearch.trim().length >= 2 ? 'Buscando iconos…' : 'Cargando iconos…' }}</span></div>
          <p v-if="iconPickerError" class="icon-picker-error" role="alert">{{ iconPickerError }}</p>
        </div>
      </section>
    </div>

    <div v-if="recurringDeleteTarget" class="modal-backdrop" @mousedown.self="recurringDeleteTarget = null"><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="recurring-delete-title"><span class="danger-mark"><PhTrash :size="25" /></span><p id="recurring-delete-title" class="eyebrow modal-title">Eliminar programación</p><p>“{{ recurringDeleteTarget.name }}” dejará de generar nuevos movimientos; los ya creados se conservarán.</p><div><button class="ghost" @click="recurringDeleteTarget = null">Cancelar</button><button class="danger-button" :disabled="saving" @click="removeRecurring">Sí, eliminar</button></div></section></div>
    <div v-if="tagDeleteTarget" class="modal-backdrop" @mousedown.self="tagDeleteTarget = null"><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="tag-delete-title"><span class="danger-mark"><PhTrash :size="25" /></span><p id="tag-delete-title" class="eyebrow modal-title">Eliminar etiqueta</p><p>“{{ tagDeleteTarget.name }}” se quitará de los movimientos asociados, pero no eliminará esos movimientos.</p><div><button class="ghost" @click="tagDeleteTarget = null">Cancelar</button><button class="danger-button" :disabled="saving" @click="removeTag">Sí, eliminar</button></div></section></div>
    <div v-if="deleteTarget" class="modal-backdrop" @mousedown.self="deleteTarget = null"><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-delete-title"><span class="danger-mark"><PhTrash :size="25" /></span><p id="expense-delete-title" class="eyebrow modal-title">Eliminar movimiento</p><p>“{{ deleteTarget.name }}” desaparecerá del grupo y de las estadísticas.</p><div><button class="ghost" @click="deleteTarget = null">Cancelar</button><button class="danger-button" :disabled="saving" @click="removeExpense">Sí, eliminar</button></div></section></div>
  </div>
</template>
