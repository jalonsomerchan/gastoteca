<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhCheck, PhArrowRight, PhUsers, PhCloudArrowUp } from '@phosphor-icons/vue'
import SummarySettingsPanel from '../components/settings/SummarySettingsPanel.vue'
import ApiSettingsPanel from '../components/settings/ApiSettingsPanel.vue'
import { ref } from 'vue'

const activeTab = ref('general')
function moveSettingsTab(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' || event.key === 'ArrowLeft' && activeTab.value === 'api' || event.key === 'ArrowRight' && activeTab.value === 'general'
    ? 'general'
    : 'api'
  activeTab.value = next
  document.getElementById(`settings-tab-${next}`)?.focus()
}

const {
  user,
  group,
  telegramNotificationTypes,
  appNotificationTypes,
  telegramConfigured,
  telegramConnected,
  telegramUsername,
  telegramLinkUrl,
  telegramSaving,
  telegramTesting,
  notificationSaving,
  backupDraft,
  backupStatus,
  backupSaving,
  backupSending,
  saveBackupSettings,
  sendBackupNow,
  summaryDraft,
  summaryStatus,
  summaryPeriod,
  summarySaving,
  summarySending,
  summaryOptions,
  saveSummarySettings,
  sendSummaryNow,
  notificationOptions,
  memberOptions,
  saveTelegramSettings,
  saveNotificationSettings,
  testTelegram,
  beginTelegramLink,
  refreshTelegramStatus,
  navigateTo,
} = useGastotecaContext()

