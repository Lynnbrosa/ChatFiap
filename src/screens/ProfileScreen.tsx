import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { ChatUser } from '../types/user';
import { useAuth } from '../hooks/useAuth';
import { getSharedUserProfile } from '../services/userService';
import { ApiError, getFriendlyErrorMessage } from '../utils/errors';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'Profile'>;

type InfoRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | undefined;
  fallback: string;
};

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, fallback }) => (
  <View style={styles.infoRow}>
    <View style={styles.iconCircle}>
      <Ionicons name={icon} size={18} color={colors.primaryLight} />
    </View>
    <View style={styles.infoTexts}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, !value && styles.infoValueMissing]}>{value || fallback}</Text>
    </View>
  </View>
);

function formatMemberSince(timestamp: number | undefined): string | undefined {
  if (!timestamp) return undefined;
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const route = useRoute<ProfileScreenRouteProp>();
  const { user: currentUser } = useAuth();
  const targetUid = route.params.userUid;
  const isSelf = currentUser?.uid === targetUid;

  const [targetUser, setTargetUser] = useState<ChatUser | null>(isSelf ? currentUser : null);
  const [loading, setLoading] = useState<boolean>(!isSelf);
  const [error, setError] = useState<string | null>(null);

  // Dados cadastrais de outra pessoa vêm da API, que exige conversa ou grupo em comum
  const fetchProfile = useCallback(async () => {
    if (isSelf) return;
    setLoading(true);
    setError(null);
    try {
      setTargetUser(await getSharedUserProfile(targetUid));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'forbidden') {
        setError('Você só pode ver o perfil de quem participa de uma conversa ou grupo com você.');
      } else if (err instanceof ApiError && err.code === 'not_found') {
        setError('Perfil de usuário não encontrado.');
      } else {
        setError(getFriendlyErrorMessage(err, 'Não foi possível carregar este perfil.'));
      }
    } finally {
      setLoading(false);
    }
  }, [isSelf, targetUid]);

  useEffect(() => {
    if (isSelf) {
      setTargetUser(currentUser);
      return;
    }
    fetchProfile();
  }, [isSelf, currentUser, fetchProfile]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isSelf ? 'Meu perfil' : 'Perfil do usuário'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      ) : error || !targetUser ? (
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error ?? 'Perfil indisponível.'}</Text>
          <View style={styles.errorActions}>
            {!isSelf && (
              <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.retryButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.profileHeader}>
            <Avatar uri={targetUser.photoUrl} name={targetUser.name} size={96} />
            <Text style={styles.userName}>{targetUser.name || 'Nome não informado'}</Text>
            {isSelf && (
              <View style={styles.selfBadge}>
                <Text style={styles.selfBadgeText}>Sua conta</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Dados cadastrais</Text>
            <InfoRow icon="mail-outline" label="E-mail" value={targetUser.email} fallback="Não informado" />
            <InfoRow
              icon="call-outline"
              label="Número de celular"
              value={targetUser.phoneNumber}
              fallback="Não informado"
            />
            <InfoRow
              icon="calendar-outline"
              label="Data de nascimento"
              value={targetUser.birthDate}
              fallback="Não informada"
            />
            <InfoRow
              icon="time-outline"
              label="Membro desde"
              value={formatMemberSince(targetUser.createdAt)}
              fallback="Indisponível"
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 34,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  retryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 14,
  },
  selfBadge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  selfBadgeText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  infoTexts: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 1,
  },
  infoValueMissing: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
