/**
 * Gera um ID único e determinístico para uma conversa individual a partir dos dois UIDs.
 * Garante que não existirão duas conversas individuais diferentes para o mesmo par de usuários.
 * O mesmo formato (uidMenor_uidMaior) é exigido nas regras do Firestore e do Realtime Database.
 */
export function generateDirectConversationId(uid1: string, uid2: string): string {
  if (!uid1 || !uid2) {
    throw new Error('Ambos os UIDs são obrigatórios para gerar o ID da conversa individual.');
  }

  if (uid1 === uid2) {
    throw new Error('Não é permitido criar uma conversa individual consigo mesmo.');
  }

  return [uid1, uid2].sort().join('_');
}

/** Descobre o outro participante de uma conversa individual a partir do ID. */
export function getOtherParticipantId(conversationId: string, currentUid: string): string | null {
  const parts = conversationId.split('_');
  if (parts.length !== 2 || !parts.includes(currentUid)) return null;
  return parts[0] === currentUid ? parts[1] : parts[0];
}
