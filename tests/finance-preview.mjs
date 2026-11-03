// Isolated browser QA: node tests/finance-preview.mjs
// Firebase and API are replaced only in this Vite server. No real accounts,
// database writes, Telegram deliveries or access tokens are used.
import { createServer } from 'vite'

const server = await createServer({
  server: { host: '127.0.0.1', port: 5186, strictPort: true },
  plugins: [{
    name: 'finance-qa-fixtures', enforce: 'pre',
    transform(source, id) {
      if (id.endsWith('/src/lib/firebase.js')) return `
        export const hasFirebaseConfig = () => true;
        export const observeAuth = async callback => {
          callback({ uid: 'alice', displayName: 'Alicia (prueba)', email: 'alice@example.test', getIdToken: async () => 'synthetic-token' });
          return () => {};
        };
        export const signInWithGoogle = async () => {};
        export const signOut = async () => {};
      `
      if (id.endsWith('/src/lib/api.js')) {
        const start = source.indexOf('export async function networkRequest(')
        const end = source.indexOf('export const apiRequest', start)
        return `import { mockRequest } from '/tests/fixtures/finance-api.js';\n` + source.slice(0, start) +
          'export const networkRequest = mockRequest;\n' + source.slice(end)
      }
    },
  }],
})
await server.listen()
server.printUrls()
