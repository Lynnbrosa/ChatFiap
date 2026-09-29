import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest, requireUser } from '../middleware/authenticate';
import { adminDatabase, adminFirestore } from '../services/firebaseAdmin';
import { readStringArray } from '../services/types';
import { isValidKey } from './validation';

const router = Router();

/**
 * POST /groups/:groupId/members/sync
 *
 * Copia groups/{groupId}.memberIds (Firestore, fonte da verdade) para
 * groupMembers/{groupId} no Realtime Database. As regras do RTDB usam esse espelho para
 * permitir leitura/escrita de mensagens somente a integrantes ativos.
 * Pode ser chamado por quem é integrante agora ou por quem acabou de sair/ser removido.
 */
router.post('/:groupId/members/sync', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = requireUser(req);
  const { groupId } = req.params;

  if (!isValidKey(groupId) || groupId.includes('_')) {
    res.status(400).json({ error: 'invalid_request', message: 'Identificador de grupo inválido.' });
    return;
  }

  try {
    const mirrorRef = adminDatabase.ref(`groupMembers/${groupId}`);
    const [groupSnap, mirrorSnap] = await Promise.all([
      adminFirestore.collection('groups').doc(groupId).get(),
      mirrorRef.get(),
    ]);

    const memberIds = groupSnap.exists ? readStringArray(groupSnap.get('memberIds')) : [];
    const mirrored = mirrorSnap.exists() ? Object.keys(mirrorSnap.val() as Record<string, unknown>) : [];

    if (!memberIds.includes(user.uid) && !mirrored.includes(user.uid)) {
      res.status(403).json({ error: 'forbidden', message: 'Você não participa deste grupo.' });
      return;
    }

    if (!groupSnap.exists) {
      await mirrorRef.remove();
      res.status(200).json({ success: true, groupExists: false, memberCount: 0 });
      return;
    }

    const mirror: Record<string, true> = {};
    memberIds.forEach((uid) => {
      mirror[uid] = true;
    });
    await mirrorRef.set(mirror);

    res.status(200).json({ success: true, groupExists: true, memberCount: memberIds.length });
  } catch (error) {
    console.error('[Groups] Falha ao sincronizar integrantes:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Não foi possível atualizar o acesso às mensagens do grupo.',
    });
  }
});

export default router;
