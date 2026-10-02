import { computed, ref, toValue } from 'vue'

const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

export function useDataSearch(items, searchText) {
  const search = ref('')
  const filteredItems = computed(() => {
    const terms = normalizeSearch(search.value).split(/\s+/).filter(Boolean)
    return (toValue(items) || []).filter(item => {
      const text = normalizeSearch(searchText(item))
      return terms.every(term => text.includes(term))
    })
  })
  return { search, filteredItems }
}
