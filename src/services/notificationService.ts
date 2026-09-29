import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerDeviceTokenInFirestore } from './userService';

// Configura o comportamento da notificação quando o app está em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldPresentAlert: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Solicita permissões de push notification e registra o token do dispositivo
 * no Cloud Firestore na subcoleção privada do usuário.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[NotificationService] Notificações push físicas requerem um dispositivo real.');
  }

  // Configurar canal de notificações no Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'Mensagens do Chat',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[NotificationService] Permissão de notificação push não concedida pelo usuário.');
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;

    // Gerar um ID estável para o dispositivo baseado nas informações da plataforma
    const deviceId = `${Platform.OS}_${Device.modelName || 'device'}`.replace(/\s+/g, '_');
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    // Salvar token no Firestore
    await registerDeviceTokenInFirestore(userId, deviceId, token, platform);
    console.log('[NotificationService] Token push registrado com sucesso:', token);

    return token;
  } catch (err) {
    console.error('[NotificationService] Erro ao obter token push:', err);
    return null;
  }
}

/**
 * Adiciona listener para quando uma notificação é recebida em primeiro plano
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Adiciona listener para quando o usuário toca na notificação (abertura da conversa)
 */
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
