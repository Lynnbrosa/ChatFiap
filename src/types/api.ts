import { ChatUser } from './user';

/** Corpo de erro padronizado devolvido pela API. */
export type ApiErrorBody = {
  error: string;
  message: string;
};

export type NotifyMessageResponse = {
  success: true;
  duplicate?: boolean;
  sentCount: number;
  failedCount?: number;
  recipientCount?: number;
  policyUsed?: string;
};

export type SyncGroupMembersResponse = {
  success: true;
  groupExists: boolean;
  memberCount: number;
};

export type SharedProfileResponse = {
  profile: ChatUser;
};
