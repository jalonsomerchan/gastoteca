import { getJson, postJson } from '../lib/api.js'

export function useNotifications({
  user,
  freshToken,
  notifications,
  unreadNotificationCount,
  markingNotificationIds,
  error,
  markingAllNotifications,
  notificationsOpen,
  menuOpen,
  route,
  router,
}) {
  async function loadNotifications() {
    if (!user.value) return
    const requestedUid = user.value.uid
    try {
      const data = await getJson('gastoteca/notifications', await freshToken())
      if (user.value?.uid !== requestedUid) return
      notifications.value = data.notifications || []
      unreadNotificationCount.value = Number(data.unread_count) || 0
    } catch {
      // Notification polling should never block the rest of the app.
    }
  }

  async function markNotificationRead(notification) {
    if (!notification || notification.read_at || markingNotificationIds.value.includes(notification.id)) return
    markingNotificationIds.value.push(notification.id)
    try {
      const data = await postJson('gastoteca/mark_notification_read', await freshToken(true), { id: notification.id })
      notification.read_at = new Date().toISOString()
      unreadNotificationCount.value = Number(data.unread_count) || 0
    } catch (reason) {
      error.value = reason.message
    } finally {
      markingNotificationIds.value = markingNotificationIds.value.filter((id) => id !== notification.id)
    }
  }

  async function markAllNotificationsRead() {
    if (!unreadNotificationCount.value || markingAllNotifications.value) return
    markingAllNotifications.value = true
    try {
      await postJson('gastoteca/mark_all_notifications_read', await freshToken(true), {})
      const readAt = new Date().toISOString()
      notifications.value.forEach((notification) => { if (!notification.read_at) notification.read_at = readAt })
      unreadNotificationCount.value = 0
    } catch (reason) {
      error.value = reason.message
    } finally {
      markingAllNotifications.value = false
    }
  }

  async function openNotification(notification) {
    if (!notification.read_at) await markNotificationRead(notification)
    notificationsOpen.value = false
    menuOpen.value = false
    const target = notification.target || '/'
    if (route.fullPath !== target) await router.push(target)
  }

  return { loadNotifications, markNotificationRead, markAllNotificationsRead, openNotification }
}
