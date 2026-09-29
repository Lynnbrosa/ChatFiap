/**
 * Gera um ID único e determinístico para uma conversa individual a partir dos dois UIDs.
 * Garante que não existirão duas conversas individuais diferentes para o mesmo par de usuários.
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
