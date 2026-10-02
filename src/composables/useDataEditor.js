import { onBeforeUnmount, ref } from 'vue'
import { useGastotecaContext } from './gastotecaContext.js'

export function useDataEditor({ reset, save }) {
  const { saving, error, dataEditorOpen } = useGastotecaContext()
  const editorOpen = ref(false)

  function openEditor(item) {
    if (saving.value) return
    error.value = ''
    reset(item)
    editorOpen.value = true
    dataEditorOpen.value = true
  }

  function closeEditor() {
    if (saving.value) return
    editorOpen.value = false
    dataEditorOpen.value = false
    reset()
    error.value = ''
  }

  async function submitEditor() {
    if (saving.value) return
    if (await save()) closeEditor()
  }

  onBeforeUnmount(() => { dataEditorOpen.value = false })
  return { editorOpen, openEditor, closeEditor, submitEditor }
}
