import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => server.close())
const { networkRequest, ApiError } = await server.ssrLoadModule('/src/lib/api.js')

test('HTTP transport bounds both connection and response parsing time', async t => {
  let signal
  t.mock.method(globalThis, 'fetch', async (url, options) => { signal = options.signal; return new Promise(() => {}) })
  await assert.rejects(networkRequest('gastoteca/group', 'token', { timeoutMs: 15 }), reason => reason instanceof ApiError && reason.status === 0)
  assert.equal(signal.aborted, true)
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }))
  await assert.rejects(networkRequest('gastoteca/group', 'token', { timeoutMs: 15 }), reason => reason.code === 'TIMEOUT')
})

test('HTTP transport preserves auth and validation errors while identifying unusable responses', async t => {
  for (const status of [401, 403, 400, 502]) {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status, json: async () => { throw new SyntaxError('HTML instead of JSON') } }))
    await assert.rejects(networkRequest('gastoteca/group', 'token'), reason => reason.status === status)
  }
  for (const payload of [{}, null, []]) {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => payload }))
    await assert.rejects(networkRequest('gastoteca/group', 'token'), reason => reason.code === 'INVALID_RESPONSE' && reason.status === 0)
  }
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 400, json: async () => ({ ok: false, code: 'INVALID_AMOUNT', message: 'Importe inválido.' }) }))
  await assert.rejects(networkRequest('gastoteca/save_expense', 'token'), reason => reason.code === 'INVALID_AMOUNT' && reason.message === 'Importe inválido.')
})

test('HTTP transport keeps the existing JSON and bearer token contract', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /gastoteca\/save_expense$/)
    assert.equal(options.headers.Authorization, 'Bearer current-token')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { amount: 12.34 })
    return { ok: true, json: async () => ({ data: { expense: { id: 42 } } }) }
  })
  assert.deepEqual(await networkRequest('gastoteca/save_expense', 'current-token', { method: 'POST', body: JSON.stringify({ amount: 12.34 }) }), { expense: { id: 42 } })
})
