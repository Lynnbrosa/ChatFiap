import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatGroup, NotificationPolicy } from '../types/group';
import { uploadImage } from './userService';

export interface CreateGroupParams {
  name: string;
  photoUri?: string | null;
  initialMemberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  ownerId: string;
}

/**
 * Cria um novo grupo persistido no Cloud Firestore.
 * Valida capacidade inicial e proprietário.
 */
export async function createGroup(params: CreateGroupParams): Promise<ChatGroup> {
  const { name, photoUri, initialMemberIds, memberLimit, notificationPolicy, ownerId } = params;

  // Garante que o proprietário esteja incluído na lista de integrantes
  const uniqueMembers = Array.from(new Set([ownerId, ...initialMemberIds]));

  if (uniqueMembers.length < 2) {
    throw new Error('O grupo precisa de pelo menos 2 integrantes (incluindo o proprietário).');
  }

  if (memberLimit < uniqueMembers.length) {
    throw new Error(
      `O limite (${memberLimit}) não pode ser inferior à quantidade de integrantes iniciais (${uniqueMembers.length}).`
    );
  }

  const groupDocRef = doc(collection(db, 'groups'));
  const groupId = groupDocRef.id;

  let photoUrl = '';
  if (photoUri) {
    try {
      photoUrl = await uploadImage(photoUri, `groups/${groupId}/photo_${Date.now()}.jpg`);
    } catch (err) {
      console.warn('[GroupService] Falha ao enviar foto do grupo:', err);
    }
  }

  const now = Date.now();
  const group: ChatGroup = {
    id: groupId,
    name: name.trim(),
    photoUrl,
    ownerId,
    memberIds: uniqueMembers,
    memberLimit,
    notificationPolicy,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(groupDocRef, group);
  return group;
}

/**
 * Adiciona um integrante ao grupo utilizando uma TRANSAÇÃO ATÔMICA DO FIRESTORE.
 * Garante proteção estrita contra concorrência e impede estouro do limite máximo
 * mesmo sob múltiplas requisições simultâneas.
 */
export async function addMemberToGroup(groupId: string, newMemberId: string): Promise<void> {
  const groupDocRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (transaction) => {
    const groupSnap = await transaction.get(groupDocRef);

    if (!groupSnap.exists()) {
      throw new Error('Grupo não encontrado.');
    }

    const groupData = groupSnap.data() as ChatGroup;
    const currentMembers = groupData.memberIds || [];
    const limit = groupData.memberLimit;

    if (currentMembers.includes(newMemberId)) {
      throw new Error('O usuário já é integrante deste grupo.');
    }

    if (currentMembers.length >= limit) {
      throw new Error(`Limite máximo de ${limit} integrantes já atingido. Nenhuma vaga disponível.`);
    }

    const updatedMembers = [...currentMembers, newMemberId];
    transaction.update(groupDocRef, {
      memberIds: updatedMembers,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Adiciona múltiplos integrantes ao grupo via TRANSAÇÃO ATÔMICA,
 * garantindo que o lote não ultrapasse o limite configurado.
 */
export async function addMembersToGroup(
  groupId: string,
  newMemberIds: string[],
  requesterId: string
): Promise<void> {
  const groupDocRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (transaction) => {
    const groupSnap = await transaction.get(groupDocRef);

    if (!groupSnap.exists()) {
      throw new Error('Grupo não encontrado.');
    }

    const groupData = groupSnap.data() as ChatGroup;

    if (groupData.ownerId !== requesterId) {
      throw new Error('Apenas o proprietário do grupo pode adicionar novos integrantes.');
    }

    const currentMembers = groupData.memberIds || [];
    const limit = groupData.memberLimit;

    const toAdd = newMemberIds.filter((id) => !currentMembers.includes(id));
    if (toAdd.length === 0) {
      return;
    }

    if (currentMembers.length + toAdd.length > limit) {
      const vacancies = Math.max(0, limit - currentMembers.length);
      throw new Error(
        `Capacidade insuficiente. Vagas disponíveis: ${vacancies}, tentando adicionar: ${toAdd.length}.`
      );
    }

    const updatedMembers = [...currentMembers, ...toAdd];
    transaction.update(groupDocRef, {
      memberIds: updatedMembers,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Remove um integrante do grupo. Apenas o proprietário ou o próprio integrante (ao sair)
 * pode executar esta ação.
 */
export async function removeMemberFromGroup(
  groupId: string,
  memberIdToRemove: string,
  requesterId: string
): Promise<void> {
  const groupDocRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (transaction) => {
    const groupSnap = await transaction.get(groupDocRef);

    if (!groupSnap.exists()) {
      throw new Error('Grupo não encontrado.');
    }

    const groupData = groupSnap.data() as ChatGroup;

    const isOwner = groupData.ownerId === requesterId;
    const isSelf = memberIdToRemove === requesterId;

    if (!isOwner && !isSelf) {
      throw new Error('Você não tem permissão para remover este integrante.');
    }

    if (memberIdToRemove === groupData.ownerId && groupData.memberIds.length > 1) {
      throw new Error('O proprietário não pode sair sem transferir o grupo ou ser o último membro.');
    }

    const updatedMembers = groupData.memberIds.filter((id) => id !== memberIdToRemove);
    transaction.update(groupDocRef, {
      memberIds: updatedMembers,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Atualiza configurações do grupo (nome, limite, foto ou política de notificações).
 * O limite não pode ser reduzido para menos que a quantidade atual de integrantes.
 */
export async function updateGroup(
  groupId: string,
  updates: Partial<Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>>,
  requesterId: string
): Promise<void> {
  const groupDocRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (transaction) => {
    const groupSnap = await transaction.get(groupDocRef);

    if (!groupSnap.exists()) {
      throw new Error('Grupo não encontrado.');
    }

    const groupData = groupSnap.data() as ChatGroup;

    if (groupData.ownerId !== requesterId) {
      throw new Error('Apenas o proprietário pode alterar as configurações do grupo.');
    }

    if (updates.memberLimit !== undefined) {
      if (!Number.isInteger(updates.memberLimit)) {
        throw new Error('O limite de integrantes deve ser um número inteiro.');
      }
      if (updates.memberLimit < groupData.memberIds.length) {
        throw new Error(
          `O limite não pode ser menor que o total atual de integrantes (${groupData.memberIds.length}).`
        );
      }
    }

    transaction.update(groupDocRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Busca os dados de um grupo pelo ID
 */
export async function getGroup(groupId: string): Promise<ChatGroup | null> {
  const groupDocRef = doc(db, 'groups', groupId);
  const snap = await getDoc(groupDocRef);
  if (snap.exists()) {
    return snap.data() as ChatGroup;
  }
  return null;
}

/**
 * Escuta em tempo real os grupos dos quais o usuário autenticado participa
 */
export function listenUserGroups(
  userId: string,
  callback: (groups: ChatGroup[]) => void
): Unsubscribe {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('memberIds', 'array-contains', userId));

  return onSnapshot(q, (snapshot) => {
    const list: ChatGroup[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as ChatGroup);
    });
    // Ordenar pelo mais recentemente atualizado
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    callback(list);
  });
}
