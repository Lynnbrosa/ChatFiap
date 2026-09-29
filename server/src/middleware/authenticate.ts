import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../services/firebaseAdmin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Valida o Firebase ID Token enviado em `Authorization: Bearer <token>` com o Admin SDK.
 * Nenhum detalhe interno da falha é devolvido ao cliente.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthenticated',
      message: 'Envie o token do Firebase Authentication no formato Bearer <token>.',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = { uid: decodedToken.uid, email: decodedToken.email };
    next();
  } catch (error) {
    console.warn('[Auth] Token rejeitado:', error instanceof Error ? error.message : error);
    res.status(401).json({
      error: 'unauthenticated',
      message: 'Sessão inválida ou expirada. Entre novamente.',
    });
  }
}

/** Garante que o usuário autenticado existe (evita "!" espalhados nas rotas). */
export function requireUser(req: AuthenticatedRequest): AuthenticatedUser {
  if (!req.user) {
    throw new Error('Rota autenticada executada sem usuário.');
  }
  return req.user;
}
