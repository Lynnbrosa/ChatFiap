export type MessageTarget =
  | { type: 'conversation' }
  | { type: 'member'; memberId: string };

export type ChatMessage = {
  id: string;
  conversationId: string;
  conversationType: 'direct' | 'group';
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
