import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, RefreshControl,
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { ShoppingItem } from '../../src/types/database.types';
import { Plus, Check, ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notifyOtherUser } from '../../src/lib/notifications';

export default function ShoppingScreen() {
  const { activeProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
    notifyOtherUser(activeProfile.name, '🛒 Lista de compras', `${activeProfile.name.split(' ')[0]} agregó "${newItem.trim()}" a la lista.`);
    setNewItem('');
    fetchItems();
  };

  const profileColor = theme.colors.primary;

  const handleDeleteItem = (item: ShoppingItem) => {
    Alert.alert(
      'Eliminar ítem',
      `¿Eliminar "${item.name}" de la lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
            if (!error) fetchItems();
          }
        }
      ]
    );
  };

  const clearResolved = async () => {
    Alert.alert(
      'Limpiar completados',
      '¿Eliminar todos los ítems ya comprados?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('shopping_items').delete().eq('status', 'resolved');
            fetchItems();
          }
        }
      ]
    );
  };

  const toggleStatus = async (item: ShoppingItem) => {
    const isResolved = item.status === 'resolved';
    const newStatus = isResolved ? 'pending' : 'resolved';
    const updates = isResolved
      ? { status: newStatus, resolved_by_profile_id: null, resolved_at: null }
      : { status: newStatus, resolved_by_profile_id: activeProfile?.id, resolved_at: new Date().toISOString() };
    const { error } = await supabase.from('shopping_items').update(updates).eq('id', item.id);
    if (!error) fetchItems();
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => {
    const isResolved = item.status === 'resolved';
    return (
      <TouchableOpacity
        style={[styles.item, isResolved && styles.itemResolved]}
        onPress={() => toggleStatus(item)}
        onLongPress={() => handleDeleteItem(item)}
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
          <TouchableOpacity onPress={clearResolved} style={styles.clearBtn}>
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
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: profileColor }]} onPress={handleAddItem}>
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
});
