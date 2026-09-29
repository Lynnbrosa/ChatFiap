export interface GroupValidationResult {
  valid: boolean;
  error?: string;
  availableVacancies: number;
}

/**
 * Valida os limites de integrantes e capacidade do grupo.
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

  if (newLimit < 2) {
    return {
      valid: false,
      error: 'O grupo deve permitir no mínimo 2 integrantes.',
      availableVacancies: 0,
    };
  }

  if (newLimit < currentMemberCount) {
    return {
      valid: false,
      error: `O limite (${newLimit}) não pode ser inferior à quantidade atual de integrantes (${currentMemberCount}).`,
      availableVacancies: 0,
    };
  }

  const vacancies = newLimit - currentMemberCount;

  return {
    valid: true,
    availableVacancies: vacancies,
  };
}

/**
 * Verifica se um novo integrante pode ser adicionado ao grupo.
 */
export function canAddMember(
  currentMemberIds: string[],
  memberLimit: number,
  newMemberId: string
): { allowed: boolean; reason?: string } {
  if (currentMemberIds.includes(newMemberId)) {
    return {
      allowed: false,
      reason: 'O usuário já é integrante deste grupo.',
    };
  }

  if (currentMemberIds.length >= memberLimit) {
    return {
      allowed: false,
      reason: 'O limite máximo de integrantes deste grupo foi atingido.',
    };
  }

  return { allowed: true };
}
