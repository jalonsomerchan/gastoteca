import { postJson } from '../lib/api.js'

export const summaryOptions = [
  { value: 'daily', label: 'Diario', description: 'El día anterior' },
  { value: 'weekly', label: 'Semanal', description: 'La semana anterior, de lunes a domingo' },
  { value: 'monthly', label: 'Mensual', description: 'El mes anterior completo' },
]

export function useSummaries({ summaryDraft, summaryStatus, summaryPeriod, summarySaving, summarySending, freshToken, error, flash }) {
  function applySummarySettings(data = {}) {
    for (const { value } of summaryOptions) {
      const settings = data.schedules?.[value] || {}
      Object.assign(summaryDraft[value], { enabled: Boolean(settings.enabled), time: settings.time || '09:00', weekday: settings.weekday ?? 1, monthday: settings.monthday ?? 1 })
      Object.assign(summaryStatus[value], { next_run_at: settings.next_run_at || null, last_sent_at: settings.last_sent_at || null })
    }
  }

  async function saveSummarySettings() {
    if (summarySaving.value || summarySending.value) return
    summarySaving.value = true
    error.value = ''
    try {
      const schedules = Object.fromEntries(summaryOptions.map(({ value }) => [value, { ...summaryDraft[value] }]))
      const data = await postJson('gastoteca/save_summary_settings', await freshToken(true), { schedules })
      applySummarySettings(data)
      flash('Programación de resúmenes guardada.')
    } catch (reason) { error.value = reason.message }
    finally { summarySaving.value = false }
  }

  async function sendSummaryNow() {
    if (summarySending.value || summarySaving.value) return
    const period = summaryPeriod.value
    summarySending.value = period
    error.value = ''
    try {
      const data = await postJson('gastoteca/send_summary', await freshToken(true), { period })
      summaryStatus[period].last_sent_at = data.last_sent_at
      flash('Resumen enviado a tu Telegram.')
    } catch (reason) { error.value = reason.message }
    finally { summarySending.value = '' }
  }

  return { applySummarySettings, saveSummarySettings, sendSummaryNow }
}
