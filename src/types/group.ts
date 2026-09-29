export type NotificationPolicy =
  | 'all_group_messages'
  | 'mentioned_members'
  | 'direct_messages_only'
  | 'disabled';

export const NOTIFICATION_POLICIES: readonly NotificationPolicy[] = [
  'all_group_messages',
  'mentioned_members',
  'direct_messages_only',
  'disabled',
];

export type ChatGroup = {
  id: string;
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  notificationPolicyUpdatedBy?: string;
  notificationPolicyUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
};

/** Limites aceitos para memberLimit (os mesmos valores estão nas regras do Firestore). */
export const MIN_GROUP_LIMIT = 2;
export const MAX_GROUP_LIMIT = 100;
export const MAX_GROUP_NAME_LENGTH = 60;
