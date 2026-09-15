import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

interface FirebaseClients {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  isConfigured: boolean;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let clients: FirebaseClients = {
  app: null,
  auth: null,
  firestore: null,
  isConfigured: false,
};

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    clients = {
      app,
      auth,
      firestore,
      isConfigured: true,
    };
  }
} catch (error) {
  console.warn('Firebase initialization skipped or failed. Running in pure offline local database mode.', error);
}

export const firebaseClients = clients;
export const isFirebaseConfigured = () => clients.isConfigured;
export { firebaseConfig };
