import { computed, nextTick, watch } from 'vue'

const pageNames = {
  expenses: 'Movimientos', balance: 'Balance', stats: 'Estadísticas', budgets: 'Presupuestos',
  recurring: 'Gastos recurrentes', tags: 'Etiquetas', establishments: 'Establecimientos',
  categories: 'Categorías', group: 'Tu grupo', settings: 'Ajustes',
}

export function usePageAccessibility({ route, loading, routeLoading, user }) {
  const pageTitle = computed(() => user.value ? pageNames[route.name] || 'Movimientos' : 'Bienvenida')
  const busy = computed(() => loading.value || routeLoading.value)

  watch([pageTitle, busy], async ([title, isBusy]) => {
    if (typeof document === 'undefined') return
    document.title = `${title} · La Gastoteca`
    if (isBusy) return
    await nextTick()
    // Only move focus after route loading. Dialogs keep ownership of their focus.
    if (!document.querySelector('dialog[open]')) document.querySelector('#main-content')?.focus({ preventScroll: true })
  }, { immediate: true, flush: 'post' })

  return { pageTitle, pageBusy: busy }
}
