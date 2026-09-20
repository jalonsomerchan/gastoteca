import { ref, computed, watch, onBeforeUnmount } from 'vue'

export function useIconPicker() {
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
  onBeforeUnmount(closeIconPicker)
  return { iconPickerOpen, iconPickerTarget, iconPickerSearch, iconPickerCollections, iconPickerCollectionCategory, iconPickerCollection, iconPickerData, iconPickerResults, iconPickerSearchHasMore, iconPickerLoading, iconPickerError, iconPickerLimit, iconPickerCollectionCategories, iconPickerVisibleCollections, iconPickerGroups, iconPickerSearchCollections, iconifyJson, loadIconPickerCollection, openIconPicker, setIconPickerCategory, setIconPickerCollection, chooseIcon, loadMoreIconPickerSearchResults, closeIconPicker }
}
