import { apiRequest } from './apiClient';
import { PickedImage } from '../types/image';

type UploadResponse = { url: string };

/**
 * As fotos são enviadas à API própria, que confere a permissão e faz o upload assinado no
 * Cloudinary (a chave secreta fica só no servidor). A API devolve a URL HTTPS final — é só
 * ela que o app grava no Firestore, nunca o Base64.
 */
async function upload(body: Record<string, unknown>, image: PickedImage): Promise<string> {
  const response = await apiRequest<UploadResponse>('/uploads/image', {
    method: 'POST',
    body: { ...body, mimeType: image.mimeType, imageBase64: image.base64 },
    timeoutMs: 90000,
  });
  return response.url;
}

export function uploadProfilePhoto(image: PickedImage): Promise<string> {
  return upload({ target: 'profile' }, image);
}

export function uploadGroupPhoto(groupId: string, image: PickedImage): Promise<string> {
  return upload({ target: 'group', groupId }, image);
}
