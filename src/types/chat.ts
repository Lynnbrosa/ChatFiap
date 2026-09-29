export type ConversationType = 'direct' | 'group';

export type MessageTarget =
  | { type: 'conversation' }
  | { type: 'member'; memberId: string };

export type ChatMessage = {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  senderName?: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
};

export type DirectConversation = {
  id: string;
  type: 'direct';
  participantIds: [string, string];
  createdAt: number;
  updatedAt?: number;
  lastMessage?: string;
  lastMessageAt?: number;
};

/** Limite de caracteres de uma mensagem (validado também nas regras do Realtime Database). */
export const MAX_MESSAGE_LENGTH = 1000;
