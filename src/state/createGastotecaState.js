import { reactive, ref } from 'vue'

// State is created per provider; never shared between application instances.
export function createGastotecaState() {
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
  const emptyDraft = () => {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    return { id: '', transaction_type: '', name: '', details: '', category: 'food', place: '', city: '', occurred_at: local, amount: '', payment_method: group.value?.default_payment_method || 'card', paid_by_type: 'person', paid_by_uid: user.value?.uid || '', applies_to_all: true, participant_uids: [], participant_shares: {}, share_mode: 'equal', tags: [], recurrence: 'none', is_quick: false }
  }
  const draft = reactive(emptyDraft())
  const recurringDraft = reactive({ id: '', transaction_type: 'expense', name: '', amount: '', category: 'bills', frequency: 'monthly', next_at: emptyDraft().occurred_at, payment_method: group.value?.default_payment_method || 'card', paid_by_type: 'person', paid_by_uid: user.value?.uid || '', applies_to_all: true, participant_uids: [], participant_shares: {}, share_mode: 'equal', tags: [] })

  return {
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
  }
}
