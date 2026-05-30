self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nova notificação', {
      body: data.message || '',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { action_href: data.action_href },
      tag: data.dedup_key,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.action_href || '/cms'
  event.waitUntil(clients.openWindow(href))
})
