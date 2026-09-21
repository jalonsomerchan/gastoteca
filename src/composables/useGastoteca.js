import { useGroupCatalogs } from './useGroupCatalogs.js'
import { createGastotecaState } from '../state/createGastotecaState.js'
import { useRoute, useRouter } from 'vue-router'
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { notificationOptions, paymentMethods, paymentMethodLabel } from '../domain/catalogs.js'
import { money, dateLabel, notificationDateLabel, monthLabel, expenseLocation } from '../utils/formatters.js'
import { getJson, postJson } from '../lib/api.js'
import { signInWithGoogle, hasFirebaseConfig, observeAuth, signOut } from '../lib/firebase.js'
import { navigationItems } from '../config/navigation.js'
import { useIconPicker } from './useIconPicker.js'
import { useBalances } from './useBalances.js'
import { useExpenseSuggestions } from './useExpenseSuggestions.js'
import { useLocation } from './useLocation.js'
import { useNotifications } from './useNotifications.js'
import { useExpenses } from './useExpenses.js'
import { useSettlements } from './useSettlements.js'
import { useBudgets } from './useBudgets.js'
import { useRecurring } from './useRecurring.js'
import { useTags } from './useTags.js'
import { useNotificationSettings } from './useNotificationSettings.js'
import { useGroup } from './useGroup.js'

