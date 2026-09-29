import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { adminDatabase, adminFirestore } from '../services/firebaseAdmin';
import { resolveRecipients, MessageRecord } from '../services/recipientResolver';
import { sendPushNotifications } from '../services/notificationSender';

const router = Router();

/**
 * POST /notifications/messages
 * Dispara envio seguro de notificações push para uma mensagem persistida no Realtime Database.
 * Requer Bearer Token no cabeçalho Authorization.
 */
router.post('/messages', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { conversationId, messageId } = req.body;
  const authenticatedUserId = req.user?.uid;

  if (!conversationId || typeof conversationId !== 'string') {
    res.status(400).json({
      error: 'Parâmetro inválido',
      message: 'O campo conversationId é obrigatório e deve ser uma string.',
    });
    return;
  }

  if (!messageId || typeof messageId !== 'string') {
    res.status(400).json({
      error: 'Parâmetro inválido',
      message: 'O campo messageId é obrigatório e deve ser uma string.',
    });
    return;
  }

  try {
    // 1. Proteção contra chamadas duplicadas (Idempotência)
    const idempotencyRef = adminFirestore.collection('notifiedMessages').doc(messageId);
    const existingLog = await idempotencyRef.get();

    if (existingLog.exists) {
      console.log(`[NotificationRoute] Chamada duplicada ignorada para messageId: ${messageId}`);
      res.status(200).json({
        success: true,
        message: 'Notificação já processada anteriormente (idempotência garantida).',
        duplicate: true,
        data: existingLog.data(),
      });
      return;
    }

    // 2. Buscar e validar a mensagem no Firebase Realtime Database
    const messageSnapshot = await adminDatabase
      .ref(`messages/${conversationId}/${messageId}`)
      .once('value');

    if (!messageSnapshot.exists()) {
      res.status(404).json({
        error: 'Mensagem não encontrada',
        message: `A mensagem ${messageId} não foi encontrada no Realtime Database na conversa ${conversationId}.`,
      });
      return;
    }

    const messageData = messageSnapshot.val() as MessageRecord;

    // 3. Validar se o remetente da mensagem gravada corresponde ao usuário autenticado
    if (messageData.senderId !== authenticatedUserId) {
      res.status(403).json({
        error: 'Ação não permitida',
        message: 'O remetente registrado na mensagem não corresponde ao usuário autenticado pelo token.',
      });
      return;
    }

    // 4. Calcular os destinatários autorizados no servidor
    const resolved = await resolveRecipients(messageData);

    // 5. Se não houver destinatários (ex: política disabled ou remetente é o único no grupo)
    if (resolved.recipientUids.length === 0) {
      await idempotencyRef.set({
        messageId,
        conversationId,
        senderId: authenticatedUserId,
        processedAt: Date.now(),
        sentCount: 0,
        policyUsed: resolved.policyUsed,
      });

      res.status(200).json({
        success: true,
        message: 'Nenhum destinatário elegível para receber notificação conforme a política.',
        policyUsed: resolved.policyUsed,
        sentCount: 0,
      });
      return;
    }

    // 6. Preparar texto e payload seguro da notificação
    // Truncar mensagens muito longas para exibição no push
    const notificationBody =
      messageData.text.length > 120
        ? `${messageData.text.substring(0, 117)}...`
        : messageData.text;

    // 7. Enviar notificações push
    const result = await sendPushNotifications({
      recipientUids: resolved.recipientUids,
      title: resolved.conversationTitle,
      body: notificationBody,
      payload: {
        conversationId,
        conversationType: messageData.conversationType,
        messageId,
        senderId: messageData.senderId,
      },
    });

    // 8. Registrar conclusão para idempotência
    await idempotencyRef.set({
      messageId,
      conversationId,
      senderId: authenticatedUserId,
      processedAt: Date.now(),
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      recipients: resolved.recipientUids,
      policyUsed: resolved.policyUsed,
    });

    res.status(200).json({
      success: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      recipientCount: resolved.recipientUids.length,
      policyUsed: resolved.policyUsed,
      conversationTitle: resolved.conversationTitle,
    });
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error('[NotificationRoute] Erro interno ao processar notificação:', errorDetails);
    res.status(500).json({
      error: 'Erro interno no servidor',
      message: 'Falha ao processar o envio de notificações.',
      details: errorDetails,
    });
  }
});

export default router;
