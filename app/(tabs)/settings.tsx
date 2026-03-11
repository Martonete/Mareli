import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { LogOut, ChevronRight, Bell, Shield, Info, RotateCcw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { activeProfile, clearProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showNewWeek, setShowNewWeek] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await clearProfile();
    router.replace('/profile-select');
  };

  const confirmNewWeek = async () => {
    setResetting(true);
    try {
      await Promise.all([
        supabase.from('tasks').delete().neq('id', ''),
        supabase.from('reward_redemptions').delete().neq('id', ''),
        supabase.from('shopping_items').delete().neq('id', ''),
      ]);
      alert('¡Nueva semana iniciada! Todo fue reiniciado a 0.');
    } catch (err: any) {
      alert('Error al reiniciar: ' + err.message);
    }
    setResetting(false);
    setShowNewWeek(false);
  };

  const profileColor = theme.colors.primary;

  const menuItems = [
    { icon: Bell, label: 'Notificaciones', sub: 'Se envían automáticamente al otro perfil', onPress: () => {} },
    { icon: Shield, label: 'Privacidad', sub: 'Solo Liz y Martín tienen acceso', onPress: () => {} },
    {
      icon: Info, label: 'Acerca de', sub: 'Versión 1.0.0', onPress: () => {
        alert('Casa en Orden v1.0.0\n\nHecha con amor para Liz y Martín.\n\nGestioná tareas, puntos, compras, eventos y los cuidados de Tony desde un solo lugar.');
      }
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Configuración</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={[styles.avatarBg, { backgroundColor: profileColor + '22' }]}>
          <Text style={[styles.avatarLetter, { color: profileColor }]}>
            {activeProfile?.name?.charAt(0) ?? '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{activeProfile?.name ?? 'Sin perfil'}</Text>
          <Text style={styles.profileSub}>Perfil activo</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.section}>
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.menuItem, i < menuItems.length - 1 && styles.menuItemBorder]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBg}>
              <item.icon size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSub}>{item.sub}</Text>
            </View>
            <ChevronRight size={16} color="rgba(139,69,19,0.3)" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Nueva semana */}
      <TouchableOpacity style={styles.newWeekBtn} onPress={() => setShowNewWeek(true)} activeOpacity={0.8}>
        <RotateCcw size={18} color="#FFF" />
        <Text style={styles.newWeekText}>Comenzar nueva semana</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={18} color={theme.colors.error} />
        <Text style={styles.logoutText}>Cambiar perfil</Text>
      </TouchableOpacity>

      {/* Modal confirmar nueva semana */}
      <Modal visible={showNewWeek} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Comenzar nueva semana</Text>
            <Text style={styles.confirmSub}>
              Se eliminarán todas las tareas, canjes y artículos de compra. Los puntos volverán a 0 para ambos. ¿Continuar?
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelConfirmBtn} onPress={() => setShowNewWeek(false)}>
                <Text style={styles.cancelConfirmText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteConfirmBtn, resetting && { opacity: 0.5 }]} onPress={confirmNewWeek} disabled={resetting}>
                <Text style={styles.deleteConfirmText}>{resetting ? 'Reiniciando...' : 'Reiniciar todo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal confirmar cambio de perfil */}
      <Modal visible={showLogoutConfirm} animationType="fade" transparent>
        <View style={styles.overlayCenter}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Cambiar perfil</Text>
            <Text style={styles.confirmSub}>¿Querés cambiar de perfil?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelConfirmBtn} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.cancelConfirmText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmLogout}>
                <Text style={styles.deleteConfirmText}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.5, marginBottom: 20 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    marginBottom: 24,
  },
  avatarBg: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(139,69,19,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '800', color: theme.colors.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  profileSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '500' },
  section: {
    backgroundColor: '#FFF', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(139,69,19,0.1)',
    shadowColor: '#8B4513', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
    marginBottom: 24, overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(139,69,19,0.07)' },
  menuIconBg: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(139,69,19,0.08)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  menuSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '400' },
  newWeekBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 12,
    shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  newWeekText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: theme.colors.error,
    borderRadius: 14, paddingVertical: 14,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: theme.colors.error },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmModal: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  confirmSub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4, marginBottom: 24, textAlign: 'center' },
  confirmBtns: { width: '100%', gap: 10 },
  cancelConfirmBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(139,69,19,0.08)' },
  cancelConfirmText: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  deleteConfirmBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#EF4444' },
  deleteConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
