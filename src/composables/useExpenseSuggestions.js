import { computed } from 'vue'
import { normalizeName } from '../utils/formatters.js'
import { defaultSuggestions } from '../domain/catalogs.js'

export function useExpenseSuggestions({ expenses, draft }) {
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

  return { frequentNames, mostUsedValues, frequentEstablishments, frequentCities }
}
