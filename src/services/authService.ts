import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Unsubscribe,
} from 'firebase/auth';
import { auth } from './firebase';
import { ChatUser } from '../types/user';
import { getUserProfile, saveUserProfile, uploadImage } from './userService';

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  birthDate: string;
  photoUri?: string | null;
}

/**
 * Cria nova conta com e-mail e senha, realiza upload da foto se fornecida
 * e persiste o documento do usuário no Firestore.
 */
export async function registerUser(params: RegisterParams): Promise<ChatUser> {
  const { name, email, password, phoneNumber, birthDate, photoUri } = params;

  if (!email || !password || !name || !phoneNumber || !birthDate) {
    throw new Error('Todos os campos obrigatórios devem ser preenchidos.');
  }

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = credential.user.uid;

  let finalPhotoUrl = '';
  if (photoUri) {
    try {
      finalPhotoUrl = await uploadImage(photoUri, `users/${uid}/avatar_${Date.now()}.jpg`);
    } catch (uploadErr) {
      console.warn('[AuthService] Foto de perfil falhou, continuando sem foto:', uploadErr);
    }
  }

  const chatUser: ChatUser = {
    uid,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: phoneNumber.trim(),
    birthDate: birthDate.trim(),
    photoUrl: finalPhotoUrl,
    createdAt: Date.now(),
  };

  await saveUserProfile(chatUser);
  return chatUser;
}

/**
 * Autentica usuário com e-mail e senha e recupera seus dados cadastrais do Firestore
 */
export async function loginUser(
  email: string,
  pass: string
): Promise<{ firebaseUser: User; profile: ChatUser | null }> {
  if (!email || !pass) {
    throw new Error('Informe o e-mail e a senha para entrar.');
  }

  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const profile = await getUserProfile(credential.user.uid);

  return {
    firebaseUser: credential.user,
    profile,
  };
}

/**
 * Encerra a sessão do usuário no Firebase Authentication
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Observa alterações no estado da sessão autenticada
 */
export function onAuthStateChangedListener(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
