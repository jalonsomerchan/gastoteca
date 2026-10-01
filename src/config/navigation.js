import { PhReceipt, PhChartDonut, PhWallet, PhLightning, PhTag, PhMapPin, PhUsers, PhGear, PhPencilSimple, PhFileArrowUp } from '@phosphor-icons/vue'

export const navigationItems = [
  { route: 'expenses', label: 'Gastos', path: '/', icon: PhReceipt },
  { route: 'stats', label: 'Estadísticas', path: '/estadisticas', icon: PhChartDonut },
  { route: 'budgets', label: 'Presupuestos', path: '/presupuestos', icon: PhWallet },
  { route: 'recurring', label: 'Recurrentes', path: '/recurrentes', icon: PhLightning },
  { route: 'group', label: 'Grupo', path: '/grupo', icon: PhUsers },
  { route: 'settings', label: 'Ajustes', path: '/ajustes', icon: PhGear },
]

export const moreNavigationItems = [
  { route: 'bulk-edit', label: 'Edición masiva', path: '/edicion-masiva', icon: PhPencilSimple },
  { route: 'quick-expenses', label: 'Gastos rápidos', path: '/gastos-rapidos', icon: PhLightning },
  { route: 'import', label: 'Importar gastos', path: '/importar', icon: PhFileArrowUp },
  { route: 'tags', label: 'Etiquetas', path: '/etiquetas', icon: PhTag },
  { route: 'categories', label: 'Categorías', path: '/categorias', icon: PhTag },
  { route: 'establishments', label: 'Establecimientos', path: '/establecimientos', icon: PhMapPin },
]
