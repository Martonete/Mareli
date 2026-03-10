import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal,
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { ShoppingItem } from '../../src/types/database.types';
import { Plus, Check, ShoppingCart, X } from 'lucide-react-native';
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

  const fetchItems = async () => {
    const { data } = await supabase
      .from('shopping_items')
      .select('*, profiles!shopping_items_created_by_profile_id_fkey(name)')
      .order('status', { ascending: false })
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
    const { error } = await supabase.from('shopping_items').insert({
      name: newItem.trim(),
      status: 'pending',
      created_by_profile_id: activeProfile.id,
    });
    if (error) { Alert.alert('Error', 'No se pudo agregar el item'); return; }
    notifyOtherUser(activeProfile.id, '🛒 Lista de compras', `${activeProfile.name.split(' ')[0]} agregó "${newItem.trim()}" a la lista.`);
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
          {isResolved && <Check size={12} color="#FFF" strokeWidth={3} />}
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, isResolved && styles.itemNameDone]} numberOfLines={1}>
            {item.name}
          </Text>
          {(item as any).profiles?.name && (
            <Text style={styles.itemBy} numberOfLines={1}>
              Añadido por {(item as any).profiles.name}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const pending = items.filter(i => i.status !== 'resolved');
  const resolved = items.filter(i => i.status === 'resolved');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Compras</Text>
          <Text style={styles.headerSub}>{pending.length} pendientes</Text>
        </View>
        {resolved.length > 0 && (
          <TouchableOpacity onPress={() => setShowClearConfirm(true)} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Limpiar ✓</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Agregar ítem..."
          placeholderTextColor="rgba(139,69,19,0.35)"
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={handleAddItem}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddItem}>
          <Plus size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <ShoppingCart size={56} color="rgba(139,69,19,0.2)" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Lista vacía</Text>
          <Text style={styles.emptyText}>Agregá items arriba para empezar</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      )}

      {/* Modal: eliminar ítem */}
      <Modal visible={!!pendingDelete} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <TouchableOpacity style={styles.confirmClose} onPress={() => setPendingDelete(null)}>
              <X size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.confirmEmoji}>🗑️</Text>
            <Text style={styles.confirmTitle}>Eliminar ítem</Text>
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
            <Text style={styles.confirmTitle}>Limpiar completados</Text>
            <Text style={styles.confirmBody}>¿Eliminar todos los ítems ya comprados?</Text>
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
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 26, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '500' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 20 },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.success },
  inputRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20,
    paddingVertical: 14, alignItems: 'center',
  },
  input: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.12)',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: theme.colors.text,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 12, padding: 14,
    marginHorizontal: 4, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  itemResolved: { opacity: 0.45 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(139,69,19,0.3)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  itemNameDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  itemBy: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
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
