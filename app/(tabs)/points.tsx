import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import Svg, { Circle } from 'react-native-svg';
import { Gift, Star, Sparkles, X } from 'lucide-react-native';
import { notifyOtherUser } from '../../src/lib/notifications';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileStore } from '../../src/store/useProfileStore';
import { usePoints } from '../../src/lib/usePoints';
import { DEFAULT_REWARDS } from '../../src/constants/rewards';

export default function PointsScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);
  const [allProfiles, setAllProfiles] = useState<{ id: string, name: string }[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [pendingRedeem, setPendingRedeem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const { balances, fetchBalances } = usePoints();

  const fetchData = useCallback(async () => {
    await fetchBalances();

    const { data: spends } = await supabase
      .from('reward_redemptions')
      .select('points_cost, profiles(name), rewards(name), created_at')
      .order('created_at', { ascending: false });

    const { data: items } = await supabase
      .from('rewards')
      .select('*')
      .order('points_cost', { ascending: true });

    if (spends) setRedemptions(spends.slice(0, 5));

    const { data: profilesData } = await supabase.from('profiles').select('id, name');
    if (profilesData) setAllProfiles(profilesData);

    if (items && items.length > 0) {
      setRewards(items);
    } else {
      setRewards(DEFAULT_REWARDS.map((r, i) => ({ id: `mock-${i + 1}`, ...r })));
    }
  }, [fetchBalances]);

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
    try {
      const { data: existing } = await supabase.from('rewards').select('name');
      const existingNames = existing?.map((e: any) => e.name) || [];
      const toInsert = DEFAULT_REWARDS.filter(r => !existingNames.includes(r.name));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('rewards').insert(toInsert as any[]);
        if (error) throw error;
      }
      alert('Los premios se agregaron correctamente.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRedeem = async (reward: any) => {
    if (!activeProfile) return;
    const myBal = balances[activeProfile.name] ?? 0;

    if (myBal < reward.points_cost) {
      alert('Puntos insuficientes: necesitás seguir completando tareas para alcanzar este premio.');
      return;
    }

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
          alert('No se pudo procesar el canje.');
          return;
        }
        rewardId = inserted.id;
      }
    }

    setPendingRedeem({ ...reward, resolvedId: rewardId });
  };

  const confirmRedeem = async () => {
    if (!activeProfile || !pendingRedeem || saving) return;
    setSaving(true);
    const { error } = await supabase.from('reward_redemptions').insert({
      profile_id: activeProfile.id,
      reward_id: pendingRedeem.resolvedId,
      points_cost: pendingRedeem.points_cost,
    });
    setSaving(false);
    setPendingRedeem(null);
    if (error) {
      alert('No se pudo procesar el canje: ' + error.message);
    } else {
      const partnerName = allProfiles.find(p => p.id !== activeProfile.id)?.name?.split(' ')[0] ?? 'tu pareja';
      alert(`¡Canje exitoso! Coordiná con ${partnerName} para hacer realidad tu premio.`);
      notifyOtherUser(activeProfile.id, '🎁 Premio canjeado', `${activeProfile.name.split(' ')[0]} canjeó "${pendingRedeem.name}" por ${pendingRedeem.points_cost} pts.`);
      fetchData();
    }
  };

  const myBalance = balances[activeProfile?.name ?? ''] ?? 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.balanceRingWrapper}>
            <Svg width={184} height={184} style={styles.balanceRingSvg}>
              <Circle cx={92} cy={92} r={88} stroke="rgba(255,255,255,0.18)" strokeWidth={8} fill="none" />
              <Circle
                cx={92} cy={92} r={88}
                stroke="rgba(255,255,255,0.9)" strokeWidth={8} fill="none"
                strokeDasharray={2 * Math.PI * 88}
                strokeDashoffset={2 * Math.PI * 88 * (1 - Math.min(myBalance / Math.max(myBalance + (Object.entries(balances).find(([n]) => n !== activeProfile?.name)?.[1] ?? 0), 1), 1))}
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

        <View style={styles.partnerCard}>
          <Text style={styles.partnerTitle}>Saldo familiar</Text>
          <View style={styles.partnerRow}>
            {allProfiles.map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 && <View style={styles.dividerVertical} />}
                <View style={styles.partnerCol}>
                  <Text style={styles.partnerName}>{p.name.split(' ')[0]}</Text>
                  <Text style={[styles.partnerPts, { color: i === 0 ? '#F472B6' : '#60A5FA' }]}>{balances[p.name] ?? 0} pts</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Gift size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Tienda de Premios</Text>
          </View>

          <TouchableOpacity style={styles.syncBtn} onPress={syncRewards}>
            <Text style={styles.syncBtnText}>🔄 Sincronizar premios predeterminados</Text>
          </TouchableOpacity>

          {rewards.map((r) => {
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

        {redemptions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Sparkles size={18} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Canjes recientes</Text>
            </View>
            <View style={styles.historyCard}>
              {redemptions.map((red, i) => {
                const nameColor = red.profiles?.name === allProfiles[0]?.name ? theme.colors.primary : '#5D4037';
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

      <Modal visible={!!pendingRedeem} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <TouchableOpacity style={styles.confirmClose} onPress={() => setPendingRedeem(null)}>
              <X size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.confirmEmoji}>🎁</Text>
            <Text style={styles.confirmTitle}>Confirmar canje</Text>
            <Text style={styles.confirmRewardName}>{pendingRedeem?.name}</Text>
            <Text style={styles.confirmCost}>
              Gastás <Text style={{ fontWeight: '800', color: theme.colors.primary }}>{pendingRedeem?.points_cost} pts</Text>
            </Text>
            <Text style={styles.confirmRemaining}>
              Te quedarán {myBalance - (pendingRedeem?.points_cost ?? 0)} puntos
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPendingRedeem(null)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, saving && { opacity: 0.5 }]} onPress={confirmRedeem} disabled={saving}>
                <Text style={styles.confirmBtnText}>{saving ? 'Canjeando...' : '¡Canjear! 🎉'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 16 },
  balanceRingWrapper: { width: 184, height: 184, alignItems: 'center', justifyContent: 'center' },
  balanceRingSvg: { position: 'absolute' },
  balanceCircle: { width: 160, height: 160, borderRadius: 80, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, borderWidth: 6, borderColor: 'rgba(255,255,255,0.2)' },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginBottom: -4 },
  balanceAmount: { color: '#FFF', fontSize: 64, fontWeight: '900', letterSpacing: -2 },
  balancePts: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600', marginTop: -6 },
  partnerCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: 'rgba(139,69,19,0.06)' },
  partnerTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 12 },
  partnerRow: { flexDirection: 'row', alignItems: 'center' },
  partnerCol: { flex: 1, alignItems: 'center' },
  dividerVertical: { width: 1, height: 30, backgroundColor: 'rgba(139,69,19,0.1)' },
  partnerName: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  partnerPts: { fontSize: 18, fontWeight: '800' },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
  syncBtn: { backgroundColor: 'rgba(139,69,19,0.03)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)' },
  syncBtnText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
  rewardCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  rewardCardDisabled: { opacity: 0.75, backgroundColor: '#FAFAFA' },
  rewardInfo: { flex: 1, paddingRight: 16 },
  rewardName: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  costBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  costText: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  redeemBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  redeemBtnDisabled: { backgroundColor: 'rgba(139,69,19,0.1)' },
  redeemText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  redeemTextDisabled: { color: theme.colors.textSecondary },
  historyCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(139,69,19,0.06)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
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
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmModal: { backgroundColor: '#FFF', borderRadius: 24, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  confirmClose: { position: 'absolute', top: 16, right: 16, padding: 4 },
  confirmEmoji: { fontSize: 40, marginBottom: 8 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  confirmRewardName: { fontSize: 16, fontWeight: '600', color: theme.colors.primary, textAlign: 'center', marginBottom: 16 },
  confirmCost: { fontSize: 15, color: theme.colors.text, marginBottom: 4 },
  confirmRemaining: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 24 },
  confirmBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(139,69,19,0.08)' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  confirmBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
