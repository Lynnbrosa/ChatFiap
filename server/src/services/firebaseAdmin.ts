import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let initialized = false;

export function getFirebaseAdmin(): typeof admin {
  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;
    const databaseURL = process.env.FIREBASE_DATABASE_URL;

    if (projectId && clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          databaseURL,
        });
        console.log('[FirebaseAdmin] Inicializado com credenciais de serviço.');
      } catch (err) {
        console.error('[FirebaseAdmin] Erro ao inicializar com credenciais:', err);
      }
    } else {
      console.warn(
        '[FirebaseAdmin] Variáveis de ambiente FIREBASE_* incompletas. Tentando credenciais padrão do ambiente ou modo demonstrativo.'
      );
      try {
        admin.initializeApp({
          databaseURL,
        });
      } catch {
        // App já inicializado
      }
    }
    initialized = true;
  }

  return admin;
}

export const adminInstance = getFirebaseAdmin();
export const adminAuth = adminInstance.auth();
export const adminFirestore = adminInstance.firestore();
export const adminDatabase = adminInstance.database();
