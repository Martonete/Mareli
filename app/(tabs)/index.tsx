import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Platform, StatusBar, Modal, TextInput, Alert
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell, ShoppingCart, FileText, ChevronRight, Home, Sparkles, Plus, X, CalendarDays
} from 'lucide-react-native';
import { format, parseISO, addDays, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect, useRouter } from 'expo-router';
import { notifyOtherUser } from '../../src/lib/notifications';
import Svg, { Circle } from 'react-native-svg';

const CircularProgress = ({ value, max, color, size = 88, strokeWidth = 7 }: {
  value: number; max: number; color: string; size?: number; strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke="rgba(139,69,19,0.1)" strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={center} cy={center} r={radius}
        stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
};

const parseNoteContent = (raw: string): { current: string; history: string[] } => {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed?.current)
      return { current: parsed.current, history: Array.isArray(parsed.history) ? parsed.history : [] };
  } catch {}
  return { current: raw, history: [] };
};

const NoteCard = ({ note, onEdit }: { note: any; onEdit: (note: any) => void }) => {
  const { current, history } = parseNoteContent(note.content ?? '');
  const noteDate = note.created_at ? format(parseISO(note.created_at), 'dd/MM/yyyy') : '';
  return (
    <TouchableOpacity style={styles.noteCard} onPress={() => onEdit(note)} activeOpacity={0.75}>
      <Text style={styles.noteText} numberOfLines={4}>{current || 'Sin contenido'}</Text>
      {history.length > 0 && (
        <View style={styles.noteHistory}>
          {history.slice(0, 2).map((prev, i) => (
            <Text key={i} style={styles.noteHistoryText} numberOfLines={2}>↩ {prev}</Text>
          ))}
        </View>
      )}
      {note.profiles?.name && (
        <Text style={styles.noteAuthor}>— {note.profiles.name}{noteDate ? ` · ${noteDate}` : ''}</Text>
      )}
    </TouchableOpacity>
  );
};

