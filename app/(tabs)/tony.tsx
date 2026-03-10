import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, RefreshControl,
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { TonyReminder, TonyReminderType } from '../../src/types/database.types';
import { Check, Plus, X, Bone } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REMINDER_TYPES: { key: TonyReminderType; label: string; emoji: string }[] = [
  { key: 'comida', label: 'Comida', emoji: '🍖' },
  { key: 'paseo', label: 'Paseo', emoji: '🦮' },
  { key: 'veterinario', label: 'Veterinario', emoji: '🏥' },
  { key: 'baño', label: 'Baño', emoji: '🛁' },
  { key: 'vacuna', label: 'Vacuna', emoji: '💉' },
  { key: 'remedio', label: 'Remedio', emoji: '💊' },
];

export default function TonyScreen() {
  const { activeProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<TonyReminder[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<TonyReminderType>('comida');

  const fetchReminders = async () => {
    const { data } = await supabase
      .from('tony_reminders')
      .select('*')
      .order('status', { ascending: false })
      .order('reminder_date', { ascending: true })
      .limit(20);
    if (data) setReminders(data as TonyReminder[]);
  };

  const onRefresh = async () => { setRefreshing(true); await fetchReminders(); setRefreshing(false); };
  useEffect(() => { fetchReminders(); }, []);

  const handleCreateReminder = async () => {
    const { error } = await supabase.from('tony_reminders').insert({
      type: selectedType,
      status: 'pending',
      reminder_date: format(new Date(), 'yyyy-MM-dd'),
      created_by_profile_id: activeProfile?.id,
    });
    if (error) { Alert.alert('Error', 'No se pudo crear el recordatorio'); return; }
    setIsModalVisible(false);
    fetchReminders();
  };

  const toggleStatus = async (item: TonyReminder) => {
    const isCompleted = item.status === 'completed';
    const newStatus = isCompleted ? 'pending' : 'completed';
    const updates = isCompleted
      ? { status: newStatus, completed_by_profile_id: null, completed_at: null }
      : { status: newStatus, completed_by_profile_id: activeProfile?.id, completed_at: new Date().toISOString() };
    const { error } = await supabase.from('tony_reminders').update(updates).eq('id', item.id);
    if (!error) fetchReminders();
  };

  const profileColor = theme.colors.primary;

  const clearCompleted = async () => {
    const completed = reminders.filter(r => r.status === 'completed');
    if (completed.length === 0) return;
    Alert.alert(
      'Limpiar completados',
      `¿Eliminar ${completed.length} recordatorio${completed.length > 1 ? 's' : ''} completado${completed.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpiar', style: 'destructive', onPress: async () => {
          const ids = completed.map(r => r.id);
          await supabase.from('tony_reminders').delete().in('id', ids);
          fetchReminders();
        }}
      ]
    );
  };

  const handleDeleteReminder = (item: TonyReminder) => {
    Alert.alert(
      'Eliminar recordatorio',
      `¿Eliminar este recordatorio de ${getTypeInfo(item.type).label.toLowerCase()}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('tony_reminders').delete().eq('id', item.id);
            if (!error) fetchReminders();
          }
        }
      ]
    );
  };

  const getTypeInfo = (key: TonyReminderType) => REMINDER_TYPES.find(t => t.key === key) ?? { label: key, emoji: '🐶' };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "d 'de' MMMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const renderItem = ({ item }: { item: TonyReminder }) => {
    const isCompleted = item.status === 'completed';
    const info = getTypeInfo(item.type);
    return (
      <TouchableOpacity
        style={[styles.item, isCompleted && styles.itemDone]}
        onPress={() => toggleStatus(item)}
        onLongPress={() => handleDeleteReminder(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.itemEmoji}>{info.emoji}</Text>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, isCompleted && styles.itemNameDone]} numberOfLines={1}>
            {info.label}
          </Text>
          <Text style={styles.itemDate}>{formatDate(item.reminder_date)}</Text>
        </View>
        <View style={[styles.checkbox, isCompleted && styles.checkboxDone]}>
          {isCompleted && <Check size={12} color="#FFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🐷 Tony</Text>
          <Text style={styles.headerSub}>Recordatorios del chancho</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {reminders.some(r => r.status === 'completed') && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearCompleted}>
              <Text style={styles.clearBtnText}>Limpiar ✓</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: profileColor }]} onPress={() => setIsModalVisible(true)}>
            <Plus size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {reminders.length === 0 ? (
        <View style={styles.empty}>
          <Bone size={56} color="rgba(139,69,19,0.2)" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Tony está al día 🎉</Text>
          <Text style={styles.emptyText}>Tocá + para agregar un recordatorio</Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      )}

      {/* Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Recordatorio</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Tipo de recordatorio</Text>
            <View style={styles.typeGrid}>
              {REMINDER_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeChip, selectedType === t.key && styles.typeChipActive]}
                  onPress={() => setSelectedType(t.key)}
                >
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.typeText, selectedType === t.key && styles.typeTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateReminder}>
              <Text style={styles.saveBtnText}>Guardar Recordatorio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '500' },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    marginHorizontal: 4,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  itemDone: { opacity: 0.45 },
  itemEmoji: { fontSize: 24, flexShrink: 0 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  itemNameDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  itemDate: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '500' },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    borderColor: 'rgba(139,69,19,0.3)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(139,69,19,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.15)',
    backgroundColor: theme.colors.background,
  },
  typeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  typeEmoji: { fontSize: 16 },
  typeText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  typeTextActive: { color: '#FFF' },
  saveBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(139,69,19,0.08)', borderWidth: 1, borderColor: 'rgba(139,69,19,0.15)',
  },
  clearBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
});
