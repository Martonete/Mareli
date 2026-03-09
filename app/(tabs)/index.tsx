import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Platform, StatusBar, Modal, TextInput, Alert, Animated, PanResponder, Dimensions
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell, ShoppingCart, FileText, ChevronRight, Home, Sparkles, Plus, X, CalendarDays
} from 'lucide-react-native';
import { startOfWeek, endOfWeek, format, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import { notifyOtherUser } from '../../src/lib/notifications';

// Componente para deslizar y borrar la nota
const SwipeableNote = ({ note, activeProfileId, onDelete }: { note: any, activeProfileId: string | undefined, onDelete: (id: string) => void }) => {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const isCreator = note.created_by_profile_id === activeProfileId;

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return isCreator && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx < 0) {
           pan.setValue({ x: gestureState.dx, y: 0 });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -80) {
           Animated.timing(pan, { toValue: { x: -Dimensions.get('window').width, y: 0 }, duration: 250, useNativeDriver: true }).start(() => {
              onDelete(note.id);
           });
        } else {
           Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        }
      }
    })
  ).current;

  const noteDate = note.created_at ? format(parseISO(note.created_at), 'dd/MM/yyyy') : '';

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteBackground}>
        <Text style={styles.deleteText}>Eliminar</Text>
      </View>
      <Animated.View 
        style={[styles.noteCard, { transform: [{ translateX: pan.x }] }]} 
        {...panResponder.panHandlers}
      >
        <Text style={styles.noteText} numberOfLines={3}>
          {note.content || 'Sin contenido'}
        </Text>
        {note.profiles?.name && (
          <Text style={styles.noteAuthor}>— {note.profiles.name} {noteDate ? `- ${noteDate}` : ''}</Text>
        )}
      </Animated.View>
    </View>
  );
};