export default function DashboardScreen() {
  const { activeProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [notesY, setNotesY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [pendingShopping, setPendingShopping] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [points, setPoints] = useState({ Liz: 0, Martin: 0 });
  const [recentRedemptions, setRecentRedemptions] = useState<any[]>([]);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchData = async () => {
    const [
      { data: tasks, error: e1 },
      { data: items, error: e2 },
      { data: notes, error: e3 },
      { data: ptsData, error: e4 },
      { data: eventsData, error: e5 },
      { data: redemptionsData },
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
        .order('created_at', { ascending: false })
        .limit(5),
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
        .select('points_cost, profiles(name), rewards(name), created_at')
        .order('created_at', { ascending: false }),
    ]);
    if (e1) console.error('tasks error:', e1.message);
    if (e2) console.error('shopping error:', e2.message);
    if (e3) console.error('notes error:', e3.message);
    if (e5) console.error('events error:', e5.message);
    if (tasks) setRecentTasks(tasks);
    if (items) setPendingShopping(items);
    if (notes) setRecentNotes(notes);
    if (eventsData) setUpcomingEvents(eventsData);
    if (ptsData) {
      let eliPts = 0, marPts = 0;
      ptsData.forEach((t: any) => {
        if (t.profiles?.name === 'Liz') eliPts += (t.points_awarded || 0);
        if (t.profiles?.name === 'Martin') marPts += (t.points_awarded || 0);
      });
      if (redemptionsData) {
        redemptionsData.forEach((r: any) => {
          if (r.profiles?.name === 'Liz') eliPts -= (r.points_cost || 0);
          if (r.profiles?.name === 'Martin') marPts -= (r.points_cost || 0);
        });
      }
      setPoints({ Liz: eliPts, Martin: marPts });
      setRecentRedemptions(redemptionsData?.slice(0, 3) || []);
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

  const handleOpenEdit = (note: any) => {
    const { current } = parseNoteContent(note.content ?? '');
    setEditContent(current);
    setEditingNote(note);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !editingNote) return;
    const { current, history } = parseNoteContent(editingNote.content ?? '');
    const changed = current.trim() !== editContent.trim();
    const newHistory = changed ? [current, ...history].slice(0, 5) : history;
    const newContent = newHistory.length > 0
      ? JSON.stringify({ current: editContent.trim(), history: newHistory })
      : editContent.trim();
    const { error } = await supabase.from('notes').update({ content: newContent }).eq('id', editingNote.id);
    if (!error) {
      setEditingNote(null);
      setEditContent('');
      fetchData();
      if (activeProfile && changed) {
        notifyOtherUser(activeProfile.name, '✏️ Nota editada', `${activeProfile.name.split(' ')[0]} actualizó una nota.`);
      }
    } else {
      Alert.alert('Error', 'No se pudo guardar la edición');
    }
  };

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };
  
  useFocusEffect(
    useCallback(() => {
      fetchData();

      const channel = supabase.channel('dashboard_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => fetchData())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }, [])
  );

  const topPadding = insets.top > 0 ? insets.top + 8 : (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 20);
  const greeting = activeProfile?.name ? `Hola, ${activeProfile.name.split(' ')[0]} 👋` : 'Hola 👋';
  const profileColor = theme.colors.primary;
  const todayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase());

  const getTs = (s?: string | null) => s ? new Date(s).getTime() : 0;
  const dynamicSections = [
    { key: 'notes', ts: getTs(recentNotes[0]?.created_at) },
    { key: 'tasks', ts: getTs(recentTasks[0]?.created_at) },
    { key: 'shopping', ts: getTs(pendingShopping[0]?.created_at) },
    { key: 'events', ts: upcomingEvents.length > 0 ? Math.max(...upcomingEvents.map((e: any) => getTs(e.created_at))) : 0 },
    { key: 'redemptions', ts: getTs(recentRedemptions[0]?.created_at) },
  ].sort((a, b) => b.ts - a.ts);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: insets.bottom + 80 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.headerSub}>{todayLabel}</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: profileColor + '18' }]}>
          <Home size={22} color={profileColor} />
        </View>
      </View>

      {/* Grid de resumen */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/(tabs)/tasks')} activeOpacity={0.75}>
          <View style={[styles.gridIconBg, { backgroundColor: 'rgba(139, 69, 19, 0.12)' }]}>
            <Bell size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.gridNum}>{recentTasks.length}</Text>
          <Text style={styles.gridLabel}>Tareas{'\n'}pendientes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/(tabs)/shopping')} activeOpacity={0.75}>
          <View style={[styles.gridIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <ShoppingCart size={20} color="#10B981" />
          </View>
          <Text style={[styles.gridNum, { color: '#10B981' }]}>{pendingShopping.length}</Text>
          <Text style={styles.gridLabel}>Artículos{'\n'}de compra</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gridCard} onPress={() => scrollViewRef.current?.scrollTo({ y: notesY - 16, animated: true })} activeOpacity={0.75}>
          <View style={[styles.gridIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
            <FileText size={20} color="#F59E0B" />
          </View>
          <Text style={[styles.gridNum, { color: '#F59E0B' }]}>{recentNotes.length}</Text>
          <Text style={styles.gridLabel}>Notas{'\n'}recientes</Text>
        </TouchableOpacity>
      </View>

      {/* Resumen Puntos */}
      <View style={styles.pointsSummary}>
        <Text style={styles.pointsTitle}>Saldo de Puntos</Text>
        <View style={styles.pointsCirclesRow}>
          {([
            { name: 'Liz', pts: points.Liz, color: '#F472B6' },
            { name: 'Martín', pts: points.Martin, color: '#60A5FA' },
          ] as const).map(({ name, pts, color }) => {
            const maxPts = Math.max(points.Liz, points.Martin, 1);
            return (
              <View key={name} style={styles.pointsCircleWrapper}>
                <View style={styles.pointsCircleContainer}>
                  <CircularProgress value={pts} max={maxPts} color={color} size={92} strokeWidth={7} />
                  <View style={styles.pointsCircleInner}>
                    <Text style={[styles.pointsCircleNum, { color }]}>{pts}</Text>
                    <Text style={styles.pointsCirclePts}>pts</Text>
                  </View>
                </View>
                <Text style={styles.pointsCircleName}>{name}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Secciones dinámicas - ordenadas por actividad más reciente */}
      {dynamicSections.map(({ key }) => {
        if (key === 'notes') return (
          <View key="notes" style={styles.section} onLayout={(e) => setNotesY(e.nativeEvent.layout.y)}>
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
                <NoteCard key={note.id ?? i} note={note} onEdit={handleOpenEdit} />
              ))
            )}
          </View>
        );
        if (key === 'tasks') return (
          <View key="tasks" style={styles.section}>
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
                  <Text style={styles.listItemText} numberOfLines={2}>{task.task_types?.name ?? 'Tarea'}</Text>
                  <ChevronRight size={16} color="rgba(139,69,19,0.3)" />
                </View>
              ))
            )}
          </View>
        );
        if (key === 'shopping') return (
          <View key="shopping" style={styles.section}>
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
                  <View style={styles.listDot} />
                  <Text style={styles.listItemText} numberOfLines={1}>{item.name}</Text>
                  <ChevronRight size={16} color="rgba(139,69,19,0.3)" />
                </View>
              ))
            )}
            {pendingShopping.length > 4 && (
              <Text style={styles.moreText}>+{pendingShopping.length - 4} más en la lista</Text>
            )}
          </View>
        );
        if (key === 'events' && upcomingEvents.length > 0) return (
          <View key="events" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Próximos Eventos</Text>
            </View>
            {upcomingEvents.map((event, i) => (
              <View key={event.id ?? i} style={styles.listItem}>
                <View style={styles.listDot} />
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
        );
        if (key === 'redemptions' && recentRedemptions.length > 0) return (
          <View key="redemptions" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Canjes recientes</Text>
            </View>
            {recentRedemptions.map((red, i) => {
              const timeAgo = red.created_at
                ? formatDistanceToNow(parseISO(red.created_at), { addSuffix: true, locale: es })
                : '';
              return (
                <View key={i} style={styles.listItem}>
                  <View style={styles.listDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemText} numberOfLines={1}>
                      <Text style={{ fontWeight: '700' }}>{red.profiles?.name}</Text>
                      {' canjeó '}
                      <Text style={styles.redemptionReward}>🎁 {red.rewards?.name ?? '?'}</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>-{red.points_cost} pts</Text>
                      {timeAgo !== '' && <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{timeAgo}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        );
        return null;
      })}

      {/* Modal: crear o editar nota */}
      <Modal visible={isNoteModalVisible || editingNote !== null} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingNote ? 'Editar Nota' : 'Nueva Nota'}</Text>
              <TouchableOpacity
                onPress={() => { setIsNoteModalVisible(false); setEditingNote(null); setEditContent(''); }}
                style={styles.closeBtn}
              >
                <X size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Escribí una nota para la casa..."
              placeholderTextColor="rgba(139,69,19,0.35)"
              value={editingNote ? editContent : newNoteContent}
              onChangeText={editingNote ? setEditContent : setNewNoteContent}
              multiline
              autoFocus
            />

            <TouchableOpacity
              style={[styles.saveBtn, !(editingNote ? editContent : newNoteContent).trim() && styles.saveBtnDisabled]}
              onPress={editingNote ? handleSaveEdit : handleSaveNote}
              disabled={!(editingNote ? editContent : newNoteContent).trim()}
            >
              <Text style={styles.saveBtnText}>{editingNote ? 'Guardar Cambios' : 'Guardar Nota'}</Text>
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
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 69, 19, 0.1)',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  gridIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridNum: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: -1,
    lineHeight: 40,
    textAlign: 'center',
  },
  gridLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 15,
    textAlign: 'center',
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
  noteCard: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139, 69, 19, 0.06)',
  },
  noteHistory: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(139, 69, 19, 0.1)',
    gap: 3,
  },
  noteHistoryText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
    opacity: 0.75,
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
    marginBottom: 24, paddingVertical: 20, paddingHorizontal: 16, backgroundColor: '#FFF', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(139, 69, 19, 0.08)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
    alignItems: 'center',
  },
  pointsTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 16, alignSelf: 'flex-start' },
  pointsCirclesRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  pointsCircleWrapper: { alignItems: 'center', gap: 8 },
  pointsCircleContainer: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  pointsCircleInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pointsCircleNum: { fontSize: 24, fontWeight: '800', letterSpacing: -1, lineHeight: 26 },
  pointsCirclePts: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: -2 },
  pointsCircleName: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
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
  redemptionReward: { fontStyle: 'italic', fontWeight: '600', color: '#7C3AED' },
});
