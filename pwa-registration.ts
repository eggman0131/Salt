/**
 * Service Worker Registration for SALT PWA
 */

export function registerServiceWorker() {
  // Skip registration in development mode
  if (import.meta.env.DEV) {
    console.log('⏭️ Service Worker registration skipped (running in dev mode)');
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                console.log('🔄 New version available! Reload to update.');
                
                // Optionally show a notification to the user
                if (window.confirm('A new version of SALT is available! Reload to update?')) {
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('Error unregistering service worker:', error);
      });
  }
}

// Check if app is running standalone (installed as PWA)
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Prompt user to install PWA
export function promptInstall() {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show custom install button/banner
    console.log('💾 PWA install prompt available');
  });

  return {
    showInstallPrompt: async () => {
      if (!deferredPrompt) {
        console.log('Install prompt not available');
        return false;
      }

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log(`User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);
      deferredPrompt = null;
      
      return outcome === 'accepted';
    }
  };
}
