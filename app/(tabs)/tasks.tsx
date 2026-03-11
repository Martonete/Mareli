import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { TaskWithDetails, TaskType } from '../../src/types/database.types';
import { Check, Plus, X, CheckCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { notifyOtherUser } from '../../src/lib/notifications';

export default function TasksScreen() {
  const { activeProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [profiles, setProfiles] = useState<{id: string, name: string}[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<TaskWithDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingNewType, setIsCreatingNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypePoints, setNewTypePoints] = useState('');
  const [pendingDeleteTask, setPendingDeleteTask] = useState<TaskWithDetails | null>(null);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_types(name, default_points), creator:profiles!tasks_created_by_profile_id_fkey(name), completer:profiles!tasks_completed_by_profile_id_fkey(name)')
      .order('status', { ascending: false })    // pending primero
      .order('created_at', { ascending: false });
    if (error) console.error('fetchTasks error:', error.message);
    if (data) setTasks(data as any[]);
  }, []);

  const fetchTaskTypes = useCallback(async () => {
    const { data, error } = await supabase.from('task_types').select('*').order('name');
    if (error) console.error('fetchTaskTypes error:', error.message);
    if (data && data.length > 0) {
      setTaskTypes(data);
      setSelectedTypeId(data[0].id);
    }
  }, []);

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('id, name');
    if (data) setProfiles(data);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTasks();
    fetchTaskTypes();
    fetchProfiles();

    const channel = supabase.channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks, fetchTaskTypes, fetchProfiles]);

  const syncDefaultTasks = async () => {
    const defaultTasks = [
      { name: 'Barrer pisos', default_points: 5 },
      { name: 'Trapear', default_points: 8 },
      { name: 'Ordenar habitación', default_points: 8 },
      { name: 'Cocinar', default_points: 15 },
      { name: 'Lavar platos', default_points: 15 },
      { name: 'Limpiar', default_points: 15 },
      { name: 'Limpiar baño', default_points: 25 },
      { name: 'Limpiar ambiente', default_points: 20 },
      { name: 'Limpiar casa', default_points: 60 },
      { name: 'Lavar ropa', default_points: 5 },
      { name: 'Colgar ropa', default_points: 10 },
      { name: 'Doblar ropa', default_points: 15 },
      { name: 'Sacar basura', default_points: 5 },
      { name: 'Hacer compras', default_points: 10 },
      { name: 'Pasear a Tony', default_points: 10 }
    ];

    try {
      const { error } = await supabase.from('task_types').upsert(defaultTasks, { onConflict: 'name' });
      if (error) throw error;
      alert('La lista de tareas fue actualizada correctamente.');
      setIsModalVisible(false);
      fetchTaskTypes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredTasks = tasks.filter(t =>
    filter === 'all' ? true : t.status === filter
  );

  const openCompleteModal = (task: TaskWithDetails) => {
    if (task.status === 'completed' || !activeProfile) return;
    setTaskToComplete(task);
  };

  const handleConfirmComplete = async (assignee: string | 'ambos') => {
    if (!taskToComplete || !activeProfile) return;

    if (assignee === 'ambos') {
      if (profiles.length < 2) {
        alert('No hay suficientes perfiles para asignar a "Ambos"');
        return;
      }
      const halfPoints = Math.floor((taskToComplete.task_types?.default_points ?? 0) / 2);
      
      // Actualizamos la original a favor de Profile 1
      await supabase.from('tasks').update({
        status: 'completed',
        completed_by_profile_id: profiles[0].id,
        completed_at: new Date().toISOString(),
        points_awarded: halfPoints,
      }).eq('id', taskToComplete.id);

      // Creamos clon para Profile 2
      await supabase.from('tasks').insert({
        task_type_id: taskToComplete.task_type_id,
        status: 'completed',
        created_by_profile_id: taskToComplete.created_by_profile_id,
        completed_by_profile_id: profiles[1].id,
        completed_at: new Date().toISOString(),
        points_awarded: halfPoints,
        target_date: taskToComplete.target_date,
        notes: taskToComplete.notes ? `(Compartida) ${taskToComplete.notes}` : '(Compartida)',
      });
      notifyOtherUser(activeProfile.id, '🤝 Tarea compartida', `${activeProfile.name.split(' ')[0]} marcó "${taskToComplete.task_types?.name}" como realizada por ambos.`);
      
    } else {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_by_profile_id: assignee,
          completed_at: new Date().toISOString(),
          points_awarded: taskToComplete.task_types?.default_points ?? 0,
        })
        .eq('id', taskToComplete.id);
        
      if (error) {
        alert('No se pudo completar la tarea');
      } else {
        const completerName = profiles.find(p => p.id === assignee)?.name || activeProfile.name;
        notifyOtherUser(activeProfile.id, '✅ Tarea completada', `${completerName.split(' ')[0]} completó "${taskToComplete.task_types?.name}" y ganó puntos!`);
      }
    }
    
    setTaskToComplete(null);
    fetchTasks();
  };

  const handleCreateTask = async () => {
    if (!activeProfile) return;

    let finalTaskTypeId = selectedTypeId;
    let finalPoints = 0;

    if (isCreatingNewType) {
      if (!newTypeName.trim() || !newTypePoints.trim()) {
        alert('Completá nombre y puntaje para la nueva tarea.');
        return;
      }
      const pts = parseInt(newTypePoints, 10);
      if (isNaN(pts) || pts <= 0) {
        alert('El puntaje debe ser un número válido mayor a 0.');
        return;
      }
      
      const { data: insertedType, error: typeError } = await supabase
        .from('task_types')
        .insert({ name: newTypeName.trim(), default_points: pts })
        .select()
        .single();
        
      if (typeError) {
        alert(`Error al crear el tipo de tarea: ${typeError.message}`);
        return;
      }
      
      finalTaskTypeId = insertedType.id;
      finalPoints = pts;
      setTaskTypes(prev => [...prev, insertedType].sort((a,b) => a.name.localeCompare(b.name)));
    } else {
      if (!selectedTypeId) {
        alert('Seleccioná un tipo de tarea');
        return;
      }
      const selectedType = taskTypes.find(t => t.id === selectedTypeId);
      finalPoints = selectedType?.default_points ?? 0;
    }

    const { error } = await supabase.from('tasks').insert({
      task_type_id: finalTaskTypeId,
      status: 'pending',
      created_by_profile_id: activeProfile.id,
      target_date: format(new Date(), 'yyyy-MM-dd'),
      notes: notes.trim() || null,
      points_awarded: finalPoints,
    });
    
    if (error) {
      alert(`Error al crear: ${error.message}`);
      return;
    }
    
    notifyOtherUser(activeProfile.id, '📋 Nueva tarea', `${activeProfile.name.split(' ')[0]} agregó "${isCreatingNewType ? newTypeName.trim() : taskTypes.find(t=>t.id===selectedTypeId)?.name}" a la lista.`);
    
    setIsModalVisible(false);
    setNotes('');
    setIsCreatingNewType(false);
    setNewTypeName('');
    setNewTypePoints('');
    fetchTasks();
  };

  const renderTask = ({ item }: { item: TaskWithDetails }) => {
    const isCompleted = item.status === 'completed';
    return (
      <TouchableOpacity
        style={[styles.taskItem, isCompleted && styles.taskItemDone]}
        onPress={() => openCompleteModal(item)}
        onLongPress={() => handleDeleteTask(item)}
        disabled={false}
        activeOpacity={0.7}
      >
        <View style={[styles.taskCheck, isCompleted && styles.taskCheckDone]}>
          {isCompleted && <Check size={14} color="#FFF" strokeWidth={3} />}
        </View>
        <View style={styles.taskInfo}>
          <Text style={[styles.taskName, isCompleted && styles.taskNameDone]} numberOfLines={2}>
            {item.task_types?.name ?? 'Tarea'}
          </Text>
          <Text style={styles.taskMeta} numberOfLines={1}>
            {item.task_types?.default_points ?? 0} pts
            {item.notes ? ` · ${item.notes}` : ''}
            {item.target_date ? ` · ${item.target_date}` : ''}
          </Text>
          {isCompleted && item.completer?.name && (
            <Text style={styles.taskCompleter}>Completado por: {item.completer.name}</Text>
          )}
        </View>
        {isCompleted && <CheckCircle size={20} color={theme.colors.success} />}
      </TouchableOpacity>
    );
  };

  const profileColor = theme.colors.primary;

  const handleDeleteTask = (task: TaskWithDetails) => {
    setPendingDeleteTask(task);
  };

  const confirmDeleteTask = async () => {
    if (!pendingDeleteTask) return;
    const { error } = await supabase.from('tasks').delete().eq('id', pendingDeleteTask.id);
    setPendingDeleteTask(null);
    if (!error) fetchTasks();
  };

  const FILTERS: { key: 'all' | 'pending' | 'completed'; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'completed', label: 'Completadas' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tareas</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: profileColor }]} onPress={() => setIsModalVisible(true)}>
          <Plus size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {FILTERS.map(f => {
          const count = f.key === 'all' ? tasks.length : tasks.filter(t => t.status === f.key).length;
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && { backgroundColor: profileColor, borderColor: profileColor }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
              <Text style={[styles.filterCount, active && styles.filterCountActive]}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats bar */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          {tasks.filter(t => t.status === 'pending').length} pendientes · {tasks.filter(t => t.status === 'completed').length} completadas
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.id}
        renderItem={renderTask}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <CheckCircle size={56} color="rgba(139,69,19,0.2)" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'Sin tareas aún' : `Sin tareas ${filter === 'pending' ? 'pendientes' : 'completadas'}`}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'all' ? 'Tocá + para agregar una nueva tarea' : 'Cambiá el filtro para ver otras tareas'}
            </Text>
          </View>
        }
      />

      {/* Modal de nueva tarea */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Tarea</Text>
              <TouchableOpacity onPress={() => {
                setIsModalVisible(false);
                setIsCreatingNewType(false);
                setNewTypeName('');
                setNewTypePoints('');
              }} style={styles.closeBtn}>
                <X size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Tipo de tarea</Text>
              {isCreatingNewType ? (
                <View style={styles.newTypeContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre (ej: Barrer patio)"
                    placeholderTextColor="rgba(139,69,19,0.35)"
                    value={newTypeName}
                    onChangeText={setNewTypeName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Puntaje (ej: 10)"
                    placeholderTextColor="rgba(139,69,19,0.35)"
                    value={newTypePoints}
                    onChangeText={setNewTypePoints}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.cancelNewBtn} onPress={() => setIsCreatingNewType(false)}>
                    <Text style={styles.cancelNewBtnText}>Cancelar nueva tarea</Text>
                  </TouchableOpacity>
                </View>
              ) : taskTypes.length === 0 ? (
                <View>
                  <Text style={styles.noTypesText}>No hay tipos de tarea.</Text>
                  <TouchableOpacity style={[styles.typeChip, { alignSelf: 'flex-start', marginBottom: 20 }]} onPress={() => setIsCreatingNewType(true)}>
                    <Text style={styles.typeText}>Crear la primera</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.typeGrid}>
                  {taskTypes.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeChip, selectedTypeId === t.id && styles.typeChipActive]}
                      onPress={() => setSelectedTypeId(t.id)}
                    >
                      <Text
                        style={[styles.typeText, selectedTypeId === t.id && styles.typeTextActive]}
                        numberOfLines={1}
                      >
                        {t.name}
                      </Text>
                      <Text style={[styles.typePoints, selectedTypeId === t.id && styles.typePointsActive]}>
                        {t.default_points} pts
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.typeChip, { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center' }]}
                    onPress={() => { setIsCreatingNewType(true); setSelectedTypeId(''); }}
                  >
                    <Plus size={16} color={theme.colors.primary} />
                    <Text style={{ ...styles.typeText, color: theme.colors.primary, marginLeft: 6 }}>Nueva categoría</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isCreatingNewType && (
                <TouchableOpacity style={styles.syncBtn} onPress={syncDefaultTasks}>
                  <Text style={styles.syncBtnText}>🔄 Restaurar tareas por defecto</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Nota (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Limpiar a fondo..."
                placeholderTextColor="rgba(139,69,19,0.35)"
                value={notes}
                onChangeText={setNotes}
              />

              {(()=>{
                const canSave = isCreatingNewType 
                  ? (newTypeName.trim().length > 0 && newTypePoints.trim().length > 0) 
                  : !!selectedTypeId;

                return (
                  <TouchableOpacity
                    style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                    onPress={handleCreateTask}
                    disabled={!canSave}
                  >
                    <Text style={styles.saveBtnText}>Guardar Tarea</Text>
                  </TouchableOpacity>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Confirmar Quién la hizo */}
      <Modal visible={!!taskToComplete} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>¿Quién realizó la tarea?</Text>
            <Text style={styles.confirmSub}>{taskToComplete?.task_types?.name}</Text>

            <View style={styles.confirmBtns}>
              {profiles.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.assignBtn}
                  onPress={() => handleConfirmComplete(p.id)}
                >
                  <Text style={styles.assignBtnText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.assignBtnBoth}
                onPress={() => handleConfirmComplete('ambos')}
              >
                <Text style={styles.assignBtnBothText}>Ambos</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setTaskToComplete(null)}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Confirmar Eliminar Tarea */}
      <Modal visible={!!pendingDeleteTask} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Eliminar tarea</Text>
            <Text style={styles.confirmSub}>¿Eliminar "{pendingDeleteTask?.task_types?.name}"?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPendingDeleteTask(null)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.assignBtnBoth, { backgroundColor: '#EF4444' }]} onPress={confirmDeleteTask}>
                <Text style={styles.assignBtnBothText}>Eliminar</Text>
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
  filters: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  filterChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(139,69,19,0.12)',
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  filterTextActive: { color: '#FFF' },
  filterBadge: {},
  filterBadgeActive: {},
  filterCount: { fontSize: 22, color: theme.colors.textSecondary, fontWeight: '900', lineHeight: 28, marginTop: 2 },
  filterCountActive: { color: '#FFF' },
  stats: { paddingHorizontal: 20, paddingBottom: 8 },
  statsText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  list: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  taskItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    marginHorizontal: 4,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  taskItemDone: { opacity: 0.5, backgroundColor: 'rgba(139,69,19,0.03)' },
  taskCheck: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2,
    borderColor: 'rgba(139,69,19,0.3)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  taskCheckDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 16, fontWeight: '600', color: theme.colors.text, lineHeight: 22 },
  taskNameDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  taskMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  taskCompleter: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(139,69,19,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 10, marginTop: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(139,69,19,0.15)', backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  typeText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  typeTextActive: { color: '#FFF' },
  typePoints: { fontSize: 11, fontWeight: '500', color: theme.colors.textSecondary, marginTop: 2 },
  typePointsActive: { color: 'rgba(255,255,255,0.75)' },
  noTypesText: {
    fontSize: 14, color: theme.colors.textSecondary, fontStyle: 'italic',
    marginBottom: 20, lineHeight: 20,
  },
  input: {
    borderWidth: 1.5, borderColor: 'rgba(139,69,19,0.15)', borderRadius: 12,
    padding: 14, fontSize: 14, color: theme.colors.text,
    backgroundColor: theme.colors.background, marginBottom: 20,
  },
  newTypeContainer: { marginBottom: 10 },
  cancelNewBtn: { alignItems: 'center', marginTop: -10, marginBottom: 20 },
  cancelNewBtnText: { color: theme.colors.primary, fontWeight: '600', fontSize: 13 },
  syncBtn: {
    backgroundColor: 'rgba(139,69,19,0.03)', paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)'
  },
  syncBtnText: {
    color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13
  },
  saveBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmModal: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  confirmSub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4, marginBottom: 24, textAlign: 'center' },
  confirmBtns: { width: '100%', gap: 10, marginBottom: 16 },
  assignBtn: { backgroundColor: 'rgba(139,69,19,0.08)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  assignBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  assignBtnBoth: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  assignBtnBothText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
});
