import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from '../services/notificationService';
import { PushNotificationPayload } from '../types/notification';
import { useAuth } from './useAuth';

export interface UseNotificationsReturn {
  pushToken: string | null;
  permissionGranted: boolean;
  registerToken: () => Promise<void>;
  lastReceivedNotification: Notifications.Notification | null;
}

/**
 * Hook para gerenciar push notifications, registro de dispositivo e direcionamento ao tocar
 */
export function useNotifications(
  onNotificationTap?: (payload: PushNotificationPayload) => void
): UseNotificationsReturn {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [lastReceivedNotification, setLastReceivedNotification] =
    useState<Notifications.Notification | null>(null);

  const registerToken = useCallback(async () => {
    if (!user) return;
    try {
      const token = await registerForPushNotificationsAsync(user.uid);
      if (token) {
        setPushToken(token);
        setPermissionGranted(true);
      } else {
        setPermissionGranted(false);
      }
    } catch (err) {
      console.warn('[useNotifications] Falha no registro do token:', err);
      setPermissionGranted(false);
    }
  }, [user]);

  // Registro automático do token quando o usuário autenticar
  useEffect(() => {
    if (user?.uid) {
      registerToken();
    }
  }, [user?.uid, registerToken]);

  // Listeners de notificações
  useEffect(() => {
    // 1. Notificação recebida com o app em primeiro plano
    const receivedSub = addNotificationReceivedListener((notification) => {
      setLastReceivedNotification(notification);
    });

    // 2. Notificação tocada pelo usuário (redireciona para o chat)
    const responseSub = addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as PushNotificationPayload;
      if (data && data.conversationId && onNotificationTap) {
        onNotificationTap(data);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [onNotificationTap]);

  return {
    pushToken,
    permissionGranted,
    registerToken,
    lastReceivedNotification,
  };
}
