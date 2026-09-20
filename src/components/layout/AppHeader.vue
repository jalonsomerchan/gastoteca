<script setup>
import { RouterLink } from 'vue-router'
import { useGastotecaContext } from '../../composables/gastotecaContext.js'
import { PhList, PhBell, PhCheck, PhSignOut } from '@phosphor-icons/vue'

const {
  signOut,
  route,
  brandIconUrl,
  menuOpen,
  user,
  notifications,
  unreadNotificationCount,
  notificationsOpen,
  markingNotificationIds,
  markingAllNotifications,
  navigationItems,
  notificationDateLabel,
  markNotificationRead,
  markAllNotificationsRead,
  openNotification,
} = useGastotecaContext()
</script>

<template>
  <header class="topbar">
    <RouterLink class="brand" to="/" aria-label="La Gastoteca, ir a movimientos">
      <img class="brand-icon" :src="brandIconUrl" alt="" />
      <span><strong>La Gastoteca</strong><small>Cuentas claras, siempre</small></span>
    </RouterLink>
    <div v-if="user" class="navigation-menu" @click.stop>
      <button
        type="button"
        class="menu-trigger"
        :aria-expanded="menuOpen"
        :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'"
        aria-controls="main-navigation"
        @click="menuOpen = !menuOpen; notificationsOpen = false"
      >
        <PhList aria-hidden="true" :size="22" weight="regular" /><span>Menú</span>
      </button>
      <nav
        v-if="menuOpen"
        id="main-navigation"
        class="navigation-panel"
        aria-label="Navegación principal"
      >
        <RouterLink
          v-for="item in navigationItems"
          :key="item.route"
          :to="item.path"
          :class="{ active: route.name === item.route }"
          :aria-current="route.name === item.route ? 'page' : undefined"
          @click="menuOpen = false"
        >
          <component :is="item.icon" :size="19" weight="regular" /><span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </div>
    <div v-if="user" class="notification-center" @click.stop>
      <button
        type="button"
        class="icon-button notification-trigger"
        :aria-label="unreadNotificationCount ? `Notificaciones, ${unreadNotificationCount} sin leer` : 'Notificaciones'"
        :aria-expanded="notificationsOpen"
        aria-controls="notifications-panel"
        title="Notificaciones"
        @click="notificationsOpen = !notificationsOpen; menuOpen = false"
      >
        <PhBell aria-hidden="true" :size="21" weight="regular" />
        <span v-if="unreadNotificationCount" class="notification-count">{{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}</span>
      </button>
      <section v-if="notificationsOpen"
               id="notifications-panel"
               class="notifications-panel"
               aria-label="Notificaciones recientes"
      >
        <header class="notifications-heading">
          <div><strong>Notificaciones</strong><span v-if="unreadNotificationCount">{{ unreadNotificationCount }} sin leer</span></div>
          <button type="button"
                  class="mark-all-read"
                  :disabled="!unreadNotificationCount || markingAllNotifications"
                  @click="markAllNotificationsRead"
          >
            {{ markingAllNotifications ? 'Guardando…' : 'Marcar todas como leídas' }}
          </button>
        </header>
        <div v-if="!notifications.length" class="notifications-empty">
          <PhBell aria-hidden="true" :size="23" /><span>Todo al día. Aquí verás la actividad de tu grupo.</span>
        </div>
        <div v-else class="notifications-list">
          <article v-for="notification in notifications"
                   :key="notification.id"
                   class="notification-item"
                   :class="{ unread: !notification.read_at }"
          >
            <button type="button" class="notification-open" @click="openNotification(notification)">
              <span class="notification-unread-dot" :class="{ visible: !notification.read_at }"></span>
              <span class="notification-copy"><strong>{{ notification.title }}</strong><span>{{ notification.body }}</span><time>{{ notificationDateLabel(notification.created_at) }}</time></span>
            </button>
            <button v-if="!notification.read_at"
                    type="button"
                    class="notification-mark-read"
                    :disabled="markingNotificationIds.includes(notification.id)"
                    :aria-label="`Marcar como leída: ${notification.title}`"
                    title="Marcar como leída"
                    @click="markNotificationRead(notification)"
            >
              <PhCheck aria-hidden="true" :size="17" />
            </button>
          </article>
        </div>
      </section>
    </div>
    <div v-if="user" class="account">
      <img v-if="user.photoURL" :src="user.photoURL" alt="" />
      <span>{{ user.displayName || user.email }}</span>
      <button class="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión" @click="signOut">
        <PhSignOut aria-hidden="true" :size="21" />
      </button>
    </div>
  </header>
</template>
