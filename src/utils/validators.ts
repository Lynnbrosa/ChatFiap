const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** Celular brasileiro com DDD: 10 ou 11 dígitos. */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

/** Data no formato DD/MM/AAAA, existente, não futura e posterior a 1900. */
export function isValidBirthDate(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  const exists =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return exists && year >= 1900 && date.getTime() <= Date.now();
}
