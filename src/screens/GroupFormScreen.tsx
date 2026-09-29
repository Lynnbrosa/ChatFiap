import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import {
  MAX_GROUP_LIMIT,
  MAX_GROUP_NAME_LENGTH,
  MIN_GROUP_LIMIT,
  NotificationPolicy,
} from '../types/group';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { getGroup } from '../services/groupService';
import { colors } from '../theme/colors';
import { ErrorMessage } from '../components/ErrorMessage';
import { PhotoPicker } from '../components/PhotoPicker';
import { PickedImage } from '../types/image';
import { validateGroupCapacity } from '../utils/groupValidation';
import { getFriendlyErrorMessage } from '../utils/errors';

type GroupFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupForm'>;
type GroupFormScreenRouteProp = RouteProp<RootStackParamList, 'GroupForm'>;

const POLICY_OPTIONS: { value: NotificationPolicy; title: string; description: string }[] = [
  {
    value: 'all_group_messages',
    title: 'Todas as mensagens (padrão)',
    description: 'Notifica todos os integrantes, exceto quem enviou.',
  },
  {
    value: 'mentioned_members',
    title: 'Apenas mencionados (@)',
    description: 'Notifica somente quem foi mencionado ou escolhido como destinatário.',
  },
  {
    value: 'direct_messages_only',
    title: 'Apenas conversas individuais',
    description: 'Mensagens deste grupo não geram push; só as conversas individuais notificam.',
  },
  {
    value: 'disabled',
    title: 'Desativadas',
    description: 'Nenhuma mensagem deste grupo gera notificação push.',
  },
];

function showSuccess(message: string) {
  if (Platform.OS !== 'web') Alert.alert('Grupo', message);
}

