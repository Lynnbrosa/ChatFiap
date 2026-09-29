import { adminFirestore } from './firebaseAdmin';
import { MessageRecord, NotificationPolicy, parseGroupRecord, readStringArray } from './types';

export interface ResolvedRecipients {
  recipientUids: string[];
  conversationTitle: string;
  senderName: string;
  policyUsed: NotificationPolicy | 'direct' | 'rejected';
  /** Motivo quando nada é enviado (útil nos logs e na resposta). */
  reason?: string;
}

async function getUserName(uid: string): Promise<string> {
  const snap = await adminFirestore.collection('users').doc(uid).get();
  const name = snap.get('name');
  return typeof name === 'string' && name.length > 0 ? name : 'Nova mensagem';
}

/**
 * Calcula NO SERVIDOR quem pode receber o push da mensagem, a partir dos dados do Firestore.
 * Nunca usa uma lista de destinatários enviada pelo aplicativo.
 */
export async function resolveRecipients(
  conversationId: string,
  message: MessageRecord
): Promise<ResolvedRecipients> {
  const { senderId } = message;
  const senderName = await getUserName(senderId);

  if (message.conversationType === 'direct') {
    const directDoc = await adminFirestore.collection('directConversations').doc(conversationId).get();
    if (!directDoc.exists) {
      return { recipientUids: [], conversationTitle: senderName, senderName, policyUsed: 'rejected', reason: 'direct_not_found' };
    }

    const participantIds = readStringArray(directDoc.get('participantIds'));
    // Apenas participantes: o remetente precisa fazer parte da conversa
    if (participantIds.length !== 2 || !participantIds.includes(senderId)) {
      return { recipientUids: [], conversationTitle: senderName, senderName, policyUsed: 'rejected', reason: 'sender_not_participant' };
    }

    // O remetente nunca recebe o próprio push
    const recipient = participantIds.find((uid) => uid !== senderId);
    return {
      recipientUids: recipient ? [recipient] : [],
      conversationTitle: senderName,
      senderName,
      policyUsed: 'direct',
    };
  }

  const groupDoc = await adminFirestore.collection('groups').doc(conversationId).get();
  const group = groupDoc.exists ? parseGroupRecord(groupDoc.id, groupDoc.data()) : null;
  if (!group) {
    return { recipientUids: [], conversationTitle: 'Grupo', senderName, policyUsed: 'rejected', reason: 'group_not_found' };
  }

  if (!group.memberIds.includes(senderId)) {
    return { recipientUids: [], conversationTitle: group.name, senderName, policyUsed: 'rejected', reason: 'sender_not_member' };
  }

  const otherMembers = group.memberIds.filter((uid) => uid !== senderId);
  let recipients: string[] = [];

  switch (group.notificationPolicy) {
    case 'all_group_messages':
      recipients = otherMembers;
      break;

    case 'mentioned_members': {
      const selected = new Set<string>(message.mentionedUserIds);
      if (message.target.type === 'member') selected.add(message.target.memberId);
      // Só integrantes ativos, nunca o remetente
      recipients = otherMembers.filter((uid) => selected.has(uid));
      break;
    }

    case 'direct_messages_only':
    case 'disabled':
      recipients = [];
      break;
  }

  return {
    recipientUids: recipients,
    conversationTitle: group.name,
    senderName,
    policyUsed: group.notificationPolicy,
  };
}
