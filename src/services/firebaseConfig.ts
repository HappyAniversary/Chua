import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';

interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

const rawEnv: FirebaseEnvConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID ?? '').trim(),
  databaseURL: (import.meta.env.VITE_FIREBASE_DATABASE_URL ?? '').trim(),
};

function hasValidFirebaseCredentials(cfg: FirebaseEnvConfig): boolean {
  if (!cfg.apiKey || !cfg.projectId) {
    return false;
  }
  const lowerKey = cfg.apiKey.toLowerCase();
  const lowerProj = cfg.projectId.toLowerCase();
  if (
    lowerKey.includes('your_') ||
    lowerKey === 'undefined' ||
    lowerProj.includes('your_') ||
    lowerProj === 'undefined'
  ) {
    return false;
  }
  return true;
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let rtdbInstance: Database | null = null;
let configuredFlag = false;

if (hasValidFirebaseCredentials(rawEnv)) {
  try {
    const firebaseOptions = {
      apiKey: rawEnv.apiKey,
      authDomain: rawEnv.authDomain || `${rawEnv.projectId}.firebaseapp.com`,
      projectId: rawEnv.projectId,
      storageBucket: rawEnv.storageBucket || `${rawEnv.projectId}.appspot.com`,
      messagingSenderId: rawEnv.messagingSenderId || undefined,
      appId: rawEnv.appId || undefined,
      databaseURL:
        rawEnv.databaseURL || `https://${rawEnv.projectId}-default-rtdb.firebaseio.com`,
    };

    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseOptions);
    authInstance = getAuth(appInstance);
    firestoreInstance = getFirestore(appInstance);

    try {
      rtdbInstance = getDatabase(appInstance, firebaseOptions.databaseURL);
    } catch {
      rtdbInstance = null;
    }

    configuredFlag = true;
  } catch (error) {
    console.warn(
      '[FirebaseConfig] Không thể khởi tạo Firebase Cloud, tự động chuyển sang chế độ Local Fallback:',
      error
    );
    appInstance = null;
    authInstance = null;
    firestoreInstance = null;
    rtdbInstance = null;
    configuredFlag = false;
  }
}

export const isFirebaseConfigured: boolean = configuredFlag;
export const firebaseApp: FirebaseApp | null = appInstance;
export const firebaseAuth: Auth | null = authInstance;
export const firestoreDb: Firestore | null = firestoreInstance;
export const realtimeDb: Database | null = rtdbInstance;

export function getBackendMode(): 'firebase' | 'local' {
  return isFirebaseConfigured ? 'firebase' : 'local';
}
