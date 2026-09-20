import { builtInCategories, customCategoryColor } from '../domain/catalogs.js'
import { computed } from 'vue'
import { normalizeName } from '../utils/formatters.js'

export function useGroupCatalogs({ group, user, stats, draft, recurringDraft, detectedCity, expenses }) {
  const categories = computed(() => [
      ...builtInCategories.map((item) => ({ ...item, icon: group.value?.category_icons?.[item.id] || item.icon })),
      ...(group.value?.custom_categories || []).map((label) => ({ id: label, label, icon: group.value?.category_icons?.[label] || 'mdi:tag-outline', color: customCategoryColor(label) })),
    ])

  const memberOptions = computed(() => group.value?.members || [])

  const currentMember = computed(() => memberOptions.value.find((member) => member.uid === user.value?.uid))

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

  const catalogEstablishments = computed(() => group.value?.establishments || [])

  const category = (id) => categories.value.find((item) => item.id === id) || { id, label: id || 'Otros', icon: group.value?.category_icons?.[id] || 'mdi:tag-outline', color: '#757a78' }

  const memberLabel = (uid) => memberOptions.value.find((item) => item.uid === uid)?.name || memberOptions.value.find((item) => item.uid === uid)?.email || 'Miembro'

  const establishmentIcon = (place) => catalogEstablishments.value.find((item) => normalizeName(item.name) === normalizeName(place || ''))?.icon || ''
  return { categories, memberOptions, currentMember, maxCategoryTotal, budgetSummary, categoryOptions, tagOptions, splitMembers, recurringSplitMembers, cityOptions, establishmentOptions, catalogEstablishments, category, memberLabel, establishmentIcon }
}
