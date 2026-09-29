import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChatMessage, MessageTarget } from '../types/chat';
import { listenMessages, sendMessage } from '../services/chatService';
import { useAuth } from './useAuth';

export interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  sendChatMessage: (
    text: string,
    target?: MessageTarget,
    mentionedUserIds?: string[]
  ) => Promise<void>;
  clearChatError: () => void;
  messageCount: number;
}

/**
 * Hook para gerenciar as mensagens em tempo real de uma conversa aberta no Realtime Database
 */
export function useChat(
  conversationId: string,
  conversationType: 'direct' | 'group'
): UseChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearChatError = useCallback(() => {
    setError(null);
  }, []);

  // Listener em tempo real das mensagens no Realtime Database com limpeza obrigatória
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = listenMessages(conversationId, (incomingMessages) => {
      // Ordenação garantida por createdAt crescente
      const sorted = [...incomingMessages].sort((a, b) => a.createdAt - b.createdAt);
      setMessages(sorted);
      setLoading(false);
    });

    // Cleanup hook: remove o listener do Realtime Database quando a tela for desmontada
    return () => {
      unsubscribe();
    };
  }, [conversationId]);

  const sendChatMessage = useCallback(
    async (
      text: string,
      target: MessageTarget = { type: 'conversation' },
      mentionedUserIds: string[] = []
    ) => {
      if (!user) {
        setError('Você precisa estar autenticado para enviar mensagens.');
        return;
      }

      if (!text.trim()) {
        return;
      }

      setSending(true);
      setError(null);

      try {
        await sendMessage({
          conversationId,
          conversationType,
          senderId: user.uid,
          senderName: user.name || 'Usuário',
          text,
          target,
          mentionedUserIds,
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Falha ao enviar a mensagem. Tente novamente.';
        setError(errorMsg);
        console.error('[useChat] Erro no envio da mensagem:', err);
        throw err;
      } finally {
        setSending(false);
      }
    },
    [conversationId, conversationType, user]
  );

  const messageCount = useMemo(() => messages.length, [messages]);

  return {
    messages,
    loading,
    sending,
    error,
    sendChatMessage,
    clearChatError,
    messageCount,
  };
}
