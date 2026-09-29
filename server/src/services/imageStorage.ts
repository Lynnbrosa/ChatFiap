import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

/** true quando as credenciais do Cloudinary foram configuradas nos segredos da hospedagem. */
export const imageStorageConfigured = Boolean(cloudName && apiKey && apiSecret);

if (imageStorageConfigured) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Envia a imagem ao Cloudinary (upload assinado, feito só pelo servidor) e devolve a URL HTTPS final.
 * A imagem é recortada/reduzida para 512x512 no próprio Cloudinary.
 */
export async function uploadImage(options: {
  base64: string;
  mimeType: string;
  folder: string;
  publicId: string;
}): Promise<string> {
  const result = await cloudinary.uploader.upload(`data:${options.mimeType};base64,${options.base64}`, {
    folder: options.folder,
    public_id: options.publicId,
    overwrite: true,
    invalidate: true,
    resource_type: 'image',
    transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto', quality: 'auto' }],
  });
  return result.secure_url;
}
