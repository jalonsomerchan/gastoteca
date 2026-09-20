import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './styles.css'
import { registerServiceWorker } from './pwa.js'

createApp(App).use(router).mount('#app')
registerServiceWorker()
