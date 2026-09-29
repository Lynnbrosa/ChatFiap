# 📱 FIAP Chat — React Native + Firebase

Aplicativo de chat em **React Native (Expo) com TypeScript** com conversas **individuais** e **em grupo**, mensagens em **tempo real** no Firebase Realtime Database, perfis/grupos no Cloud Firestore, fotos no **Cloudinary** (enviadas pela API) e **push notifications** enviadas por uma **API própria** publicada na internet, com destinatários definidos pela política de cada grupo.

## 👨‍💻 Integrantes

- RM556223 — Giovanne Charelli Zaniboni Silva
- RM555827 — Gustavo Oliveira de Moura
- RM551102 — Lynn Bueno Rosa

---

## Sumário

1. [Tecnologias e versões](#-tecnologias-e-versões)
2. [Serviços Firebase e responsabilidades](#-serviços-firebase-e-responsabilidades)
3. [Arquitetura e fluxo de uma mensagem](#-arquitetura-e-fluxo-de-uma-mensagem)
4. [Passo a passo do Firebase](#-passo-a-passo-do-firebase)
5. [API de notificações (backend)](#-api-de-notificações-backend)
6. [Notificações no Android e no iOS](#-notificações-no-android-e-no-ios)
7. [Instalação e execução do app](#-instalação-e-execução-do-app)
8. [Política de notificações](#-política-de-notificações)
9. [Limite de integrantes e concorrência](#-limite-de-integrantes-e-proteção-contra-concorrência)
10. [Regras de segurança](#-regras-de-segurança)
11. [Fotos (Cloudinary via API)](#-fotos-de-perfil-e-de-grupo)
12. [Estrutura do projeto](#-estrutura-do-projeto)
13. [Testes automatizados com emuladores](#-testes-automatizados-e-emuladores)
14. [Prints das telas](#-prints-das-telas)
15. [Evidência de notificação](#-evidência-de-notificação-recebida)

---

## 🚀 Tecnologias e versões

| Camada | Tecnologia |
|---|---|
| App | **Expo SDK 57** (`expo ~57.0.25`), React Native 0.86, React 19.2, TypeScript 6 (strict, **sem `any`**) |
| Navegação | React Navigation 7 (native stack) com parâmetros tipados |
| Firebase (cliente) | Firebase JS SDK 12 — Auth, Firestore, Realtime Database |
| Push no app | `expo-notifications` (Expo Push Token, entregue via **FCM** no Android e APNs no iOS) |
| Imagens | `expo-image-picker` (câmera ou galeria, com permissões) + **Cloudinary**, com upload assinado feito pela API |
| API | **Node.js 22 + Express 4 + TypeScript**, Firebase Admin SDK, `expo-server-sdk`, SDK do Cloudinary |
| Hospedagem da API | Render (plano gratuito, HTTPS) — configuração em [`render.yaml`](render.yaml) |
| Build | EAS Build (APK Android / build iOS) — [`eas.json`](eas.json) |

Não usamos Cloud Functions: todo envio de push passa pela API própria.

## 🔥 Serviços Firebase e responsabilidades

| Serviço | O que guarda / faz |
|---|---|
| **Authentication** | Cadastro e login **somente por e-mail e senha**, recuperação da sessão (persistida com AsyncStorage), identificação pelo `uid`, logout. |
| **Realtime Database** | **Todas as mensagens** (`messages/{conversationId}/{messageId}`), listeners em tempo real da conversa aberta e o espelho de integrantes ativos dos grupos (`groupMembers/{groupId}/{uid}`), usado pelas regras. |
| **Cloud Firestore** | Perfis públicos (`users/{uid}`), dados cadastrais privados (`users/{uid}/private/profile`), tokens de dispositivos (`users/{uid}/devices/{deviceId}`), conversas individuais (`directConversations`), grupos com integrantes, `memberLimit` e `notificationPolicy` (`groups`), registro de idempotência do push (`notifiedMessages`). |
| **Cloud Messaging (FCM)** | Entrega dos pushes no Android (via Expo Push Service com credencial FCM V1, ou FCM direto para tokens nativos). O payload leva `conversationId`, `conversationType` e `messageId`. |
| *(fotos)* | O **Firebase Storage não é usado**: ele exige o plano pago Blaze. As fotos ficam no **Cloudinary** (gratuito). No Firestore fica **apenas a URL final**. Veja [Fotos](#-fotos-de-perfil-e-de-grupo). |

## 🧭 Arquitetura e fluxo de uma mensagem

```
App (usuário envia)
   │ 1. grava a mensagem em messages/{conversa}/{id}  ──►  Realtime Database
   │                                                        │ 2. listeners atualizam a conversa aberta (tempo real)
   │ 3. POST /notifications/messages { conversationId, messageId }
   │    Authorization: Bearer <Firebase ID Token>
   ▼
API própria (Render, HTTPS)
   4. valida o ID Token com o Admin SDK
   5. confirma no RTDB que a mensagem existe e que o remetente é o usuário do token
   6. reserva a mensagem de forma atômica (evita push duplicado)
   7. lê no Firestore participantes, política e tokens → calcula os destinatários
   8. envia pelo Expo Push Service / FCM → só os destinatários permitidos
```

A API **nunca** recebe lista de destinatários do app: ela calcula no servidor.

---

## 🔧 Passo a passo do Firebase

O projeto Firebase usado é **`checkpoint2-9fe23`**. A configuração do SDK cliente já está em [`firebaseConfig.json`](firebaseConfig.json), versionada como o enunciado pede. Ela **não** contém credenciais administrativas.

> Status: Authentication (só e-mail/senha), Firestore, Realtime Database e o app Android já estão criados no projeto. Faltam publicar as regras (passo 6), a conta de serviço (7) e o EAS (8).

### 1. Authentication (e-mail e senha)
1. Console do Firebase → **Build → Authentication → Get started**.
2. Aba **Sign-in method** → **Email/Password** → **Enable** → Save.
3. Não habilite nenhum outro provedor (Google, Apple, anônimo etc.).

### 2. Cloud Firestore
1. **Build → Firestore Database → Create database**.
2. Local: **`nam5 (United States)`**. Modo: **Production mode**. As regras de verdade são publicadas no passo 6.

### 3. Realtime Database
1. **Build → Realtime Database → Create Database**.
2. Local: **United States (us-central1)** → **Start in locked mode**.
3. Confira a URL mostrada no topo do painel. Ela deve ser `https://checkpoint2-9fe23-default-rtdb.firebaseio.com`. Se for diferente (outra região), copie a URL para o campo `databaseURL` do `firebaseConfig.json` e também para a variável `FIREBASE_DATABASE_URL` da API.

### 4. Fotos: conta gratuita no Cloudinary
O Firebase Storage exige o plano Blaze (com cartão), então usamos o **Cloudinary**, que é gratuito (25 créditos/mês) e não pede cartão.
1. Crie a conta em [cloudinary.com](https://cloudinary.com/users/register_free).
2. No painel → **Settings → API Keys**, anote o **Cloud name**, a **API Key** e o **API Secret**.
3. Esses três valores vão **só** nas variáveis secretas da API no Render (veja [Publicar no Render](#publicar-no-render-passo-a-passo)). O app nunca vê a chave: ele envia a foto para a API, e a API faz o upload assinado.

### 5. App Android (necessário para o push)
1. ⚙️ **Project settings → General → Your apps → Add app → Android**.
2. Android package name: **`com.fiapchat.app`** (igual ao `app.json`).
3. Baixe o **`google-services.json`** e coloque na **raiz do projeto**, ao lado do `app.json`.
   Esse arquivo é configuração de cliente e **pode ser commitado**. O EAS Build precisa dele.

### 6. Publicar as regras de segurança
As regras estão versionadas em [`firestore.rules`](firestore.rules) e [`database.rules.json`](database.rules.json). O [`firebase.json`](firebase.json) e o [`.firebaserc`](.firebaserc) já apontam para o projeto.

```bash
npx firebase-tools login
```

```bash
npx firebase-tools deploy --only firestore:rules,database
```

### 7. Conta de serviço da API (credencial administrativa)
A API precisa de uma conta de serviço para usar o Admin SDK. **Essa chave nunca vai para o GitHub nem para o app.** Ela fica só nas variáveis secretas do Render.

**Recomendado — permissões mínimas** (atende ao enunciado):
1. Google Cloud Console → projeto `checkpoint2-9fe23` → **IAM & Admin → Service Accounts → Create service account**. Nome: `fiap-chat-api`.
2. Conceda somente estes papéis:
   - **Cloud Datastore User**: ler/gravar Firestore (grupos, tokens, idempotência).
   - **Firebase Realtime Database Admin**: ler mensagens e manter o espelho de integrantes.
   - **Firebase Cloud Messaging API Admin**: enviar push por FCM.
   - Validar o ID Token (`verifyIdToken`) não exige nenhum papel.
3. Na conta criada → **Keys → Add key → Create new key → JSON**.

> A chave gerada em *Project settings → Service accounts → Generate new private key* (`firebase-adminsdk-...`) também funciona, mas tem permissões de administrador bem maiores que o necessário. Se usar a conta mínima, apague a chave antiga em *Keys*.

Guarde o JSON **fora da pasta do projeto**. O `.gitignore` bloqueia `*-firebase-adminsdk-*.json` e `*serviceAccount*.json` por segurança.

### 8. Credencial FCM V1 no EAS (push no Android)
1. Crie a conta no [expo.dev](https://expo.dev) e rode na raiz do projeto:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

   O `eas init` grava o `extra.eas.projectId` no `app.json`. Esse ID é necessário para gerar o Expo Push Token.

2. Envie a chave de conta de serviço (com o papel *Firebase Cloud Messaging API Admin*) para o EAS:

```bash
npx eas-cli@latest credentials
```

   → Android → *production/preview* → **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → upload do JSON.

---

## 📡 API de notificações (backend)

**Tecnologia:** Node.js 22 + Express + TypeScript + Firebase Admin SDK + Expo Server SDK. Código em [`server/`](server/).

### URL pública
**URL da API:** https://fiap-chat-notifications-api.onrender.com  
**Health check:** https://fiap-chat-notifications-api.onrender.com/health

A mesma URL está em `app.json → expo.extra.notificationsApiUrl`, que é usada pelo app.

### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | pública | Disponibilidade. Retorna `status: "ok"`, `firebaseAdminConfigured` e `imageStorageConfigured` (`true` quando os segredos estão configurados). |
| POST | `/notifications/messages` | Bearer ID Token | Body `{ conversationId, messageId }`. Valida a mensagem e o remetente, aplica a política e envia o push. Reenvios retornam `duplicate: true` sem notificar de novo. |
| POST | `/groups/:groupId/members/sync` | Bearer ID Token | Copia os integrantes do grupo (Firestore) para o espelho `groupMembers` no RTDB, que libera o acesso às mensagens. Chamado pelo app ao criar grupo, adicionar ou remover integrantes. |
| GET | `/users/:uid/profile` | Bearer ID Token | Dados cadastrais de outro usuário, **somente** se houver conversa individual ou grupo em comum (senão `403`). |
| POST | `/uploads/image` | Bearer ID Token | Body `{ target: 'profile' }` ou `{ target: 'group', groupId }` + `mimeType` + `imageBase64`. Confere a permissão (foto de perfil só do próprio usuário, foto do grupo só do proprietário), aceita só imagens de até 5 MB, envia ao Cloudinary e devolve `{ url }`. |

Erros retornam `{ error, message }` sem detalhes internos.

### Publicar no Render (passo a passo)
1. O Render publica a partir do repositório no GitHub: https://github.com/Lynnbrosa/ChatFiap
2. [render.com](https://render.com) → **New → Blueprint** → selecione o repositório. O [`render.yaml`](render.yaml) já define:
   - Root directory `server`, build `npm ci --include=dev && npm run build`, start `npm start`, health check `/health`.
   - Se preferir sem Blueprint: **New → Web Service** com os mesmos valores.
3. Em **Environment**, preencha os segredos **copiando os campos do JSON da conta de serviço**:

| Variável | Valor |
|---|---|
| `FIREBASE_PROJECT_ID` | `checkpoint2-9fe23` |
| `FIREBASE_CLIENT_EMAIL` | campo `client_email` do JSON |
| `FIREBASE_PRIVATE_KEY` | campo `private_key` do JSON, inteiro, incluindo `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----` |
| `FIREBASE_DATABASE_URL` | `https://checkpoint2-9fe23-default-rtdb.firebaseio.com` |
| `CLOUDINARY_CLOUD_NAME` | Cloud name do painel do Cloudinary |
| `CLOUDINARY_API_KEY` | API Key do Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret do Cloudinary |

4. Deploy → abra `https://<sua-api>.onrender.com/health`. Deve mostrar `"firebaseAdminConfigured": true` e `"imageStorageConfigured": true`.
5. **Mantenha a API acordada durante a correção.** O plano gratuito "dorme" após 15 min sem uso, e a primeira chamada leva ~50 s. Crie um monitor gratuito no [UptimeRobot](https://uptimerobot.com) ou [cron-job.org](https://cron-job.org) chamando `/health` a cada 10 minutos.

Os nomes das variáveis (sem valores reais) estão em [`server/.env.example`](server/.env.example).

### Rodar a API localmente (opcional, para desenvolvimento)

```bash
cd server && npm install && npm run build && npm start
```

Localmente ela lê um `server/.env`, que está no `.gitignore`. Nunca commite esse arquivo.

---

## 🔔 Notificações no Android e no iOS

- **Expo Go não serve para testar push.** No Android ele não recebe push remoto desde o SDK 53. Use o build do EAS.
- **Android:** precisa do `google-services.json` (passo 5) e da credencial FCM V1 no EAS (passo 8). Gere um APK instalável:

```bash
npx eas-cli@latest build -p android --profile preview
```

  O EAS devolve um link/QR code do APK, que pode ser enviado ao professor.
- **iOS:** exige **conta paga do Apple Developer**. Registre o aparelho (`npx eas-cli@latest device:create`) e rode `npx eas-cli@latest build -p ios --profile preview`. Na primeira vez o EAS cria a chave de push da Apple (APNs) automaticamente. Sem conta paga, as telas podem ser testadas no iOS, mas o push remoto no iOS não é possível.
- Push só funciona em **dispositivo físico**. Em emulador/simulador o app mostra o aviso "exigem um dispositivo físico".
- O app pede a permissão ao entrar. Se ela for negada, a tela de conversas mostra um aviso com o botão **Abrir configurações**.
- Com a conversa aberta, o push dela não aparece em primeiro plano (já estamos vendo a mensagem).
- Ao tocar na notificação, com o app aberto, em segundo plano ou fechado, o app abre a conversa do `conversationId` do payload.

---

## 🛠️ Instalação e execução do app

```bash
npm install
```

```bash
npx expo start
```

- Antes de gerar o build, confirme que:
  1. `firebaseConfig.json` está com a configuração do projeto (já está);
  2. `google-services.json` está na raiz;
  3. `app.json → expo.extra.notificationsApiUrl` tem a URL HTTPS da API;
  4. `app.json → expo.extra.eas.projectId` foi preenchido pelo `eas init`.
- Para testar tudo, inclusive push, instale o APK gerado pelo EAS (seção anterior).
- Variáveis opcionais de desenvolvimento em [`.env.example`](.env.example), sem nenhum segredo.

---

## 🛡️ Política de notificações

Cada grupo tem `notificationPolicy`, definida na criação e alterável **só pelo proprietário** (a regra do Firestore bloqueia os demais). A API guarda também quem alterou e quando (`notificationPolicyUpdatedBy/At`).

| Política | Quem recebe o push |
|---|---|
| `all_group_messages` | Todos os integrantes do grupo, **exceto o remetente**. |
| `mentioned_members` | Somente quem foi **mencionado** (@) ou **escolhido como destinatário** (📌), desde que seja integrante e não seja o remetente. |
| `direct_messages_only` | Mensagens do grupo **não** geram push. Só as conversas individuais notificam. |
| `disabled` | Nenhuma mensagem do grupo gera push. |

Regras gerais aplicadas pela API:
- Nas conversas individuais, o outro participante é notificado.
- O remetente nunca é notificado e só participantes podem receber.
- Tokens inválidos (`DeviceNotRegistered`/FCM `registration-token-not-registered`) são **desativados** no Firestore.
- O texto do push mostra só o nome do remetente/grupo e uma prévia curta da mensagem (sem e-mail, telefone ou IDs).
- O payload tem `conversationId`, `conversationType` e `messageId`.
- **Idempotência:** o documento `notifiedMessages/{conversa}__{mensagem}` é criado com `create()` (atômico) antes do envio. Um reenvio ou requisições simultâneas da mesma mensagem não geram push repetido. Isso foi testado com 6 chamadas simultâneas.
- No logout o token do aparelho é desativado, para o usuário anterior não receber mais push ali.

## 👥 Limite de integrantes e proteção contra concorrência

- `memberLimit` é definido na criação (inteiro entre 2 e 100) e pode ser alterado **somente pelo proprietário**. Ele não pode ficar menor que a quantidade atual de integrantes, e o proprietário conta como integrante.
- A interface mostra `integrantes/limite` e as **vagas disponíveis**, e bloqueia a seleção além das vagas.
- **Proteção real (servidor):** a regra do Firestore exige `memberIds.size() <= memberLimit` **em toda escrita** do grupo. Ela é avaliada no servidor do Firebase, então nem um cliente modificado consegue passar do limite.
- **Concorrência:** a adição de integrantes usa `runTransaction`. Se duas pessoas tentam ocupar a última vaga ao mesmo tempo, o Firestore detecta que o documento mudou e repete a transação com os dados novos. A segunda tentativa encontra o grupo cheio e falha com "limite atingido". Mesmo sem transação, a regra acima recusa a escrita.
- No teste automatizado, duas entradas simultâneas com 1 vaga resultaram em **exatamente 1 aceita** e o grupo terminou em 3/3.

## 🔒 Regras de segurança

As regras ficam versionadas no repositório e **nenhuma é pública** (`.read/.write: true` não existe em nenhum lugar).

**Firestore** ([`firestore.rules`](firestore.rules))
- Somente usuários autenticados acessam dados.
- `users/{uid}` guarda só nome e foto (para a busca de usuários) e só o dono edita. `photoUrl` precisa ser `https://` ou vazio, o que **bloqueia Base64** e caminhos locais.
- `users/{uid}/private/profile` (e-mail, celular, nascimento) é lido **só pelo dono**. Outras pessoas recebem esses dados apenas pela API, se tiverem conversa ou grupo em comum.
- `users/{uid}/devices` (tokens de push) é lido e escrito **só pelo dono**. A API lê com o Admin SDK.
- `directConversations`: o ID precisa ser `uidMenor_uidMaior`, com exatamente 2 participantes distintos, o criador entre eles e ambos existindo. Só participantes leem, e só o resumo da última mensagem pode ser atualizado.
- `groups`: só integrantes leem. O dono gerencia nome, foto, integrantes, limite e política, mas não troca `ownerId`. O integrante comum só pode **sair** (remover a si mesmo) ou atualizar o resumo da última mensagem. O limite vale em toda escrita.

**Realtime Database** ([`database.rules.json`](database.rules.json))
- Tudo fechado por padrão.
- `messages/{conversationId}`:
  - **Leitura:** conversa individual → só os dois `uid` que formam o ID; grupo → só quem está em `groupMembers/{groupId}`.
  - **Escrita:** só criação (mensagens são imutáveis), com `senderId == auth.uid`, remetente participante, `conversationId` igual ao caminho, texto de 1 a 1000 caracteres e campos validados.
- `groupMembers` só é escrito pela API. **Um integrante removido sai do espelho e perde o acesso às mensagens novas na hora.**

**Fotos (API):** a rota `/uploads/image` faz o papel das regras de armazenamento. Ela aceita só imagens de até 5 MB, a foto de perfil só pelo próprio usuário e a do grupo só pelo proprietário (conferido no Firestore). No Firestore, `photoUrl` só aceita URLs `https://res.cloudinary.com/...` ou vazio.

**Decisão documentada:** o RTDB não consegue consultar o Firestore. Por isso **as validações que dependem dos dois bancos ficam na API**:
- o espelho de integrantes ativos (usado pelas regras do RTDB);
- o cálculo dos destinatários do push;
- a verificação "conversa ou grupo em comum" para ver dados cadastrais;
- a permissão para enviar fotos (perfil e grupo).

## 🖼️ Fotos de perfil e de grupo

- **Serviço escolhido: [Cloudinary](https://cloudinary.com)** (plano gratuito). O Firebase Storage não foi usado porque exige o plano pago Blaze. O enunciado permite outra solução, desde que documentada.
- A foto é escolhida pela **câmera ou galeria** (`expo-image-picker`), com pedido e tratamento de permissão. A imagem é recortada em 1:1.
- O app envia a imagem para a **API própria** (`POST /uploads/image`, autenticada com o ID Token). A API:
  - confere a permissão;
  - faz o **upload assinado** no Cloudinary, com a chave secreta guardada só no Render;
  - pede ao Cloudinary para reduzir a imagem a 512×512;
  - devolve a URL HTTPS final.
- **Apenas essa URL** é gravada no Firestore. O Base64 só trafega até a API e nunca é salvo em nenhum banco, e a regra do Firestore recusa qualquer valor que não seja uma URL do Cloudinary.
- Se a foto não existir ou falhar ao carregar, o componente `Avatar` mostra uma imagem padrão (iniciais ou ícone).
- Tocar na foto no chat abre o perfil (conversa individual) ou a lista de integrantes (grupo). Cada integrante leva ao perfil dele.
- Configuração: passo 4 do [passo a passo](#-passo-a-passo-do-firebase) e as três variáveis `CLOUDINARY_*` no Render.

## 🗂️ Estrutura do projeto

```
├── App.tsx / index.ts
├── firebaseConfig.json        # config do SDK cliente (sem credenciais admin)
├── firestore.rules            # regras do Firestore
├── database.rules.json        # regras do Realtime Database
├── firebase.json / .firebaserc
├── app.json / eas.json        # Expo + EAS Build
├── render.yaml                # deploy da API no Render
├── .env.example
├── scripts/
│   ├── seed-emulator.mjs      # dados de demonstração (só emulador)
│   └── test-rules.mjs         # 72 verificações de regras + API
├── docs/screenshots/          # prints
├── src/
│   ├── components/            # Avatar, ChatInput, ChatMessage, ConversationItem, GroupMemberItem,
│   │                          # PhotoPicker, NoticeBanner, ConnectivityBanner, Loading, ErrorMessage, EmptyState
│   ├── config/env.ts          # URL da API, projectId do EAS, emuladores
│   ├── contexts/AuthContext.tsx
│   ├── hooks/                 # useAuth, useChat, useGroups (+ useGroupDetails), useNotifications, useConnectivity
│   ├── navigation/AppNavigator.tsx
│   ├── screens/               # Login, Register, Conversations, Users, GroupForm, GroupMembers, Chat, Profile
│   ├── services/              # firebase, converters (Firestore tipado), apiClient, authService, userService,
│   │                          # groupService, chatService, notificationService, imagePickerService, imageUploadService, connectivityService
│   ├── types/                 # user, chat, group, notification, navigation, api, image
│   └── utils/                 # conversationId, groupValidation, validators, formatters, errors
└── server/
    ├── .env.example
    └── src/
        ├── app.ts / index.ts
        ├── middleware/authenticate.ts
        ├── routes/            # health, notifications, groups, users, uploads
        └── services/          # firebaseAdmin, recipientResolver, notificationSender, imageStorage, types
```

**Hooks obrigatórios:** `useState`/`useEffect` estão em todas as telas e hooks, e os listeners são sempre removidos no cleanup. `useMemo` calcula a lista unificada de conversas, as vagas, os integrantes elegíveis para menção e o valor do contexto. `useCallback` estabiliza as ações de auth, chat e grupos.

**Estados tratados:** loading, erro, usuário não autenticado, sessão expirada, nenhuma conversa, nenhum usuário, grupo sem vagas, conversa sem mensagens, falha no envio (o texto é mantido para reenviar), falha ao pedir o push, permissão de notificação negada, dispositivo sem token, sem conexão (via `.info/connected`), integrante removido e acesso negado.

## 🧪 Testes automatizados e emuladores

O script [`scripts/test-rules.mjs`](scripts/test-rules.mjs) cria usuários nos **emuladores locais** e verifica **72 cenários**. Todos passam. Entre eles:
- leitura e escrita permitidas e negadas em cada coleção;
- Base64 recusado;
- DM consigo mesmo recusada;
- não integrante sem acesso às mensagens;
- usuário removido perde o acesso;
- concorrência no limite;
- as 4 políticas de push;
- idempotência com 6 requisições simultâneas;
- `403` ao pedir push da mensagem de outra pessoa;
- perfil protegido;
- upload de foto protegido e só URLs do Cloudinary aceitas.

Para rodar (Java 11+ instalado), em terminais separados:

```bash
npx firebase-tools emulators:start --only auth,firestore,database
```

```bash
cd server && npm run build && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_PROJECT_ID=checkpoint2-9fe23 FIREBASE_DATABASE_URL=https://checkpoint2-9fe23-default-rtdb.firebaseio.com npm start
```

```bash
node scripts/test-rules.mjs
```

Para usar o app ligado aos emuladores: `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true`, com dados de exemplo gerados por `node scripts/seed-emulator.mjs`.

## 📸 Prints das telas

Capturados do próprio app rodando ligado aos emuladores do Firebase, com dados de demonstração e tela de celular (390×844).

| Login | Erro de credenciais | Cadastro |
|---|---|---|
| ![Login](docs/screenshots/01-login.png) | ![Erro no login](docs/screenshots/02-login-erro.png) | ![Cadastro](docs/screenshots/03-cadastro.png) |

| Conversas | Usuários | Criar grupo |
|---|---|---|
| ![Conversas](docs/screenshots/04-conversas.png) | ![Usuários](docs/screenshots/05-usuarios.png) | ![Criar grupo](docs/screenshots/06-criar-grupo.png) |

| Chat individual | Perfil (toque na foto) | Chat em grupo (tempo real) |
|---|---|---|
| ![Chat individual](docs/screenshots/07-chat-individual.png) | ![Perfil](docs/screenshots/08-perfil.png) | ![Chat em grupo](docs/screenshots/09-chat-grupo.png) |

| Menção de integrante | Menção selecionada | Integrantes e vagas |
|---|---|---|
| ![Menção](docs/screenshots/10-mencao.png) | ![Menção selecionada](docs/screenshots/10b-mencao-selecionada.png) | ![Integrantes](docs/screenshots/11-integrantes.png) |

| Configurações do grupo (proprietário) |
|---|
| ![Configurações](docs/screenshots/12-configuracoes-grupo.png) |

## 🔔 Evidência de notificação recebida

> ⚠️ **A preencher pela equipe com o APK instalado em celulares reais** (push não funciona em emulador nem na web):
> 1. Instale o APK em dois celulares e entre com contas diferentes.
> 2. Com o app do celular B em segundo plano ou fechado, envie uma mensagem pelo celular A.
> 3. Tire print da notificação no celular B → salve como `docs/screenshots/13-push-recebido.png`.
> 4. Toque na notificação e tire print do chat aberto → `docs/screenshots/14-push-abre-conversa.png`.
> 5. Descomente as linhas abaixo.

<!--
| Push recebido | Toque abre a conversa |
|---|---|
| ![Push](docs/screenshots/13-push-recebido.png) | ![Conversa aberta](docs/screenshots/14-push-abre-conversa.png) |
-->
