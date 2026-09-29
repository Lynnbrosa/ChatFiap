/**
 * Chaves aceitas em caminhos do Firebase: IDs do Firestore, push IDs do RTDB (-Nabc...)
 * e IDs de conversa individual (uidA_uidB). Bloqueia ".", "/", "#", "$", "[" e "]".
 */
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}
