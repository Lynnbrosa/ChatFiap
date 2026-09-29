import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { ImageSource, pickImage } from '../services/imagePickerService';
import { getFriendlyErrorMessage } from '../utils/errors';
import { PickedImage } from '../types/image';

interface PhotoPickerProps {
  /** Imagem recém-escolhida (tem prioridade na pré-visualização). */
  image: PickedImage | null;
  /** URL já salva no Firestore (modo edição). */
  existingUrl?: string | null;
  label: string;
  onChange: (image: PickedImage) => void;
  onError: (message: string) => void;
  size?: number;
  accentColor?: string;
  disabled?: boolean;
}

export const PhotoPicker: React.FC<PhotoPickerProps> = ({
  image,
  existingUrl,
  label,
  onChange,
  onError,
  size = 96,
  accentColor = colors.primary,
  disabled = false,
}) => {
  const [hasError, setHasError] = useState<boolean>(false);

  const handlePick = async (source: ImageSource) => {
    try {
      const picked = await pickImage(source);
      if (picked) {
        setHasError(false);
        onChange(picked);
      }
    } catch (err) {
      onError(getFriendlyErrorMessage(err, 'Não foi possível abrir as imagens do aparelho.'));
    }
  };

  const handlePress = () => {
    if (Platform.OS === 'web') {
      handlePick('library');
      return;
    }
    Alert.alert(label, 'Escolha de onde vem a foto', [
      { text: 'Câmera', onPress: () => handlePick('camera') },
      { text: 'Galeria', onPress: () => handlePick('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const dimension = { width: size, height: size, borderRadius: size / 2 };
  const uri = image?.uri || existingUrl || null;
  const showImage = Boolean(uri) && !hasError;

  return (
    <TouchableOpacity
      style={[styles.button, dimension, { borderColor: accentColor }]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={label}
    >
      {showImage && uri ? (
        <Image source={{ uri }} style={dimension} onError={() => setHasError(true)} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="camera-outline" size={size * 0.33} color={colors.primaryLight} />
          <Text style={styles.placeholderText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 11,
    color: colors.primaryLight,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});
