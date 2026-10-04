import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

function offlineBuild() {
  let assets = []
  let outDir
  return {
    name: 'gastoteca-offline-precache',
    apply: 'build',
    configResolved: config => { outDir = config.build.outDir },
    generateBundle: (options, bundle) => { assets = Object.keys(bundle).filter(path => path !== 'index.html') },
    async closeBundle() {
      const template = await readFile(new URL('./public/sw.js', import.meta.url), 'utf8')
      const index = await readFile(`${outDir}/index.html`, 'utf8')
      const version = createHash('sha256').update(index + template + JSON.stringify(assets)).digest('hex').slice(0, 16)
      await writeFile(`${outDir}/sw.js`, template.replace('__BUILD_VERSION__', version).replace("'__PRECACHE_ASSETS__'", JSON.stringify(assets)))
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'iconify-icon' } } }), offlineBuild()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
