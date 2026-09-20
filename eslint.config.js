import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'

export default defineConfig([
  { files: ['**/*.{vue,js,mjs}'] },
  globalIgnores(['**/dist/**', '**/node_modules/**']),
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
])
