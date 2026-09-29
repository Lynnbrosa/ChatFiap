export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Conversations: undefined;
  Users: {
    mode: 'direct' | 'group_select';
    selectedIds?: string[];
    onSelectMembers?: (uids: string[]) => void;
  };
  GroupForm: {
    groupId?: string;
  };
  Chat: {
    conversationId: string;
    conversationType: 'direct' | 'group';
    title: string;
    photoUrl?: string;
    directParticipantUid?: string;
  };
  Profile: {
    userUid: string;
  };
  GroupMembers: {
    groupId: string;
  };
};
