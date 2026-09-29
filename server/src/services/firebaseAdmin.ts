import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Na hospedagem a chave costuma ser colada com "\n" literais; aqui viram quebras de linha reais
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const databaseURL = process.env.FIREBASE_DATABASE_URL;

/** Com os emuladores do Firebase ligados a API funciona sem credencial (apenas desenvolvimento). */
const usingEmulators = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
);

export const credentialsConfigured = Boolean(projectId && clientEmail && privateKey && databaseURL);

if (admin.apps.length === 0) {
  if (credentialsConfigured && projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      databaseURL,
    });
    console.log('[FirebaseAdmin] Inicializado com a conta de serviço.');
  } else if (usingEmulators) {
    admin.initializeApp({ projectId, databaseURL });
    console.log('[FirebaseAdmin] Inicializado apontando para os emuladores locais.');
  } else {
    // Sem credenciais nada funciona: falhar cedo deixa o problema visível no log da hospedagem
    throw new Error(
      'Credenciais do Firebase Admin ausentes. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, ' +
        'FIREBASE_PRIVATE_KEY e FIREBASE_DATABASE_URL nas variáveis secretas da hospedagem.'
    );
  }
}

export const adminInstance = admin;
export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
export const adminDatabase = admin.database();
export const adminMessaging = admin.messaging();
