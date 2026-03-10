// Service Worker para Web Push Notifications (Casa en Orden)

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received');

  if (event.data) {
    try {
      const data = event.data.json();
      
      const title = data.title || 'Casa en Orden';
      const options = {
        body: data.body || 'Alguien hizo una actualización',
        icon: '/assets/icon.png',
        badge: '/assets/icon.png',
        data: data.data || {}
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.log('Error parsing push data', e);
      // Fallback
      event.waitUntil(
        self.registration.showNotification('Casa en Orden', {
          body: event.data.text(),
          icon: '/assets/icon.png'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click', event.notification.data);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Si la app está abierta, enfocarla
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Si está cerrada, abrir la raíz
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
