/* ─── system notifications for overdue accounts ───
   Wraps the browser Notification API. Falls back silently (no-op) if the
   browser doesn't support notifications, or if the user hasn't granted
   permission — the in-app bell/sparkle sound and visual alert still work
   either way, so this is purely additive. */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function notifyOverdue(accountName: string) {
  if (!isNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification('SWITCHBOARD', {
      body: `${accountName} is overdue — time to switch back.`,
      tag: `overdue-${accountName}`,
    })
  } catch {
    // ignore — never block the app on a notification failure
  }
}
