<script setup>
import { onMounted, ref, watch } from 'vue'
import { PhCopy, PhKey, PhPlus, PhTrash } from '@phosphor-icons/vue'
import { API_BASE, postJson } from '../../lib/api.js'
import { useGastotecaContext } from '../../composables/gastotecaContext.js'

const { group, freshToken } = useGastotecaContext()
const keys = ref([])
const name = ref('')
const secret = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const copied = ref(false)
const copiedBearer = ref(false)
const endpoint = `${API_BASE}/gastoteca/v1/expenses`
const sample = `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer TU_CLAVE' \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: atajo-2026-10-09-1234' \\
  -d '{"name":"Café","amount":2.50,"category":"food","place":"Cafetería","paid_by_uid":"UID_DEL_PAGADOR","applies_to_all":true}'`

async function loadKeys() {
  if (!group.value?.id) return
  busy.value = true
  error.value = ''
  try {
    const data = await postJson('gastoteca/list_api_keys', await freshToken(true, true), {})
    keys.value = data.keys || []
  } catch (reason) {
    error.value = reason.message || 'No se pudieron cargar las claves.'
  } finally { busy.value = false }
}

async function createKey() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await postJson('gastoteca/create_api_key', await freshToken(true, true), { name: name.value })
    secret.value = data.secret
    name.value = ''
    notice.value = 'Clave creada. Cópiala ahora; no volverá a mostrarse.'
    await loadKeys()
  } catch (reason) {
    error.value = reason.message || 'No se pudo crear la clave.'
  } finally { busy.value = false }
}

async function revokeKey(key) {
  if (!window.confirm(`¿Revocar «${key.name}»? Los atajos que la usan dejarán de funcionar.`)) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await postJson('gastoteca/revoke_api_key', await freshToken(true, true), { id: key.id })
    notice.value = `Clave «${key.name}» revocada.`
    await loadKeys()
    if (secret.value.startsWith(key.prefix)) secret.value = ''
  } catch (reason) {
    error.value = reason.message || 'No se pudo revocar la clave.'
  } finally { busy.value = false }
}

async function copy(value, label = 'Clave copiada.') {
  try {
    await navigator.clipboard.writeText(value)
    const isBearer = value.startsWith('Bearer ')
    if (isBearer) copiedBearer.value = true
    else copied.value = true
    notice.value = label
    window.setTimeout(() => {
      if (isBearer) copiedBearer.value = false
      else copied.value = false
    }, 1800)
  } catch {
    error.value = 'No se pudo copiar automáticamente. Selecciona y copia el texto.'
  }
}

watch(() => group.value?.id, loadKeys)
onMounted(loadKeys)
</script>

