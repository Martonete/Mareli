import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import Svg, { Circle } from 'react-native-svg';
import { Gift, Star, Sparkles } from 'lucide-react-native';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileStore } from '../../src/store/useProfileStore';

export default function PointsScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState({ Liz: 0, Martin: 0 });
  const [rewards, setRewards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    // 1. Tareas completadas (histórico de ganancias)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('points_awarded, profiles!tasks_completed_by_profile_id_fkey(name)')
      .eq('status', 'completed');

    // 2. Historial de canjes (histórico de gastos)
    const { data: spends } = await supabase
      .from('reward_redemptions')
      .select('points_cost, profiles(name), rewards(name), created_at')
      .order('created_at', { ascending: false });

    // 3. Catálogo de recompensas
    const { data: items } = await supabase
      .from('rewards')
      .select('*')
      .order('points_cost', { ascending: true });

    let eliEarned = 0, marEarned = 0;
    if (tasks) {
      tasks.forEach((t: any) => {
        if (t.profiles?.name === 'Liz') eliEarned += (t.points_awarded || 0);
        if (t.profiles?.name === 'Martin') marEarned += (t.points_awarded || 0);
      });
    }

    let eliSpent = 0, marSpent = 0;
    if (spends) {
      spends.forEach((s: any) => {
        if (s.profiles?.name === 'Liz') eliSpent += (s.points_cost || 0);
        if (s.profiles?.name === 'Martin') marSpent += (s.points_cost || 0);
      });
      setRedemptions(spends.slice(0, 5)); // Últimos 5 canjes
    }

    setBalances({
      Liz: eliEarned - eliSpent,
      Martin: marEarned - marSpent
    });

    if (items && items.length > 0) {
      setRewards(items);
    } else {
      // Fallback en caso de que aún no se haya creado la tabla en Supabase
      setRewards([
        { id: 'mock-1', name: 'Elegir la película/serie', points_cost: 20 },
        { id: 'mock-2', name: 'Merienda', points_cost: 25 },
        { id: 'mock-3', name: 'Desayuno en la cama', points_cost: 35 },
        { id: 'mock-4', name: 'Postre sorpresa', points_cost: 35 },
        { id: 'mock-5', name: 'Elegís la música todo el día', points_cost: 30 },
        { id: 'mock-6', name: 'Paseo sorpresa', points_cost: 50 },
        { id: 'mock-7', name: 'Noche de cine', points_cost: 60 },
        { id: 'mock-8', name: 'Noche de bar / tragos', points_cost: 80 },
        { id: 'mock-9', name: 'Masajes', points_cost: 90 },
        { id: 'mock-10', name: 'Oral', points_cost: 110 },
        { id: 'mock-11', name: 'Soy tu esclavo/a', points_cost: 160 }
      ]);
    }
  }, []);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };
  
  useFocusEffect(
    useCallback(() => {
      fetchData();

      const channel = supabase.channel('points_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => fetchData())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }, [fetchData])
  );

  const syncRewards = async () => {
    const defaultRewards = [
      { name: 'Elegir la película/serie', points_cost: 20 },
      { name: 'Merienda', points_cost: 25 },
      { name: 'Desayuno en la cama', points_cost: 35 },
      { name: 'Postre sorpresa', points_cost: 35 },
      { name: 'Elegís la música todo el día', points_cost: 30 },
      { name: 'Paseo sorpresa', points_cost: 50 },
      { name: 'Noche de cine', points_cost: 60 },
      { name: 'Noche de bar / tragos', points_cost: 80 },
      { name: 'Masajes', points_cost: 90 },
      { name: 'Oral', points_cost: 110 },
      { name: 'Soy tu esclavo/a', points_cost: 160 }
    ];

    try {
      // 1. Obtener existentes para no duplicar
      const { data: existing } = await supabase.from('rewards').select('name');
      const existingNames = existing?.map((e: any) => e.name) || [];
      const toInsert = defaultRewards.filter(r => !existingNames.includes(r.name));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('rewards').insert(toInsert);
        if (error) throw error;
      }
      
      Alert.alert('¡Tienda actualizada!', 'Los nuevos premios se agregaron correctamente.');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleRedeem = async (reward: any) => {
    if (!activeProfile) return;
    const myBalance = activeProfile.name === 'Liz' ? balances.Liz : balances.Martin;

    if (myBalance < reward.points_cost) {
      Alert.alert('Puntos insuficientes', 'Necesitás seguir completando tareas para alcanzar este premio.');
      return;
    }

    // Si el reward viene del fallback mock, resolver su ID real en Supabase primero
    let rewardId = reward.id;
    if (typeof rewardId === 'string' && rewardId.startsWith('mock-')) {
      const { data: existing } = await supabase.from('rewards').select('id').eq('name', reward.name).single();
      if (existing) {
        rewardId = existing.id;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('rewards')
          .insert({ name: reward.name, points_cost: reward.points_cost })
          .select()
          .single();
        if (insertErr || !inserted) {
          Alert.alert('Error', 'No se pudo procesar el canje. Intentá sincronizar los premios primero.');
          return;
        }
        rewardId = inserted.id;
      }
    }

    Alert.alert(
      'Confirmar canje',
      `¿Querés gastar ${reward.points_cost} puntos en "${reward.name}"?\n\nTe quedarán ${myBalance - reward.points_cost} puntos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '¡Canjear! 🎉',
          style: 'default',
          onPress: async () => {
            const { error } = await supabase.from('reward_redemptions').insert({
              profile_id: activeProfile.id,
              reward_id: rewardId,
              points_cost: reward.points_cost,
            });
            if (error) {
              Alert.alert('Error', 'No se pudo procesar el canje: ' + error.message);
            } else {
              Alert.alert('¡Canje exitoso! 🎊', `Coordiná con ${activeProfile.name === 'Liz' ? 'Martín' : 'Liz'} para hacer realidad tu premio 😉`);
              fetchData();
            }
          }
        }
      ]
    );
  };

  const myBalance = activeProfile?.name === 'Liz' ? balances.Liz : balances.Martin;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 80 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Mis Puntos */}
      <View style={styles.header}>
        <View style={styles.balanceRingWrapper}>
          <Svg width={184} height={184} style={styles.balanceRingSvg}>
            <Circle cx={92} cy={92} r={88} stroke="rgba(255,255,255,0.18)" strokeWidth={8} fill="none" />
            <Circle
              cx={92} cy={92} r={88}
              stroke="rgba(255,255,255,0.9)" strokeWidth={8} fill="none"
              strokeDasharray={2 * Math.PI * 88}
              strokeDashoffset={2 * Math.PI * 88 * (1 - Math.min(myBalance / Math.max(myBalance + (activeProfile?.name === 'Liz' ? balances.Martin : balances.Liz), 1), 1))}
              strokeLinecap="round"
              transform="rotate(-90 92 92)"
            />
          </Svg>
          <View style={styles.balanceCircle}>
            <Text style={styles.balanceLabel}>Tu Saldo</Text>
            <Text style={styles.balanceAmount}>{myBalance}</Text>
            <Text style={styles.balancePts}>puntos</Text>
          </View>
        </View>
      </View>

      {/* Pareja */}
      <View style={styles.partnerCard}>
        <Text style={styles.partnerTitle}>Saldo familiar</Text>
        <View style={styles.partnerRow}>
          <View style={styles.partnerCol}>
            <Text style={styles.partnerName}>Liz</Text>
            <Text style={[styles.partnerPts, { color: '#F472B6' }]}>{balances.Liz} pts</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.partnerCol}>
            <Text style={styles.partnerName}>Martin</Text>
            <Text style={[styles.partnerPts, { color: '#60A5FA' }]}>{balances.Martin} pts</Text>
          </View>
        </View>
      </View>

      {/* Rewards Catalog */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Gift size={20} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Tienda de Premios</Text>
        </View>

        <TouchableOpacity style={styles.syncBtn} onPress={syncRewards}>
          <Text style={styles.syncBtnText}>🔄 Sincronizar premios predeterminados</Text>
        </TouchableOpacity>
        
        {rewards.map((r, i) => {
          const canAfford = myBalance >= r.points_cost;
          return (
            <View key={r.id} style={[styles.rewardCard, !canAfford && styles.rewardCardDisabled]}>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardName}>{r.name}</Text>
                <View style={styles.costBadge}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.costText}>{r.points_cost} pts</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.redeemBtn, !canAfford && styles.redeemBtnDisabled]} 
                onPress={() => handleRedeem(r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.redeemText, !canAfford && styles.redeemTextDisabled]}>Canjear</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Historial */}
      {redemptions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Canjes recientes</Text>
          </View>
          <View style={styles.historyCard}>
            {redemptions.map((red, i) => {
              const isLiz = red.profiles?.name === 'Liz';
              const nameColor = isLiz ? theme.colors.primary : '#5D4037';
              const timeAgo = red.created_at
                ? formatDistanceToNow(parseISO(red.created_at), { addSuffix: true, locale: es })
                : '';
              return (
                <View key={i} style={[styles.historyItem, i < redemptions.length - 1 && styles.historyItemBorder]}>
                  <View style={[styles.historyDot, { backgroundColor: nameColor }]} />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyText}>
                      <Text style={[styles.historyName, { color: nameColor }]}>{red.profiles?.name}</Text>
                      {' canjeó '}
                      <Text style={styles.historyReward}>🎁 {red.rewards?.name ?? '?'}</Text>
                    </Text>
                    <View style={styles.historyMeta}>
                      <Text style={styles.historyPts}>-{red.points_cost} pts</Text>
                      {timeAgo !== '' && <Text style={styles.historyTime}>{timeAgo}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20 },
  
  header: { alignItems: 'center', marginBottom: 24, marginTop: 16 },
  balanceRingWrapper: { width: 184, height: 184, alignItems: 'center', justifyContent: 'center' },
  balanceRingSvg: { position: 'absolute' },
  balanceCircle: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
    borderWidth: 6, borderColor: 'rgba(255,255,255,0.2)',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginBottom: -4 },
  balanceAmount: { color: '#FFF', fontSize: 64, fontWeight: '900', letterSpacing: -2 },
  balancePts: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600', marginTop: -6 },

  partnerCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.06)',
  },
  partnerTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 12 },
  partnerRow: { flexDirection: 'row', alignItems: 'center' },
  partnerCol: { flex: 1, alignItems: 'center' },
  dividerVertical: { width: 1, height: 30, backgroundColor: 'rgba(139,69,19,0.1)' },
  partnerName: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  partnerPts: { fontSize: 18, fontWeight: '800' },

  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
  
  syncBtn: {
    backgroundColor: 'rgba(139,69,19,0.03)', paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)'
  },
  syncBtnText: {
    color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13
  },

  rewardCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  rewardCardDisabled: { opacity: 0.75, backgroundColor: '#FAFAFA' },
  rewardInfo: { flex: 1, paddingRight: 16 },
  rewardName: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  costBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  costText: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  
  redeemBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  redeemBtnDisabled: { backgroundColor: 'rgba(139,69,19,0.1)' },
  redeemText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  redeemTextDisabled: { color: theme.colors.textSecondary },

  historyCard: {
    backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  historyItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.07)' },
  historyDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  historyInfo: { flex: 1 },
  historyText: { fontSize: 14, color: '#444', lineHeight: 20 },
  historyName: { fontWeight: '700', fontSize: 14 },
  historyReward: { fontStyle: 'italic', fontWeight: '600', fontSize: 14, color: '#7C3AED' },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  historyPts: { fontSize: 12, fontWeight: '700', color: '#E53E3E', backgroundColor: '#FFF5F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  historyTime: { fontSize: 12, color: theme.colors.textSecondary },
});
