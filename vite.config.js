import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'iconify-icon' } } })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