<template>
  <section class="feature-panel api-settings-panel" aria-labelledby="api-settings-title" :aria-busy="busy">
    <div class="feature-panel-heading">
      <div><p class="eyebrow">ATAJOS Y AUTOMATIZACIONES</p><h2 id="api-settings-title">API de La Gastoteca</h2></div>
      <PhKey aria-hidden="true" :size="26" />
    </div>
    <p class="feature-hint settings-intro">Crea claves para registrar gastos desde Atajos de iPhone o cualquier herramienta que pueda hacer una petición HTTPS. Cada clave queda asociada a <strong>{{ group?.name || 'tu grupo actual' }}</strong> y solo permite crear gastos.</p>
    <p class="feature-hint">Los pagos creados desde la API quedan pendientes de revisar y aparecen a todas las personas del grupo. Se envía un aviso de Telegram a quienes tengan Telegram vinculado.</p>

    <form class="api-key-create" @submit.prevent="createKey">
      <label for="api-key-name">Nombre de la clave</label>
      <div class="api-key-create-row"><input id="api-key-name" v-model="name" type="text" maxlength="80" placeholder="Atajos del iPhone" required :disabled="busy" /><button class="primary" :disabled="busy || !name.trim()"><PhPlus aria-hidden="true" :size="17" /> Crear clave</button></div>
    </form>

    <p v-if="error" class="api-message error" role="alert">{{ error }}</p>
    <p v-if="notice" class="api-message" role="status">{{ notice }}</p>

    <div v-if="secret" class="api-new-secret">
      <label for="new-api-secret">Tu nueva clave · se muestra una sola vez</label>
      <div class="api-secret-actions"><input id="new-api-secret" :value="secret" readonly @focus="$event.target.select()" /><button type="button" class="secondary" @click="copy(secret)"><PhCopy aria-hidden="true" :size="16" /> {{ copied ? 'Copiada' : 'Copiar clave' }}</button><button type="button" class="secondary" @click="copy(`Bearer ${secret}`, 'Clave con Bearer copiada.')"><PhCopy aria-hidden="true" :size="16" /> {{ copiedBearer ? 'Copiada' : 'Copiar con Bearer' }}</button></div>
      <small>Guárdala en un lugar seguro. Si la pierdes, revócala y crea otra.</small>
    </div>

    <div class="api-key-list">
      <h3>Claves de este grupo</h3>
      <p v-if="!keys.length && !busy" class="feature-hint">Todavía no has creado claves.</p>
      <article v-for="key in keys" :key="key.id" class="api-key-row" :class="{ revoked: key.revoked_at }">
        <PhKey aria-hidden="true" :size="19" />
        <div><strong>{{ key.name }}</strong><small>{{ key.prefix }}•••• · creada {{ key.created_at }}<template v-if="key.last_used_at"> · usada {{ key.last_used_at }}</template><template v-if="key.revoked_at"> · revocada</template></small></div>
        <button v-if="!key.revoked_at" type="button" class="ghost small-action api-revoke" :disabled="busy" :aria-label="`Revocar ${key.name}`" @click="revokeKey(key)"><PhTrash aria-hidden="true" :size="17" /> Revocar</button>
        <span v-else class="settings-status">Revocada</span>
      </article>
    </div>

    <details class="api-docs" open>
      <summary>Documentación de la API</summary>
      <div class="api-docs-body">
        <p>Un único método para crear un gasto. La petición se guarda en el grupo al que pertenece la clave; no se puede usar para consultar, editar ni borrar datos.</p>
        <dl class="api-reference">
          <div><dt>Método y URL</dt><dd><code>POST {{ endpoint }}</code></dd></div>
          <div><dt>Autenticación</dt><dd><code>Authorization: Bearer TU_CLAVE</code></dd></div>
          <div><dt>Formato</dt><dd><code>Content-Type: application/json</code></dd></div>
          <div><dt>Reintentos seguros</dt><dd>Envía un <code>Idempotency-Key</code> único por gasto (máximo 100 caracteres). Si repites la petición con la misma clave, devuelve el gasto original sin duplicarlo. Conserva la clave durante 30 días.</dd></div>
        </dl>
        <h4>Campos del gasto</h4>
        <div class="api-docs-table-wrap"><table class="api-docs-table"><thead><tr><th>Campo</th><th>Tipo</th><th>Uso</th></tr></thead><tbody>
          <tr><td><code>name</code></td><td>texto, obligatorio</td><td>Concepto (hasta 160 caracteres).</td></tr>
          <tr><td><code>amount</code></td><td>número, obligatorio</td><td>Importe positivo en euros, hasta dos decimales.</td></tr>
          <tr><td><code>category</code></td><td>texto</td><td>Clave de categoría del grupo; por defecto <code>other</code>. Ejemplos: <code>food</code>, <code>home</code>, <code>transport</code>, <code>leisure</code>, <code>health</code>, <code>shopping</code>, <code>bills</code>, <code>travel</code>.</td></tr>
          <tr><td><code>occurred_at</code></td><td>fecha y hora</td><td><code>YYYY-MM-DD HH:mm:ss</code> o <code>YYYY-MM-DDTHH:mm:ss</code>, en hora local de Madrid. Por defecto, ahora.</td></tr>
          <tr><td><code>details</code></td><td>texto</td><td>Notas (hasta 1000 caracteres).</td></tr>
          <tr><td><code>place</code>, <code>city</code></td><td>texto</td><td>Establecimiento y ciudad; la ciudad predeterminada del grupo se usa si se omite.</td></tr>
          <tr><td><code>payment_method</code></td><td>texto</td><td><code>card</code>, <code>cash</code>, <code>transfer</code>, <code>bizum</code>, <code>cobee</code> o <code>other</code>. Por defecto, el método del grupo.</td></tr>
          <tr><td><code>paid_by_uid</code></td><td>texto</td><td>UID del miembro que pagó. Por defecto, el dueño de la clave. Debe pertenecer al grupo. Usa <code>"all"</code> para indicar que pagó todo el grupo.</td></tr>
          <tr><td><code>applies_to_all</code></td><td>booleano</td><td><code>true</code> reparte entre todo el grupo (valor predeterminado); <code>false</code> limita el reparto a <code>participant_uids</code>.</td></tr>
          <tr><td><code>participant_uids</code></td><td>lista de textos</td><td>Miembros incluidos si <code>applies_to_all</code> es <code>false</code>. En ese caso debe incluir al menos un UID válido.</td></tr>
          <tr><td><code>share_mode</code>, <code>participant_shares</code></td><td>texto, objeto</td><td>Reparto: <code>equal</code> (por defecto), <code>amount</code> (euros por UID) o <code>percent</code> (porcentajes por UID).</td></tr>
          <tr><td><code>tags</code></td><td>lista de textos</td><td>Etiquetas del gasto. Se crean en el grupo si aún no existen.</td></tr>
          <tr><td><code>recurrence</code></td><td>texto</td><td>Opcional: <code>weekly</code>, <code>monthly</code> o <code>yearly</code>. Crea la regla recurrente además del primer gasto.</td></tr>
        </tbody></table></div>
        <div v-if="group?.members?.length" class="api-member-uids">
          <h4>UIDs de las personas del grupo</h4>
          <p>Úsalos en <code>paid_by_uid</code> y <code>participant_uids</code> para elegir pagador y reparto.</p>
          <div v-for="member in group.members" :key="member.uid" class="api-member-uid"><span><strong>{{ member.name || member.email }}</strong><code>{{ member.uid }}</code></span><button type="button" class="ghost small-action" :aria-label="`Copiar UID de ${member.name || member.email}`" @click="copy(member.uid, 'UID copiado.')"><PhCopy aria-hidden="true" :size="15" /> Copiar UID</button></div>
        </div>
        <h4>Ejemplo para Atajos de iPhone</h4>
        <p>En Atajos, crea un diccionario con los campos del ejemplo y usa «Obtener contenido de URL»: método POST, cuerpo JSON y encabezados <code>Authorization</code> y <code>Idempotency-Key</code>. Usa un identificador nuevo para cada ejecución.</p>
        <div class="api-code"><pre><code>{{ sample }}</code></pre><button type="button" class="ghost small-action" @click="copy(sample, 'Ejemplo copiado.')"><PhCopy aria-hidden="true" :size="16" /> Copiar ejemplo</button></div>
        <p class="feature-hint">Respuesta correcta: <code>{ "ok": true, "data": { "expense": { … } } }</code>. Los errores incluyen <code>ok: false</code>, un código estable y un mensaje. Los importes, fechas y repartos se validan igual que al guardar desde la aplicación. Mantén la clave privada: cualquier persona que la tenga podrá crear gastos en este grupo.</p>
      </div>
    </details>
  </section>
</template>
