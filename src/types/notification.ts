import { ConversationType } from './chat';
import { NotificationPolicy } from './group';

export type NotificationSettings = {
  conversationId: string;
  policy: NotificationPolicy;
  updatedBy: string;
  updatedAt: number;
};

/** Dados enviados pela API no payload do push (campo `data`). */
export type PushNotificationPayload = {
  conversationId: string;
  conversationType: ConversationType;
  messageId?: string;
};

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'permission_denied' }
  | { status: 'unavailable'; reason: string }
  | { status: 'no_token'; reason: string };

export type PushRegistrationStatus = PushRegistrationResult['status'] | 'idle' | 'registering';
