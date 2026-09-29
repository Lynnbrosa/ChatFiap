import { NotificationPolicy } from './group';

export type NotificationSettings = {
  conversationId: string;
  policy: NotificationPolicy;
  updatedBy: string;
  updatedAt: number;
};

export type PushNotificationPayload = {
  conversationId: string;
  conversationType: 'direct' | 'group';
  messageId?: string;
  senderId?: string;
};
