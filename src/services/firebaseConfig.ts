import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
// @ts-ignore
import appletConfig from '../../firebase-applet-config.json';

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
  clients.firestore = null;
  clients.isConfigured = false;
  console.warn('[FirebaseConfig] Firestore quota limit exceeded. Disabling cloud connection; app running seamlessly in offline local IndexedDB mode.');
};

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    const quotaTimestamp = typeof localStorage !== 'undefined' ? localStorage.getItem('hitoms_firestore_quota_exceeded') : null;
    const isQuotaExceededPreviously = quotaTimestamp ? (Date.now() - Number(quotaTimestamp) < 24 * 60 * 60 * 1000) : true; // Default to quota-safe offline mode if quota was hit

    if (isQuotaExceededPreviously) {
      console.warn('[FirebaseConfig] Operating in local IndexedDB mode (Firestore quota limit active).');
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

      // Immediately disable network to prevent automatic SDK background sync retries on quota limit
      import('firebase/firestore').then(({ disableNetwork }) => {
        disableNetwork(firestore).catch(() => {});
      });

      clients = {
        app,
        auth,
        firestore,
        isConfigured: true,
        databaseId,
      };

      signInAnonymously(auth).catch((err) => {
        console.warn('[FirebaseConfig] Anonymous sign-in failed (offline or credentials disabled):', err?.message);
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
export const isFirebaseConfigured = () => clients.isConfigured;
export { firebaseConfig };

