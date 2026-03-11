import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  TextInput, RefreshControl, Modal,
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { ShoppingItem } from '../../src/types/database.types';
import { Plus, Check, ShoppingCart, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notifyOtherUser } from '../../src/lib/notifications';

export default function ShoppingScreen() {
  const { activeProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ShoppingItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [boughtCollapsed, setBoughtCollapsed] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('shopping_items')
      .select('*, profiles!shopping_items_created_by_profile_id_fkey(name)')
      .order('created_at', { ascending: false });
    if (data) setItems(data as any[]);
  };

  const onRefresh = async () => { setRefreshing(true); await fetchItems(); setRefreshing(false); };

  useEffect(() => {
    fetchItems();
    const channel = supabase.channel('shopping_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => {
        fetchItems();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddItem = async () => {
    if (!newItem.trim() || !activeProfile) return;
    // Soporta múltiples items separados por línea
    const lines = newItem.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const rows = lines.map(name => ({
      name,
      status: 'pending' as const,
      created_by_profile_id: activeProfile.id,
    }));
    const { error } = await supabase.from('shopping_items').insert(rows);
    if (error) { alert('No se pudo agregar'); return; }

    const label = lines.length === 1
      ? `"${lines[0]}"`
      : `${lines.length} items`;
    notifyOtherUser(activeProfile.id, '🛒 Lista de compras', `${activeProfile.name.split(' ')[0]} agregó ${label} a la lista.`);
    setNewItem('');
    fetchItems();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from('shopping_items').delete().eq('id', pendingDelete.id);
    setPendingDelete(null);
    if (!error) fetchItems();
  };

  const confirmClear = async () => {
    setShowClearConfirm(false);
    await supabase.from('shopping_items').delete().eq('status', 'resolved');
    fetchItems();
  };

  const toggleStatus = async (item: ShoppingItem) => {
    if (!activeProfile) return;
    const isResolved = item.status === 'resolved';
    const newStatus = isResolved ? 'pending' : 'resolved';
    const updates = isResolved
      ? { status: newStatus, resolved_by_profile_id: null, resolved_at: null }
      : { status: newStatus, resolved_by_profile_id: activeProfile.id, resolved_at: new Date().toISOString() };
    const { error } = await supabase.from('shopping_items').update(updates).eq('id', item.id);
    if (!error) {
      if (!isResolved) {
        notifyOtherUser(activeProfile.id, '✅ Compra completada', `${activeProfile.name.split(' ')[0]} compró "${item.name}".`);
      }
      fetchItems();
    }
  };

  const pending = items.filter(i => i.status !== 'resolved');
  const resolved = items.filter(i => i.status === 'resolved');

  const sections = [
    ...(pending.length > 0 ? [{ key: 'pending', title: `Por comprar (${pending.length})`, data: pending }] : []),
    ...(resolved.length > 0 ? [{ key: 'resolved', title: `Comprados (${resolved.length})`, data: boughtCollapsed ? [] : resolved }] : []),
  ];

  const renderItem = ({ item }: { item: ShoppingItem }) => {
    const isResolved = item.status === 'resolved';
    return (
      <TouchableOpacity
        style={[styles.item, isResolved && styles.itemResolved]}
        onPress={() => toggleStatus(item)}
        onLongPress={() => setPendingDelete(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isResolved && styles.checkboxChecked]}>
          {isResolved && <Check size={14} color="#FFF" strokeWidth={3} />}
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, isResolved && styles.itemNameDone]} numberOfLines={1}>
            {item.name}
          </Text>
          {(item as any).profiles?.name && (
            <Text style={styles.itemBy} numberOfLines={1}>
              {(item as any).profiles.name.split(' ')[0]}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.itemDeleteBtn}
          onPress={() => setPendingDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={14} color="rgba(139,69,19,0.25)" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: { key: string; title: string } }) => {
    if (section.key === 'resolved') {
      return (
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setBoughtCollapsed(!boughtCollapsed)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
          <View style={styles.sectionHeaderRight}>
            {resolved.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowClearConfirm(true)}
                style={styles.clearPill}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearPillText}>Limpiar</Text>
              </TouchableOpacity>
            )}
            {boughtCollapsed
              ? <ChevronDown size={16} color={theme.colors.textSecondary} />
              : <ChevronUp size={16} color={theme.colors.textSecondary} />}
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <ShoppingCart size={22} color={theme.colors.primary} />
        <Text style={styles.headerTitle}>Lista de Compras</Text>
      </View>

      {/* Input tipo bloc de notas */}
      <View style={styles.inputCard}>
        <View style={styles.inputLines}>
          <TextInput
            style={styles.input}
            placeholder={"Escribí lo que falta...\nUn item por línea"}
            placeholderTextColor="rgba(139,69,19,0.3)"
            value={newItem}
            onChangeText={setNewItem}
            multiline
            textAlignVertical="top"
          />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, !newItem.trim() && styles.addBtnDisabled]}
          onPress={handleAddItem}
          disabled={!newItem.trim()}
        >
          <Plus size={18} color="#FFF" />
          <Text style={styles.addBtnLabel}>Agregar</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBg}>
            <ShoppingCart size={40} color={theme.colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>No falta nada</Text>
          <Text style={styles.emptyText}>Agregá lo que necesiten comprar{'\n'}y tachalo cuando lo consigan</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Contador flotante */}
      {pending.length > 0 && (
        <View style={[styles.floatingCounter, { bottom: insets.bottom + 90 }]}>
          <Text style={styles.floatingCounterText}>
            {pending.length} {pending.length === 1 ? 'item pendiente' : 'items pendientes'}
          </Text>
        </View>
      )}

      {/* Modal: eliminar item */}
      <Modal visible={!!pendingDelete} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <TouchableOpacity style={styles.confirmClose} onPress={() => setPendingDelete(null)}>
              <X size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.confirmEmoji}>🗑️</Text>
            <Text style={styles.confirmTitle}>Eliminar item</Text>
            <Text style={styles.confirmBody}>¿Eliminar "{pendingDelete?.name}" de la lista?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPendingDelete(null)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
                <Text style={styles.deleteBtnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: limpiar completados */}
      <Modal visible={showClearConfirm} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <TouchableOpacity style={styles.confirmClose} onPress={() => setShowClearConfirm(false)}>
              <X size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.confirmEmoji}>✅</Text>
            <Text style={styles.confirmTitle}>Limpiar comprados</Text>
            <Text style={styles.confirmBody}>¿Eliminar los {resolved.length} items ya comprados?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowClearConfirm(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmClear}>
                <Text style={styles.deleteBtnText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 24, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5,
  },

  inputCard: {
    marginHorizontal: 16, marginTop: 10, marginBottom: 6,
    backgroundColor: '#FFF', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  inputLines: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(139,69,19,0.08)',
  },
  input: {
    fontSize: 15, color: theme.colors.text,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    minHeight: 80, maxHeight: 140,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    backgroundColor: theme.colors.primary, borderRadius: 0,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnLabel: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  list: { paddingHorizontal: 16, paddingTop: 8 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4, marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionHeaderRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  clearPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12,
  },
  clearPillText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.08)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  itemResolved: { opacity: 0.5, backgroundColor: 'rgba(255,255,255,0.6)' },
  checkbox: {
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, borderColor: 'rgba(139,69,19,0.25)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  itemNameDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  itemBy: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  itemDeleteBtn: {
    padding: 6, borderRadius: 8,
  },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(139,69,19,0.06)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  emptyText: {
    fontSize: 14, color: theme.colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },

  floatingCounter: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: theme.colors.primary, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  floatingCounterText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmModal: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 28, width: '100%', maxWidth: 340,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  confirmClose: { position: 'absolute', top: 16, right: 16, padding: 4 },
  confirmEmoji: { fontSize: 36, marginBottom: 8 },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  confirmBody: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  confirmBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(139,69,19,0.08)' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  deleteBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#EF4444' },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
