import { Router, Request, Response } from 'express';
import { credentialsConfigured } from '../services/firebaseAdmin';
import { imageStorageConfigured } from '../services/imageStorage';

const router = Router();

/**
 * GET /health
 * Verificação pública de disponibilidade. Não expõe nenhum segredo: informa apenas
 * se as credenciais (Firebase Admin e Cloudinary) foram configuradas na hospedagem.
 */
router.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    service: 'fiap-chat-notifications-api',
    firebaseAdminConfigured: credentialsConfigured,
    imageStorageConfigured,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
