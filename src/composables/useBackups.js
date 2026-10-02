import { postJson } from '../lib/api.js'

export function useBackups({ backupDraft, backupStatus, backupSaving, backupSending, freshToken, error, flash }) {
  function applyBackupSettings(data = {}) {
    Object.assign(backupDraft, {
      frequency: data.frequency || 'disabled', time: data.time || '09:00',
      weekday: data.weekday ?? 1, monthday: data.monthday ?? 1,
    })
    Object.assign(backupStatus, { next_run_at: data.next_run_at || null, last_sent_at: data.last_sent_at || null })
  }

  async function saveBackupSettings() {
    if (backupSaving.value || backupSending.value) return
    backupSaving.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/save_backup_settings', await freshToken(true), { ...backupDraft })
      applyBackupSettings(data)
      flash(data.frequency === 'disabled' ? 'Copias automáticas desactivadas.' : 'Programación de copias guardada.')
    } catch (reason) { error.value = reason.message }
    finally { backupSaving.value = false }
  }

  async function sendBackupNow() {
    if (backupSending.value || backupSaving.value) return
    backupSending.value = true
    error.value = ''
    try {
      const data = await postJson('gastoteca/send_backup', await freshToken(true), {})
      backupStatus.last_sent_at = data.last_sent_at
      flash(`Copia enviada a tu Telegram: ${data.movement_count} movimientos y ${data.settlement_count} liquidaciones.`)
    } catch (reason) { error.value = reason.message }
    finally { backupSending.value = false }
  }

  return { applyBackupSettings, saveBackupSettings, sendBackupNow }
}
