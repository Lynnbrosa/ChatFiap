import express, { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest, requireUser } from '../middleware/authenticate';
import { adminFirestore } from '../services/firebaseAdmin';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  imageStorageConfigured,
  uploadImage,
} from '../services/imageStorage';
import { isValidKey } from './validation';

const router = Router();

// Só esta rota aceita corpo grande (imagem em Base64 em trânsito — nunca gravada nos bancos)
router.use(express.json({ limit: '8mb' }));

type UploadTarget = { kind: 'profile' } | { kind: 'group'; groupId: string };

function readField(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null && key in body
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

function parseTarget(body: unknown): UploadTarget | null {
  const target = readField(body, 'target');
  if (target === 'profile') return { kind: 'profile' };
  const groupId = readField(body, 'groupId');
  if (target === 'group' && isValidKey(groupId) && !groupId.includes('_')) {
    return { kind: 'group', groupId };
  }
  return null;
}

/**
 * POST /uploads/image
 * Body: { target: 'profile' } | { target: 'group', groupId }, mimeType, imageBase64
 *
 * Faz o papel das "regras do Storage": só o próprio usuário troca a foto de perfil e só o
 * proprietário troca a foto do grupo. Devolve a URL final, que o app grava no Firestore.
 */
router.post('/image', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const target = parseTarget(req.body);
  const mimeType = readField(req.body, 'mimeType');
  const imageBase64 = readField(req.body, 'imageBase64');

  if (!target || typeof mimeType !== 'string' || typeof imageBase64 !== 'string') {
    res.status(400).json({ error: 'invalid_request', message: 'Envie target, mimeType e imageBase64.' });
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    res.status(400).json({ error: 'invalid_request', message: 'Formato de imagem não suportado.' });
    return;
  }

  const sizeInBytes = Math.floor((imageBase64.length * 3) / 4);
  if (sizeInBytes === 0 || sizeInBytes > MAX_IMAGE_BYTES) {
    res.status(400).json({ error: 'invalid_request', message: 'A imagem deve ter até 5 MB.' });
    return;
  }

  try {
    if (target.kind === 'group') {
      const groupSnap = await adminFirestore.collection('groups').doc(target.groupId).get();
      if (!groupSnap.exists) {
        res.status(404).json({ error: 'not_found', message: 'Grupo não encontrado.' });
        return;
      }
      if (groupSnap.get('ownerId') !== user.uid) {
        res.status(403).json({
          error: 'forbidden',
          message: 'Apenas o proprietário pode trocar a foto do grupo.',
        });
        return;
      }
    }

    if (!imageStorageConfigured) {
      res.status(503).json({
        error: 'storage_not_configured',
        message: 'O armazenamento de imagens ainda não foi configurado na API.',
      });
      return;
    }

    const url = await uploadImage({
      base64: imageBase64,
      mimeType,
      folder: target.kind === 'profile' ? `fiap-chat/users/${user.uid}` : `fiap-chat/groups/${target.groupId}`,
      publicId: target.kind === 'profile' ? 'avatar' : 'photo',
    });

    res.status(200).json({ url });
  } catch (error) {
    console.error('[Uploads] Falha ao enviar imagem:', error);
    res.status(500).json({ error: 'internal_error', message: 'Não foi possível enviar a imagem agora.' });
  }
});

export default router;
