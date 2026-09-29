import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { PublicUserProfile } from '../types/user';
import { useAuth } from '../hooks/useAuth';
import { useGroups, useGroupDetails } from '../hooks/useGroups';
import { getFriendlyErrorMessage } from '../utils/errors';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';

type GroupMembersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupMembers'>;
type GroupMembersScreenRouteProp = RouteProp<RootStackParamList, 'GroupMembers'>;

function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export const GroupMembersScreen: React.FC = () => {
  const navigation = useNavigation<GroupMembersScreenNavigationProp>();
  const route = useRoute<GroupMembersScreenRouteProp>();
  const { user: currentUser } = useAuth();
  const { addMembers, removeMember, leaveGroup } = useGroups();
  const { groupId, selectedMemberIds } = route.params;

  // Grupo em tempo real: alterações feitas por outro aparelho aparecem na hora
  const { group, members, loading, error, isOwner, isMember, vacancies } = useGroupDetails(groupId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  // Retorno da seleção de novos integrantes
  useEffect(() => {
    if (!selectedMemberIds || selectedMemberIds.length === 0) return;
    navigation.setParams({ selectedMemberIds: undefined });

    setBusy(true);
    setActionError(null);
    addMembers(groupId, selectedMemberIds)
      .catch((err: unknown) =>
        setActionError(getFriendlyErrorMessage(err, 'Não foi possível adicionar os integrantes.'))
      )
      .finally(() => setBusy(false));
  }, [selectedMemberIds, groupId, addMembers, navigation]);

  const handleRemoveMember = (member: PublicUserProfile) => {
    confirmAction('Remover integrante', `Remover ${member.name} do grupo?`, 'Remover', async () => {
      setBusy(true);
      setActionError(null);
      try {
        await removeMember(groupId, member.uid);
      } catch (err) {
        setActionError(getFriendlyErrorMessage(err, 'Não foi possível remover o integrante.'));
      } finally {
        setBusy(false);
      }
    });
  };

  const handleLeaveGroup = () => {
    confirmAction('Sair do grupo', 'Você deixará de receber as mensagens deste grupo.', 'Sair', async () => {
      setBusy(true);
      try {
        await leaveGroup(groupId);
        navigation.popTo('Conversations');
      } catch (err) {
        setActionError(getFriendlyErrorMessage(err, 'Não foi possível sair do grupo.'));
        setBusy(false);
      }
    });
  };

  const handleAddMembers = () => {
    if (!group) return;
    if (vacancies <= 0) {
      setActionError('O grupo atingiu o limite de integrantes. Aumente o limite nas configurações.');
      return;
    }
    navigation.navigate('Users', {
      mode: 'group_select',
      target: { screen: 'GroupMembers', groupId },
      excludeIds: group.memberIds,
      maxSelectable: vacancies,
    });
  };

  const renderHeader = () => (
    <View style={styles.groupOverview}>
      <Avatar uri={group?.photoUrl} name={group?.name} size={72} isGroup />
      <Text style={styles.groupName}>{group?.name}</Text>

      <View style={styles.capacityCard}>
        <View style={styles.capacityRow}>
          <Text style={styles.capacityLabel}>Integrantes</Text>
          <Text style={styles.capacityValue}>
            {group?.memberIds.length} / {group?.memberLimit}
          </Text>
        </View>
        <View style={styles.capacityRow}>
          <Text style={styles.capacityLabel}>Vagas disponíveis</Text>
          <Text style={[styles.capacityValue, vacancies > 0 ? styles.vacanciesPositive : styles.vacanciesZero]}>
            {vacancies === 0 ? 'Grupo cheio' : `${vacancies} ${vacancies === 1 ? 'vaga' : 'vagas'}`}
          </Text>
        </View>
      </View>

      {isOwner && (
        <TouchableOpacity
          style={[styles.addMemberButton, (vacancies <= 0 || busy) && styles.buttonDisabled]}
          onPress={handleAddMembers}
          disabled={busy}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.addMemberButtonText}>
            {vacancies > 0 ? 'Adicionar integrantes' : 'Sem vagas disponíveis'}
          </Text>
        </TouchableOpacity>
      )}

      {isMember && !isOwner && (
        <TouchableOpacity
          style={[styles.leaveButton, busy && styles.buttonDisabled]}
          onPress={handleLeaveGroup}
          disabled={busy}
        >
          <Ionicons name="exit-outline" size={18} color={colors.danger} />
          <Text style={styles.leaveButtonText}>Sair do grupo</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Integrantes do grupo</Text>
        {isOwner ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('GroupForm', { groupId })}
            accessibilityLabel="Configurações do grupo"
          >
            <Ionicons name="settings-outline" size={22} color={colors.primaryLight} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ErrorMessage message={actionError || ''} onDismiss={() => setActionError(null)} />

      {loading ? (
        <Loading message="Carregando integrantes..." fullscreen />
      ) : !group || !isMember ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Grupo indisponível"
          description={error ?? 'Você não faz mais parte deste grupo.'}
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.uid}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <GroupMemberItem
              member={item}
              isOwner={item.uid === group.ownerId}
              isCurrentUser={item.uid === currentUser?.uid}
              canRemove={isOwner && item.uid !== group.ownerId && !busy}
              onPressProfile={() => navigation.navigate('Profile', { userUid: item.uid })}
              onRemove={() => handleRemoveMember(item)}
            />
          )}
        />
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
  editButton: {
    padding: 6,
  },
  groupOverview: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    marginBottom: 8,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 12,
  },
  capacityCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  capacityLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  capacityValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  vacanciesPositive: {
    color: colors.accent,
  },
  vacanciesZero: {
    color: colors.danger,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 14,
    width: '100%',
    gap: 8,
  },
  addMemberButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerMuted,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
    width: '100%',
    gap: 8,
  },
  leaveButtonText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
