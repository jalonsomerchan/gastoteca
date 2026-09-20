import { nextTick } from 'vue'

export async function focusElement(selector) {
  await nextTick()
  if (typeof document === 'undefined') return
  document.querySelector(selector)?.focus()
}
