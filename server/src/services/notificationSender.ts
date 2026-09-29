import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { adminFirestore, adminInstance } from './firebaseAdmin';

const expo = new Expo();

export type PushNotificationPayload = {
  conversationId: string;
  conversationType: 'direct' | 'group';
  messageId: string;
  senderId: string;
  [key: string]: unknown;
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
  recipientUids: string[];
}

interface DeviceRecord {
  token: string;
  platform: 'ios' | 'android' | 'web';
  enabled: boolean;
  updatedAt: number;
  deviceId: string;
  uid: string;
}

/**
 * Envia notificações push para a lista de UIDs resolvidos.
 * Consulta tokens salvos no Firestore, despacha as mensagens e desativa tokens inválidos.
 */
export async function sendPushNotifications(
  options: SendPushOptions
): Promise<SendPushResult> {
  const { recipientUids, title, body, payload } = options;

  if (recipientUids.length === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
      totalDevices: 0,
      recipientUids: [],
    };
  }

  // 1. Buscar todos os dispositivos ativos dos destinatários no Firestore
  const activeDevices: DeviceRecord[] = [];

  for (const uid of recipientUids) {
    try {
      const devicesSnapshot = await adminFirestore
        .collection('users')
        .doc(uid)
        .collection('devices')
        .where('enabled', '==', true)
        .get();

      devicesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.token && typeof data.token === 'string') {
          activeDevices.push({
            token: data.token,
            platform: data.platform || 'android',
            enabled: data.enabled !== false,
            updatedAt: data.updatedAt || Date.now(),
            deviceId: doc.id,
            uid,
          });
        }
      });
    } catch (err) {
      console.error(`[NotificationSender] Erro ao buscar dispositivos do usuário ${uid}:`, err);
    }
  }

  if (activeDevices.length === 0) {
    console.log('[NotificationSender] Nenhum dispositivo ativo encontrado para os destinatários.');
    return {
      sentCount: 0,
      failedCount: 0,
      totalDevices: 0,
      recipientUids,
    };
  }

  // 2. Separar tokens Expo vs FCM nativo
  const expoMessages: (ExpoPushMessage & { deviceRecord: DeviceRecord })[] = [];
  const fcmDevices: DeviceRecord[] = [];

  for (const device of activeDevices) {
    if (Expo.isExpoPushToken(device.token)) {
      expoMessages.push({
        to: device.token,
        sound: 'default',
        title,
        body,
        data: payload,
        priority: 'high',
        channelId: 'chat-messages',
        deviceRecord: device,
      });
    } else {
      fcmDevices.push(device);
    }
  }

  let sentCount = 0;
  let failedCount = 0;

  // 3. Enviar notificações via Expo Push Service
  if (expoMessages.length > 0) {
    const chunks = expo.chunkPushNotifications(expoMessages);
    for (const chunk of chunks) {
      try {
        const ticketChunk: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

        for (let i = 0; i < ticketChunk.length; i++) {
          const ticket = ticketChunk[i];
          const originalMessage = chunk[i] as ExpoPushMessage & { deviceRecord: DeviceRecord };

          if (ticket.status === 'ok') {
            sentCount++;
          } else if (ticket.status === 'error') {
            failedCount++;
            console.error(`[NotificationSender] Erro ao enviar para token Expo:`, ticket.message, ticket.details);

            // Desativar token se o dispositivo foi desregistrado
            if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
              await deactivateDeviceToken(originalMessage.deviceRecord.uid, originalMessage.deviceRecord.deviceId);
            }
          }
        }
      } catch (expoErr) {
        console.error('[NotificationSender] Erro no envio do lote Expo:', expoErr);
        failedCount += chunk.length;
      }
    }
  }

  // 4. Enviar notificações via Firebase Cloud Messaging direto
  if (fcmDevices.length > 0) {
    try {
      const messaging = adminInstance.messaging();
      for (const device of fcmDevices) {
        try {
          await messaging.send({
            token: device.token,
            notification: {
              title,
              body,
            },
            data: {
              conversationId: String(payload.conversationId),
              conversationType: String(payload.conversationType),
              messageId: String(payload.messageId),
              senderId: String(payload.senderId),
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'chat-messages',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
          });
          sentCount++;
        } catch (fcmErr: unknown) {
          failedCount++;
          console.error(`[NotificationSender] Erro FCM no dispositivo ${device.deviceId}:`, fcmErr);
          const errorMsg = String(fcmErr);
          if (
            errorMsg.includes('registration-token-not-registered') ||
            errorMsg.includes('invalid-registration-token')
          ) {
            await deactivateDeviceToken(device.uid, device.deviceId);
          }
        }
      }
    } catch (fcmGlobalErr) {
      console.error('[NotificationSender] Erro ao instanciar FCM Admin Messaging:', fcmGlobalErr);
    }
  }

  console.log(
    `[NotificationSender] Resumo: ${sentCount} enviadas, ${failedCount} falhas. Dispositivos: ${activeDevices.length}.`
  );

  return {
    sentCount,
    failedCount,
    totalDevices: activeDevices.length,
    recipientUids,
  };
}

/**
 * Desativa token no Firestore para evitar envios desnecessários a dispositivos inválidos
 */
async function deactivateDeviceToken(uid: string, deviceId: string): Promise<void> {
  try {
    await adminFirestore
      .collection('users')
      .doc(uid)
      .collection('devices')
      .doc(deviceId)
      .update({
        enabled: false,
        deactivatedAt: Date.now(),
      });
    console.log(`[NotificationSender] Dispositivo ${deviceId} do usuário ${uid} desativado com sucesso.`);
  } catch (err) {
    console.error(`[NotificationSender] Falha ao desativar token ${deviceId}:`, err);
  }
}
