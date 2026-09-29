import {
  collection,
  doc,
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
} from 'firebase/firestore';
import { db } from './firebase';
import { DeviceTokenRecord, PrivateUserProfile, PublicUserProfile } from '../types/user';
import { ChatGroup } from '../types/group';
import { DirectConversation } from '../types/chat';

/**
 * Converter genérico: faz com que leituras e escritas no Firestore sejam tipadas
 * (getDoc, setDoc, updateDoc e transações passam a validar os campos em tempo de compilação).
 */
function createConverter<T extends DocumentData>(): FirestoreDataConverter<T, T> {
  return {
    toFirestore(model: WithFieldValue<T>): WithFieldValue<T> {
      return model;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot<T, T>, options?: SnapshotOptions): T {
      return snapshot.data(options);
    },
  };
}

const publicProfileConverter = createConverter<PublicUserProfile>();
const privateProfileConverter = createConverter<PrivateUserProfile>();
const deviceConverter = createConverter<DeviceTokenRecord>();
const groupConverter = createConverter<ChatGroup>();
const directConversationConverter = createConverter<DirectConversation>();

export const usersCollection = () =>
  collection(db, 'users').withConverter(publicProfileConverter);

export const publicProfileDoc = (uid: string) =>
  doc(db, 'users', uid).withConverter(publicProfileConverter);

export const privateProfileDoc = (uid: string) =>
  doc(db, 'users', uid, 'private', 'profile').withConverter(privateProfileConverter);

export const deviceDoc = (uid: string, deviceId: string) =>
  doc(db, 'users', uid, 'devices', deviceId).withConverter(deviceConverter);

export const groupsCollection = () => collection(db, 'groups').withConverter(groupConverter);

export const groupDoc = (groupId: string) =>
  doc(db, 'groups', groupId).withConverter(groupConverter);

export const directConversationsCollection = () =>
  collection(db, 'directConversations').withConverter(directConversationConverter);

export const directConversationDoc = (conversationId: string) =>
  doc(db, 'directConversations', conversationId).withConverter(directConversationConverter);
