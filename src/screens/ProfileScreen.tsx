import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../hooks/useAuth';
import { getUserProfile } from '../services/userService';
import { ChatUser } from '../types/user';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { formatTimeOrDate } from '../utils/formatters';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'Profile'>;

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const route = useRoute<ProfileScreenRouteProp>();
  const { user: currentUser } = useAuth();
  const targetUid = route.params.userUid;

  const [targetUser, setTargetUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);

        const profile = await getUserProfile(targetUid);
        if (!profile) {
          setError('Perfil de usuário não encontrado.');
        } else {
          setTargetUser(profile);
        }
      } catch (err) {
        console.error('[ProfileScreen] Erro ao carregar perfil:', err);
        setError('Não foi possível carregar os dados deste perfil.');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [targetUid]);

  const isSelf = currentUser?.uid === targetUid;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isSelf ? 'Meu Perfil' : 'Perfil do Usuário'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      ) : error || !targetUser ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error || 'Perfil indisponível.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Avatar e Nome Principal */}
          <View style={styles.profileHeader}>
            <Avatar uri={targetUser.photoUrl} name={targetUser.name} size={96} />
            <Text style={styles.userName}>{targetUser.name}</Text>
            <Text style={styles.userEmail}>{targetUser.email}</Text>
            {isSelf && (
              <View style={styles.selfBadge}>
                <Text style={styles.selfBadgeText}>Sua conta</Text>
              </View>
            )}
          </View>

          {/* Dados Cadastrais Detalhados */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Informações de Contato</Text>

            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="call-outline" size={18} color={colors.primaryLight} />
              </View>
              <View style={styles.infoTexts}>
                <Text style={styles.infoLabel}>Telefone Celular</Text>
                <Text style={styles.infoValue}>
                  {targetUser.phoneNumber || 'Não informado'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-outline" size={18} color={colors.primaryLight} />
              </View>
              <View style={styles.infoTexts}>
                <Text style={styles.infoLabel}>E-mail</Text>
                <Text style={styles.infoValue}>{targetUser.email}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={18} color={colors.primaryLight} />
              </View>
              <View style={styles.infoTexts}>
                <Text style={styles.infoLabel}>Data de Nascimento</Text>
                <Text style={styles.infoValue}>
                  {targetUser.birthDate || 'Não informada'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="time-outline" size={18} color={colors.primaryLight} />
              </View>
              <View style={styles.infoTexts}>
                <Text style={styles.infoLabel}>Membro desde</Text>
                <Text style={styles.infoValue}>
                  {targetUser.createdAt
                    ? formatTimeOrDate(targetUser.createdAt)
                    : 'Recente'}
                </Text>
              </View>
            </View>
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
    color: colors.danger,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 12,
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
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
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
});
