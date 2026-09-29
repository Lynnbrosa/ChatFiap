# 📱 FIAP Chat Firebase - React Native

Aplicativo de chat desenvolvido em React Native com TypeScript, utilizando o Firebase como backend para troca de mensagens individuais e em grupos, com atualizações em tempo real e envio seguro de notificações push via API própria.

## 🚀 Tecnologias Utilizadas

- **React Native** e **Expo SDK 57+**
- **TypeScript** (tipagem forte, sem uso de `any`)
- **React Navigation** (Navegação em pilha)
- **Firebase SDK** (Cliente)
- **Firebase Admin SDK** (Backend)
- **Node.js** com **Express** (API de Notificações)
- **Expo Notifications** e **Expo Server SDK**

## 🔥 Serviços do Firebase e Responsabilidades

* **Firebase Authentication:** Criação de contas (exclusivamente com e-mail e senha), autenticação, controle e recuperação de sessão de usuários (identificados pelo UID).
* **Firebase Realtime Database:** Armazenamento otimizado de mensagens, permitindo leitura e sincronização bidirecional em tempo real (listeners).
* **Cloud Firestore:** Banco de dados de documentos para perfis de usuários, metadados dos grupos, políticas de notificações, limites configuráveis de integrantes e registros seguros dos tokens dos dispositivos para push.
* **Firebase Cloud Messaging (FCM):** Envio silencioso e em background de notificações push utilizando payloads baseados nas conversas.
* **Firebase Storage:** Armazenamento das fotos de perfil e das fotos dos grupos (as URLs finais são persistidas no Firestore).

## 🗂️ Estrutura do Projeto

O projeto é dividido em dois módulos principais no mesmo repositório:

1. `/`: Raiz contendo o aplicativo mobile (React Native + Expo).
2. `/server/`: Contém a API online para disparo seguro das notificações push.

Estrutura das pastas do App:
- `/src/components/`: Componentes reutilizáveis (Input, Mensagens, Listas, Estados vazios, Erros, Loading).
- `/src/screens/`: Telas (Autenticação, Conversas, Perfil, Chat, Grupo).
- `/src/services/`: Camada de acesso ao Firebase (authService, chatService, groupService, userService).
- `/src/hooks/`: Hooks personalizados.
- `/src/types/`: Tipagens TypeScript obrigatórias.

## 🛡️ Políticas de Notificações

As conversas em grupo respeitam uma política de notificações configurável pelo proprietário do grupo:
1. `all_group_messages`: Notifica todos os integrantes do grupo sempre que houver uma nova mensagem.
2. `mentioned_members`: Apenas integrantes mencionados no texto ou selecionados recebem notificação.
3. `direct_messages_only`: O grupo fica silenciado, recebendo push apenas para chats diretos.
4. `disabled`: Nenhuma mensagem deste grupo gera notificação push.
*O remetente da mensagem nunca recebe sua própria notificação.*

## 🔒 Proteção Contra Concorrência no Limite do Grupo

Para evitar que requisições concorrentes ultrapassem o `memberLimit` do grupo, foi implementada uma transação atômica do Cloud Firestore (`runTransaction`) no serviço `groupService.ts`. O backend/SDK lê a quantidade atual de integrantes dentro da transação; se a validação passar, ele atualiza a lista de membros no mesmo bloco. Caso o limite seja atingido entre a leitura e a escrita por outra chamada paralela, a transação falha (ou é re-tentada) de forma segura, impossibilitando que o limite seja estourado sob concorrência.

## 📜 Regras de Segurança (Firestore e RTDB)

* **Firestore:** Permite leitura do perfil e grupos onde o `uid` está no array de `memberIds`. Apenas o dono pode editar as definições dos grupos (nome e capacidade). 
* **Realtime Database:** Restringe a gravação e leitura de mensagens apenas para integrantes ativos da conversa, usando validações por token.

## 🛠️ Instruções de Instalação e Execução (Mobile)

1. Clone o repositório.
2. Instale as dependências: `npm install`.
3. Certifique-se de que o arquivo `firebaseConfig.json` existe na raiz e possui somente chaves públicas do SDK cliente.
4. Rode a aplicação com `npx expo start` e teste em um dispositivo físico com o aplicativo Expo Go ou gerando a build nativa (se preferir debugar o FCM nativamente no Android/iOS).

*Nota sobre Push:* Para testes de notificações em Android e iOS reais, é necessário possuir a credencial FCM Server Key / APNs na Dashboard da Expo ou as integrações ativas no Firebase e usar `npx expo run:android` ou `run:ios` (ou EAS Build).

## 📡 API de Notificações (Backend)

A aplicação inclui uma API construída em Node.js com Express para validar a identidade do usuário logado via **Firebase Admin SDK**, verificar se a mensagem existe no RTDB e enviar o push usando a Expo Server SDK ou FCM de forma segura.

### Como Executar e Publicar a API:
1. Entre na pasta: `cd server` e instale: `npm install`.
2. Configure as credenciais administrativas configurando as variáveis de ambiente baseadas no `server/.env.example`. Não faça commit da chave privada.
3. Inicie localmente: `npm run dev`.
4. A API está pronta para ser publicada em provedores como Render, Railway ou Heroku. As variáveis secretas deverão ser configuradas na dashboard de deploy, e NÃO inseridas no código-fonte.

### Endpoints da API:
- **GET /health**: Retorna `200 OK` informando que o servidor está online. Ideal para *health check* por parte do professor/avaliador.
- **POST /notifications/messages**: Rota segura exigindo `Authorization: Bearer <token-do-firebase-auth>`. Recebe `{ conversationId, messageId }` e envia as notificações push dependendo da política configurada.

### 🌐 URL da API Online
**URL da API:** `https://SUA-API-AQUI.onrender.com` (Substitua após publicação!)
**Endpoint de Health Check:** `https://SUA-API-AQUI.onrender.com/health`

## 📸 Evidências
*Insira aqui as prints das telas.*
*Insira aqui a print evidenciando recebimento da notificação push.*

## 👨‍💻 Integrantes
- RM12345 — João da Silva
- RM54321 — Maria Souza
