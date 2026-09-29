import * as ImagePicker from 'expo-image-picker';
import { AppError } from '../utils/errors';
import { PickedImage } from '../types/image';

export type ImageSource = 'camera' | 'library';

/**
 * Solicita a permissão adequada e abre a câmera ou a galeria.
 * Retorna a imagem escolhida, ou null se o usuário cancelar.
 */
export async function pickImage(source: ImageSource): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new AppError(
      source === 'camera'
        ? 'Permissão da câmera negada. Ative nas configurações do aparelho.'
        : 'Permissão da galeria negada. Ative nas configurações do aparelho.'
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
    base64: true,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (!asset.base64) {
    throw new AppError('Não foi possível ler a imagem escolhida. Tente outra foto.');
  }

  return {
    uri: asset.uri,
    base64: asset.base64,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}
