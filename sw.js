/// <reference lib="webworker" />

/**
 * PushTube Client Service Worker
 * Handles Web-Push events, rich notification displays, and click-through tracking.
 */

self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || 'New Notification';
        const options = {
            body: data.body || '',
            icon: data.icon || '/logo.svg',
            badge: data.badge || '/logo.svg',
            data: {
                url: data.target_url || data.url || '/',
                campaign_id: data.data?.campaign_id || data.campaign_id || null,
                track_url: data.data?.track_url || data.track_url || '/api/v1/track/click',
            }
        };

        if (data.image) {
            options.image = data.image;
        }

        if (data.tag) {
            options.tag = data.tag;
        }

        if (data.requireInteraction) {
            options.requireInteraction = true;
        }

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (err) {
        console.error('[PushTube SW] Error processing push event', err);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const notifData = event.notification.data || {};
    const urlToOpen = notifData.url || '/';
    const campaignId = notifData.campaign_id;
    const trackUrl = notifData.track_url || '/api/v1/track/click';

    const promiseChain = [];

    // CTR Click Tracking Ping (CORS-enabled direct to PushTube backend)
    if (campaignId && trackUrl) {
        const trackPromise = fetch(trackUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: campaignId })
        }).catch((err) => console.warn('[PushTube SW] Tracking click failed', err));
        promiseChain.push(trackPromise);
    }

    // Window focus or open
    const openPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            if (client.url === urlToOpen && 'focus' in client) {
                return client.focus();
            }
        }
        if (self.clients.openWindow) {
            return self.clients.openWindow(urlToOpen);
        }
    });
    promiseChain.push(openPromise);

    event.waitUntil(Promise.all(promiseChain));
});
