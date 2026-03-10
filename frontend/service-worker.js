// =============================================
// Service Worker for Push Notifications
// File: frontend/service-worker.js
// Description: Handles push notifications even when app is closed
// =============================================

console.log('🔧 Service Worker loaded');

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('📬 Push notification received:', event);
    
    if (event.data) {
        const data = event.data.json();
        console.log('📬 Push data:', data);
        
        const options = {
            body: data.body || 'You have a new notification',
            icon: '/cpmr_library/frontend/images/icon-192x192.png',
            badge: '/cpmr_library/frontend/images/badge-72x72.png',
            tag: data.tag || 'notification',
            requireInteraction: data.requireInteraction || false,
            actions: data.actions || [],
            data: data.data || {}
        };
        
        // Add sound if specified
        if (data.sound) {
            options.sound = data.sound;
        }
        
        // Add vibration pattern
        options.vibrate = [200, 100, 200];
        
        event.waitUntil(
            self.registration.showNotification(data.title || '🔔 Notification', options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ Notification clicked:', event.notification.tag);
    
    event.notification.close();
    
    // If there's an action in the notification, handle it
    if (event.action) {
        console.log('📌 Action clicked:', event.action);
    }
    
    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window/tab open
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === '/' || client.url.includes('/cpmr_library')) {
                    // Found a matching client, focus it
                    return client.focus();
                }
            }
            
            // No matching window, open a new one
            return clients.openWindow('/cpmr_library');
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('❌ Notification closed:', event.notification.tag);
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activated');
    event.waitUntil(clients.claim());
});

// Handle service worker install
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker installing');
    self.skipWaiting();
});
