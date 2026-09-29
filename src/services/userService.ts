import { getDoc, getDocs, limit, orderBy, query, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import {
  deviceDoc,
  privateProfileDoc,
  publicProfileDoc,
  usersCollection,
} from './converters';
import { apiRequest } from './apiClient';
import { ChatUser, DevicePlatform, PublicUserProfile } from '../types/user';
import { SharedProfileResponse } from '../types/api';

/** Perfil público (nome e foto) de qualquer usuário autenticado. */
export async function getPublicProfile(uid: string): Promise<PublicUserProfile | null> {
  if (!uid) return null;
  const snap = await getDoc(publicProfileDoc(uid));
  return snap.exists() ? snap.data() : null;
}

/** Perfil completo do próprio usuário (parte pública + dados cadastrais privados). */
export async function getOwnProfile(uid: string): Promise<ChatUser | null> {
  const [publicSnap, privateSnap] = await Promise.all([
    getDoc(publicProfileDoc(uid)),
    getDoc(privateProfileDoc(uid)),
  ]);

  if (!publicSnap.exists()) return null;

  const publicData = publicSnap.data();
  const privateData = privateSnap.exists() ? privateSnap.data() : null;

  return {
    ...publicData,
    email: privateData?.email ?? '',
    phoneNumber: privateData?.phoneNumber ?? '',
    birthDate: privateData?.birthDate ?? '',
  };
}

/**
 * Perfil completo de outro usuário. Buscado pela API, que só devolve os dados
 * cadastrais se existir uma conversa individual ou um grupo em comum.
 */
export async function getSharedUserProfile(uid: string): Promise<ChatUser> {
  const response = await apiRequest<SharedProfileResponse>(
    `/users/${encodeURIComponent(uid)}/profile`,
    { method: 'GET', timeoutMs: 60000 }
  );
  return response.profile;
}

/** Grava a parte pública e a parte privada do perfil numa única operação atômica. */
export async function saveUserProfile(user: ChatUser): Promise<void> {
  const batch = writeBatch(db);
  batch.set(publicProfileDoc(user.uid), {
    uid: user.uid,
    name: user.name,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt,
  });
  batch.set(privateProfileDoc(user.uid), {
    email: user.email,
    phoneNumber: user.phoneNumber,
    birthDate: user.birthDate,
  });
  await batch.commit();
}

/** Lista os usuários cadastrados (apenas dados públicos), sem o próprio usuário. */
export async function listUsers(currentUid: string): Promise<PublicUserProfile[]> {
  const snap = await getDocs(query(usersCollection(), orderBy('name'), limit(200)));
  return snap.docs.map((d) => d.data()).filter((u) => u.uid !== currentUid);
}

/** Registra/atualiza o token de push do dispositivo na subcoleção privada do usuário. */
export async function registerDeviceToken(
  uid: string,
  deviceId: string,
  token: string,
  platform: DevicePlatform
): Promise<void> {
  await setDoc(deviceDoc(uid, deviceId), {
    token,
    platform,
    enabled: true,
    updatedAt: Date.now(),
  });
}

/** Desativa o token do dispositivo (usado no logout) para que ele pare de receber push. */
export async function disableDeviceToken(uid: string, deviceId: string): Promise<void> {
  const snap = await getDoc(deviceDoc(uid, deviceId));
  if (!snap.exists()) return;
  await setDoc(deviceDoc(uid, deviceId), { ...snap.data(), enabled: false, updatedAt: Date.now() });
}
