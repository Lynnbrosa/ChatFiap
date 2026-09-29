import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  User,
  Unsubscribe,
} from 'firebase/auth';
import { auth } from './firebase';
import { ChatUser } from '../types/user';
import { PickedImage } from '../types/image';
import { getOwnProfile, saveUserProfile } from './userService';
import { uploadProfilePhoto } from './imageUploadService';
import { unregisterDeviceForUser } from './notificationService';
import { AppError } from '../utils/errors';

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  birthDate: string;
  photo?: PickedImage | null;
}

export interface RegisterResult {
  user: ChatUser;
  photoUploadFailed: boolean;
}

/**
 * Cria a conta com e-mail e senha, envia a foto de perfil (via API → Cloudinary) e grava o perfil
 * no Firestore. Se o perfil não puder ser salvo, a conta recém-criada é removida para
 * que o cadastro possa ser refeito.
 */
export async function registerUser(params: RegisterParams): Promise<RegisterResult> {
  const { name, email, password, phoneNumber, birthDate, photo } = params;

  if (!email || !password || !name || !phoneNumber || !birthDate) {
    throw new AppError('Todos os campos obrigatórios devem ser preenchidos.');
  }

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = credential.user.uid;

  let photoUrl = '';
  let photoUploadFailed = false;
  if (photo) {
    try {
      // O usuário já está autenticado aqui, então a API aceita o upload
      photoUrl = await uploadProfilePhoto(photo);
    } catch {
      photoUploadFailed = true;
    }
  }

  const chatUser: ChatUser = {
    uid,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: phoneNumber.trim(),
    birthDate: birthDate.trim(),
    photoUrl,
    createdAt: Date.now(),
  };

  try {
    await saveUserProfile(chatUser);
  } catch (err) {
    await deleteUser(credential.user).catch(() => undefined);
    throw err;
  }

  return { user: chatUser, photoUploadFailed };
}

/** Autentica com e-mail e senha e carrega o perfil do Firestore. */
export async function loginUser(email: string, password: string): Promise<ChatUser> {
  if (!email || !password) {
    throw new AppError('Informe o e-mail e a senha para entrar.');
  }

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await getOwnProfile(credential.user.uid);

  if (!profile) {
    await signOut(auth);
    throw new AppError('Seu cadastro está incompleto. Crie a conta novamente.');
  }

  return profile;
}

/**
 * Encerra a sessão. Antes disso desativa o token de push deste aparelho, para que o
 * usuário anterior não continue recebendo notificações aqui.
 */
export async function logoutUser(uid: string | null): Promise<void> {
  if (uid) {
    try {
      await unregisterDeviceForUser(uid);
    } catch (err) {
      console.warn('[AuthService] Não foi possível desativar o token do dispositivo:', err);
    }
  }
  await signOut(auth);
}

/** Observa alterações no estado da sessão autenticada. */
export function onAuthStateChangedListener(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
