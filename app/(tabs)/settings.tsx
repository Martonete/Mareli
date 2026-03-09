import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useProfileStore } from '../../src/store/useProfileStore';
import { theme } from '../../src/constants/theme';
import { LogOut, User, ChevronRight, Bell, Shield, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { activeProfile, clearProfile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Cambiar perfil',
      '¿Querés cambiar de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await clearProfile();
            router.replace('/profile-select');
          }
        }
      ]
    );
  };

  const menuItems = [
    { icon: Bell, label: 'Notificaciones', sub: 'Configurar alertas', onPress: () => {} },
    { icon: Shield, label: 'Privacidad', sub: 'Gestionar privacidad', onPress: () => {} },
    { icon: Info, label: 'Acerca de', sub: 'Versión 1.0.0', onPress: () => {} },
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
        <View style={styles.avatarBg}>
          <Text style={styles.avatarLetter}>
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

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={18} color={theme.colors.error} />
        <Text style={styles.logoutText}>Cambiar perfil</Text>
      </TouchableOpacity>
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
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: theme.colors.error,
    borderRadius: 14, paddingVertical: 14,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: theme.colors.error },
});
