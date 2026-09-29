import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { getGroup, addMembersToGroup } from '../services/groupService';
import { getUserProfile } from '../services/userService';
import { ChatGroup } from '../types/group';
import { ChatUser } from '../types/user';
import { colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { ErrorMessage } from '../components/ErrorMessage';

type GroupMembersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupMembers'>;
type GroupMembersScreenRouteProp = RouteProp<RootStackParamList, 'GroupMembers'>;

export const GroupMembersScreen: React.FC = () => {
  const navigation = useNavigation<GroupMembersScreenNavigationProp>();
  const route = useRoute<GroupMembersScreenRouteProp>();
  const { user: currentUser } = useAuth();
  const { removeMember } = useGroups();
  const groupId = route.params.groupId;

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [members, setMembers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadGroupAndMembers = useCallback(async () => {
    try {
      setLoading(true);
      setActionError(null);
      const groupData = await getGroup(groupId);

      if (!groupData) {
        setActionError('Grupo não encontrado.');
        setLoading(false);
        return;
      }

      setGroup(groupData);

      const membersData = await Promise.all(
        groupData.memberIds.map((uid) => getUserProfile(uid))
      );

      setMembers(membersData.filter((m): m is ChatUser => m !== null));
    } catch (err) {
      console.error('[GroupMembersScreen] Erro ao carregar integrantes:', err);
      setActionError('Falha ao carregar lista de integrantes.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroupAndMembers();
  }, [loadGroupAndMembers]);

  const isOwner = currentUser?.uid === group?.ownerId;
  const vacancies = group ? Math.max(0, group.memberLimit - group.memberIds.length) : 0;

  const handleRemoveMember = (member: ChatUser) => {
    Alert.alert(
      'Remover integrante',
      `Deseja realmente remover ${member.name} deste grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(groupId, member.uid);
              await loadGroupAndMembers();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Falha ao remover integrante.';
              setActionError(msg);
            }
          },
        },
      ]
    );
  };

  const handleAddMoreMembers = () => {
    if (vacancies <= 0) {
      Alert.alert('Limite atingido', 'O grupo não possui mais vagas disponíveis.');
      return;
    }

    navigation.navigate('Users', {
      mode: 'group_select',
      onSelectMembers: async (selectedUids) => {
        if (!currentUser) return;
        try {
          await addMembersToGroup(groupId, selectedUids, currentUser.uid);
          await loadGroupAndMembers();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao adicionar integrantes.';
          setActionError(msg);
        }
      },
    });
  };

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
        <Text style={styles.headerTitle}>Integrantes do Grupo</Text>
        {isOwner ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('GroupForm', { groupId })}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primaryLight} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ErrorMessage message={actionError || ''} onDismiss={() => setActionError(null)} />

      {loading ? (
        <Loading message="Carregando integrantes..." fullscreen />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.uid}
          ListHeaderComponent={
            <View style={styles.groupOverview}>
              <Avatar uri={group?.photoUrl} name={group?.name} size={72} isGroup />
              <Text style={styles.groupName}>{group?.name}</Text>

              {/* Indicador de Capacidade e Vagas */}
              <View style={styles.capacityCard}>
                <View style={styles.capacityRow}>
                  <Text style={styles.capacityLabel}>Integrantes</Text>
                  <Text style={styles.capacityValue}>
                    {group?.memberIds.length} / {group?.memberLimit}
                  </Text>
                </View>
                <View style={styles.capacityRow}>
                  <Text style={styles.capacityLabel}>Vagas disponíveis</Text>
                  <Text
                    style={[
                      styles.capacityValue,
                      vacancies > 0 ? styles.vacanciesPositive : styles.vacanciesZero,
                    ]}
                  >
                    {vacancies} {vacancies === 1 ? 'vaga' : 'vagas'}
                  </Text>
                </View>
              </View>

              {/* Botão de Adicionar Integrante (para o proprietário com vagas) */}
              {isOwner && vacancies > 0 && (
                <TouchableOpacity
                  style={styles.addMemberButton}
                  onPress={handleAddMoreMembers}
                >
                  <Ionicons name="person-add" size={18} color="#FFFFFF" />
                  <Text style={styles.addMemberButtonText}>Adicionar Novos Integrantes</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <GroupMemberItem
              member={item}
              isOwner={item.uid === group?.ownerId}
              canRemove={isOwner && item.uid !== group?.ownerId}
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
});
