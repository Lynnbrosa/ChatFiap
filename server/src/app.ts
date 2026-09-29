import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import notificationsRouter from './routes/notifications';

export function createApp(): Express {
  const app = express();

  // Middleware básicos
  app.use(cors());
  app.use(express.json());

  // Rotas públicas
  app.use('/health', healthRouter);

  // Rota raiz para conferência rápida
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'FIAP Chat Notifications API',
      status: 'online',
      documentation: 'Consulte /health para status e POST /notifications/messages para envio.',
    });
  });

  // Rotas de notificações autenticadas
  app.use('/notifications', notificationsRouter);

  // Tratamento de rota não encontrada (404)
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Não encontrado',
      message: 'A rota solicitada não existe.',
    });
  });

  // Tratamento global de erros
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[App] Erro não tratado:', err);
    res.status(500).json({
      error: 'Erro interno',
      message: err.message || 'Ocorreu um erro no processamento da requisição.',
    });
  });

  return app;
}