// One instance per application. Feature modules receive explicit reactive dependencies.
export function useGastoteca() {
  const route = useRoute()
  const router = useRouter()
  const {
    brandIconUrl,
    menuOpen,
    loading,
    routeLoading,
    signingIn,
    saving,
    user,
    token,
    error,
    notice,
    expenses,
    settlements,
    notifications,
    unreadNotificationCount,
    notificationsOpen,
    markingNotificationIds,
    markingAllNotifications,
    group,
    stats,
    modalOpen,
    quickExpenseMode,
    quickAmount,
    quickAmountInput,
    tagInput,
    deleteTarget,
    settlementTarget,
    recurringDeleteTarget,
    tagDeleteTarget,
    expenseHistoryForId,
    expenseHistoryEntries,
    expenseHistoryLoading,
    settlementDraft,
    budgetDraft,
    tagDraft,
    telegramNotificationTypes,
    appNotificationTypes,
    telegramConfigured,
    telegramConnected,
    telegramUsername,
    telegramLinkUrl,
    telegramSaving,
    notificationSaving,
    filters,
    filtersOpen,
    visibleExpenseCount,
    loadMoreSentinel,
    inviteEmail,
    inviteSending,
    joinCode,
    defaultCityDraft,
    defaultPaymentMethodDraft,
    detectingCity,
    locationStatus,
    detectedCity,
    catalogDraft,
    emptyDraft,
    draft,
    recurringDraft,
  } = createGastotecaState()
  const routeLoadFailed = ref(false)
  let expenseObserver = null
  let routeDataRequestId = 0
  let notificationsPollTimer = null
  let unsubscribeAuth = null
  let disposed = false
  let noticeTimer = null

  const filteredExpenses = computed(() => expenses.value.filter((expense) => {
    const term = filters.search.trim().toLowerCase()
    return (!term || `${expense.name} ${expense.details || ''} ${expense.place} ${expense.city || ''} ${(expense.tags || []).join(' ')}`.toLowerCase().includes(term)) &&
      (!filters.category || expense.category === filters.category) &&
      (!filters.from || expense.occurred_at.slice(0, 10) >= filters.from) &&
      (!filters.to || expense.occurred_at.slice(0, 10) <= filters.to)
  }))

  const visibleExpenses = computed(() => filteredExpenses.value.slice(0, visibleExpenseCount.value))
  const hasMoreExpenses = computed(() => visibleExpenseCount.value < filteredExpenses.value.length)
  const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length)

  function flash(message) {
    notice.value = message
    window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => { if (notice.value === message) notice.value = '' }, 8000)
  }

  function clearFilters() {
    Object.assign(filters, { search: '', category: '', from: '', to: '' })
  }
  const {
    categories,
    memberOptions,
    currentMember,
    maxCategoryTotal,
    budgetSummary,
    categoryOptions,
    tagOptions,
    splitMembers,
    recurringSplitMembers,
    cityOptions,
    establishmentOptions,
    catalogEstablishments,
    category,
    memberLabel,
    establishmentIcon,
  } = useGroupCatalogs({
    group,
    user,
    stats,
    draft,
    recurringDraft,
    detectedCity,
    expenses,
  })
  const { iconPickerOpen, iconPickerTarget, iconPickerSearch, iconPickerCollectionCategory, iconPickerCollection, iconPickerData, iconPickerResults, iconPickerSearchHasMore, iconPickerLoading, iconPickerError, iconPickerLimit, iconPickerCollectionCategories, iconPickerVisibleCollections, iconPickerGroups, iconPickerSearchCollections, openIconPicker, setIconPickerCategory, setIconPickerCollection, chooseIcon, loadMoreIconPickerSearchResults, closeIconPicker } = useIconPicker()
  const {
    balanceSummary,
    netBalance,
    netBalanceTitle,
    balanceBreakdown,
  } = useBalances({
    expenses,
    settlements,
    user,
  })
  const { frequentNames, frequentEstablishments, frequentCities } = useExpenseSuggestions({ expenses, draft })
  const { detectCurrentCity } = useLocation({ detectedCity, draft, locationStatus, detectingCity, group })
  const {
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    openNotification,
  } = useNotifications({
    user,
    freshToken,
    notifications,
    unreadNotificationCount,
    markingNotificationIds,
    error,
    markingAllNotifications,
    notificationsOpen,
    menuOpen,
    route,
    router,
  })
  const {
    openExpense,
    closeExpenseModal,
    loadExpenseHistory,
    historyChangeEntries,
    historyValue,
    startQuickExpense,
    saveQuickExpense,
    selectFrequentName,
    setShareMode,
    shareValue,
    addDraftTag,
    saveExpense,
    removeExpense,
  } = useExpenses({
    error,
    expenseHistoryForId,
    expenseHistoryEntries,
    quickExpenseMode,
    quickAmount,
    tagInput,
    draft,
    emptyDraft,
    currentMember,
    memberOptions,
    group,
    modalOpen,
    locationStatus,
    expenseHistoryLoading,
    freshToken,
    category,
    memberLabel,
    quickAmountInput,
    saving,
    expenses,
    stats,
    settlements,
    flash,
    splitMembers,
    deleteTarget,
  })
  const {
    openSettlement,
    saveSettlement,
  } = useSettlements({
    settlementTarget,
    settlementDraft,
    user,
    group,
    error,
    saving,
    freshToken,
    settlements,
    flash,
  })
  const { saveBudget, deleteBudget } = useBudgets({ error, saving, freshToken, budgetDraft, group, flash })
  const {
    toggleRecurring,
    startRecurringRule,
    resetRecurringShares,
    setRecurringShareMode,
    saveRecurring,
    removeRecurring,
  } = useRecurring({
    freshToken,
    group,
    flash,
    error,
    memberOptions,
    recurringDraft,
    emptyDraft,
    currentMember,
    recurringSplitMembers,
    saving,
    recurringDeleteTarget,
  })
  const { saveTag, removeTag } = useTags({ error, tagDraft, saving, freshToken, group, flash, tagDeleteTarget })
  const {
    saveTelegramSettings,
    saveNotificationSettings,
    beginTelegramLink,
    refreshTelegramStatus,
  } = useNotificationSettings({
    telegramSaving,
    error,
    freshToken,
    telegramNotificationTypes,
    flash,
    notificationSaving,
    appNotificationTypes,
    telegramLinkUrl,
    telegramConfigured,
    telegramConnected,
    telegramUsername,
  })
  const {
    invite,
    saveGroupSettings,
    prepareCatalogDraft,
    saveCatalogIcons,
    saveCatalogItem,
    joinGroup,
    leaveGroup,
  } = useGroup({
    inviteEmail,
    error,
    inviteSending,
    freshToken,
    group,
    flash,
    saving,
    defaultCityDraft,
    defaultPaymentMethodDraft,
    catalogDraft,
    catalogEstablishments,
    categories,
    joinCode,
    expenses,
    stats,
    settlements,
    loadNotifications,
  })

  // Location is requested only from the explicit 'Usar mi ubicación' action.

  async function freshToken(force = false) {
    if (!user.value) throw new Error('Debes iniciar sesión.')
    token.value = await user.value.getIdToken(force)
    return token.value
  }

  async function loadRouteData(routeName) {
    if (!user.value) return

    const requestId = ++routeDataRequestId
    routeLoading.value = true
    routeLoadFailed.value = false
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
      if (requestId === routeDataRequestId && route.name === routeName) {
        error.value = reason.message
        routeLoadFailed.value = true
      }
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

  watch(() => route.name, () => {
    menuOpen.value = false
    notificationsOpen.value = false
    error.value = ''
    if (route.name === 'establishments' || route.name === 'categories') prepareCatalogDraft()
    window.scrollTo({ top: 0, behavior: 'instant' })
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
    if (!element || typeof IntersectionObserver === 'undefined') return
    expenseObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMoreExpenses.value) visibleExpenseCount.value += 20
    }, { rootMargin: '300px 0px' })
    expenseObserver.observe(element)
  })

  onBeforeUnmount(() => {
    disposed = true
    unsubscribeAuth?.()
    window.clearTimeout(noticeTimer)
    expenseObserver?.disconnect()
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
    if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return
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
      unsubscribeAuth = await observeAuth(async (firebaseUser) => {
        if (disposed) return
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
      if (disposed) unsubscribeAuth()
    } catch (reason) {
      error.value = reason.message
      loading.value = false
    }
  })
  return {
    routeLoadFailed,
    retryRouteLoad: () => loadRouteData(route.name),
    loadMoreExpenses: () => { visibleExpenseCount.value += 20 },
    signOut,
    route,
    router,
    brandIconUrl,
    menuOpen,
    loading,
    routeLoading,
    signingIn,
    saving,
    user,
    error,
    notice,
    expenses,
    settlements,
    notifications,
    unreadNotificationCount,
    notificationsOpen,
    markingNotificationIds,
    markingAllNotifications,
    group,
    stats,
    modalOpen,
    quickExpenseMode,
    quickAmount,
    quickAmountInput,
    tagInput,
    deleteTarget,
    settlementTarget,
    recurringDeleteTarget,
    tagDeleteTarget,
    expenseHistoryForId,
    expenseHistoryEntries,
    expenseHistoryLoading,
    settlementDraft,
    budgetDraft,
    tagDraft,
    telegramNotificationTypes,
    appNotificationTypes,
    telegramConfigured,
    telegramConnected,
    telegramUsername,
    telegramLinkUrl,
    telegramSaving,
    notificationSaving,
    filters,
    filtersOpen,
    loadMoreSentinel,
    inviteEmail,
    inviteSending,
    joinCode,
    defaultCityDraft,
    defaultPaymentMethodDraft,
    detectingCity,
    locationStatus,
    catalogDraft,
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
    notificationOptions,
    paymentMethods,
    paymentMethodLabel,
    categories,
    draft,
    memberOptions,
    recurringDraft,
    maxCategoryTotal,
    budgetSummary,
    categoryOptions,
    tagOptions,
    splitMembers,
    recurringSplitMembers,
    cityOptions,
    establishmentOptions,
    filteredExpenses,
    frequentNames,
    frequentEstablishments,
    frequentCities,
    iconPickerCollectionCategories,
    iconPickerVisibleCollections,
    iconPickerGroups,
    iconPickerSearchCollections,
    visibleExpenses,
    hasMoreExpenses,
    activeFilterCount,
    balanceSummary,
    netBalance,
    netBalanceTitle,
    balanceBreakdown,
    navigationItems,
    category,
    memberLabel,
    establishmentIcon,
    money,
    dateLabel,
    notificationDateLabel,
    monthLabel,
    expenseLocation,
    clearFilters,
    detectCurrentCity,
    markNotificationRead,
    markAllNotificationsRead,
    openNotification,
    login,
    openExpense,
    closeExpenseModal,
    loadExpenseHistory,
    historyChangeEntries,
    historyValue,
    startQuickExpense,
    saveQuickExpense,
    selectFrequentName,
    setShareMode,
    addDraftTag,
    openSettlement,
    saveSettlement,
    saveBudget,
    deleteBudget,
    toggleRecurring,
    startRecurringRule,
    resetRecurringShares,
    setRecurringShareMode,
    saveRecurring,
    removeRecurring,
    saveTag,
    removeTag,
    saveTelegramSettings,
    saveNotificationSettings,
    beginTelegramLink,
    refreshTelegramStatus,
    saveExpense,
    removeExpense,
    invite,
    saveGroupSettings,
    openIconPicker,
    setIconPickerCategory,
    setIconPickerCollection,
    chooseIcon,
    loadMoreIconPickerSearchResults,
    closeIconPicker,
    saveCatalogIcons,
    saveCatalogItem,
    joinGroup,
    leaveGroup,
    dismissHeaderMenu,
    dismissSmartSelectOutside,
    navigateTo,
  }
}
