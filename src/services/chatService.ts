import {
  ref,
  push,
  set,
  onValue,
  query as rtdbQuery,
  orderByChild,
  limitToLast,
  DataSnapshot,
  Unsubscribe as RtdbUnsubscribe,
} from 'firebase/database';
import {
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db, rtdb } from './firebase';
import { directConversationDoc, directConversationsCollection, groupDoc } from './converters';
import { apiRequest } from './apiClient';
import {
  ChatMessage,
  ConversationType,
  DirectConversation,
  MAX_MESSAGE_LENGTH,
  MessageTarget,
} from '../types/chat';
import { NotifyMessageResponse } from '../types/api';
import { generateDirectConversationId } from '../utils/conversationId';
import { AppError } from '../utils/errors';

export interface SendMessageParams {
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  senderName: string;
  text: string;
  target?: MessageTarget;
  mentionedUserIds?: string[];
}

/**
 * Cria ou recupera a conversa individual no Cloud Firestore.
 * O ID é derivado dos dois UIDs ordenados e a criação ocorre numa transação,
 * então dois usuários abrindo a conversa ao mesmo tempo não geram duplicatas.
 */
export async function getOrCreateDirectConversation(
  currentUid: string,
  otherUid: string
): Promise<DirectConversation> {
  if (currentUid === otherUid) {
    throw new AppError('Você não pode iniciar uma conversa consigo mesmo.');
  }

  const conversationId = generateDirectConversationId(currentUid, otherUid);
  const conversationRef = directConversationDoc(conversationId);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(conversationRef);
    if (snap.exists()) {
      return snap.data();
    }

    const [first, second] = [currentUid, otherUid].sort();
    const now = Date.now();
    const conversation: DirectConversation = {
      id: conversationId,
      type: 'direct',
      participantIds: [first, second],
      createdAt: now,
      updatedAt: now,
    };
    transaction.set(conversationRef, conversation);
    return conversation;
  });
}

/** Escuta em tempo real as conversas individuais das quais o usuário participa. */
export function listenUserDirectConversations(
  userId: string,
  onData: (conversations: DirectConversation[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(directConversationsCollection(), where('participantIds', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data())
        .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
      onData(list);
    },
    onError
  );
}

/** Valida em tempo de execução o formato de uma mensagem lida do Realtime Database. */
export function parseChatMessage(value: unknown): ChatMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (
    typeof v.id !== 'string' ||
    typeof v.conversationId !== 'string' ||
    (v.conversationType !== 'direct' && v.conversationType !== 'group') ||
    typeof v.senderId !== 'string' ||
    typeof v.text !== 'string' ||
    typeof v.createdAt !== 'number'
  ) {
    return null;
  }

  let target: MessageTarget = { type: 'conversation' };
  const rawTarget = v.target;
  if (
    typeof rawTarget === 'object' &&
    rawTarget !== null &&
    'type' in rawTarget &&
    rawTarget.type === 'member' &&
    'memberId' in rawTarget &&
    typeof rawTarget.memberId === 'string'
  ) {
    target = { type: 'member', memberId: rawTarget.memberId };
  }

  // O Realtime Database não armazena arrays vazios, então o campo pode não existir
  const mentionedUserIds = Array.isArray(v.mentionedUserIds)
    ? v.mentionedUserIds.filter((id): id is string => typeof id === 'string')
    : [];

  return {
    id: v.id,
    conversationId: v.conversationId,
    conversationType: v.conversationType,
    senderId: v.senderId,
    senderName: typeof v.senderName === 'string' ? v.senderName : undefined,
    text: v.text,
    target,
    mentionedUserIds,
    createdAt: v.createdAt,
  };
}

/**
 * Persiste a mensagem no Firebase Realtime Database.
 * As regras do banco conferem se o remetente é o usuário autenticado e se ele participa da conversa.
 */
export async function sendMessage(params: SendMessageParams): Promise<ChatMessage> {
  const {
    conversationId,
    conversationType,
    senderId,
    senderName,
    target = { type: 'conversation' },
    mentionedUserIds = [],
  } = params;
  const text = params.text.trim();

  if (text.length === 0) {
    throw new AppError('A mensagem não pode ser vazia.');
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`);
  }

  const newMessageRef = push(ref(rtdb, `messages/${conversationId}`));
  const messageId = newMessageRef.key;
  if (!messageId) {
    throw new AppError('Falha ao gerar o identificador da mensagem.');
  }

  const now = Date.now();
  const message: ChatMessage = {
    id: messageId,
    conversationId,
    conversationType,
    senderId,
    senderName,
    text,
    target,
    mentionedUserIds: Array.from(new Set(mentionedUserIds)).filter((id) => id !== senderId),
    createdAt: now,
  };

  await set(newMessageRef, message);

  // Resumo da última mensagem para a lista de conversas (metadado no Firestore)
  const summary = {
    lastMessage: text.length > 120 ? `${text.slice(0, 117)}...` : text,
    lastMessageAt: now,
    updatedAt: now,
  };
  try {
    if (conversationType === 'direct') {
      await updateDoc(directConversationDoc(conversationId), summary);
    } else {
      await updateDoc(groupDoc(conversationId), summary);
    }
  } catch (err) {
    console.warn('[ChatService] Não foi possível atualizar o resumo da conversa:', err);
  }

  return message;
}

/**
 * Solicita à API online o envio do push da mensagem já persistida.
 * O app envia apenas conversationId e messageId: os destinatários são calculados no servidor.
 */
export async function requestPushForMessage(
  conversationId: string,
  messageId: string
): Promise<NotifyMessageResponse> {
  return apiRequest<NotifyMessageResponse>('/notifications/messages', {
    method: 'POST',
    body: { conversationId, messageId },
  });
}

/**
 * Escuta em tempo real as últimas mensagens da conversa aberta.
 * Retorna a função que remove o listener (chamada quando a tela é desmontada).
 */
export function listenMessages(
  conversationId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void
): RtdbUnsubscribe {
  const messagesQuery = rtdbQuery(
    ref(rtdb, `messages/${conversationId}`),
    orderByChild('createdAt'),
    limitToLast(100)
  );

  return onValue(
    messagesQuery,
    (snapshot: DataSnapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const parsed = parseChatMessage(child.val());
        if (parsed) messages.push(parsed);
      });
      onMessages(messages);
    },
    onError
  );
}
