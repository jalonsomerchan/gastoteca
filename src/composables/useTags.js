import { postJson } from '../lib/api.js'

export function useTags({ error, tagDraft, saving, freshToken, group, flash, tagDeleteTarget }) {
  async function saveTag() {
    if (saving.value) return
    error.value = ''
    if (!tagDraft.name.trim()) {
      error.value = 'Escribe un nombre para la etiqueta.'
      return
    }
    saving.value = true
    try {
      const data = await postJson('gastoteca/save_tag', await freshToken(true), { ...tagDraft })
      group.value = data.group
      const wasEditing = Boolean(tagDraft.id)
      Object.assign(tagDraft, { id: '', name: '' })
      flash(wasEditing ? 'Etiqueta actualizada.' : 'Etiqueta creada.')
    } catch (reason) { error.value = reason.message }
    finally { saving.value = false }
  }

  async function removeTag() {
    if (saving.value) return
    if (!tagDeleteTarget.value) return
    saving.value = true
    try {
      const data = await postJson('gastoteca/delete_tag', await freshToken(true), { id: tagDeleteTarget.value.id })
      group.value = data.group
      if (tagDraft.id === tagDeleteTarget.value.id) Object.assign(tagDraft, { id: '', name: '' })
      tagDeleteTarget.value = null
      flash('Etiqueta eliminada de los movimientos.')
    } catch (reason) { error.value = reason.message }
    finally { saving.value = false }
  }

  return { saveTag, removeTag }
}
