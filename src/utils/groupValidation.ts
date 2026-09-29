import { MAX_GROUP_LIMIT, MIN_GROUP_LIMIT } from '../types/group';

export interface GroupValidationResult {
  valid: boolean;
  error?: string;
  availableVacancies: number;
}

/**
 * Valida o limite de integrantes (mesmas condições aplicadas nas regras do Firestore).
 */
export function validateGroupCapacity(
  currentMemberCount: number,
  newLimit: number
): GroupValidationResult {
  if (!Number.isInteger(newLimit)) {
    return {
      valid: false,
      error: 'O limite de integrantes deve ser um número inteiro.',
      availableVacancies: 0,
    };
  }

  if (newLimit < MIN_GROUP_LIMIT) {
    return {
      valid: false,
      error: `O grupo deve permitir no mínimo ${MIN_GROUP_LIMIT} integrantes.`,
      availableVacancies: 0,
    };
  }

  if (newLimit > MAX_GROUP_LIMIT) {
    return {
      valid: false,
      error: `O limite máximo permitido é de ${MAX_GROUP_LIMIT} integrantes.`,
      availableVacancies: 0,
    };
  }

  if (newLimit < currentMemberCount) {
    return {
      valid: false,
      error: `O limite (${newLimit}) não pode ser menor que a quantidade atual de integrantes (${currentMemberCount}).`,
      availableVacancies: 0,
    };
  }

  return {
    valid: true,
    availableVacancies: newLimit - currentMemberCount,
  };
}

/** Quantidade de vagas restantes (nunca negativa). */
export function getAvailableVacancies(memberCount: number, memberLimit: number): number {
  return Math.max(0, memberLimit - memberCount);
}
