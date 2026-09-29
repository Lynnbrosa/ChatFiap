import {
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
  UpdateData,
} from 'firebase/firestore';
import { db } from './firebase';
import { groupDoc, groupsCollection } from './converters';
import { uploadGroupPhoto } from './imageUploadService';
import { apiRequest } from './apiClient';
import { ChatGroup, MAX_GROUP_NAME_LENGTH, NotificationPolicy } from '../types/group';
import { PickedImage } from '../types/image';
import { NotificationSettings } from '../types/notification';
import { SyncGroupMembersResponse } from '../types/api';
import { validateGroupCapacity } from '../utils/groupValidation';
import { AppError } from '../utils/errors';

export interface CreateGroupParams {
  name: string;
  photo?: PickedImage | null;
  initialMemberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  ownerId: string;
}

export interface CreateGroupResult {
  group: ChatGroup;
  photoUploadFailed: boolean;
  membersSyncFailed: boolean;
}

export interface UpdateGroupParams {
  name?: string;
  memberLimit?: number;
  notificationPolicy?: NotificationPolicy;
  /** Nova foto escolhida (enviada à API, que devolve a URL final). */
  photo?: PickedImage | null;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError('Informe o nome do grupo.');
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) {
    throw new AppError(`O nome do grupo pode ter no máximo ${MAX_GROUP_NAME_LENGTH} caracteres.`);
  }
  return trimmed;
}

function assertValidLimit(memberCount: number, memberLimit: number): void {
  const validation = validateGroupCapacity(memberCount, memberLimit);
  if (!validation.valid) {
    throw new AppError(validation.error ?? 'Limite de integrantes inválido.');
  }
}

/**
 * Atualiza o espelho de integrantes no Realtime Database através da API.
 * As regras do RTDB usam esse espelho para liberar leitura/escrita de mensagens
 * somente aos integrantes ativos (o RTDB não consegue consultar o Firestore).
 */
export async function syncGroupMembers(groupId: string): Promise<SyncGroupMembersResponse> {
  return apiRequest<SyncGroupMembersResponse>(
    `/groups/${encodeURIComponent(groupId)}/members/sync`,
    { method: 'POST' }
  );
}

async function trySyncGroupMembers(groupId: string): Promise<boolean> {
  try {
    await syncGroupMembers(groupId);
    return true;
  } catch (err) {
    console.warn('[GroupService] Falha ao sincronizar integrantes com a API:', err);
    return false;
  }
}

/** Cria o grupo no Cloud Firestore com o usuário autenticado como proprietário. */
export async function createGroup(params: CreateGroupParams): Promise<CreateGroupResult> {
  const { photo, initialMemberIds, memberLimit, notificationPolicy, ownerId } = params;
  const name = validateName(params.name);

  // O proprietário sempre faz parte da lista de integrantes
  const memberIds = Array.from(new Set([ownerId, ...initialMemberIds]));
  if (memberIds.length < 2) {
    throw new AppError('O grupo precisa de pelo menos 2 integrantes (incluindo você).');
  }
  assertValidLimit(memberIds.length, memberLimit);

  const groupRef = doc(groupsCollection());
  const now = Date.now();
  const group: ChatGroup = {
    id: groupRef.id,
    name,
    photoUrl: '',
    ownerId,
    memberIds,
    memberLimit,
    notificationPolicy,
    notificationPolicyUpdatedBy: ownerId,
    notificationPolicyUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(groupRef, group);

  // A foto é enviada depois da criação: a API confere se quem envia é o proprietário do grupo
  let photoUploadFailed = false;
  if (photo) {
    try {
      const photoUrl = await uploadGroupPhoto(group.id, photo);
      await updateDoc(groupRef, { photoUrl, updatedAt: Date.now() });
      group.photoUrl = photoUrl;
    } catch (err) {
      console.warn('[GroupService] Falha ao enviar a foto do grupo:', err);
      photoUploadFailed = true;
    }
  }

  const membersSyncFailed = !(await trySyncGroupMembers(group.id));
  return { group, photoUploadFailed, membersSyncFailed };
}

/**
 * Adiciona integrantes numa TRANSAÇÃO do Firestore.
 * A transação lê o documento, valida proprietário e vagas e grava a nova lista; se outra
 * requisição alterar o grupo no meio do caminho, o Firestore repete a transação com os
 * dados novos. Além disso, a regra `memberIds.size() <= memberLimit` é avaliada no servidor
 * em toda escrita — nenhuma combinação de requisições concorrentes ultrapassa o limite.
 */
export async function addMembersToGroup(
  groupId: string,
  newMemberIds: string[],
  requesterId: string
): Promise<void> {
  const ref = groupDoc(groupId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new AppError('Grupo não encontrado.');

    const group = snap.data();
    if (group.ownerId !== requesterId) {
      throw new AppError('Apenas o proprietário do grupo pode adicionar integrantes.');
    }

    const toAdd = newMemberIds.filter((id) => !group.memberIds.includes(id));
    if (toAdd.length === 0) return;

    const vacancies = group.memberLimit - group.memberIds.length;
    if (vacancies <= 0) {
      throw new AppError(`O grupo já atingiu o limite de ${group.memberLimit} integrantes.`);
    }
    if (toAdd.length > vacancies) {
      throw new AppError(
        `Vagas insuficientes: há ${vacancies} vaga(s) e você tentou adicionar ${toAdd.length}.`
      );
    }

    transaction.update(ref, {
      memberIds: [...group.memberIds, ...toAdd],
      updatedAt: Date.now(),
    });
  });

  await trySyncGroupMembers(groupId);
}

