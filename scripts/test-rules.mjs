// Teste de integração: regras de segurança (Firestore, RTDB) + API (push, integrantes, perfil, fotos).
// Roda SOMENTE contra os emuladores locais do Firebase e a API local (ver README → "Rodar com emuladores").
// Uso: node scripts/test-rules.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(PROJECT_DIR, 'package.json'));
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const fs = require('firebase/firestore');
const rt = require('firebase/database');

const config = JSON.parse(readFileSync(`${PROJECT_DIR}/firebaseConfig.json`, 'utf8'));
const API = process.env.API_URL || 'http://127.0.0.1:3000';
const HOST = '127.0.0.1';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  passed++;
  console.log(`  ✔ ${name}`);
}
function bad(name, detail) {
  failed++;
  failures.push(name);
  console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
}
async function expectAllow(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    bad(name, `esperado PERMITIR, veio erro: ${e.code || e.message}`);
  }
}
async function expectDeny(name, fn) {
  try {
    await fn();
    bad(name, 'esperado NEGAR, mas foi permitido');
  } catch (e) {
    const msg = `${e.code || ''} ${e.message || ''}`;
    if (/permission|PERMISSION_DENIED|unauthorized|denied/i.test(msg)) ok(name);
    else bad(name, `erro inesperado: ${msg}`);
  }
}
function check(name, cond, detail) {
  cond ? ok(name) : bad(name, detail);
}

async function makeUser(label) {
  const app = initializeApp(config, label);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = fs.getFirestore(app);
  fs.connectFirestoreEmulator(db, HOST, 8080);
  const rtdb = rt.getDatabase(app);
  rt.connectDatabaseEmulator(rtdb, HOST, 9000);

  const email = `${label.toLowerCase()}.${Date.now()}@teste.dev`;
  const cred = await createUserWithEmailAndPassword(auth, email, 'senha-teste-123');
  const uid = cred.user.uid;
  const batch = fs.writeBatch(db);
  batch.set(fs.doc(db, 'users', uid), { uid, name: `Usuário ${label}`, photoUrl: '', createdAt: Date.now() });
  batch.set(fs.doc(db, 'users', uid, 'private', 'profile'), {
    email,
    phoneNumber: '(11) 99999-0000',
    birthDate: '01/01/2000',
  });
  await batch.commit();
  return { label, app, auth, db, rtdb, uid, token: () => cred.user.getIdToken() };
}

