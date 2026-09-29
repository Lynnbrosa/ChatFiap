import { adminFirestore } from './firebaseAdmin';

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
  conversationType: 'direct' | 'group';
  senderId: string;
  senderName?: string;
  text: string;
  target?: MessageTarget;
  mentionedUserIds?: string[];
  createdAt: number;
}

export interface GroupRecord {
  id: string;
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  createdAt: number;
  updatedAt: number;
}

export interface DirectConversationRecord {
  id: string;
  type: 'direct';
  participantIds: [string, string];
  createdAt: number;
}

export interface ResolvedRecipients {
  recipientUids: string[];
  conversationTitle: string;
  policyUsed: string;
}

/**
 * Resolve com segurança os destinatários de uma notificação a partir das regras de negócio
 * e políticas configuradas no Firestore, sem confiar no cliente.
 */
export async function resolveRecipients(
  message: MessageRecord
): Promise<ResolvedRecipients> {
  const { conversationId, conversationType, senderId, target, mentionedUserIds } = message;

  if (conversationType === 'direct') {
    const directDoc = await adminFirestore
      .collection('directConversations')
      .doc(conversationId)
      .get();

    if (!directDoc.exists) {
      console.warn(`[RecipientResolver] Conversa direta ${conversationId} não encontrada no Firestore.`);
      return {
        recipientUids: [],
        conversationTitle: 'Mensagem privada',
        policyUsed: 'direct_conversation_not_found',
      };
    }

    const directData = directDoc.data() as DirectConversationRecord;
    const participantIds = directData.participantIds || [];

    // O remetente nunca deve receber notificação da própria mensagem
    const otherParticipant = participantIds.find((uid) => uid !== senderId);

    return {
      recipientUids: otherParticipant ? [otherParticipant] : [],
      conversationTitle: message.senderName || 'Nova mensagem direta',
      policyUsed: 'direct_default',
    };
  }

  if (conversationType === 'group') {
    const groupDoc = await adminFirestore.collection('groups').doc(conversationId).get();

    if (!groupDoc.exists) {
      console.warn(`[RecipientResolver] Grupo ${conversationId} não encontrado no Firestore.`);
      return {
        recipientUids: [],
        conversationTitle: 'Mensagem de grupo',
        policyUsed: 'group_not_found',
      };
    }

    const groupData = groupDoc.data() as GroupRecord;
    const memberIds = groupData.memberIds || [];
    const policy = groupData.notificationPolicy || 'all_group_messages';

    // Validação de segurança: apenas integrantes ativos do grupo podem ter mensagens notificadas
    if (!memberIds.includes(senderId)) {
      console.warn(`[RecipientResolver] Remetente ${senderId} não é membro ativo do grupo ${conversationId}.`);
      return {
        recipientUids: [],
        conversationTitle: groupData.name || 'Grupo',
        policyUsed: 'sender_not_a_member',
      };
    }

    let calculatedRecipients: string[] = [];

    switch (policy) {
      case 'disabled':
        // Nenhuma notificação enviada
        calculatedRecipients = [];
        break;

      case 'direct_messages_only':
        // Apenas DMs geram push; grupo desativado
        calculatedRecipients = [];
        break;

      case 'all_group_messages':
        // Todos os integrantes exceto o remetente
        calculatedRecipients = memberIds.filter((uid) => uid !== senderId);
        break;

      case 'mentioned_members': {
        const recipientsSet = new Set<string>();

        // Integrante selecionado como target explícito
        if (
          target &&
          target.type === 'member' &&
          target.memberId &&
          target.memberId !== senderId &&
          memberIds.includes(target.memberId)
        ) {
          recipientsSet.add(target.memberId);
        }

        // Integrantes mencionados na lista mentionedUserIds
        if (Array.isArray(mentionedUserIds)) {
          for (const uid of mentionedUserIds) {
            if (uid !== senderId && memberIds.includes(uid)) {
              recipientsSet.add(uid);
            }
          }
        }

        calculatedRecipients = Array.from(recipientsSet);
        break;
      }

      default:
        calculatedRecipients = memberIds.filter((uid) => uid !== senderId);
        break;
    }

    return {
      recipientUids: calculatedRecipients,
      conversationTitle: groupData.name || 'Mensagem do Grupo',
      policyUsed: policy,
    };
  }

  return {
    recipientUids: [],
    conversationTitle: 'Nova mensagem',
    policyUsed: 'unknown_type',
  };
}