/**
 * Remove um integrante. O proprietário pode remover qualquer outro integrante;
 * um integrante comum só pode remover a si mesmo (sair do grupo).
 */
export async function removeMemberFromGroup(
  groupId: string,
  memberIdToRemove: string,
  requesterId: string
): Promise<void> {
  const ref = groupDoc(groupId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new AppError('Grupo não encontrado.');

    const group = snap.data();
    const isOwner = group.ownerId === requesterId;
    const isSelf = memberIdToRemove === requesterId;

    if (!isOwner && !isSelf) {
      throw new AppError('Você não tem permissão para remover este integrante.');
    }
    if (memberIdToRemove === group.ownerId) {
      throw new AppError('O proprietário não pode ser removido do grupo.');
    }
    if (!group.memberIds.includes(memberIdToRemove)) return;

    transaction.update(ref, {
      memberIds: group.memberIds.filter((id) => id !== memberIdToRemove),
      updatedAt: Date.now(),
    });
  });

  // Sem essa sincronização o integrante removido continuaria lendo mensagens novas no RTDB
  const synced = await trySyncGroupMembers(groupId);
  if (!synced) {
    throw new AppError(
      'O integrante foi removido, mas não foi possível atualizar o acesso às mensagens. Tente novamente.'
    );
  }
}

/**
 * Atualiza as configurações do grupo (somente proprietário).
 * O limite não pode ficar menor que a quantidade atual de integrantes.
 */
export async function updateGroupSettings(
  groupId: string,
  updates: UpdateGroupParams,
  requesterId: string
): Promise<void> {
  const ref = groupDoc(groupId);

  // Envia a foto antes da transação (a API confere se quem envia é o proprietário)
  let photoUrl: string | undefined;
  if (updates.photo) {
    photoUrl = await uploadGroupPhoto(groupId, updates.photo);
  }

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new AppError('Grupo não encontrado.');

    const group = snap.data();
    if (group.ownerId !== requesterId) {
      throw new AppError('Apenas o proprietário pode alterar as configurações do grupo.');
    }

    const now = Date.now();
    const changes: UpdateData<ChatGroup> = { updatedAt: now };

    if (updates.name !== undefined) changes.name = validateName(updates.name);
    if (photoUrl) changes.photoUrl = photoUrl;

    if (updates.memberLimit !== undefined) {
      assertValidLimit(group.memberIds.length, updates.memberLimit);
      changes.memberLimit = updates.memberLimit;
    }

    if (updates.notificationPolicy && updates.notificationPolicy !== group.notificationPolicy) {
      const settings: NotificationSettings = {
        conversationId: groupId,
        policy: updates.notificationPolicy,
        updatedBy: requesterId,
        updatedAt: now,
      };
      changes.notificationPolicy = settings.policy;
      changes.notificationPolicyUpdatedBy = settings.updatedBy;
      changes.notificationPolicyUpdatedAt = settings.updatedAt;
    }

    transaction.update(ref, changes);
  });
}

/** Política de notificação atual do grupo no formato NotificationSettings. */
export function getNotificationSettings(group: ChatGroup): NotificationSettings {
  return {
    conversationId: group.id,
    policy: group.notificationPolicy,
    updatedBy: group.notificationPolicyUpdatedBy ?? group.ownerId,
    updatedAt: group.notificationPolicyUpdatedAt ?? group.createdAt,
  };
}

export async function getGroup(groupId: string): Promise<ChatGroup | null> {
  const snap = await getDoc(groupDoc(groupId));
  return snap.exists() ? snap.data() : null;
}

/** Escuta um grupo em tempo real (nome, foto, integrantes, limite e política). */
export function listenGroup(
  groupId: string,
  onData: (group: ChatGroup | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    groupDoc(groupId),
    (snap) => onData(snap.exists() ? snap.data() : null),
    onError
  );
}

/** Escuta em tempo real os grupos dos quais o usuário participa. */
export function listenUserGroups(
  userId: string,
  onData: (groups: ChatGroup[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(groupsCollection(), where('memberIds', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data()).sort((a, b) => b.updatedAt - a.updatedAt);
      onData(list);
    },
    onError
  );
}
