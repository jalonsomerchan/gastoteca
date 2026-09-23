import { createRouter, createWebHistory } from 'vue-router'


export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'expenses', component: () => import('./views/ExpensesView.vue') },
    { path: '/edicion-masiva', name: 'bulk-edit', component: () => import('./views/BulkEditView.vue') },
    { path: '/importar', name: 'import', component: () => import('./views/ImportView.vue') },
    { path: '/balance', name: 'balance', component: () => import('./views/BalanceView.vue') },
    { path: '/estadisticas', name: 'stats', component: () => import('./views/StatisticsView.vue') },
    { path: '/presupuestos', name: 'budgets', component: () => import('./views/BudgetsView.vue') },
    { path: '/recurrentes', name: 'recurring', component: () => import('./views/RecurringView.vue') },
    { path: '/etiquetas', name: 'tags', component: () => import('./views/TagsView.vue') },
    { path: '/establecimientos', name: 'establishments', component: () => import('./views/CatalogView.vue') },
    { path: '/categorias', name: 'categories', component: () => import('./views/CatalogView.vue') },
    { path: '/grupo', name: 'group', component: () => import('./views/GroupView.vue') },
    { path: '/ajustes', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
