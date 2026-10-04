import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import '@vueform/multiselect/themes/default.css'
import './styles.css'
import { addIcon } from 'iconify-icon'
import { offlineIcons } from './domain/offlineIcons.js'
import { registerServiceWorker } from './pwa.js'

Object.entries(offlineIcons).forEach(([name, data]) => addIcon(name, data))
createApp(App).use(router).mount('#app')
registerServiceWorker()
