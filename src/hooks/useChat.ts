import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChatMessage, ConversationType, MessageTarget } from '../types/chat';
import { listenMessages, requestPushForMessage, sendMessage } from '../services/chatService';
import { syncGroupMembers } from '../services/groupService';
import { getFriendlyErrorMessage, isPermissionDenied } from '../utils/errors';
import { useAuth } from './useAuth';

export interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  /** A leitura foi negada pelas regras (ex.: integrante removido do grupo). */
  accessDenied: boolean;
  /** Aviso não bloqueante: a mensagem foi salva, mas o push não pôde ser solicitado. */
  pushWarning: string | null;
  sendChatMessage: (
    text: string,
    target?: MessageTarget,
    mentionedUserIds?: string[]
  ) => Promise<boolean>;
  clearChatError: () => void;
  clearPushWarning: () => void;
  messageCount: number;
}

/**
 * Mensagens em tempo real de uma conversa aberta no Firebase Realtime Database.
 * O listener é removido quando a tela é desmontada ou quando a conversa muda.
 */
export function useChat(
  conversationId: string,
  conversationType: ConversationType,
  isActiveMember: boolean
): UseChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [pushWarning, setPushWarning] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const syncAttemptedRef = useRef<boolean>(false);

  const clearChatError = useCallback(() => setError(null), []);
  const clearPushWarning = useCallback(() => setPushWarning(null), []);

  useEffect(() => {
    syncAttemptedRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAccessDenied(false);

    const unsubscribe = listenMessages(
      conversationId,
      (incoming) => {
        setMessages([...incoming].sort((a, b) => a.createdAt - b.createdAt));
        setLoading(false);
      },
      async (listenError) => {
        setLoading(false);

        // Integrante de grupo recém-criado/adicionado cujo acesso ainda não foi espelhado no RTDB
        if (
          isPermissionDenied(listenError) &&
          conversationType === 'group' &&
          isActiveMember &&
          !syncAttemptedRef.current
        ) {
          syncAttemptedRef.current = true;
          try {
            await syncGroupMembers(conversationId);
            setRetryKey((k) => k + 1);
            return;
          } catch (syncError) {
            console.warn('[useChat] Falha ao sincronizar integrantes:', syncError);
          }
        }

        if (isPermissionDenied(listenError)) {
          setAccessDenied(true);
          setMessages([]);
        } else {
          setError(getFriendlyErrorMessage(listenError, 'Não foi possível carregar as mensagens.'));
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [conversationId, conversationType, isActiveMember, retryKey]);

  const sendChatMessage = useCallback(
    async (
      text: string,
      target: MessageTarget = { type: 'conversation' },
      mentionedUserIds: string[] = []
    ): Promise<boolean> => {
      if (!user) {
        setError('Sua sessão expirou. Entre novamente para enviar mensagens.');
        return false;
      }
      if (!text.trim()) return false;

      setSending(true);
      setError(null);

      let messageId: string;
      try {
        const message = await sendMessage({
          conversationId,
          conversationType,
          senderId: user.uid,
          senderName: user.name || 'Usuário',
          text,
          target,
          mentionedUserIds,
        });
        messageId = message.id;
      } catch (err) {
        console.error('[useChat] Erro no envio da mensagem:', err);
        setError(getFriendlyErrorMessage(err, 'Falha ao enviar a mensagem. Tente novamente.'));
        return false;
      } finally {
        setSending(false);
      }

      // O push é solicitado depois da persistência e não bloqueia a conversa
      requestPushForMessage(conversationId, messageId)
        .then(() => setPushWarning(null))
        .catch((pushErr: unknown) => {
          console.warn('[useChat] Falha ao solicitar push à API:', pushErr);
          setPushWarning(
            `Mensagem enviada, mas a notificação não foi disparada: ${getFriendlyErrorMessage(
              pushErr,
              'API de notificações indisponível.'
            )}`
          );
        });

      return true;
    },
    [conversationId, conversationType, user]
  );

  const messageCount = useMemo(() => messages.length, [messages]);

  return {
    messages,
    loading,
    sending,
    error,
    accessDenied,
    pushWarning,
    sendChatMessage,
    clearChatError,
    clearPushWarning,
    messageCount,
  };
}
