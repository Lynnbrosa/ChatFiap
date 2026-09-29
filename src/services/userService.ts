import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { ChatUser, DeviceTokenRecord } from '../types/user';

/**
 * Busca os dados do perfil de um usuário no Firestore
 */
export async function getUserProfile(uid: string): Promise<ChatUser | null> {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid);
  const snap = await getDoc(userDocRef);

  if (snap.exists()) {
    return snap.data() as ChatUser;
  }
  return null;
}

/**
 * Salva ou atualiza os dados cadastrais do perfil no Firestore
 */
export async function saveUserProfile(user: ChatUser): Promise<void> {
  const userDocRef = doc(db, 'users', user.uid);
  await setDoc(userDocRef, user, { merge: true });
}

/**
 * Lista outros usuários cadastrados no aplicativo, excluindo o próprio usuário logado
 */
export async function getUsersList(currentUid: string): Promise<ChatUser[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, limit(50));
  const snap = await getDocs(q);

  const users: ChatUser[] = [];
  snap.forEach((d) => {
    if (d.id !== currentUid) {
      users.push(d.data() as ChatUser);
    }
  });

  return users;
}

/**
 * Faz upload de imagem selecionada no dispositivo para o Firebase Storage
 * e retorna a URL pública de download.
 * Atende ao requisito: apenas a URL é armazenada no Firestore; nunca Base64.
 */
export async function uploadImage(localUri: string, path: string): Promise<string> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error('[UserService] Falha ao enviar imagem para o Storage:', error);
    throw new Error('Falha no upload da imagem para o Firebase Storage.');
  }
}

/**
 * Registra ou atualiza o token de push do dispositivo na subcoleção privada do usuário
 */
export async function registerDeviceTokenInFirestore(
  uid: string,
  deviceId: string,
  token: string,
  platform: 'ios' | 'android' | 'web'
): Promise<void> {
  const deviceDocRef = doc(db, 'users', uid, 'devices', deviceId);
  const payload: DeviceTokenRecord = {
    token,
    platform,
    enabled: true,
    updatedAt: Date.now(),
  };

  await setDoc(deviceDocRef, payload, { merge: true });
}
