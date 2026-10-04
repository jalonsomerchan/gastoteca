const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'alonsoftware',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}
let authPromise

export const hasFirebaseConfig = () => Boolean(config.apiKey && config.authDomain && config.appId)

export async function getFirebaseAuth() {
  authPromise ||= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appModule, authModule]) => {
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config)
    return { auth: authModule.getAuth(app), authModule }
  }).catch(reason => { authPromise = null; throw reason })
  return authPromise
}

export async function observeAuth(callback) {
  const { auth, authModule } = await getFirebaseAuth()
  return authModule.onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle() {
  const { auth, authModule } = await getFirebaseAuth()
  const provider = new authModule.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return authModule.signInWithPopup(auth, provider)
}

export async function signOut() {
  const { auth, authModule } = await getFirebaseAuth()
  return authModule.signOut(auth)
}
