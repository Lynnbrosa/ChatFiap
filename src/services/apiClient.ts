import { auth } from './firebase';
import { NOTIFICATIONS_API_URL, isApiConfigured } from '../config/env';
import { ApiError, ApiErrorCode } from '../utils/errors';

type ApiRequestOptions = {
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  /** A hospedagem gratuita pode "acordar" o servidor em ~50 s, por isso o timeout é longo. */
  timeoutMs?: number;
};

function readMessage(payload: unknown): string | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }
  return null;
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  return 'server';
}

async function performRequest(
  path: string,
  options: ApiRequestOptions,
  forceTokenRefresh: boolean
): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new ApiError('Sua sessão expirou. Entre novamente.', 401, 'unauthenticated');
  }

  let idToken: string;
  try {
    idToken = await currentUser.getIdToken(forceTokenRefresh);
  } catch {
    throw new ApiError('Sua sessão expirou. Entre novamente.', 401, 'unauthenticated');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);

  try {
    return await fetch(`${NOTIFICATIONS_API_URL}${path}`, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError('A API demorou demais para responder.', 0, 'timeout');
    }
    throw new ApiError('Não foi possível conectar à API. Verifique sua internet.', 0, 'network');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chamada autenticada à API própria. Envia o Firebase ID Token no cabeçalho
 * Authorization; se o token estiver expirado, renova uma vez e tenta de novo.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiError(
      'A URL da API não está configurada (app.json → expo.extra.notificationsApiUrl).',
      0,
      'not_configured'
    );
  }

  let response = await performRequest(path, options, false);
  if (response.status === 401) {
    response = await performRequest(path, options, true);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const code = codeForStatus(response.status);
    const message =
      code === 'unauthenticated'
        ? 'Sua sessão expirou. Entre novamente.'
        : readMessage(payload) ?? 'A API retornou um erro inesperado.';
    throw new ApiError(message, response.status, code);
  }

  return payload as T;
}
