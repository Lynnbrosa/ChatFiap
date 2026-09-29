import React, { useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  isGroup?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name = '',
  size = 48,
  isGroup = false,
}) => {
  const [hasError, setHasError] = useState<boolean>(false);

  const getInitials = (n: string): string => {
    if (!n) return isGroup ? 'G' : 'U';
    const parts = n.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const showImage = uri && uri.trim().length > 0 && !hasError;

  return (
    <View style={[styles.container, containerStyle]}>
      {showImage ? (
        <Image
          source={{ uri: uri }}
          style={[styles.image, containerStyle]}
          onError={() => setHasError(true)}
        />
      ) : (
        <View style={[styles.placeholder, containerStyle]}>
          {isGroup ? (
            <Ionicons name="people" size={size * 0.45} color={colors.primaryLight} />
          ) : name ? (
            <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
              {getInitials(name)}
            </Text>
          ) : (
            <Ionicons name="person" size={size * 0.45} color={colors.textSecondary} />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceBorder,
  },
  initials: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
});
