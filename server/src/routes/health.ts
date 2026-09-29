import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Endpoint público de verificação de disponibilidade (Health Check).
 * Não requer autenticação.
 */
router.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    service: 'fiap-chat-notifications-api',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
