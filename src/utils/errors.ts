import { FirebaseError } from 'firebase/app';

/**
 * Erro de regra de negócio com mensagem já pronta para o usuário
 * (ex.: "Limite de integrantes atingido").
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export type ApiErrorCode =
  | 'not_configured'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'network'
  | 'timeout'
  | 'server';

/** Falha ao chamar a API de notificações. A mensagem já é amigável. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const FIREBASE_MESSAGES: Record<string, string> = {
  // Authentication
  'auth/invalid-credential': 'E-mail ou senha inválidos. Verifique suas credenciais.',
  'auth/wrong-password': 'E-mail ou senha inválidos. Verifique suas credenciais.',
  'auth/user-not-found': 'E-mail ou senha inválidos. Verifique suas credenciais.',
  'auth/invalid-email': 'Formato de e-mail inválido.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'A senha é fraca. Use pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-token-expired': 'Sua sessão expirou. Entre novamente.',
  'auth/requires-recent-login': 'Sua sessão expirou. Entre novamente.',
  'auth/invalid-api-key': 'Configuração do Firebase inválida (confira o firebaseConfig.json).',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    'Configuração do Firebase inválida (confira o firebaseConfig.json).',
  'auth/operation-not-allowed': 'O login por e-mail e senha não está ativado no Firebase.',
  // Firestore
  'permission-denied': 'Você não tem permissão para realizar esta ação.',
  unavailable: 'Serviço indisponível no momento. Verifique sua conexão.',
  'deadline-exceeded': 'A operação demorou demais. Verifique sua conexão.',
  'not-found': 'O registro solicitado não foi encontrado.',
  aborted: 'Outra alteração aconteceu ao mesmo tempo. Tente novamente.',
  'failed-precondition': 'Outra alteração aconteceu ao mesmo tempo. Tente novamente.',
  unauthenticated: 'Sua sessão expirou. Entre novamente.',
  // Storage
  'storage/unauthorized': 'Sem permissão para enviar esta imagem.',
  'storage/canceled': 'O envio da imagem foi cancelado.',
  'storage/quota-exceeded': 'Limite de armazenamento de imagens atingido.',
  'storage/retry-limit-exceeded': 'Falha de conexão ao enviar a imagem.',
};

function hasCode(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string';
}

/**
 * Converte qualquer erro em uma mensagem compreensível, sem expor detalhes internos
 * (códigos, stack traces, URLs ou credenciais).
 */
export function getFriendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AppError || err instanceof ApiError) {
    return err.message;
  }

  if (err instanceof FirebaseError || hasCode(err)) {
    const code = err.code;
    const mapped = FIREBASE_MESSAGES[code] ?? FIREBASE_MESSAGES[code.replace(/^firestore\//, '')];
    if (mapped) return mapped;
    // Realtime Database usa códigos em maiúsculas
    if (code === 'PERMISSION_DENIED') return FIREBASE_MESSAGES['permission-denied'];
  }

  if (err instanceof Error && err.message.includes('PERMISSION_DENIED')) {
    return FIREBASE_MESSAGES['permission-denied'];
  }

  return fallback;
}

export function isPermissionDenied(err: unknown): boolean {
  if (hasCode(err) && (err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED')) {
    return true;
  }
  return err instanceof Error && err.message.includes('PERMISSION_DENIED');
}
