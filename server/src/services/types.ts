export type ConversationType = 'direct' | 'group';

export type NotificationPolicy =
  | 'all_group_messages'
  | 'mentioned_members'
  | 'direct_messages_only'
  | 'disabled';

export type MessageTarget =
  | { type: 'conversation' }
  | { type: 'member'; memberId: string };

export interface MessageRecord {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  senderName?: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
}

export interface GroupRecord {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
}

const POLICIES: readonly NotificationPolicy[] = [
  'all_group_messages',
  'mentioned_members',
  'direct_messages_only',
  'disabled',
];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Valida em tempo de execução a mensagem lida do Realtime Database. */
export function parseMessageRecord(value: unknown): MessageRecord | null {
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
  if (typeof rawTarget === 'object' && rawTarget !== null) {
    const t = rawTarget as Record<string, unknown>;
    if (t.type === 'member' && typeof t.memberId === 'string') {
      target = { type: 'member', memberId: t.memberId };
    }
  }

  return {
    id: v.id,
    conversationId: v.conversationId,
    conversationType: v.conversationType,
    senderId: v.senderId,
    senderName: typeof v.senderName === 'string' ? v.senderName : undefined,
    text: v.text,
    target,
    // O RTDB não guarda arrays vazios; às vezes devolve objeto {0: ..., 1: ...}
    mentionedUserIds: isStringArray(v.mentionedUserIds)
      ? v.mentionedUserIds
      : typeof v.mentionedUserIds === 'object' && v.mentionedUserIds !== null
        ? Object.values(v.mentionedUserIds).filter((id): id is string => typeof id === 'string')
        : [],
    createdAt: v.createdAt,
  };
}

/** Valida em tempo de execução o documento de grupo lido do Firestore. */
export function parseGroupRecord(id: string, value: unknown): GroupRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (
    typeof v.name !== 'string' ||
    typeof v.ownerId !== 'string' ||
    !isStringArray(v.memberIds) ||
    typeof v.memberLimit !== 'number'
  ) {
    return null;
  }

  const policy = POLICIES.find((p) => p === v.notificationPolicy) ?? 'all_group_messages';

  return {
    id,
    name: v.name,
    ownerId: v.ownerId,
    memberIds: v.memberIds,
    memberLimit: v.memberLimit,
    notificationPolicy: policy,
  };
}

export function readStringArray(value: unknown): string[] {
  return isStringArray(value) ? value : [];
}
