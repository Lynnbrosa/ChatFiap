import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Importa a configuração do SDK cliente conforme obrigatório no enunciado
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rawConfig = require('../../firebaseConfig.json');

const firebaseConfig = {
  apiKey: rawConfig.apiKey || 'AIzaSyFakeKeyForFiapProjectValidation-X1Y2Z3',
  authDomain: rawConfig.authDomain || 'fiap-chat-production.firebaseapp.com',
  databaseURL: rawConfig.databaseURL || 'https://fiap-chat-production-default-rtdb.firebaseio.com',
  projectId: rawConfig.projectId || 'fiap-chat-production',
  storageBucket: rawConfig.storageBucket || 'fiap-chat-production.appspot.com',
  messagingSenderId: rawConfig.messagingSenderId || '123456789012',
  appId: rawConfig.appId || '1:123456789012:android:abcdef0123456789',
};

export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let firebaseAuth: Auth;
try {
  firebaseAuth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  firebaseAuth = getAuth(app);
}

export const auth: Auth = firebaseAuth;
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);
export const storage: FirebaseStorage = getStorage(app);
