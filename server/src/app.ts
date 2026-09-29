import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import notificationsRouter from './routes/notifications';
import groupsRouter from './routes/groups';
import usersRouter from './routes/users';
import uploadsRouter from './routes/uploads';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  // Upload de imagens tem limite de corpo próprio (8 MB); precisa vir antes do parser padrão
  app.use('/uploads', uploadsRouter);
  app.use(express.json({ limit: '10kb' }));

  // Pública
  app.use('/health', healthRouter);

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'FIAP Chat Notifications API',
      status: 'online',
      endpoints: [
        'GET /health',
        'POST /notifications/messages',
        'POST /groups/:groupId/members/sync',
        'GET /users/:uid/profile',
        'POST /uploads/image',
      ],
    });
  });

  // Autenticadas com Firebase ID Token
  app.use('/notifications', notificationsRouter);
  app.use('/groups', groupsRouter);
  app.use('/users', usersRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', message: 'A rota solicitada não existe.' });
  });

  // Erros inesperados: loga no servidor, responde sem detalhes internos
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[App] Erro não tratado:', err);
    res.status(500).json({ error: 'internal_error', message: 'Ocorreu um erro inesperado.' });
  });

  return app;
}
