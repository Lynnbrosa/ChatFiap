import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addPushTokenChangeListener,
  parseNotificationPayload,
} from '../services/notificationService';
import { PushRegistrationStatus } from '../types/notification';
import { RootStackParamList } from '../types/navigation';
import { getFriendlyErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';

export interface UsePushRegistrationReturn {
  status: PushRegistrationStatus;
  /** Explicação para o usuário quando o push não está ativo. */
  message: string | null;
  pushToken: string | null;
  retry: () => void;
  lastReceivedNotification: Notifications.Notification | null;
}

/**
 * Pede permissão, registra o token do dispositivo quando o usuário entra e
 * re-registra se o sistema trocar o token.
 */
export function usePushRegistration(): UsePushRegistrationReturn {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [status, setStatus] = useState<PushRegistrationStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [lastReceivedNotification, setLastReceivedNotification] =
    useState<Notifications.Notification | null>(null);

  const register = useCallback(async () => {
    if (!uid) return;
    setStatus('registering');
    try {
      const result = await registerForPushNotificationsAsync(uid);
      setStatus(result.status);
      if (result.status === 'registered') {
        setPushToken(result.token);
        setMessage(null);
      } else if (result.status === 'permission_denied') {
        setMessage('Você negou a permissão de notificações. Ative nas configurações do aparelho.');
      } else {
        setMessage(result.reason);
      }
    } catch (err) {
      console.warn('[usePushRegistration] Falha no registro do token:', err);
      setStatus('no_token');
      setMessage(getFriendlyErrorMessage(err, 'Não foi possível registrar este dispositivo.'));
    }
  }, [uid]);

  useEffect(() => {
    register();
  }, [register]);

  useEffect(() => {
    if (!uid || Platform.OS === 'web') return;

    const receivedSub = addNotificationReceivedListener(setLastReceivedNotification);
    const tokenSub = addPushTokenChangeListener(() => {
      register();
    });

    return () => {
      receivedSub.remove();
      tokenSub.remove();
    };
  }, [uid, register]);

  return { status, message, pushToken, retry: register, lastReceivedNotification };
}

type LastResponse = ReturnType<typeof Notifications.useLastNotificationResponse>;

// Na web o módulo nativo de notificações não existe; o hook escolhido é fixo por plataforma
const useLastResponse: () => LastResponse =
  Platform.OS === 'web' ? () => null : Notifications.useLastNotificationResponse;

/**
 * Ao tocar numa notificação (app aberto, em segundo plano ou fechado), abre a conversa
 * indicada no payload. `useLastNotificationResponse` também cobre o caso de o app ter sido
 * iniciado pelo toque (cold start).
 */
export function useNotificationNavigation(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  navigationReady: boolean,
  isAuthenticated: boolean
): void {
  const lastResponse = useLastResponse();

  useEffect(() => {
    if (!lastResponse || !navigationReady || !isAuthenticated) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const payload = parseNotificationPayload(lastResponse.notification.request.content.data);
    if (payload && navigationRef.isReady()) {
      navigationRef.navigate('Chat', {
        conversationId: payload.conversationId,
        conversationType: payload.conversationType,
      });
    }
    Notifications.clearLastNotificationResponse();
  }, [lastResponse, navigationReady, isAuthenticated, navigationRef]);
}
