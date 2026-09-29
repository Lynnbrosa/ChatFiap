import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { adminFirestore, adminMessaging } from './firebaseAdmin';
import { ConversationType } from './types';

const expo = new Expo();

/** Dados mínimos do payload: identificam a conversa a ser aberta ao tocar na notificação. */
export type PushNotificationPayload = {
  conversationId: string;
  conversationType: ConversationType;
  messageId: string;
};

export interface SendPushOptions {
  recipientUids: string[];
  title: string;
  body: string;
  payload: PushNotificationPayload;
}

export interface SendPushResult {
  sentCount: number;
  failedCount: number;
  totalDevices: number;
  deactivatedTokens: number;
}

interface DeviceRecord {
  uid: string;
  deviceId: string;
  token: string;
}

async function loadActiveDevices(recipientUids: string[]): Promise<DeviceRecord[]> {
  const snapshots = await Promise.all(
    recipientUids.map((uid) =>
      adminFirestore
        .collection('users')
        .doc(uid)
        .collection('devices')
        .where('enabled', '==', true)
        .get()
        .then((snap) => ({ uid, snap }))
    )
  );

  const devices: DeviceRecord[] = [];
  for (const { uid, snap } of snapshots) {
    snap.forEach((doc) => {
      const token = doc.get('token');
      if (typeof token === 'string' && token.length > 0) {
        devices.push({ uid, deviceId: doc.id, token });
      }
    });
  }
  return devices;
}

/** Desativa um token inválido para não tentar enviar para ele de novo. */
async function deactivateDeviceToken(device: DeviceRecord): Promise<void> {
  try {
    await adminFirestore
      .collection('users')
      .doc(device.uid)
      .collection('devices')
      .doc(device.deviceId)
      .update({ enabled: false, deactivatedAt: Date.now() });
    console.log(`[NotificationSender] Token do dispositivo ${device.deviceId} desativado.`);
  } catch (err) {
    console.error(`[NotificationSender] Falha ao desativar token ${device.deviceId}:`, err);
  }
}

function isInvalidFcmTokenError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/invalid-argument'
  );
}

/**
 * Envia o push para os dispositivos ativos dos destinatários.
 * - Tokens Expo (ExponentPushToken[...]) → Expo Push Service, que entrega via FCM (Android) e APNs (iOS).
 * - Tokens FCM nativos → Firebase Cloud Messaging diretamente pelo Admin SDK.
 * Tokens inválidos são desativados no Firestore.
 */
export async function sendPushNotifications(options: SendPushOptions): Promise<SendPushResult> {
  const { recipientUids, title, body, payload } = options;
  const result: SendPushResult = { sentCount: 0, failedCount: 0, totalDevices: 0, deactivatedTokens: 0 };

  if (recipientUids.length === 0) return result;

  const devices = await loadActiveDevices(recipientUids);
  result.totalDevices = devices.length;
  if (devices.length === 0) return result;

  const expoDevices = devices.filter((d) => Expo.isExpoPushToken(d.token));
  const fcmDevices = devices.filter((d) => !Expo.isExpoPushToken(d.token));

  // 1) Expo Push Service
  if (expoDevices.length > 0) {
    const messages: ExpoPushMessage[] = expoDevices.map((device) => ({
      to: device.token,
      sound: 'default',
      title,
      body,
      data: payload,
      priority: 'high',
      channelId: 'chat-messages',
    }));

    // Os tickets voltam na mesma ordem das mensagens
    let offset = 0;
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const chunkDevices = expoDevices.slice(offset, offset + chunk.length);
      offset += chunk.length;

      try {
        const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'ok') {
            result.sentCount++;
          } else {
            result.failedCount++;
            console.warn('[NotificationSender] Expo recusou o envio:', ticket.message);
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await deactivateDeviceToken(chunkDevices[i]);
              result.deactivatedTokens++;
            }
          }
        }
      } catch (err) {
        console.error('[NotificationSender] Falha no lote do Expo Push Service:', err);
        result.failedCount += chunk.length;
      }
    }
  }

  // 2) Firebase Cloud Messaging (tokens nativos)
  for (const device of fcmDevices) {
    try {
      await adminMessaging.send({
        token: device.token,
        notification: { title, body },
        data: payload,
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'chat-messages' },
        },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      result.sentCount++;
    } catch (err) {
      result.failedCount++;
      console.warn(`[NotificationSender] Erro FCM no dispositivo ${device.deviceId}:`, err);
      if (isInvalidFcmTokenError(err)) {
        await deactivateDeviceToken(device);
        result.deactivatedTokens++;
      }
    }
  }

  console.log(
    `[NotificationSender] ${result.sentCount} enviada(s), ${result.failedCount} falha(s), ${result.totalDevices} dispositivo(s).`
  );
  return result;
}