async function api(user, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.token()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function sendMsg(user, conversationId, type, text, extra = {}) {
  const ref = rt.push(rt.ref(user.rtdb, `messages/${conversationId}`));
  const msg = {
    id: ref.key,
    conversationId,
    conversationType: type,
    senderId: user.uid,
    senderName: user.label,
    text,
    target: { type: 'conversation' },
    mentionedUserIds: [],
    createdAt: Date.now(),
    ...extra,
  };
  await rt.set(ref, msg);
  return msg;
}

const dmId = (a, b) => [a, b].sort().join('_');

async function main() {
  console.log('\n== Health');
  const health = await fetch(`${API}/health`).then((r) => r.json());
  check('GET /health responde ok', health.status === 'ok', JSON.stringify(health));

  console.log('\n== Usuários de teste');
  const A = await makeUser('A');
  const B = await makeUser('B');
  const C = await makeUser('C');
  const D = await makeUser('D');
  ok('4 contas criadas com e-mail/senha e perfis gravados');

  console.log('\n== Perfis (Firestore)');
  await expectAllow('A lê o perfil público de B', () => fs.getDoc(fs.doc(A.db, 'users', B.uid)));
  await expectDeny('A NÃO lê os dados privados de B', () => fs.getDoc(fs.doc(A.db, 'users', B.uid, 'private', 'profile')));
  await expectAllow('A lê os próprios dados privados', () => fs.getDoc(fs.doc(A.db, 'users', A.uid, 'private', 'profile')));
  await expectDeny('Foto em Base64 no Firestore é recusada', () =>
    fs.updateDoc(fs.doc(A.db, 'users', A.uid), { photoUrl: 'data:image/png;base64,AAAA' })
  );
  await expectDeny('A NÃO altera o perfil de B', () => fs.updateDoc(fs.doc(A.db, 'users', B.uid), { name: 'hack' }));

  console.log('\n== Tokens de dispositivo');
  await expectAllow('A registra o próprio token', () =>
    fs.setDoc(fs.doc(A.db, 'users', A.uid, 'devices', 'dev1'), {
      token: 'ExponentPushToken[teste-invalido-A]',
      platform: 'android',
      enabled: true,
      updatedAt: Date.now(),
    })
  );
  await expectDeny('B NÃO lê os tokens de A', () => fs.getDocs(fs.collection(B.db, 'users', A.uid, 'devices')));

  console.log('\n== Conversa individual');
  const AB = dmId(A.uid, B.uid);
  const [p0, p1] = [A.uid, B.uid].sort();
  await expectAllow('A consulta DM inexistente com B (criar ou localizar)', () => fs.getDoc(fs.doc(A.db, 'directConversations', AB)));
  await expectDeny('C NÃO consulta a DM A_B', () => fs.getDoc(fs.doc(C.db, 'directConversations', AB)));
  await expectAllow('A cria a DM A_B', () =>
    fs.setDoc(fs.doc(A.db, 'directConversations', AB), {
      id: AB, type: 'direct', participantIds: [p0, p1], createdAt: Date.now(), updatedAt: Date.now(),
    })
  );
  await expectDeny('DM consigo mesmo é recusada', () =>
    fs.setDoc(fs.doc(A.db, 'directConversations', `${A.uid}_${A.uid}`), {
      id: `${A.uid}_${A.uid}`, type: 'direct', participantIds: [A.uid, A.uid], createdAt: Date.now(),
    })
  );
  const [q0, q1] = [A.uid, C.uid].sort();
  await expectDeny('DM com ID fora do padrão é recusada', () =>
    fs.setDoc(fs.doc(A.db, 'directConversations', 'id-qualquer'), {
      id: 'id-qualquer', type: 'direct', participantIds: [q0, q1], createdAt: Date.now(),
    })
  );
  await expectDeny('B NÃO troca os participantes da DM', () =>
    fs.updateDoc(fs.doc(B.db, 'directConversations', AB), { participantIds: [B.uid, C.uid] })
  );
  await expectAllow('B atualiza o resumo da última mensagem', () =>
    fs.updateDoc(fs.doc(B.db, 'directConversations', AB), { lastMessage: 'oi', lastMessageAt: Date.now(), updatedAt: Date.now() })
  );
  const listA = await fs.getDocs(fs.query(fs.collection(A.db, 'directConversations'), fs.where('participantIds', 'array-contains', A.uid)));
  check('Lista de DMs de A (query com array-contains) funciona', listA.size === 1, `size=${listA.size}`);

  console.log('\n== Mensagens da DM (Realtime Database)');
  let dmMsg;
  await expectAllow('A envia mensagem na DM', async () => {
    dmMsg = await sendMsg(A, AB, 'direct', 'Olá B!');
  });
  await expectAllow('B lê as mensagens da DM', () => rt.get(rt.ref(B.rtdb, `messages/${AB}`)));
  await expectDeny('C NÃO lê as mensagens da DM', () => rt.get(rt.ref(C.rtdb, `messages/${AB}`)));
  await expectDeny('C NÃO escreve na DM', () => sendMsg(C, AB, 'direct', 'intruso'));
  await expectDeny('A NÃO grava mensagem com senderId de B', async () => {
    const ref = rt.push(rt.ref(A.rtdb, `messages/${AB}`));
    await rt.set(ref, { id: ref.key, conversationId: AB, conversationType: 'direct', senderId: B.uid, text: 'falso', target: { type: 'conversation' }, createdAt: Date.now() });
  });
  await expectDeny('Mensagem não pode ser editada depois de enviada', () =>
    rt.set(rt.ref(A.rtdb, `messages/${AB}/${dmMsg.id}/text`), 'editado')
  );

  console.log('\n== Push de DM (API)');
  let r = await api(A, 'POST', '/notifications/messages', { conversationId: AB, messageId: dmMsg.id });
  check('Push da DM: 1 destinatário (só B, remetente excluído)', r.status === 200 && r.json.recipientCount === 1 && r.json.policyUsed === 'direct', JSON.stringify(r));
  r = await api(A, 'POST', '/notifications/messages', { conversationId: AB, messageId: dmMsg.id });
  check('Reenvio da mesma mensagem é marcado como duplicado', r.status === 200 && r.json.duplicate === true, JSON.stringify(r));
  const dm2 = await sendMsg(A, AB, 'direct', 'concorrência');
  const burst = await Promise.all(Array.from({ length: 6 }, () => api(A, 'POST', '/notifications/messages', { conversationId: AB, messageId: dm2.id })));
  const nonDup = burst.filter((x) => x.status === 200 && !x.json.duplicate).length;
  check('6 requisições simultâneas → só 1 processa o push', nonDup === 1, `processadas=${nonDup}`);
  r = await api(B, 'POST', '/notifications/messages', { conversationId: AB, messageId: dmMsg.id });
  check('B NÃO pode pedir push de mensagem de A (403)', r.status === 403, JSON.stringify(r));
  r = await api(A, 'POST', '/notifications/messages', { conversationId: 'x/../y', messageId: 'z' });
  check('Parâmetros inválidos → 400', r.status === 400, JSON.stringify(r));
  const noAuth = await fetch(`${API}/notifications/messages`, { method: 'POST' });
  check('Sem token → 401', noAuth.status === 401, String(noAuth.status));
  const tokenDoc = await fs.getDoc(fs.doc(A.db, 'users', A.uid, 'devices', 'dev1'));
  check('Dispositivo continua registrado (token de B não foi enviado ao remetente)', tokenDoc.exists());

  console.log('\n== Grupo: criação e limite');
  const groupRef = fs.doc(fs.collection(A.db, 'groups'));
  const G = groupRef.id;
  const baseGroup = {
    id: G, name: 'Grupo de teste', photoUrl: '', ownerId: A.uid, memberIds: [A.uid, B.uid], memberLimit: 3,
    notificationPolicy: 'all_group_messages', notificationPolicyUpdatedBy: A.uid, notificationPolicyUpdatedAt: Date.now(),
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await expectDeny('Grupo com mais integrantes que o limite é recusado', () =>
    fs.setDoc(fs.doc(A.db, 'groups', 'grupoInvalido1'), { ...baseGroup, id: 'grupoInvalido1', memberIds: [A.uid, B.uid, C.uid], memberLimit: 2 })
  );
  await expectDeny('Grupo com limite não inteiro é recusado', () =>
    fs.setDoc(fs.doc(A.db, 'groups', 'grupoInvalido2'), { ...baseGroup, id: 'grupoInvalido2', memberLimit: 2.5 })
  );
  await expectDeny('Grupo com dono diferente do usuário é recusado', () =>
    fs.setDoc(fs.doc(A.db, 'groups', 'grupoInvalido3'), { ...baseGroup, id: 'grupoInvalido3', ownerId: B.uid, memberIds: [B.uid, A.uid] })
  );
  await expectAllow('A cria grupo [A, B] com limite 3', () => fs.setDoc(groupRef, baseGroup));

  await expectDeny('B lê mensagens do grupo ANTES do espelho existir', () => rt.get(rt.ref(B.rtdb, `messages/${G}`)));
  r = await api(A, 'POST', `/groups/${G}/members/sync`);
  check('API sincroniza integrantes no RTDB', r.status === 200 && r.json.memberCount === 2, JSON.stringify(r));
  r = await api(D, 'POST', `/groups/${G}/members/sync`);
  check('Não integrante NÃO consegue chamar o sync (403)', r.status === 403, JSON.stringify(r));
  await expectAllow('B (integrante) lê mensagens do grupo', () => rt.get(rt.ref(B.rtdb, `messages/${G}`)));
  await expectDeny('C (não integrante) NÃO lê o grupo no Firestore', () => fs.getDoc(fs.doc(C.db, 'groups', G)));
  await expectDeny('C (não integrante) NÃO lê mensagens do grupo', () => rt.get(rt.ref(C.rtdb, `messages/${G}`)));
  await expectDeny('C NÃO envia mensagem no grupo', () => sendMsg(C, G, 'group', 'intruso'));

  console.log('\n== Grupo: permissões do proprietário');
  await expectDeny('B (não dono) NÃO altera o limite', () => fs.updateDoc(fs.doc(B.db, 'groups', G), { memberLimit: 50 }));
  await expectDeny('B (não dono) NÃO adiciona integrantes', () => fs.updateDoc(fs.doc(B.db, 'groups', G), { memberIds: [A.uid, B.uid, C.uid] }));
  await expectDeny('B (não dono) NÃO muda a política', () => fs.updateDoc(fs.doc(B.db, 'groups', G), { notificationPolicy: 'disabled' }));
  await expectDeny('B NÃO se torna dono', () => fs.updateDoc(fs.doc(B.db, 'groups', G), { ownerId: B.uid }));
  await expectAllow('B atualiza o resumo da última mensagem', () => fs.updateDoc(fs.doc(B.db, 'groups', G), { lastMessage: 'oi', lastMessageAt: Date.now(), updatedAt: Date.now() }));
  await expectDeny('Dono NÃO reduz o limite abaixo do total atual', () => fs.updateDoc(fs.doc(A.db, 'groups', G), { memberLimit: 1 }));
  await expectDeny('Dono NÃO salva caminho local (file://) como foto', () => fs.updateDoc(fs.doc(A.db, 'groups', G), { photoUrl: 'file:///data/foto.jpg' }));

  console.log('\n== Grupo: concorrência no limite (1 vaga, 2 entradas simultâneas)');
  async function addMemberTx(user, newId) {
    const ref = fs.doc(user.db, 'groups', G);
    return fs.runTransaction(user.db, async (tx) => {
      const snap = await tx.get(ref);
      const g = snap.data();
      if (g.memberIds.includes(newId)) return;
      if (g.memberIds.length >= g.memberLimit) throw new Error('LIMITE');
      tx.update(ref, { memberIds: [...g.memberIds, newId], updatedAt: Date.now() });
    });
  }
  const results = await Promise.allSettled([addMemberTx(A, C.uid), addMemberTx(A, D.uid)]);
  const after = (await fs.getDoc(fs.doc(A.db, 'groups', G))).data();
  check('Somente 1 das 2 entradas simultâneas foi aceita', results.filter((x) => x.status === 'fulfilled').length === 1, JSON.stringify(results.map((x) => x.status)));
  check('Grupo terminou com 3/3 (limite respeitado)', after.memberIds.length === 3, `membros=${after.memberIds.length}`);
  const outsider = after.memberIds.includes(C.uid) ? D : C;
  await expectDeny('Escrita direta (sem transação) acima do limite é recusada pelas regras', () =>
    fs.updateDoc(fs.doc(A.db, 'groups', G), { memberIds: [...after.memberIds, outsider.uid] })
  );
  const joined = after.memberIds.includes(C.uid) ? C : D;
  await api(A, 'POST', `/groups/${G}/members/sync`);

  console.log('\n== Políticas de notificação (API calcula destinatários)');
  async function pushFor(policy, sender, extra) {
    await fs.updateDoc(fs.doc(A.db, 'groups', G), { notificationPolicy: policy, updatedAt: Date.now() });
    const m = await sendMsg(sender, G, 'group', `teste ${policy}`, extra);
    return api(sender, 'POST', '/notifications/messages', { conversationId: G, messageId: m.id });
  }
  r = await pushFor('all_group_messages', A);
  check('all_group_messages → todos menos o remetente (2)', r.json?.recipientCount === 2, JSON.stringify(r.json));
  r = await pushFor('mentioned_members', A, { mentionedUserIds: [B.uid] });
  check('mentioned_members → só o mencionado (1)', r.json?.recipientCount === 1, JSON.stringify(r.json));
  r = await pushFor('mentioned_members', A, { target: { type: 'member', memberId: joined.uid } });
  check('mentioned_members → integrante selecionado como destinatário (1)', r.json?.recipientCount === 1, JSON.stringify(r.json));
  r = await pushFor('mentioned_members', A, { mentionedUserIds: [A.uid, outsider.uid] });
  check('mentioned_members ignora o remetente e não integrantes (0)', r.json?.recipientCount === 0, JSON.stringify(r.json));
  r = await pushFor('direct_messages_only', A);
  check('direct_messages_only → grupo não gera push (0)', r.json?.recipientCount === 0, JSON.stringify(r.json));
  r = await pushFor('disabled', B);
  check('disabled → nenhum push (0)', r.json?.recipientCount === 0, JSON.stringify(r.json));

  console.log('\n== Perfil compartilhado (API)');
  r = await api(A, 'GET', `/users/${B.uid}/profile`);
  check('A vê dados cadastrais de B (têm DM e grupo)', r.status === 200 && r.json.profile.phoneNumber === '(11) 99999-0000', JSON.stringify(r));
  r = await api(joined, 'GET', `/users/${B.uid}/profile`);
  check(`${joined.label} vê o perfil de B (grupo em comum)`, r.status === 200, JSON.stringify(r));
  r = await api(outsider, 'GET', `/users/${A.uid}/profile`);
  check(`${outsider.label} (sem conversa em comum) NÃO vê o perfil de A (403)`, r.status === 403, JSON.stringify(r));

  console.log('\n== Remoção de integrante');
  const removeRef = fs.doc(A.db, 'groups', G);
  const cur = (await fs.getDoc(removeRef)).data();
  await fs.updateDoc(removeRef, { memberIds: cur.memberIds.filter((id) => id !== B.uid), updatedAt: Date.now() });
  r = await api(A, 'POST', `/groups/${G}/members/sync`);
  check('Sync após remoção', r.status === 200 && r.json.memberCount === 2, JSON.stringify(r));
  await expectDeny('B removido NÃO lê mais as mensagens do grupo', () => rt.get(rt.ref(B.rtdb, `messages/${G}`)));
  await expectDeny('B removido NÃO envia mensagens ao grupo', () => sendMsg(B, G, 'group', 'ainda estou aqui?'));
  await expectDeny('B removido NÃO lê o grupo no Firestore', () => fs.getDoc(fs.doc(B.db, 'groups', G)));
  await expectAllow(`${joined.label} sai do grupo sozinho`, async () => {
    const g = (await fs.getDoc(fs.doc(joined.db, 'groups', G))).data();
    await fs.updateDoc(fs.doc(joined.db, 'groups', G), { memberIds: g.memberIds.filter((id) => id !== joined.uid), updatedAt: Date.now() });
  });
  r = await api(joined, 'POST', `/groups/${G}/members/sync`);
  check('Quem acabou de sair consegue disparar o sync', r.status === 200, JSON.stringify(r));

  console.log('\n== Fotos (API -> Cloudinary)');
  const tinyJpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex').toString('base64');
  await expectDeny('URL de foto fora do Cloudinary é recusada no Firestore', () =>
    fs.updateDoc(fs.doc(A.db, 'users', A.uid), { photoUrl: 'https://exemplo.com/foto.jpg' })
  );
  await expectAllow('URL do Cloudinary é aceita no Firestore', () =>
    fs.updateDoc(fs.doc(A.db, 'users', A.uid), { photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/fiap-chat/users/a/avatar.jpg' })
  );
  r = await api(A, 'POST', '/uploads/image', { target: 'profile', mimeType: 'text/plain', imageBase64: tinyJpeg });
  check('Upload de arquivo que não é imagem -> 400', r.status === 400, JSON.stringify(r));
  r = await api(C, 'POST', '/uploads/image', { target: 'group', groupId: G, mimeType: 'image/jpeg', imageBase64: tinyJpeg });
  check('Não dono NÃO troca a foto do grupo (403)', r.status === 403, JSON.stringify(r));
  r = await api(A, 'POST', '/uploads/image', { target: 'group', groupId: G, mimeType: 'image/jpeg', imageBase64: tinyJpeg });
  check('Dono pode trocar a foto do grupo (200; 503 se o Cloudinary não estiver configurado localmente)', r.status === 200 || r.status === 503, JSON.stringify(r));
  const unauth = await fetch(`${API}/uploads/image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('Upload sem token -> 401', unauth.status === 401, String(unauth.status));

  console.log(`\nResultado: ${passed} ok, ${failed} falha(s)`);
  if (failed) console.log('Falhas:\n - ' + failures.join('\n - '));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro fatal no teste:', e);
  process.exit(2);
});
