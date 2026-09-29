export type ChatUser = {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  photoUrl: string;
  createdAt: number;
};

/**
 * Parte pública do perfil (users/{uid}): visível a qualquer usuário autenticado,
 * usada na lista de usuários, nos cabeçalhos das conversas e na lista de integrantes.
 */
export type PublicUserProfile = Pick<ChatUser, 'uid' | 'name' | 'photoUrl' | 'createdAt'>;

/**
 * Dados cadastrais privados (users/{uid}/private/profile): somente o próprio usuário
 * lê diretamente. Terceiros só recebem esses dados pela API, que confirma a existência
 * de uma conversa individual ou de um grupo em comum.
 */
export type PrivateUserProfile = Pick<ChatUser, 'email' | 'phoneNumber' | 'birthDate'>;

export type DevicePlatform = 'ios' | 'android' | 'web';

export type DeviceTokenRecord = {
  token: string;
  platform: DevicePlatform;
  enabled: boolean;
  updatedAt: number;
};
