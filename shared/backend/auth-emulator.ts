import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from './firebase';
import { debugLogger } from './debug-logger';

const TEST_EMAIL = 'dev@test.local';
const TEST_PASSWORD = 'dev-test-password-123';

/**
 * Auto-authenticate with test credentials in emulator environment.
 * Only runs on localhost; safely no-op in production.
 * Enables persistent auth across dev server restarts.
 */
export async function ensureEmulatorAuth(): Promise<void> {
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  
  if (!isLocalhost) {
    debugLogger.log('Auth Emulator', 'Skipping auto-auth (not localhost)');
    return; // Silent no-op in production
  }

  debugLogger.log('Auth Emulator', 'Starting auto-auth check...');

  try {
    // Enable persistence so auth survives dev server restarts
    await setPersistence(auth, browserLocalPersistence);
    debugLogger.log('Auth Emulator', 'Persistence enabled');

    // Already authenticated
    if (auth.currentUser) {
      debugLogger.log('Auth Emulator', `✅ Using existing session: ${auth.currentUser.email}`);
      return;
    }

    debugLogger.log('Auth Emulator', `Attempting auto-sign-in with ${TEST_EMAIL}...`);
    
    // Auto-sign in with test credentials
    const result = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
    debugLogger.log('Auth Emulator', `✅ Auto-authenticated as ${result.user.email}`);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      debugLogger.warn(
        'Auth Emulator',
        `❌ Test user not found. Run: node scripts/create-auth-user.mjs`
      );
    } else if (error.code === 'auth/wrong-password') {
      debugLogger.error('Auth Emulator', '❌ Wrong password for test user');
    } else {
      debugLogger.error('Auth Emulator', `❌ Auth failed:`, error.code, error.message);
    }
  }
}
