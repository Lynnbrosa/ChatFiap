import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  connectAuthEmulator,
  Auth,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import rawFirebaseConfig from '../../firebaseConfig.json';
import { FIREBASE_EMULATOR_HOST, USE_FIREBASE_EMULATORS } from '../config/env';

// Configuração do SDK cliente versionada no repositório (firebaseConfig.json).
// Contém apenas identificadores públicos do projeto — nenhuma credencial administrativa.
const firebaseConfig: FirebaseOptions = rawFirebaseConfig;

/** false enquanto o firebaseConfig.json ainda estiver com os valores de exemplo. */
export const isFirebaseConfigured = !String(firebaseConfig.apiKey).startsWith('COLE_AQUI');

export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let firebaseAuth: Auth;
try {
  // Persiste a sessão no AsyncStorage para recuperá-la ao reabrir o app
  firebaseAuth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  firebaseAuth = getAuth(app);
}

export const auth: Auth = firebaseAuth;
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);

if (USE_FIREBASE_EMULATORS) {
  connectAuthEmulator(auth, `http://${FIREBASE_EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, FIREBASE_EMULATOR_HOST, 8080);
  connectDatabaseEmulator(rtdb, FIREBASE_EMULATOR_HOST, 9000);
}