export const GroupFormScreen: React.FC = () => {
  const navigation = useNavigation<GroupFormScreenNavigationProp>();
  const route = useRoute<GroupFormScreenRouteProp>();
  const { user } = useAuth();
  const { createNewGroup, updateGroup } = useGroups();

  const groupId = route.params?.groupId;
  const selectedFromParams = route.params?.selectedMemberIds;
  const isEditing = Boolean(groupId);

  const [name, setName] = useState<string>('');
  const [newPhoto, setNewPhoto] = useState<PickedImage | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string>('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [memberLimit, setMemberLimit] = useState<number>(5);
  const [policy, setPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [saving, setSaving] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(isEditing);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modo edição: carrega os dados atuais do grupo
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;

    (async () => {
      try {
        setInitialLoading(true);
        const group = await getGroup(groupId);
        if (cancelled) return;
        if (!group) {
          setErrorMessage('Grupo não encontrado.');
          return;
        }
        setName(group.name);
        setExistingPhotoUrl(group.photoUrl);
        setMemberIds(group.memberIds);
        setOwnerId(group.ownerId);
        setMemberLimit(group.memberLimit);
        setPolicy(group.notificationPolicy);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(getFriendlyErrorMessage(err, 'Erro ao carregar os dados do grupo.'));
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Retorno da tela de seleção de integrantes (modo criação)
  useEffect(() => {
    if (!selectedFromParams) return;
    setMemberIds(selectedFromParams);
    // Se a seleção passar do limite atual, o limite sobe junto (o usuário pode ajustar depois)
    setMemberLimit((prev) => Math.max(prev, selectedFromParams.length + 1));
  }, [selectedFromParams]);

  const isOwner = !isEditing || (user !== null && ownerId === user.uid);

  // Total de integrantes, incluindo o proprietário
  const totalMemberCount = useMemo(() => {
    if (!user) return memberIds.length;
    return new Set([...memberIds, user.uid]).size;
  }, [memberIds, user]);

  const capacityValidation = useMemo(
    () => validateGroupCapacity(totalMemberCount, memberLimit),
    [totalMemberCount, memberLimit]
  );

  const canDecreaseLimit = memberLimit > Math.max(totalMemberCount, MIN_GROUP_LIMIT);
  const canIncreaseLimit = memberLimit < MAX_GROUP_LIMIT;

  const handleOpenMemberSelection = () => {
    navigation.navigate('Users', {
      mode: 'group_select',
      target: { screen: 'GroupForm' },
      selectedIds: memberIds.filter((id) => id !== user?.uid),
    });
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Informe o nome do grupo.');
      return;
    }
    if (!isEditing && totalMemberCount < 2) {
      setErrorMessage('Selecione pelo menos mais um integrante para formar o grupo.');
      return;
    }
    if (!capacityValidation.valid) {
      setErrorMessage(capacityValidation.error ?? 'Capacidade do grupo inválida.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && groupId) {
        await updateGroup(groupId, {
          name,
          memberLimit,
          notificationPolicy: policy,
          photo: newPhoto,
        });
        showSuccess('Configurações do grupo atualizadas!');
        navigation.goBack();
      } else {
        const result = await createNewGroup({
          name,
          photo: newPhoto,
          initialMemberIds: memberIds,
          memberLimit,
          notificationPolicy: policy,
        });

        if (result.photoUploadFailed) {
          showSuccess('Grupo criado, mas a foto não pôde ser enviada. Você pode trocá-la nas configurações.');
        }

        navigation.replace('Chat', {
          conversationId: result.group.id,
          conversationType: 'group',
          title: result.group.name,
          photoUrl: result.group.photoUrl,
        });
      }
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err, 'Não foi possível salvar o grupo.'));
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>
        {isEditing ? 'Configurações do grupo' : 'Criar novo grupo'}
      </Text>

      <ErrorMessage message={errorMessage || ''} onDismiss={() => setErrorMessage(null)} />

      {!isOwner && (
        <ErrorMessage message="Apenas o proprietário pode alterar as configurações deste grupo." />
      )}

      <View style={styles.photoSection}>
        <PhotoPicker
          image={newPhoto}
          existingUrl={existingPhotoUrl}
          label={isEditing ? 'Trocar foto' : 'Foto do grupo'}
          accentColor={colors.badgeGroup}
          onChange={setNewPhoto}
          onError={setErrorMessage}
          disabled={!isOwner || saving}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome do grupo</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: FIAP - Trabalho final"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={MAX_GROUP_NAME_LENGTH}
          editable={isOwner && !saving}
        />
      </View>

      <View style={styles.cardSection}>
        <View style={styles.cardHeader}>
          <Text style={styles.label}>Limite máximo de integrantes</Text>
          <View
            style={[
              styles.vacanciesBadge,
              capacityValidation.availableVacancies === 0 && styles.vacanciesBadgeFull,
            ]}
          >
            <Text
              style={[
                styles.vacanciesText,
                capacityValidation.availableVacancies === 0 && styles.vacanciesTextFull,
              ]}
            >
              {capacityValidation.availableVacancies === 0
                ? 'Sem vagas'
                : `${capacityValidation.availableVacancies} vaga(s) disponível(is)`}
            </Text>
          </View>
        </View>

        <Text style={styles.helperText}>
          Atual: {totalMemberCount} integrante(s), incluindo o proprietário. O limite não pode ser
          menor que isso (máximo {MAX_GROUP_LIMIT}).
        </Text>

        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepperButton, (!canDecreaseLimit || !isOwner) && styles.stepperButtonDisabled]}
            onPress={() => setMemberLimit((prev) => prev - 1)}
            disabled={!canDecreaseLimit || !isOwner}
            accessibilityLabel="Diminuir limite"
          >
            <Ionicons name="remove" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.limitValue}>{memberLimit}</Text>

          <TouchableOpacity
            style={[styles.stepperButton, (!canIncreaseLimit || !isOwner) && styles.stepperButtonDisabled]}
            onPress={() => setMemberLimit((prev) => prev + 1)}
            disabled={!canIncreaseLimit || !isOwner}
            accessibilityLabel="Aumentar limite"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardSection}>
        <View style={styles.cardHeader}>
          <Text style={styles.label}>Integrantes</Text>
          <Text style={styles.memberCountText}>{totalMemberCount} no grupo</Text>
        </View>

        {isEditing ? (
          <TouchableOpacity
            style={styles.selectMembersButton}
            onPress={() => groupId && navigation.navigate('GroupMembers', { groupId })}
          >
            <Ionicons name="people-outline" size={20} color={colors.primaryLight} />
            <Text style={styles.selectMembersText}>Gerenciar integrantes</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.selectMembersButton} onPress={handleOpenMemberSelection}>
            <Ionicons name="person-add-outline" size={20} color={colors.primaryLight} />
            <Text style={styles.selectMembersText}>
              {memberIds.length === 0 ? 'Selecionar integrantes' : 'Alterar integrantes'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardSection}>
        <Text style={styles.label}>Política de notificações push</Text>
        <Text style={styles.helperText}>
          Define quem recebe push quando alguém envia mensagem neste grupo.
        </Text>

        <View style={styles.policyOptions}>
          {POLICY_OPTIONS.map((option) => {
            const selected = policy === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.policyCard, selected && styles.policyCardActive]}
                onPress={() => setPolicy(option.value)}
                disabled={!isOwner}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.primaryLight : colors.textMuted}
                />
                <View style={styles.policyInfo}>
                  <Text style={styles.policyTitle}>{option.title}</Text>
                  <Text style={styles.policyDesc}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, (saving || !isOwner) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={saving || !isOwner}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>{isEditing ? 'Salvar alterações' : 'Criar grupo'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
  },
  cardSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vacanciesBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  vacanciesBadgeFull: {
    backgroundColor: colors.dangerMuted,
  },
  vacanciesText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  vacanciesTextFull: {
    color: colors.danger,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.surfaceBorder,
    opacity: 0.5,
  },
  limitValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  memberCountText: {
    fontSize: 13,
    color: colors.primaryLight,
    fontWeight: '600',
  },
  selectMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginTop: 10,
  },
  selectMembersText: {
    color: colors.primaryLight,
    fontWeight: '600',
    fontSize: 14,
  },
  policyOptions: {
    gap: 10,
    marginTop: 6,
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 12,
  },
  policyCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  policyInfo: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  policyDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