export default function DashboardScreen() {
  const { activeProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [pendingShopping, setPendingShopping] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [points, setPoints] = useState({ Liz: 0, Martin: 0 });
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');

  const fetchData = async () => {
    const [
      { data: tasks, error: e1 },
      { data: items, error: e2 },
      { data: notes, error: e3 },
      { data: ptsData, error: e4 },
      { data: eventsData, error: e5 },
    ] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, task_types(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('shopping_items')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('notes')
        .select('*, profiles!notes_created_by_profile_id_fkey(name)')
        .gte('created_at', startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
        .lte('created_at', endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('points_awarded, profiles!tasks_completed_by_profile_id_fkey(name)')
        .eq('status', 'completed'),
      supabase
        .from('calendar_events')
        .select('*, profiles!calendar_events_created_by_profile_id_fkey(name)')
        .gte('event_date', format(new Date(), 'yyyy-MM-dd'))
        .lte('event_date', format(addDays(new Date(), 7), 'yyyy-MM-dd'))
        .order('event_date', { ascending: true }),
      supabase
        .from('reward_redemptions')
        .select('points_cost, profiles(name)'),
    ]);
    if (e1) console.error('tasks error:', e1.message);
    if (e2) console.error('shopping error:', e2.message);
    if (e3) console.error('notes error:', e3.message);
    if (e5) console.error('events error:', e5.message);
    const e6 = arguments.length > 0 && arguments[0] ? arguments[0][5]?.error : null; // Safe ignore or check
    const redemptionsData = arguments.length > 0 && arguments[0] ? arguments[0][5]?.data : null;
    if (tasks) setRecentTasks(tasks);
    if (items) setPendingShopping(items);
    if (notes) setRecentNotes(notes);
    if (eventsData) setUpcomingEvents(eventsData);
    if (ptsData) {
      let eliPts = 0, marPts = 0;
      ptsData.forEach((t: any) => {
        if (t.profiles?.name === 'Elizabeth' || t.profiles?.name === 'Liz') eliPts += (t.points_awarded || 0);
        if (t.profiles?.name === 'Martin') marPts += (t.points_awarded || 0);
      });

      if (redemptionsData) {
        redemptionsData.forEach((r: any) => {
          if (r.profiles?.name === 'Elizabeth' || r.profiles?.name === 'Liz') eliPts -= (r.points_cost || 0);
          if (r.profiles?.name === 'Martin') marPts -= (r.points_cost || 0);
        });
      }

      setPoints({ Liz: eliPts, Martin: marPts });
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteContent.trim() || !activeProfile) return;
    const { error } = await supabase.from('notes').insert({
      content: newNoteContent.trim(),
      created_by_profile_id: activeProfile.id,
    });
    if (!error) {
      setIsNoteModalVisible(false);
      setNewNoteContent('');
      fetchData();
      notifyOtherUser(activeProfile.name, '📝 Nueva nota', `${activeProfile.name.split(' ')[0]} dejó una nueva nota rápida en el corcho.`);
    } else {
      Alert.alert('Error', 'No se pudo guardar la nota');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (!error) {
      fetchData();
    } else {
      Alert.alert('Error', 'No se pudo eliminar la nota');
    }
  };

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };
  
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const topPadding = insets.top > 0 ? insets.top + 8 : (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 20);
  const greeting = activeProfile?.name ? `Hola, ${activeProfile.name.split(' ')[0]} 👋` : 'Hola 👋';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: insets.bottom + 80 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.headerSub}>Casa en Orden</Text>
        </View>
        <View style={styles.headerIcon}>
          <Home size={22} color={theme.colors.primary} />
        </View>
      </View>

      {/* Grid de resumen */}
      <View style={styles.grid}>
        <View style={styles.gridCard}>
          <View style={[styles.gridIconBg, { backgroundColor: 'rgba(139, 69, 19, 0.12)' }]}>
            <Bell size={18} color={theme.colors.primary} />
          </View>
          <Text style={styles.gridNum}>{recentTasks.length}</Text>
          <Text style={styles.gridLabel}>Tareas{'\n'}pendientes</Text>
        </View>

        <View style={styles.gridCard}>
          <View style={[styles.gridIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <ShoppingCart size={18} color="#10B981" />
          </View>
          <Text style={[styles.gridNum, { color: '#10B981' }]}>{pendingShopping.length}</Text>
          <Text style={styles.gridLabel}>Artículos{'\n'}de compra</Text>
        </View>

        <View style={styles.gridCard}>
          <View style={[styles.gridIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
            <FileText size={18} color="#F59E0B" />
          </View>
          <Text style={[styles.gridNum, { color: '#F59E0B' }]}>{recentNotes.length}</Text>
          <Text style={styles.gridLabel}>Notas{'\n'}recientes</Text>
        </View>
      </View>

      {/* Resumen Puntos */}
      <View style={styles.pointsSummary}>
        <View style={styles.pointsHeader}>
          <Text style={styles.pointsTitle}>Saldo de Puntos</Text>
        </View>
        <View style={styles.pointsBars}>
          <View style={styles.pointRow}>
            <Text style={styles.pointLabel}>Liz: {points.Liz}</Text>
            <View style={styles.miniBarBg}>
              <View style={[styles.miniBarFill, { width: `${Math.round((points.Liz / Math.max(points.Liz, points.Martin, 1)) * 100)}%` as any, backgroundColor: theme.colors.elizabeth }]} />
            </View>
          </View>
          <View style={styles.pointRow}>
            <Text style={styles.pointLabel}>Martín: {points.Martin}</Text>
            <View style={styles.miniBarBg}>
              <View style={[styles.miniBarFill, { width: `${Math.round((points.Martin / Math.max(points.Liz, points.Martin, 1)) * 100)}%` as any, backgroundColor: theme.colors.martin }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Notas */}
      <View style={styles.section}>
        <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={styles.sectionTitle}>Notas Recientes</Text>
          <TouchableOpacity onPress={() => setIsNoteModalVisible(true)} style={{ padding: 4, marginRight: -4 }}>
            <Plus size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {recentNotes.length === 0 ? (
          <View style={styles.emptyRow}>
            <Sparkles size={16} color="rgba(139,69,19,0.4)" />
            <Text style={styles.emptyRowText}>No hay notas aún</Text>
          </View>
        ) : (
          recentNotes.map((note, i) => (
            <SwipeableNote 
              key={note.id ?? i} 
              note={note} 
              activeProfileId={activeProfile?.id} 
              onDelete={handleDeleteNote} 
            />
          ))
        )}
      </View>

      {/* Tareas pendientes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tareas Pendientes</Text>
        </View>

        {recentTasks.length === 0 ? (
          <View style={styles.emptyRow}>
            <Sparkles size={16} color="rgba(139,69,19,0.4)" />
            <Text style={styles.emptyRowText}>Sin tareas pendientes 🎉</Text>
          </View>
        ) : (
          recentTasks.map((task, i) => (
            <View key={task.id ?? i} style={styles.listItem}>
              <View style={styles.listDot} />
              <Text style={styles.listItemText} numberOfLines={2}>
                {task.task_types?.name ?? 'Tarea'}
              </Text>
              <ChevronRight size={16} color="rgba(139,69,19,0.3)" />
            </View>
          ))
        )}
      </View>

      {/* Compras */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lista de Compras</Text>
        </View>

        {pendingShopping.length === 0 ? (
          <View style={styles.emptyRow}>
            <Sparkles size={16} color="rgba(139,69,19,0.4)" />
            <Text style={styles.emptyRowText}>La alacena está completa 🛒</Text>
          </View>
        ) : (
          pendingShopping.slice(0, 4).map((item, i) => (
            <View key={item.id ?? i} style={styles.listItem}>
              <View style={[styles.listDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.listItemText} numberOfLines={1}>{item.name}</Text>
              <ChevronRight size={16} color="rgba(139,69,19,0.3)" />
            </View>
          ))
        )}
        {pendingShopping.length > 4 && (
          <Text style={styles.moreText}>+{pendingShopping.length - 4} más en la lista</Text>
        )}
      </View>

      {/* Próximos Eventos */}
      {upcomingEvents.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Próximos Eventos</Text>
          </View>
          {upcomingEvents.map((event, i) => (
            <View key={event.id ?? i} style={styles.listItem}>
              <View style={[styles.listDot, { backgroundColor: theme.colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listItemText} numberOfLines={1}>{event.title}</Text>
                <Text style={styles.eventMeta}>
                  {format(parseISO(event.event_date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
                  {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ''}
                </Text>
              </View>
              <CalendarDays size={16} color="rgba(139,69,19,0.3)" />
            </View>
          ))}
        </View>
      )}

      {/* Modal Nueva Nota */}
      <Modal visible={isNoteModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Nota</Text>
              <TouchableOpacity onPress={() => setIsNoteModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Escribí una nota para la casa..."
              placeholderTextColor="rgba(139,69,19,0.35)"
              value={newNoteContent}
              onChangeText={setNewNoteContent}
              multiline
              autoFocus
            />

            <TouchableOpacity 
              style={[styles.saveBtn, !newNoteContent.trim() && styles.saveBtnDisabled]}
              onPress={handleSaveNote}
              disabled={!newNoteContent.trim()}
            >
              <Text style={styles.saveBtnText}>Guardar Nota</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 69, 19, 0.1)',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  gridIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridNum: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: -1,
    lineHeight: 32,
  },
  gridLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 15,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 69, 19, 0.08)',
    overflow: 'hidden',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 69, 19, 0.07)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139, 69, 19, 0.06)',
    gap: 12,
  },
  listDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    flexShrink: 0,
  },
  listItemText: { fontSize: 15, color: theme.colors.text, fontWeight: '500' },
  eventMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  moreText: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    lineHeight: 20,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyRowText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  swipeContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139, 69, 19, 0.06)',
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  deleteText: {
    color: '#FFF',
    fontWeight: '600',
  },
  noteCard: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FFF',
  },
  noteText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    fontWeight: '400',
  },
  noteAuthor: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  pointsSummary: {
    marginBottom: 24, padding: 16, backgroundColor: '#FFF', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(139, 69, 19, 0.08)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  pointsHeader: { marginBottom: 12 },
  pointsTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  pointsBars: { gap: 12 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointLabel: { width: 75, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  miniBarBg: { flex: 1, height: 8, backgroundColor: 'rgba(139,69,19,0.06)', borderRadius: 4, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(139,69,19,0.1)', alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1.5, borderColor: 'rgba(139,69,19,0.15)', borderRadius: 12, padding: 14, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.background, marginBottom: 20 },
  textArea: { height: 120, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
