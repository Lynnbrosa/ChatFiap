import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../services/firebaseAdmin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação não fornecido no formato Bearer <token>.',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token inválido';
    console.error('[AuthMiddleware] Falha ao verificar token:', errorMessage);
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Token do Firebase Authentication inválido ou expirado.',
      details: errorMessage,
    });
  }
}
