// Popula os EMULADORES locais do Firebase com dados de demonstração.
// Nunca aponta para o projeto real: todas as conexões vão para 127.0.0.1.
//
// Pré-requisitos (em terminais separados):
//   1) npx firebase-tools emulators:start --only auth,firestore,database,storage --project <projectId>
//   2) API local apontando para os emuladores (ver README → "Rodar com emuladores")
// Depois: node scripts/seed-emulator.mjs
//
// Contas de demonstração (somente emulador): senha de todas = demo123456
//   ana@fiapchat.dev · bruno@fiapchat.dev · carla@fiapchat.dev · diego@fiapchat.dev · elisa@fiapchat.dev
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(projectDir, 'package.json'));
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const fs = require('firebase/firestore');
const rt = require('firebase/database');

const config = JSON.parse(readFileSync(path.join(projectDir, 'firebaseConfig.json'), 'utf8'));
const HOST = '127.0.0.1';
const API = process.env.API_URL || 'http://127.0.0.1:3000';
const PASSWORD = 'demo123456';

const PEOPLE = [
  { key: 'ana', name: 'Ana Martins', phone: '(11) 98765-4321', birth: '14/03/2001' },
  { key: 'bruno', name: 'Bruno Costa', phone: '(11) 91234-5678', birth: '02/09/2000' },
  { key: 'carla', name: 'Carla Souza', phone: '(21) 99876-1234', birth: '27/11/1999' },
  { key: 'diego', name: 'Diego Lima', phone: '(31) 98888-7777', birth: '08/06/2002' },
  { key: 'elisa', name: 'Elisa Rocha', phone: '(41) 97777-6666', birth: '19/01/2001' },
];

async function createPerson(person, createdAt) {
  const app = initializeApp(config, person.key);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = fs.getFirestore(app);
  fs.connectFirestoreEmulator(db, HOST, 8080);
  const rtdb = rt.getDatabase(app);
  rt.connectDatabaseEmulator(rtdb, HOST, 9000);

  const email = `${person.key}@fiapchat.dev`;
  const cred = await createUserWithEmailAndPassword(auth, email, PASSWORD);
  const uid = cred.user.uid;
  const batch = fs.writeBatch(db);
  batch.set(fs.doc(db, 'users', uid), { uid, name: person.name, photoUrl: '', createdAt });
  batch.set(fs.doc(db, 'users', uid, 'private', 'profile'), {
    email,
    phoneNumber: person.phone,
    birthDate: person.birth,
  });
  await batch.commit();
  return { ...person, uid, db, rtdb, token: () => cred.user.getIdToken() };
}

async function say(sender, conversationId, type, text, createdAt, extra = {}) {
  const ref = rt.push(rt.ref(sender.rtdb, `messages/${conversationId}`));
  await rt.set(ref, {
    id: ref.key,
    conversationId,
    conversationType: type,
    senderId: sender.uid,
    senderName: sender.name,
    text,
    target: { type: 'conversation' },
    mentionedUserIds: [],
    createdAt,
    ...extra,
  });
  const collection = type === 'direct' ? 'directConversations' : 'groups';
  await fs.updateDoc(fs.doc(sender.db, collection, conversationId), {
    lastMessage: text.length > 120 ? `${text.slice(0, 117)}...` : text,
    lastMessageAt: createdAt,
    updatedAt: createdAt,
  });
}

async function syncGroup(owner, groupId) {
  const res = await fetch(`${API}/groups/${groupId}/members/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await owner.token()}` },
  });
  if (!res.ok) throw new Error(`Falha no sync do grupo ${groupId}: ${res.status}`);
}

async function createDirect(a, b, createdAt) {
  const [p0, p1] = [a.uid, b.uid].sort();
  const id = `${p0}_${p1}`;
  await fs.setDoc(fs.doc(a.db, 'directConversations', id), {
    id, type: 'direct', participantIds: [p0, p1], createdAt, updatedAt: createdAt,
  });
  return id;
}

async function createGroup(owner, name, members, memberLimit, notificationPolicy, createdAt) {
  const ref = fs.doc(fs.collection(owner.db, 'groups'));
  await fs.setDoc(ref, {
    id: ref.id,
    name,
    photoUrl: '',
    ownerId: owner.uid,
    memberIds: [owner.uid, ...members.map((m) => m.uid)],
    memberLimit,
    notificationPolicy,
    notificationPolicyUpdatedBy: owner.uid,
    notificationPolicyUpdatedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
  await syncGroup(owner, ref.id);
  return ref.id;
}

async function main() {
  const now = Date.now();
  const min = 60 * 1000;
  const start = now - 180 * min;

  const [ana, bruno, carla, diego, elisa] = await Promise.all(
    PEOPLE.map((p, i) => createPerson(p, start - (i + 1) * 86400000))
  );

  // Conversa individual Ana ↔ Bruno
  const dmAnaBruno = await createDirect(ana, bruno, start);
  await say(bruno, dmAnaBruno, 'direct', 'Oi Ana! Conseguiu configurar o Firebase?', now - 42 * min);
  await say(ana, dmAnaBruno, 'direct', 'Consegui! Auth, Firestore e Realtime Database já estão ativos.', now - 40 * min);
  await say(bruno, dmAnaBruno, 'direct', 'Top. Vou publicar a API no Render agora.', now - 38 * min);
  await say(ana, dmAnaBruno, 'direct', 'Me avisa quando o /health responder 👍', now - 12 * min);

  // Conversa individual Ana ↔ Carla
  const dmAnaCarla = await createDirect(carla, ana, start);
  await say(carla, dmAnaCarla, 'direct', 'Ana, você pode revisar as regras de segurança depois?', now - 95 * min);

  // Grupo principal (Ana é dona) com 4/5 integrantes
  const squad = await createGroup(ana, 'Squad Mobile FIAP', [bruno, carla, diego], 5, 'all_group_messages', start);
  await say(ana, squad, 'group', 'Bem-vindos ao grupo do trabalho de React Native! 🚀', now - 30 * min);
  await say(bruno, squad, 'group', 'API publicada e respondendo no /health ✅', now - 25 * min);
  await say(carla, squad, 'group', '@Ana Martins revisa o limite de integrantes no Firestore?', now - 20 * min, {
    mentionedUserIds: [ana.uid],
  });
  await say(diego, squad, 'group', 'Bruno, consegue testar o push no seu Android?', now - 15 * min, {
    target: { type: 'member', memberId: bruno.uid },
  });
  await say(ana, squad, 'group', 'Revisado! O limite é validado nas regras e na transação.', now - 5 * min);

  // Grupo cheio (Bruno é dono) — mostra o estado "sem vagas"
  const full = await createGroup(bruno, 'Checkpoint 2', [ana], 2, 'mentioned_members', start);
  await say(bruno, full, 'group', 'Grupo fechado só para nós dois 😄', now - 70 * min);

  console.log('Dados de demonstração criados nos emuladores.');
  console.log('Login: ana@fiapchat.dev (senha no topo deste arquivo)');
  console.log(JSON.stringify({ dmAnaBruno, squad, full, bruno: bruno.uid }));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