const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const backupDate = value => new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
}).format(new Date(value))
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        TU EXPERIENCIA
      </p><h1>Ajustes</h1><p>Configura tu cuenta y conecta tus atajos.</p>
    </div>
  </section>
  <nav class="settings-tabs" aria-label="Secciones de ajustes" role="tablist">
    <button id="settings-tab-general" type="button" role="tab" :aria-selected="activeTab === 'general'" aria-controls="settings-general" :tabindex="activeTab === 'general' ? 0 : -1" @click="activeTab = 'general'" @keydown="moveSettingsTab">General</button>
    <button id="settings-tab-api" type="button" role="tab" :aria-selected="activeTab === 'api'" aria-controls="settings-api" :tabindex="activeTab === 'api' ? 0 : -1" @click="activeTab = 'api'" @keydown="moveSettingsTab">API</button>
  </nav>
  <section v-if="activeTab === 'general'" id="settings-general" class="settings-layout" role="tabpanel" aria-labelledby="settings-tab-general">
    <form class="feature-panel feature-form settings-panel" aria-label="Preferencias de notificaciones de la aplicación" :aria-busy="notificationSaving" @submit.prevent="saveNotificationSettings">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            EN LA CAMPAÑITA
          </p><h2>Notificaciones de la app</h2>
        </div>
      </div>
      <p class="feature-hint settings-intro">
        Controla qué actividad aparece en tu bandeja de notificaciones. Los cambios solo afectan a tu cuenta.
      </p>
      <div class="settings-options">
        <label v-for="item in notificationOptions" :key="item.value">
          <input v-model="appNotificationTypes" type="checkbox" :value="item.value" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
        </label>
      </div>
      <div class="feature-form-actions">
        <span></span><button class="primary" :disabled="notificationSaving">
          <PhCheck aria-hidden="true" :size="17" /> {{ notificationSaving ? 'Guardando…' : 'Guardar avisos de la app' }}
        </button>
      </div>
    </form>

    <form class="feature-panel feature-form settings-panel" aria-label="Preferencias de Telegram" :aria-busy="telegramSaving || telegramTesting" @submit.prevent="saveTelegramSettings">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            AVISOS EXTERNOS
          </p><h2>Telegram</h2>
        </div><span class="settings-status" :class="{ connected: telegramConnected }">{{ telegramConnected ? 'Conectado' : telegramConfigured ? 'Sin conectar' : 'No disponible' }}</span>
      </div>
      <p v-if="!telegramConfigured" class="muted">
        Telegram no está configurado en el servidor. Puedes seguir usando las notificaciones de la campanita.
      </p>
      <template v-else>
        <p class="feature-hint settings-intro">
          {{ telegramConnected ? `Tu cuenta está conectada${telegramUsername ? ` como ${telegramUsername}` : ''}. Elige qué avisos quieres recibir por Telegram.` : 'Conecta Telegram para recibir allí los avisos que selecciones.' }}
        </p>
        <div class="settings-connection-actions">
          <button v-if="!telegramConnected && !telegramLinkUrl"
                  type="button"
                  class="secondary"
                  @click="beginTelegramLink"
          >
            Conectar Telegram
          </button>
          <a v-if="telegramLinkUrl && !telegramConnected"
             class="telegram-link"
             :href="telegramLinkUrl"
             target="_blank"
             rel="noreferrer"
          >
            Abrir Telegram para vincular <span class="sr-only">(se abre en otra pestaña)</span><PhArrowRight aria-hidden="true" :size="15" />
          </a>
          <button v-if="!telegramConnected && telegramLinkUrl"
                  type="button"
                  class="ghost"
                  @click="refreshTelegramStatus"
          >
            Ya lo he vinculado · comprobar
          </button>
          <button v-if="telegramConnected"
                  type="button"
                  class="ghost"
                  @click="refreshTelegramStatus"
          >
            Actualizar conexión
          </button>
          <button v-if="telegramConnected"
                  type="button"
                  class="secondary"
                  :disabled="telegramTesting"
                  @click="testTelegram"
          >
            {{ telegramTesting ? 'Enviando…' : 'Enviar mensaje de prueba' }}
          </button>
        </div>
        <div class="settings-options">
          <label v-for="item in notificationOptions" :key="item.value">
            <input v-model="telegramNotificationTypes" type="checkbox" :value="item.value" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
          </label>
        </div>
        <div class="feature-form-actions">
          <span></span><button class="primary" :disabled="telegramSaving">
            <PhCheck aria-hidden="true" :size="17" /> {{ telegramSaving ? 'Guardando…' : 'Guardar avisos de Telegram' }}
          </button>
        </div>
      </template>
    </form>

    <form class="feature-panel feature-form settings-backup-panel" aria-label="Copias de seguridad" :aria-busy="backupSaving || backupSending" @submit.prevent="saveBackupSettings">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">TUS DATOS A SALVO</p><h2>Copias de seguridad</h2>
        </div><PhCloudArrowUp aria-hidden="true" :size="26" />
      </div>
      <p class="feature-hint settings-intro">
        Recibe en tu Telegram un CSV con todos los ingresos y gastos de tu grupo, sus repartos, etiquetas y liquidaciones. Cada copia contiene todo el historial, sin filtros. La programación solo afecta a tu cuenta y a este grupo.
      </p>
      <p v-if="!telegramConnected" class="feature-hint">
        {{ telegramConfigured ? 'Conecta tu cuenta en la sección Telegram para recibir copias.' : 'Telegram debe estar configurado en el servidor para enviar copias.' }}
      </p>
      <div class="settings-backup-manual">
        <button type="button" class="secondary" :disabled="!telegramConnected || backupSending || backupSaving" @click="sendBackupNow">
          <PhCloudArrowUp aria-hidden="true" :size="18" /> {{ backupSending ? 'Enviando copia…' : 'Enviar copia ahora' }}
        </button>
        <p v-if="backupStatus.last_sent_at" class="feature-hint">
          Última copia enviada: <time :datetime="backupStatus.last_sent_at">{{ backupDate(backupStatus.last_sent_at) }}</time>
        </p>
      </div>
      <fieldset class="settings-backup-fields" :disabled="backupSaving || backupSending">
        <legend class="sr-only">Programación de copias automáticas</legend>
        <label for="backup-frequency">
          <span>Copias automáticas</span>
          <select id="backup-frequency" v-model="backupDraft.frequency" :disabled="!telegramConnected && backupDraft.frequency === 'disabled'">
            <option value="disabled">Desactivadas</option>
            <option value="daily">Cada día</option>
            <option value="weekly">Cada semana</option>
            <option value="monthly">Cada mes</option>
          </select>
        </label>
        <label v-if="backupDraft.frequency !== 'disabled'" for="backup-time">
          <span>Hora de envío · Madrid</span>
          <input id="backup-time" v-model="backupDraft.time" type="time" required />
        </label>
        <label v-if="backupDraft.frequency === 'weekly'" for="backup-weekday">
          <span>Día de la semana</span>
          <select id="backup-weekday" v-model.number="backupDraft.weekday">
            <option v-for="(day, index) in weekdays" :key="day" :value="index + 1">{{ day }}</option>
          </select>
        </label>
        <label v-if="backupDraft.frequency === 'monthly'" for="backup-monthday">
          <span>Día del mes</span>
          <select id="backup-monthday" v-model.number="backupDraft.monthday" aria-describedby="backup-monthday-hint">
            <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
          </select>
        </label>
      </fieldset>
      <p v-if="backupDraft.frequency === 'monthly'" id="backup-monthday-hint" class="feature-hint">
        Si el mes no tiene ese día, se enviará el último día del mes.
      </p>
      <p class="feature-hint">Las copias automáticas se envían aunque tengas la aplicación cerrada. Horario de Europe/Madrid.</p>
      <p v-if="backupStatus.next_run_at" class="feature-hint">
        Próximo envío guardado: <time :datetime="backupStatus.next_run_at">{{ backupDate(backupStatus.next_run_at) }}</time>
      </p>
      <div class="feature-form-actions">
        <span></span><button class="primary" :disabled="backupSaving || backupSending || (!telegramConnected && backupDraft.frequency !== 'disabled')">
          <PhCheck aria-hidden="true" :size="17" /> {{ backupSaving ? 'Guardando…' : 'Guardar programación' }}
        </button>
      </div>
    </form>

    <SummarySettingsPanel
      v-model:period="summaryPeriod"
      :schedules="summaryDraft"
      :status="summaryStatus"
      :options="summaryOptions"
      :connected="telegramConnected"
      :configured="telegramConfigured"
      :saving="summarySaving"
      :sending="summarySending"
      @update-schedule="({ period, field, value }) => summaryDraft[period][field] = value"
      @save="saveSummarySettings"
      @send="sendSummaryNow"
    />

    <article class="feature-panel settings-account-panel">
      <div class="feature-panel-heading">
        <div>
          <p class="eyebrow">
            CUENTA Y GRUPO
          </p><h2>Tu espacio</h2>
        </div>
      </div>
      <div class="settings-account-row">
        <span class="avatar">{{ (user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase() }}</span><div><strong>{{ user?.displayName || 'Tu cuenta' }}</strong><small>{{ user?.email }}</small></div>
      </div>
      <div class="settings-account-row">
        <span class="settings-group-icon"><PhUsers aria-hidden="true" :size="19" /></span><div><strong>{{ group?.name || 'Tu grupo' }}</strong><small>{{ memberOptions.length }} {{ memberOptions.length === 1 ? 'persona' : 'personas' }}</small></div><button type="button" class="ghost small-action" @click="navigateTo('/grupo')">
          Ver grupo
        </button>
      </div>
    </article>
  </section>
  <section v-else id="settings-api" class="settings-layout settings-api-layout" role="tabpanel" aria-labelledby="settings-tab-api">
    <ApiSettingsPanel />
  </section>
</template>
