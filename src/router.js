import { createRouter, createWebHistory } from 'vue-router'

const PageRoute = { render: () => null }

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'expenses', component: PageRoute },
    { path: '/balance', name: 'balance', component: PageRoute },
    { path: '/estadisticas', name: 'stats', component: PageRoute },
    { path: '/recurrentes', name: 'recurring', component: PageRoute },
    { path: '/etiquetas', name: 'tags', component: PageRoute },
    { path: '/establecimientos', name: 'establishments', component: PageRoute },
    { path: '/categorias', name: 'categories', component: PageRoute },
    { path: '/grupo', name: 'group', component: PageRoute },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
