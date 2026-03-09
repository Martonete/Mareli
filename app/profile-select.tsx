import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useProfileStore } from '../src/store/useProfileStore';
import { theme } from '../src/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Profile } from '../src/types/database.types';

// Mocked profiles based on MVP requirements
const PROFILES: Profile[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Liz', created_at: new Date().toISOString() },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Martin', created_at: new Date().toISOString() },
];

export default function ProfileSelectScreen() {
  const { setActiveProfile } = useProfileStore();

  const handleSelectProfile = (profile: Profile) => {
    setActiveProfile(profile);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>✨</Text>
        </View>
        <Text style={styles.title}>Casa en Orden</Text>
        <Text style={styles.subtitle}>Selecciona quién eres para continuar</Text>
      </View>

      <View style={styles.profilesContainer}>
        {PROFILES.map((profile) => (
          <TouchableOpacity
            key={profile.id}
            style={[
              styles.profileCard,
              { backgroundColor: profile.name === 'Liz' ? theme.colors.elizabeth : theme.colors.martin }
            ]}
            onPress={() => handleSelectProfile(profile)}
            activeOpacity={0.9}
          >
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
            </View>
            <Text style={styles.profileName}>{profile.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  logoIcon: {
    fontSize: 32,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  profilesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  profileCard: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 180,
    ...theme.shadows.floating,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
  },
  profileName: {
    ...theme.typography.h3,
    color: '#FFF',
    fontWeight: '700',
  },
});
