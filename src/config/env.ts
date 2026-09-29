import Constants from 'expo-constants';

type AppExtra = {
  notificationsApiUrl?: string;
  eas?: { projectId?: string };
};

function readExtra(): AppExtra {
  const extra: AppExtra | undefined = Constants.expoConfig?.extra;
  return extra ?? {};
}

const extra = readExtra();

/**
 * URL pública (HTTPS) da API de notificações.
 * Fonte principal: `expo.extra.notificationsApiUrl` no app.json (versionado, vai junto no build do EAS).
 * A variável EXPO_PUBLIC_NOTIFICATIONS_API_URL (.env) sobrescreve em desenvolvimento.
 */
export const NOTIFICATIONS_API_URL: string = (
  process.env.EXPO_PUBLIC_NOTIFICATIONS_API_URL ||
  extra.notificationsApiUrl ||
  ''
).replace(/\/+$/, '');

export const isApiConfigured = NOTIFICATIONS_API_URL.startsWith('http');

/** projectId do EAS, necessário para gerar o Expo Push Token. Preenchido pelo `eas init`. */
export const EAS_PROJECT_ID: string | undefined =
  extra.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

/** Liga o app aos emuladores locais do Firebase (somente desenvolvimento). */
export const USE_FIREBASE_EMULATORS = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
export const FIREBASE_EMULATOR_HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost';
