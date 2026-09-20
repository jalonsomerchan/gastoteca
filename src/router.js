import { createRouter, createWebHistory } from 'vue-router'

const PageRoute = { render: () => null }

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'expenses', component: PageRoute },
    { path: '/estadisticas', name: 'stats', component: PageRoute },
    { path: '/grupo', name: 'group', component: PageRoute },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
