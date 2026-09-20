<script setup>
import { useGastotecaContext } from '../composables/gastotecaContext.js'
import { PhCheck, PhArrowRight, PhUsers } from '@phosphor-icons/vue'

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
  notificationSaving,
  notificationOptions,
  memberOptions,
  saveTelegramSettings,
  saveNotificationSettings,
  beginTelegramLink,
  refreshTelegramStatus,
  navigateTo,
} = useGastotecaContext()
</script>

<template>
  <section class="page-heading">
    <div>
      <p class="eyebrow">
        TU EXPERIENCIA
      </p><h1>Ajustes</h1><p>Elige qué avisos quieres recibir y cómo te llegan.</p>
    </div>
  </section>
  <section class="settings-layout">
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

    <form class="feature-panel feature-form settings-panel" aria-label="Preferencias de Telegram" :aria-busy="telegramSaving" @submit.prevent="saveTelegramSettings">
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
</template>
