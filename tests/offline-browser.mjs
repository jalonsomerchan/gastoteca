import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { loadEnv } from 'vite'

// Run against npm run preview. All authentication and API traffic uses synthetic accounts.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')
const env = loadEnv('production', process.cwd())
const base = process.env.TEST_PREVIEW_URL || 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const messages = []
const group = { id: 1, name: 'Grupo sin conexión', owner_uid: 'offline-test', members: [{ uid: 'offline-test', name: 'Prueba', email: 'offline@example.test' }, { uid: 'bob', name: 'Roberto' }], invite_code: 'TEST', category_labels: {}, category_icons: {}, category_keys: {}, custom_categories: [], establishments: [], tags: [], budgets: [], recurring: [], debts: [] }
let expenses = []
let nextId = 1
let requests = 0
let outage = false
const receipts = new Map()
const token = () => {
  const now = Math.floor(Date.now() / 1000)
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: 'offline-test', user_id: 'offline-test', aud: env.VITE_FIREBASE_PROJECT_ID, iss: `https://securetoken.google.com/${env.VITE_FIREBASE_PROJECT_ID}`, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'google.com' } })}.test`
}
const stats = () => ({ total: expenses.reduce((sum, item) => sum + item.amount, 0), count: expenses.length, average: 0, current_month_total: 0, by_category: [], by_member: [], by_participant: [], by_title: [], by_establishment: [], by_payment_method: [], monthly: [] })
const snapshot = () => ({ group, expenses, settlements: [], stats: stats(), user_uid: 'offline-test', offline_sync_version: 1 })
await context.route('https://identitytoolkit.googleapis.com/**', route => route.fulfill({ json: { users: [{ localId: 'offline-test', email: 'offline@example.test', displayName: 'Prueba', emailVerified: true, providerUserInfo: [{ providerId: 'google.com', rawId: 'offline-test', displayName: 'Prueba', email: 'offline@example.test' }] }] } }))
await context.route('https://securetoken.googleapis.com/**', route => route.fulfill({ json: { access_token: token(), expires_in: '3600', refresh_token: 'test-refresh', token_type: 'Bearer', user_id: 'offline-test', project_id: env.VITE_FIREBASE_PROJECT_ID } }))
await context.route('https://alon.one/api/**', async route => {
  requests++
  if (outage) return route.fulfill({ status: 503, json: { ok: false, message: 'Servidor en mantenimiento.' } })
  const action = new URL(route.request().url()).pathname.split('/').pop()
  let data
  if (action === 'sync_operation') {
    const operation = route.request().postDataJSON()
    if (receipts.has(operation.operation_id)) data = receipts.get(operation.operation_id)
    else {
      if (operation.action !== 'save_expense') throw new Error(`Unexpected mutation: ${operation.action}`)
      const draft = operation.body
      const id = draft.id || nextId++
      const expense = { ...draft, id, amount: Number(draft.amount), occurred_at: draft.occurred_at.replace('T', ' '), participant_uids: group.members.map(member => member.uid), participants: group.members.map(member => ({ uid: member.uid, share_amount: Number(draft.amount) / group.members.length })), confirmation_pending: false, created_by: 'offline-test', updated_at: '2026-10-04 12:00:00' }
      expenses = [expense, ...expenses.filter(item => item.id !== id)]
      data = { data: snapshot(), entity_id: id, replayed: false }
      receipts.set(operation.operation_id, data)
    }
  } else if (['bootstrap', 'group', 'expenses', 'expense_feed'].includes(action)) data = snapshot()
  else if (action === 'statistics') data = { stats: stats() }
  else if (action === 'notifications') data = { notifications: [], unread_count: 0 }
  else if (action === 'quick_expense_templates') data = { templates: [] }
  else if (action === 'backup_settings') data = { frequency: 'disabled', time: '09:00', weekday: 1, monthday: 1 }
  else if (action === 'summary_settings') data = { schedules: {} }
  else if (action === 'telegram_status') data = { telegram: { connected: false } }
  else data = { notification_types: [], telegram_configured: false }
  return route.fulfill({ json: { ok: true, data } })
})
await context.addInitScript(({ apiKey, accessToken }) => {
  if (!localStorage.getItem(`firebase:authUser:${apiKey}:[DEFAULT]`)) localStorage.setItem(`firebase:authUser:${apiKey}:[DEFAULT]`, JSON.stringify({ uid: 'offline-test', email: 'offline@example.test', emailVerified: true, displayName: 'Prueba', isAnonymous: false, providerData: [{ providerId: 'google.com', uid: 'offline-test', displayName: 'Prueba', email: 'offline@example.test', photoURL: null }], stsTokenManager: { refreshToken: 'test-refresh', accessToken, expirationTime: Date.now() + 3600000 }, createdAt: '1791115200000', lastLoginAt: '1791115200000', apiKey, appName: '[DEFAULT]' }))
}, { apiKey: env.VITE_FIREBASE_API_KEY, accessToken: token() })
try {
  const page = await context.newPage()
  page.on('pageerror', error => messages.push(error.message))
  page.on('console', message => { if (['error', 'warning'].includes(message.type()) && !message.text().startsWith('Failed to load resource:')) messages.push(message.text()) })
  page.on('requestfailed', request => { if (request.url().startsWith(base)) console.log('Failed:', request.url(), request.failure()?.errorText) })
  await page.goto(base)
  await page.getByRole('heading', { name: 'Movimientos', exact: true }).waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.getByRole('heading', { name: 'Movimientos', exact: true }).waitFor()
  await context.setOffline(true)
  await page.getByText('Sin conexión', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Nuevo movimiento', exact: true }).click()
  await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Gasto Dinero que ha salido', exact: true }) }).click()
  await page.getByLabel('Nombre del gasto', { exact: true }).fill('Compra offline en navegador')
  await page.locator('dialog[open] input[type="number"]').first().fill('12.34')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByText('Compra offline en navegador', { exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelector('.category-icon iconify-icon')?.shadowRoot?.querySelector('svg'))
  await page.getByText(/1 cambio guardado en este dispositivo/).waitFor()
  await page.reload()
  await page.getByText('Compra offline en navegador', { exact: true }).waitFor()
  for (const path of ['/deudas', '/balance', '/estadisticas', '/presupuestos', '/recurrentes', '/etiquetas', '/establecimientos', '/categorias', '/gastos-rapidos', '/edicion-masiva', '/importar', '/grupo', '/ajustes']) {
    await page.goto(`${base}${path}`)
    try { await page.locator('main h1').waitFor({ timeout: 12000 }) } catch (reason) {
      await page.screenshot({ path: '/private/tmp/gastoteca-offline-failure.png', fullPage: true })
      console.log(JSON.stringify({ path, errors: messages, text: await page.locator('body').innerText(), caches: await page.evaluate(async () => ({ keys: await caches.keys(), cached: await Promise.all((await caches.keys()).map(async key => ({ key, urls: (await (await caches.open(key)).keys()).map(request => request.url) }))) })) }))
      throw reason
    }
    assert.equal(await page.getByText('Volver a cargar', { exact: true }).count(), 0, path)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} mobile`)
    await page.setViewportSize({ width: 1280, height: 900 })
  }
  await page.goto(base)
  await page.getByText('Compra offline en navegador', { exact: true }).waitFor()
  await page.screenshot({ path: '/private/tmp/gastoteca-offline-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/private/tmp/gastoteca-offline-mobile.png', fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await context.setOffline(false)
  await page.getByText(/cambio guardado en este dispositivo/).waitFor({ state: 'hidden' })
  assert.equal(expenses.length, 1)
  assert.equal(receipts.size, 1)
  outage = true
  await page.reload()
  await page.getByText('El servidor no responde', { exact: true }).waitFor()
  await page.getByText('Compra offline en navegador', { exact: true }).waitFor()
  assert.equal(expenses.length, 1)
  await page.getByRole('button', { name: 'Nuevo movimiento', exact: true }).click()
  await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Gasto Dinero que ha salido', exact: true }) }).click()
  await page.getByLabel('Nombre del gasto', { exact: true }).fill('Gasto con servidor caído')
  await page.locator('dialog[open] input[type="number"]').first().fill('8.21')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByText('Gasto con servidor caído', { exact: true }).waitFor()
  await page.getByText(/1 cambio guardado en este dispositivo/).waitFor()
  assert.equal(expenses.length, 1)
  outage = false
  await page.getByRole('button', { name: 'Reintentar conexión y sincronizar', exact: true }).click()
  await page.getByText(/cambio guardado en este dispositivo/).waitFor({ state: 'hidden' })
  assert.equal(expenses.length, 2)
  assert.equal(receipts.size, 2)
  assert.deepEqual(messages, [])
  console.log(JSON.stringify({ passed: true, apiRequests: requests, uniqueMutations: receipts.size, offlineRoutes: 13, screenshots: ['/private/tmp/gastoteca-offline-desktop.png', '/private/tmp/gastoteca-offline-mobile.png'] }))
} finally { await context.close(); await browser.close() }
