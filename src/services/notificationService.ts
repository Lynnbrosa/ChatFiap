import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { disableDeviceToken, registerDeviceToken } from './userService';
import { EAS_PROJECT_ID } from '../config/env';
import { DevicePlatform } from '../types/user';
import { PushNotificationPayload, PushRegistrationResult } from '../types/notification';

export const CHAT_CHANNEL_ID = 'chat-messages';
const DEVICE_ID_STORAGE_KEY = '@fiap-chat/device-id';

/** Conversa aberta na tela no momento — o push dela não é exibido em primeiro plano. */
let activeConversationId: string | null = null;

export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
}

// Comportamento das notificações recebidas com o app em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const payload = parseNotificationPayload(notification.request.content.data);
    const isOpenConversation =
      payload !== null && payload.conversationId === activeConversationId;

    return {
      shouldShowBanner: !isOpenConversation,
      shouldShowList: !isOpenConversation,
      shouldPlaySound: !isOpenConversation,
      shouldSetBadge: false,
    };
  },
});

/** Valida o payload recebido e garante que contém conversationId e conversationType. */
export function parseNotificationPayload(data: unknown): PushNotificationPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  if (!('conversationId' in data) || !('conversationType' in data)) return null;

  const { conversationId, conversationType } = data;
  if (typeof conversationId !== 'string' || conversationId.length === 0) return null;
  if (conversationType !== 'direct' && conversationType !== 'group') return null;

  const messageId = 'messageId' in data && typeof data.messageId === 'string' ? data.messageId : undefined;
  return { conversationId, conversationType, messageId };
}

/** Identificador estável deste aparelho (um documento por aparelho em users/{uid}/devices). */
export async function getDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (stored) return stored;

  const generated = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

function currentPlatform(): DevicePlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Solicita a permissão de notificações, obtém o Expo Push Token (entregue via FCM no
 * Android e APNs no iOS) e registra o dispositivo no Firestore.
 */
export async function registerForPushNotificationsAsync(
  userId: string
): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable', reason: 'Notificações push não estão disponíveis na versão web.' };
  }

  if (!Device.isDevice) {
    return {
      status: 'unavailable',
      reason: 'Notificações push exigem um dispositivo físico (não funcionam no emulador/simulador).',
    };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHAT_CHANNEL_ID, {
      name: 'Mensagens do chat',
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
    return { status: 'permission_denied' };
  }

  if (!EAS_PROJECT_ID) {
    return {
      status: 'no_token',
      reason: 'O projeto ainda não foi vinculado ao EAS (rode "eas init").',
    };
  }

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    token = tokenData.data;
  } catch (err) {
    console.warn('[NotificationService] Falha ao obter token push:', err);
    return {
      status: 'no_token',
      reason: 'Não foi possível obter o token deste dispositivo. Use o build instalado (APK/EAS), não o Expo Go.',
    };
  }

  const deviceId = await getDeviceId();
  await registerDeviceToken(userId, deviceId, token, currentPlatform());
  return { status: 'registered', token };
}

/** Desativa o token deste aparelho para o usuário (chamado antes do logout). */
export async function unregisterDeviceForUser(userId: string): Promise<void> {
  const deviceId = await getDeviceId();
  await disableDeviceToken(userId, deviceId);
}

/** Notificação recebida com o app aberto. */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/** O sistema pode trocar o token do dispositivo; quando isso acontece, registramos o novo. */
export function addPushTokenChangeListener(callback: () => void): Notifications.EventSubscription {
  return Notifications.addPushTokenListener(() => callback());
}
