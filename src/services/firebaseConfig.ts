import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, disableNetwork, terminate, type Firestore } from 'firebase/firestore';
// @ts-ignore
import appletConfig from '../../firebase-applet-config.json';

// Intercept and suppress Firestore SDK internal background quota & offline connection error logs to prevent unhandled log alerts
if (typeof window !== 'undefined' && !(window as any).__hitoms_console_patched) {
  (window as any).__hitoms_console_patched = true;
  const origError = console.error;
  const origWarn = console.warn;

  const isIgnorableFirestoreLog = (str: string) => {
    return (
      str.includes('resource-exhausted') ||
      str.includes('Quota limit exceeded') ||
      str.includes('Free daily write units') ||
      str.includes('maximum backoff delay') ||
      str.includes('quota metric') ||
      str.includes('Could not reach Cloud Firestore backend') ||
      str.includes('client will operate in offline mode') ||
      str.includes('client is offline') ||
      str.includes('The operation could not be completed') ||
      str.includes('code=unavailable')
    );
  };

  console.error = function (...args: any[]) {
    const errorStr = args
      .map((a) => (a instanceof Error ? `${a.message} ${a.stack || ''}` : String(a)))
      .join(' ');
    if (isIgnorableFirestoreLog(errorStr)) {
      if (
        errorStr.includes('resource-exhausted') ||
        errorStr.includes('Quota limit exceeded') ||
        errorStr.includes('Free daily write units')
      ) {
        markFirestoreQuotaExceeded();
      }
      return;
    }
    origError.apply(console, args);
  };

  console.warn = function (...args: any[]) {
    const warnStr = args.map((a) => String(a)).join(' ');
    if (isIgnorableFirestoreLog(warnStr)) {
      if (
        warnStr.includes('resource-exhausted') ||
        warnStr.includes('Quota limit exceeded') ||
        warnStr.includes('Free daily write units')
      ) {
        markFirestoreQuotaExceeded();
      }
      return;
    }
    origWarn.apply(console, args);
  };
}

interface FirebaseClients {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  isConfigured: boolean;
  databaseId?: string;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig?.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig?.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig?.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig?.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig?.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig?.appId || '',
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig?.firestoreDatabaseId || '';

let clients: FirebaseClients = {
  app: null,
  auth: null,
  firestore: null,
  isConfigured: false,
  databaseId,
};

export const markFirestoreQuotaExceeded = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hitoms_firestore_quota_exceeded', String(Date.now()));
    }
  } catch (e) {}
  if (clients.firestore) {
    const db = clients.firestore;
    try {
      disableNetwork(db).catch(() => {});
      terminate(db).catch(() => {});
    } catch (e) {}
  }
  clients.firestore = null;
  clients.isConfigured = false;
  console.warn(
    '[FirebaseConfig] Firestore daily write quota limit reached. Terminated cloud connection; app operating seamlessly in offline-first IndexedDB mode.'
  );
};

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    const quotaTimestamp =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('hitoms_firestore_quota_exceeded')
        : null;
    const isQuotaExceededPreviously = quotaTimestamp
      ? Date.now() - Number(quotaTimestamp) < 24 * 60 * 60 * 1000
      : false;

    if (!isQuotaExceededPreviously && typeof localStorage !== 'undefined' && quotaTimestamp) {
      // Clear expired quota flag after 24 hours
      localStorage.removeItem('hitoms_firestore_quota_exceeded');
    }

    if (isQuotaExceededPreviously) {
      console.warn(
        '[FirebaseConfig] Operating in offline-first IndexedDB mode (Firestore daily quota limit active).'
      );
      clients = {
        app: null,
        auth: null,
        firestore: null,
        isConfigured: false,
        databaseId,
      };
    } else {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      const auth = getAuth(app);
      const firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

      clients = {
        app,
        auth,
        firestore,
        isConfigured: true,
        databaseId,
      };

      signInAnonymously(auth).catch((err) => {
        console.warn('[FirebaseConfig] Anonymous sign-in notice (will retry on operations):', err?.message);
      });
    }
  }
} catch (error) {
  console.warn('Firebase initialization skipped or failed. Running in pure offline local database mode.', error);
}

export const ensureFirebaseAuth = async (): Promise<boolean> => {
  if (!clients.auth) return false;
  if (clients.auth.currentUser) return true;
  try {
    await signInAnonymously(clients.auth);
    return true;
  } catch (e) {
    console.warn('[FirebaseConfig] ensureFirebaseAuth error:', e);
    return false;
  }
};

export const firebaseClients = clients;
export const isFirebaseConfigured = (): boolean => {
  try {
    const quotaTimestamp =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('hitoms_firestore_quota_exceeded')
        : null;
    if (quotaTimestamp && Date.now() - Number(quotaTimestamp) < 24 * 60 * 60 * 1000) {
      return false;
    }
  } catch {}
  return Boolean(clients.isConfigured && clients.firestore);
};
export { firebaseConfig };
