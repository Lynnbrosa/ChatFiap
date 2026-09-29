import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest, requireUser } from '../middleware/authenticate';
import { adminDatabase, adminFirestore } from '../services/firebaseAdmin';
import { resolveRecipients } from '../services/recipientResolver';
import { sendPushNotifications } from '../services/notificationSender';
import { parseMessageRecord } from '../services/types';
import { isValidKey } from './validation';

const router = Router();

const PREVIEW_LENGTH = 100;

function isAlreadyExistsError(err: unknown): boolean {
  // Código gRPC 6 = ALREADY_EXISTS (documento de idempotência já criado)
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 6;
}

function preview(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > PREVIEW_LENGTH ? `${singleLine.slice(0, PREVIEW_LENGTH - 3)}...` : singleLine;
}

/**
 * POST /notifications/messages
 * Body: { conversationId, messageId }
 *
 * 1. Valida o Firebase ID Token (middleware authenticate).
 * 2. Confirma no Realtime Database que a mensagem existe e que o remetente é o usuário autenticado.
 * 3. Reserva a mensagem de forma ATÔMICA (create) — reenvios não geram push duplicado.
 * 4. Consulta participantes, política e tokens no Firestore e calcula os destinatários no servidor.
 * 5. Envia pelo Expo Push Service / FCM.
 */
router.post('/messages', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const body: unknown = req.body;
  const conversationId =
    typeof body === 'object' && body !== null && 'conversationId' in body ? body.conversationId : undefined;
  const messageId = typeof body === 'object' && body !== null && 'messageId' in body ? body.messageId : undefined;

  if (!isValidKey(conversationId) || !isValidKey(messageId)) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'Envie conversationId e messageId válidos.',
    });
    return;
  }

  try {
    // Mensagem precisa existir no RTDB
    const snapshot = await adminDatabase.ref(`messages/${conversationId}/${messageId}`).get();
    const message = snapshot.exists() ? parseMessageRecord(snapshot.val()) : null;

    if (!message) {
      res.status(404).json({ error: 'not_found', message: 'Mensagem não encontrada.' });
      return;
    }

    // O remetente gravado precisa ser o usuário do token, e os dados precisam bater com o caminho
    if (
      message.senderId !== user.uid ||
      message.conversationId !== conversationId ||
      message.id !== messageId
    ) {
      res.status(403).json({
        error: 'forbidden',
        message: 'Você só pode solicitar notificações das suas próprias mensagens.',
      });
      return;
    }

    // Idempotência atômica: create() falha se o documento já existir, mesmo com requisições simultâneas
    const claimRef = adminFirestore.collection('notifiedMessages').doc(`${conversationId}__${messageId}`);
    try {
      await claimRef.create({
        conversationId,
        messageId,
        senderId: user.uid,
        status: 'processing',
        createdAt: Date.now(),
      });
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        res.status(200).json({ success: true, duplicate: true, sentCount: 0 });
        return;
      }
      throw err;
    }

    try {
      const resolved = await resolveRecipients(conversationId, message);

      if (resolved.policyUsed === 'rejected') {
        await claimRef.update({ status: 'rejected', reason: resolved.reason ?? null, processedAt: Date.now() });
        res.status(403).json({
          error: 'forbidden',
          message: 'O remetente não participa desta conversa.',
        });
        return;
      }

      // Texto curto: nome do remetente + prévia da mensagem (sem e-mail, telefone ou IDs)
      const body =
        message.conversationType === 'group'
          ? `${resolved.senderName}: ${preview(message.text)}`
          : preview(message.text);

      const result = await sendPushNotifications({
        recipientUids: resolved.recipientUids,
        title: resolved.conversationTitle,
        body,
        payload: {
          conversationId,
          conversationType: message.conversationType,
          messageId,
        },
      });

      await claimRef.update({
        status: 'sent',
        policyUsed: resolved.policyUsed,
        recipientCount: resolved.recipientUids.length,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        processedAt: Date.now(),
      });

      res.status(200).json({
        success: true,
        policyUsed: resolved.policyUsed,
        recipientCount: resolved.recipientUids.length,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      });
    } catch (err) {
      // Libera a reserva para permitir uma nova tentativa
      await claimRef.delete().catch(() => undefined);
      throw err;
    }
  } catch (error) {
    console.error('[Notifications] Erro ao processar notificação:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Não foi possível processar a notificação agora.',
    });
  }
});

export default router;
