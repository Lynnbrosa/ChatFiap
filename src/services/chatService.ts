import {
  ref,
  push,
  set,
  onValue,
  off,
  query,
  orderByChild,
  limitToLast,
  DataSnapshot,
} from 'firebase/database';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { rtdb, db, auth } from './firebase';
import { ChatMessage, DirectConversation, MessageTarget } from '../types/chat';
import { generateDirectConversationId } from '../utils/conversationId';

const NOTIFICATIONS_API_URL =
  process.env.EXPO_PUBLIC_NOTIFICATIONS_API_URL || 'http://localhost:3000';

export interface SendMessageParams {
  conversationId: string;
  conversationType: 'direct' | 'group';
  senderId: string;
  senderName: string;
  text: string;
  target?: MessageTarget;
  mentionedUserIds?: string[];
}

/**
 * Cria ou recupera uma conversa individual existente no Cloud Firestore.
 * Utiliza identificador determinístico baseado na ordenação dos UIDs dos participantes.
 */
export async function getOrCreateDirectConversation(
  userA: string,
  userB: string
): Promise<DirectConversation> {
  const conversationId = generateDirectConversationId(userA, userB);
  const convoDocRef = doc(db, 'directConversations', conversationId);

  const snap = await getDoc(convoDocRef);
  if (snap.exists()) {
    return snap.data() as DirectConversation;
  }

  const sortedParticipants = [userA, userB].sort() as [string, string];
  const newConversation: DirectConversation = {
    id: conversationId,
    type: 'direct',
    participantIds: sortedParticipants,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessage: '',
  };

  await setDoc(convoDocRef, newConversation);
  return newConversation;
}

/**
 * Escuta em tempo real todas as conversas individuais do usuário no Firestore
 */
export function listenUserDirectConversations(
  userId: string,
  callback: (conversations: DirectConversation[]) => void
): Unsubscribe {
  const convosRef = collection(db, 'directConversations');
  const q = where('participantIds', 'array-contains', userId);

  return onSnapshot(collection(db, 'directConversations'), (snapshot) => {
    const list: DirectConversation[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as DirectConversation;
      if (data.participantIds && data.participantIds.includes(userId)) {
        list.push(data);
      }
    });
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    callback(list);
  });
}

/**
 * Persiste uma mensagem no Firebase Realtime Database e despacha o pedido
 * de push notification para a API online segura.
 */
export async function sendMessage(params: SendMessageParams): Promise<ChatMessage> {
  const {
    conversationId,
    conversationType,
    senderId,
    senderName,
    text,
    target = { type: 'conversation' },
    mentionedUserIds = [],
  } = params;

  if (!text || text.trim().length === 0) {
    throw new Error('A mensagem não pode ser vazia.');
  }

  // 1. Gerar referência e ID no Realtime Database
  const messagesRef = ref(rtdb, `messages/${conversationId}`);
  const newMessageRef = push(messagesRef);
  const messageId = newMessageRef.key;

  if (!messageId) {
    throw new Error('Falha ao gerar identificador da mensagem no Realtime Database.');
  }

  const now = Date.now();
  const chatMessage: ChatMessage = {
    id: messageId,
    conversationId,
    conversationType,
    senderId,
    senderName,
    text: text.trim(),
    target,
    mentionedUserIds,
    createdAt: now,
  };

  // 2. Persistir no Realtime Database
  await set(newMessageRef, chatMessage);

  // 3. Atualizar resumo de última mensagem no Firestore
  try {
    if (conversationType === 'direct') {
      const directRef = doc(db, 'directConversations', conversationId);
      await updateDoc(directRef, {
        lastMessage: chatMessage.text,
        lastMessageAt: now,
        updatedAt: now,
      });
    } else {
      const groupRef = doc(db, 'groups', conversationId);
      await updateDoc(groupRef, {
        lastMessage: chatMessage.text,
        lastMessageAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.warn('[ChatService] Não foi possível atualizar lastMessage no Firestore:', err);
  }

  // 4. Disparar notificação push através da API online
  triggerPushNotification(conversationId, messageId).catch((pushErr) => {
    console.error('[ChatService] Falha assíncrona ao solicitar push para a API:', pushErr);
  });

  return chatMessage;
}

/**
 * Escuta as mensagens de uma conversa aberta em tempo real no Firebase Realtime Database
 */
export function listenMessages(
  conversationId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const messagesRef = ref(rtdb, `messages/${conversationId}`);
  const messagesQuery = query(messagesRef, orderByChild('createdAt'), limitToLast(100));

  const listener = onValue(
    messagesQuery,
    (snapshot: DataSnapshot) => {
      const messages: ChatMessage[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          messages.push(child.val() as ChatMessage);
        });
      }
      callback(messages);
    },
    (error) => {
      console.error('[ChatService] Erro ao escutar mensagens no Realtime Database:', error);
    }
  );

  // Função para desanexar o listener quando a tela for desmontada
  return () => {
    off(messagesQuery, 'value', listener);
  };
}

/**
 * Faz a chamada autenticada à API online para envio de push notification
 */
export async function triggerPushNotification(
  conversationId: string,
  messageId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('[ChatService] Usuário não autenticado; cancelando solicitação de push.');
    return;
  }

  try {
    const idToken = await currentUser.getIdToken();
    const endpoint = `${NOTIFICATIONS_API_URL.replace(/\/$/, '')}/notifications/messages`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        conversationId,
        messageId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `[ChatService] Resposta da API de notificações (${response.status}):`,
        errorText
      );
    } else {
      const data = await response.json();
      console.log('[ChatService] Notificação processada pela API com sucesso:', data);
    }
  } catch (netErr) {
    console.warn('[ChatService] Erro de rede ao conectar com a API de notificações:', netErr);
  }
}
