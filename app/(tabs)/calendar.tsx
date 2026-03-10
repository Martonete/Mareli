import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ScrollView, FlatList,
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { CalendarEvent } from '../../src/types/database.types';
import { Plus, X, Clock, ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notifyOtherUser } from '../../src/lib/notifications';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function CalendarScreen() {
  const { activeProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [description, setDescription] = useState('');

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*, profiles!calendar_events_created_by_profile_id_fkey(name)')
      .gte('event_date', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
      .lte('event_date', format(endOfMonth(currentMonth), 'yyyy-MM-dd'))
      .order('event_date', { ascending: true });
    if (error) console.error('fetchEvents error:', error.message);
    if (data) setEvents(data as any[]);
  }, [currentMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleDayPress = (date: Date) => {
    setSelectedDate(date);
    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(date);
    }
  };

  const openCreateModal = (date?: Date) => {
    setTitle('');
    setEventTime('');
    setDescription('');
    if (date) setSelectedDate(date);
    setIsModalVisible(true);
  };

  const handleCreateEvent = async () => {
    if (!title.trim() || !activeProfile || !selectedDate) {
      Alert.alert('Atención', 'Completá el título y seleccioná un día');
      return;
    }
    const { error } = await supabase.from('calendar_events').insert({
      title: title.trim(),
      event_date: format(selectedDate, 'yyyy-MM-dd'),
      event_time: eventTime.trim() || null,
      description: description.trim() || null,
      created_by_profile_id: activeProfile.id,
    });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    notifyOtherUser(activeProfile.id, '📅 Nuevo evento', `${activeProfile.name.split(' ')[0]} agendó "${title.trim()}" para el ${format(selectedDate, 'dd/MM')}.`);
    setIsModalVisible(false);
    setTitle(''); setEventTime(''); setDescription('');
    fetchEvents();
  };

  // Build calendar grid
  const buildCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  };

  const calendarDays = buildCalendarDays();

  const profileColor = theme.colors.primary;

  const handleDeleteEvent = (event: CalendarEvent) => {
    Alert.alert(
      'Eliminar evento',
      `¿Eliminar "${event.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('calendar_events').delete().eq('id', event.id);
            if (!error) fetchEvents();
          }
        }
      ]
    );
  };

  const getEventsForDate = (date: Date) =>
    events.filter(e => isSameDay(parseISO(e.event_date + 'T00:00:00'), date));

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const today = new Date();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendario</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: profileColor }]}
          onPress={() => openCreateModal(selectedDate ?? new Date())}
        >
          <Plus size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth(prev => subMonths(prev, 1))} style={styles.navBtn}>
            <ChevronLeft size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {format(currentMonth, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}
          </Text>
          <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, 1))} style={styles.navBtn}>
            <ChevronRight size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={styles.weekDaysRow}>
          {DAYS.map(d => (
            <Text key={d} style={styles.weekDay}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {calendarDays.map((date, idx) => {
            const inMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, today);
            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
            const dayEvents = getEventsForDate(date);
            const hasEvents = dayEvents.length > 0;

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => handleDayPress(date)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayNum,
                  !inMonth && styles.dayNumMuted,
                  isSelected && styles.dayNumSelected,
                  isToday && !isSelected && styles.dayNumToday,
                ]}>
                  {format(date, 'd')}
                </Text>
                {hasEvents && (
                  <View style={[
                    styles.dotContainer,
                  ]}>
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          isSelected && styles.dotSelected,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day events */}
        {selectedDate && (
          <View style={styles.selectedSection}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedTitle}>
                {format(selectedDate, "d 'de' MMMM", { locale: es })}
              </Text>
              <TouchableOpacity
                style={styles.addEventBtn}
                onPress={() => openCreateModal(selectedDate)}
              >
                <Plus size={14} color={theme.colors.primary} />
                <Text style={styles.addEventText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            {selectedEvents.length === 0 ? (
              <View style={styles.noEvents}>
                <CalendarCheck size={28} color="rgba(139,69,19,0.2)" strokeWidth={1.5} />
                <Text style={styles.noEventsText}>Sin eventos este día</Text>
              </View>
            ) : (
              selectedEvents.map(event => (
                <TouchableOpacity key={event.id} style={styles.eventCard} onLongPress={() => handleDeleteEvent(event)} activeOpacity={0.8}>
                  <View style={[styles.eventColorStrip, { backgroundColor: profileColor }]} />
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                    {event.event_time && (
                      <View style={styles.timeRow}>
                        <Clock size={12} color={theme.colors.textSecondary} />
                        <Text style={styles.eventTime}>{event.event_time}</Text>
                      </View>
                    )}
                    {event.description && (
                      <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal crear evento */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Nuevo Evento</Text>
                {selectedDate && (
                  <Text style={styles.modalDate}>
                    {format(selectedDate, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Cena, Médico, Reunión..."
              placeholderTextColor="rgba(139,69,19,0.35)"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            <Text style={styles.label}>Hora (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 18:30"
              placeholderTextColor="rgba(139,69,19,0.35)"
              value={eventTime}
              onChangeText={setEventTime}
            />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Detalles del evento..."
              placeholderTextColor="rgba(139,69,19,0.35)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateEvent}>
              <Text style={styles.saveBtnText}>Guardar Evento</Text>
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
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.3 },
  weekDaysRow: {
    flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4,
  },
  weekDay: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700',
    color: theme.colors.textSecondary, textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 8, marginBottom: 16,
  },
  dayCell: {
    width: '14.28%', aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, padding: 2,
  },
  dayCellSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayCellToday: {
    backgroundColor: 'rgba(139,69,19,0.1)',
  },
  dayNum: {
    fontSize: 13, fontWeight: '600', color: theme.colors.text,
  },
  dayNumMuted: { color: 'rgba(139,69,19,0.25)' },
  dayNumSelected: { color: '#FFF', fontWeight: '800' },
  dayNumToday: { color: theme.colors.primary, fontWeight: '800' },
  dotContainer: {
    flexDirection: 'row', gap: 2, marginTop: 2,
  },
  dot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  dotSelected: { backgroundColor: '#FFF' },
  selectedSection: {
    marginHorizontal: 16,
    backgroundColor: '#FFF', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)',
    overflow: 'hidden',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  selectedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(139,69,19,0.07)',
  },
  selectedTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  addEventBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(139,69,19,0.08)', borderRadius: 20,
  },
  addEventText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  noEvents: {
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, padding: 20,
  },
  noEventsText: { fontSize: 14, color: theme.colors.textSecondary, fontStyle: 'italic' },
  eventCard: {
    flexDirection: 'row', alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(139,69,19,0.06)',
  },
  eventColorStrip: { width: 4, backgroundColor: theme.colors.primary },
  eventInfo: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, lineHeight: 20 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  eventTime: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  eventDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  modalDate: { fontSize: 13, color: theme.colors.primary, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(139,69,19,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: 'rgba(139,69,19,0.15)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: theme.colors.text,
    backgroundColor: theme.colors.background, marginBottom: 14,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4, marginBottom: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
