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

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);
    // Connect to specific databaseId if provided
    const firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

    clients = {
      app,
      auth,
      firestore,
      isConfigured: true,
      databaseId,
    };

    // Ensure client is authenticated with Firebase for secure Firestore queries
    signInAnonymously(auth).catch((err) => {
      console.warn('[FirebaseConfig] Anonymous sign-in failed (offline or credentials disabled):', err?.message);
    });
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

