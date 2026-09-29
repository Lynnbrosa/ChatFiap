import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { getGroup } from '../services/groupService';
import { NotificationPolicy } from '../types/group';
import { colors } from '../theme/colors';
import { ErrorMessage } from '../components/ErrorMessage';
import { validateGroupCapacity } from '../utils/groupValidation';

type GroupFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupForm'>;
type GroupFormScreenRouteProp = RouteProp<RootStackParamList, 'GroupForm'>;

export const GroupFormScreen: React.FC = () => {
  const navigation = useNavigation<GroupFormScreenNavigationProp>();
  const route = useRoute<GroupFormScreenRouteProp>();
  const { user } = useAuth();
  const { createNewGroup, modifyGroup } = useGroups();

  const groupId = route.params?.groupId;
  const isEditing = Boolean(groupId);

  const [name, setName] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string>('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberLimit, setMemberLimit] = useState<number>(5);
  const [policy, setPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(isEditing);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Carregar dados caso seja modo de edição
  useEffect(() => {
    async function loadGroupData() {
      if (!groupId) return;
      try {
        setInitialLoading(true);
        const group = await getGroup(groupId);
        if (group) {
          setName(group.name);
          setExistingPhotoUrl(group.photoUrl);
          setMemberIds(group.memberIds);
          setMemberLimit(group.memberLimit);
          setPolicy(group.notificationPolicy);
        }
      } catch (err) {
        console.error('[GroupFormScreen] Falha ao carregar dados do grupo:', err);
        setErrorMessage('Erro ao carregar os dados do grupo.');
      } finally {
        setInitialLoading(false);
      }
    }

    loadGroupData();
  }, [groupId]);

  // Total de integrantes incluindo o criador
  const totalMemberCount = useMemo(() => {
    if (!user) return memberIds.length;
    const set = new Set([...memberIds, user.uid]);
    return set.size;
  }, [memberIds, user]);

  const capacityValidation = useMemo(() => {
    return validateGroupCapacity(totalMemberCount, memberLimit);
  }, [totalMemberCount, memberLimit]);

  const handlePickPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setErrorMessage('Permissão para acessar a galeria de fotos foi negada.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[GroupFormScreen] Erro ao selecionar imagem:', err);
    }
  };

  const handleOpenMemberSelection = () => {
    navigation.navigate('Users', {
      mode: 'group_select',
      selectedIds: memberIds,
      onSelectMembers: (uids) => {
        // Validação imediata de limite ao selecionar
        if (uids.length + 1 > memberLimit) {
          setMemberLimit(uids.length + 1);
        }
        setMemberIds(uids);
      },
    });
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Por favor, informe o nome do grupo.');
      return;
    }

    if (!isEditing && memberIds.length < 1) {
      setErrorMessage('Selecione pelo menos mais um integrante para formar o grupo.');
      return;
    }

    if (!capacityValidation.valid) {
      setErrorMessage(capacityValidation.error || 'Capacidade do grupo inválida.');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && groupId) {
        await modifyGroup(groupId, {
          name: name.trim(),
          memberLimit,
          notificationPolicy: policy,
          ...(photoUri ? { photoUrl: photoUri } : {}),
        });
        Alert.alert('Sucesso', 'Configurações do grupo atualizadas!');
        navigation.goBack();
      } else {
        const newGroup = await createNewGroup({
          name: name.trim(),
          photoUri,
          initialMemberIds: memberIds,
          memberLimit,
          notificationPolicy: policy,
        });

        navigation.replace('Chat', {
          conversationId: newGroup.id,
          conversationType: 'group',
          title: newGroup.name,
          photoUrl: newGroup.photoUrl,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar grupo.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
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
        {isEditing ? 'Configurações do Grupo' : 'Criar Novo Grupo'}
      </Text>

      <ErrorMessage message={errorMessage || ''} onDismiss={() => setErrorMessage(null)} />

      {/* Foto do Grupo */}
      <View style={styles.photoSection}>
        <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
          {photoUri || existingPhotoUrl ? (
            <Image
              source={{ uri: photoUri || existingPhotoUrl }}
              style={styles.photoPreview}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={32} color={colors.primaryLight} />
              <Text style={styles.photoPlaceholderText}>Foto do Grupo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Nome do Grupo */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome do Grupo</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: FIAP - Trabalho Final"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />
      </View>

      {/* Limite de Integrantes com Indicador de Vagas */}
      <View style={styles.cardSection}>
        <View style={styles.cardHeader}>
          <Text style={styles.label}>Limite Máximo de Integrantes</Text>
          <View style={styles.vacanciesBadge}>
            <Text style={styles.vacanciesText}>
              {capacityValidation.availableVacancies} vaga(s) restante(s)
            </Text>
          </View>
        </View>

        <Text style={styles.helperText}>
          Total atual: {totalMemberCount} integrante(s) (incluindo você). O limite não pode ser menor que a contagem atual.
        </Text>

        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepperButton, memberLimit <= totalMemberCount && styles.stepperButtonDisabled]}
            onPress={() => {
              if (memberLimit > totalMemberCount && memberLimit > 2) {
                setMemberLimit((prev) => prev - 1);
              }
            }}
            disabled={memberLimit <= totalMemberCount}
          >
            <Ionicons name="remove" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.limitValue}>{memberLimit}</Text>

          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setMemberLimit((prev) => prev + 1)}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Seleção de Integrantes (apenas na criação) */}
      {!isEditing && (
        <View style={styles.cardSection}>
          <View style={styles.cardHeader}>
            <Text style={styles.label}>Integrantes Selecionados</Text>
            <Text style={styles.memberCountText}>
              {memberIds.length} selecionado(s)
            </Text>
          </View>

          <TouchableOpacity
            style={styles.selectMembersButton}
            onPress={handleOpenMemberSelection}
          >
            <Ionicons name="person-add-outline" size={20} color={colors.primaryLight} />
            <Text style={styles.selectMembersText}>
              {memberIds.length === 0 ? 'Selecionar Integrantes' : 'Alterar Integrantes'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Política de Notificações */}
      <View style={styles.cardSection}>
        <Text style={styles.label}>Política de Push Notifications</Text>
        <Text style={styles.helperText}>
          Define quem receberá notificações push quando mensagens forem enviadas neste grupo.
        </Text>

        <View style={styles.policyOptions}>
          <TouchableOpacity
            style={[styles.policyCard, policy === 'all_group_messages' && styles.policyCardActive]}
            onPress={() => setPolicy('all_group_messages')}
          >
            <Ionicons
              name={policy === 'all_group_messages' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={policy === 'all_group_messages' ? colors.primaryLight : colors.textMuted}
            />
            <View style={styles.policyInfo}>
              <Text style={styles.policyTitle}>Todas as mensagens (Padrão)</Text>
              <Text style={styles.policyDesc}>Notifica todos os integrantes do grupo, exceto o remetente.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.policyCard, policy === 'mentioned_members' && styles.policyCardActive]}
            onPress={() => setPolicy('mentioned_members')}
          >
            <Ionicons
              name={policy === 'mentioned_members' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={policy === 'mentioned_members' ? colors.primaryLight : colors.textMuted}
            />
            <View style={styles.policyInfo}>
              <Text style={styles.policyTitle}>Apenas menções (@)</Text>
              <Text style={styles.policyDesc}>Notifica somente os integrantes explicitamente mencionados ou direcionados.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.policyCard, policy === 'direct_messages_only' && styles.policyCardActive]}
            onPress={() => setPolicy('direct_messages_only')}
          >
            <Ionicons
              name={policy === 'direct_messages_only' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={policy === 'direct_messages_only' ? colors.primaryLight : colors.textMuted}
            />
            <View style={styles.policyInfo}>
              <Text style={styles.policyTitle}>Apenas conversas individuais</Text>
              <Text style={styles.policyDesc}>Nenhuma mensagem deste grupo gera notificação push.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.policyCard, policy === 'disabled' && styles.policyCardActive]}
            onPress={() => setPolicy('disabled')}
          >
            <Ionicons
              name={policy === 'disabled' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={policy === 'disabled' ? colors.primaryLight : colors.textMuted}
            />
            <View style={styles.policyInfo}>
              <Text style={styles.policyTitle}>Desativadas</Text>
              <Text style={styles.policyDesc}>Desliga completamente o envio de notificações push para esta conversa.</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Botão de Envio */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>
            {isEditing ? 'Salvar Alterações' : 'Criar Grupo'}
          </Text>
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
  photoButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.badgeGroup,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: colors.primaryLight,
    fontWeight: '600',
    marginTop: 4,
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
  vacanciesText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
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
