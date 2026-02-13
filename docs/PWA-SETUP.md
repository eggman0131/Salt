# PWA Setup for SALT

SALT is now configured as a Progressive Web App (PWA). This enables:

- 📱 **Install to home screen** on mobile and desktop
- 🔌 **Offline functionality** with service worker caching
- ⚡ **Fast loading** with cached assets
- 🔔 **Push notifications** (ready for future implementation)
- 🔄 **Background sync** (ready for future implementation)

## What Was Added

### 1. Manifest File (`public/manifest.json`)
- Defines app metadata, icons, and appearance
- Enables "Add to Home Screen" functionality
- Includes app shortcuts for quick access

### 2. Service Worker (`public/service-worker.js`)
- Caches essential assets for offline use
- Network-first strategy for API calls
- Cache-first strategy for static assets
- Handles updates automatically

### 3. PWA Registration (`pwa-registration.ts`)
- Registers service worker on app load
- Handles service worker updates
- Provides install prompt functionality
- Detects standalone mode

### 4. App Icons
- SVG source icon at `public/icons/icon.svg`
- PNG icons needed for various sizes (see below)

### 5. HTML Updates
- Added PWA meta tags
- Linked manifest file
- Added favicons and apple-touch-icons

## Generating Icons

### Option 1: Online Tools (Easiest)
1. Visit **https://realfavicongenerator.net/** or **https://www.pwabuilder.com/imageGenerator**
2. Upload `public/icons/icon.svg`
3. Download generated icons
4. Place them in `public/icons/` directory

Required sizes: **72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512**

### Option 2: Using Sharp (Automated)
```bash
npm install --save-dev sharp
node scripts/generate-icons.js
```

## Testing the PWA

### Development
```bash
npm run dev
```
The service worker will register, but some features only work in production builds.

### Production Build
```bash
npm run build
npm run preview
```

### Testing on Mobile
1. Build and deploy to hosting (Firebase, Vercel, Netlify, etc.)
2. Visit the site on your mobile device
3. Look for "Add to Home Screen" or install prompt
4. Install and launch from home screen

### Chrome DevTools
1. Open DevTools → **Application** tab
2. Check **Service Workers** section (should show registered)
3. Check **Manifest** section (should show all metadata)
4. Test offline: Check "Offline" in Network tab and reload

## Lighthouse Audit

Run a Lighthouse audit to verify PWA score:

1. Open Chrome DevTools → **Lighthouse** tab
2. Select **Progressive Web App** category
3. Click **Generate report**
4. Should score high on PWA checklist

## Deployment Considerations

### Firebase Hosting
Add to `firebase.json`:
```json
{
  "hosting": {
    "headers": [
      {
        "source": "/service-worker.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache"
          }
        ]
      }
    ]
  }
}
```

### Other Hosts
Ensure:
- HTTPS is enabled (required for service workers)
- `manifest.json` is served with `Content-Type: application/manifest+json`
- Service worker is served with `Cache-Control: no-cache`

## Custom Install Button (Optional)

To add a custom install button in your UI:

```typescript
import { promptInstall } from './pwa-registration';

function InstallButton() {
  const { showInstallPrompt } = promptInstall();
  
  return (
    <button onClick={showInstallPrompt}>
      Install SALT
    </button>
  );
}
```

## Features Ready for Future Enhancement

### Push Notifications
The service worker includes push notification handlers. To enable:
1. Set up Firebase Cloud Messaging (FCM)
2. Request notification permission
3. Subscribe to push topics
4. Send notifications from backend

### Background Sync
The service worker includes background sync handlers. To enable:
1. Register sync tags when offline actions occur
2. Handle sync events in service worker
3. Sync data when connection restored

## Updating the Service Worker

When you update the service worker:
1. Change the `CACHE_NAME` version in `public/service-worker.js`
2. Users will be prompted to reload on next visit
3. Old caches are automatically cleaned up

## Troubleshooting

### Service Worker Not Registering
- Check console for errors
- Ensure HTTPS (or localhost for development)
- Clear site data in Chrome DevTools → Application

### Icons Not Showing
- Verify all icon files exist in `public/icons/`
- Check manifest.json paths are correct
- Clear cache and reload

### Offline Not Working
- Check service worker is active in DevTools
- Verify PRECACHE_URLS includes essential files
- Check Network tab to see cached responses

## Resources

- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Builder](https://www.pwabuilder.com/)
