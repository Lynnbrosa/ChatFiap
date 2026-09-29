import { ConversationType } from './chat';

/** Tela para a qual a seleção de integrantes deve retornar. */
export type MemberSelectionTarget =
  | { screen: 'GroupForm' }
  | { screen: 'GroupMembers'; groupId: string };

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Conversations: undefined;
  Users:
    | { mode: 'direct' }
    | {
        mode: 'group_select';
        target: MemberSelectionTarget;
        selectedIds?: string[];
        excludeIds?: string[];
        maxSelectable?: number;
      };
  GroupForm: {
    groupId?: string;
    selectedMemberIds?: string[];
  };
  Chat: {
    conversationId: string;
    conversationType: ConversationType;
    title?: string;
    photoUrl?: string;
    directParticipantUid?: string;
  };
  Profile: {
    userUid: string;
  };
  GroupMembers: {
    groupId: string;
    selectedMemberIds?: string[];
  };
};
