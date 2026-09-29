import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest, requireUser } from '../middleware/authenticate';
import { adminFirestore } from '../services/firebaseAdmin';
import { readStringArray } from '../services/types';
import { isValidKey } from './validation';

const router = Router();

/** true se os dois usuários têm uma conversa individual ou um grupo em comum. */
async function sharesConversation(requesterUid: string, targetUid: string): Promise<boolean> {
  if (requesterUid === targetUid) return true;

  const directId = [requesterUid, targetUid].sort().join('_');
  const directSnap = await adminFirestore.collection('directConversations').doc(directId).get();
  if (directSnap.exists) return true;

  const groups = await adminFirestore
    .collection('groups')
    .where('memberIds', 'array-contains', requesterUid)
    .get();

  return groups.docs.some((doc) => readStringArray(doc.get('memberIds')).includes(targetUid));
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * GET /users/:uid/profile
 * Devolve os dados cadastrais (e-mail, celular, nascimento) somente se o solicitante
 * compartilhar uma conversa individual ou um grupo com o perfil consultado.
 */
router.get('/:uid/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = requireUser(req);
  const targetUid = req.params.uid;

  if (!isValidKey(targetUid)) {
    res.status(400).json({ error: 'invalid_request', message: 'Identificador de usuário inválido.' });
    return;
  }

  try {
    const allowed = await sharesConversation(user.uid, targetUid);
    if (!allowed) {
      res.status(403).json({
        error: 'forbidden',
        message: 'Você só pode ver o perfil de quem participa de uma conversa ou grupo com você.',
      });
      return;
    }

    const [publicSnap, privateSnap] = await Promise.all([
      adminFirestore.collection('users').doc(targetUid).get(),
      adminFirestore.collection('users').doc(targetUid).collection('private').doc('profile').get(),
    ]);

    if (!publicSnap.exists) {
      res.status(404).json({ error: 'not_found', message: 'Perfil de usuário não encontrado.' });
      return;
    }

    const createdAt = publicSnap.get('createdAt');
    res.status(200).json({
      profile: {
        uid: targetUid,
        name: readString(publicSnap.get('name')),
        photoUrl: readString(publicSnap.get('photoUrl')),
        createdAt: typeof createdAt === 'number' ? createdAt : 0,
        email: readString(privateSnap.get('email')),
        phoneNumber: readString(privateSnap.get('phoneNumber')),
        birthDate: readString(privateSnap.get('birthDate')),
      },
    });
  } catch (error) {
    console.error('[Users] Falha ao carregar perfil:', error);
    res.status(500).json({ error: 'internal_error', message: 'Não foi possível carregar o perfil agora.' });
  }
});

export default router;
