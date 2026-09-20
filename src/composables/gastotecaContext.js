import { inject, provide } from 'vue'

const gastotecaKey = Symbol('Gastoteca')

export function provideGastoteca(application) {
  provide(gastotecaKey, application)
}

export function useGastotecaContext() {
  const application = inject(gastotecaKey)
  if (!application) throw new Error('Gastoteca components require an application provider.')
  return application
}
