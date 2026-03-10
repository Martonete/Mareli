import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../src/store/useProfileStore';
import { theme } from '../src/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Profile } from '../src/types/database.types';

// Mocked profiles based on MVP requirements
const PROFILES: Profile[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Liz', created_at: new Date().toISOString() },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Martin', created_at: new Date().toISOString() },
];

const EMOJI_STORAGE_KEY = '@casa_en_orden_emojis';
const DEFAULT_EMOJIS: Record<string, string> = { Liz: '👩', Martin: '👨' };

export default function ProfileSelectScreen() {
  const { setActiveProfile } = useProfileStore();
  const [emojis, setEmojis] = useState(DEFAULT_EMOJIS);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [draftEmoji, setDraftEmoji] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(EMOJI_STORAGE_KEY).then(stored => {
      if (stored) setEmojis({ ...DEFAULT_EMOJIS, ...JSON.parse(stored) });
    });
  }, []);

  const openEdit = (name: string) => {
    setDraftEmoji(emojis[name] ?? DEFAULT_EMOJIS[name]);
    setEditingProfile(name);
  };

  const saveEmoji = async () => {
    if (!editingProfile || !draftEmoji.trim()) return;
    const updated = { ...emojis, [editingProfile]: draftEmoji.trim() };
    setEmojis(updated);
    await AsyncStorage.setItem(EMOJI_STORAGE_KEY, JSON.stringify(updated));
    setEditingProfile(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>🏠</Text>
        </View>
        <Text style={styles.title}>Casa en Orden</Text>
        <Text style={styles.subtitle}>¿Quién sos hoy?</Text>
      </View>

      <View style={styles.profilesContainer}>
        {PROFILES.map((profile) => {
          const color = profile.name === 'Liz' ? theme.colors.elizabeth : theme.colors.martin;
          const emoji = emojis[profile.name] ?? DEFAULT_EMOJIS[profile.name];
          return (
            <TouchableOpacity
              key={profile.id}
              style={[styles.profileCard, { backgroundColor: color }]}
              onPress={() => setActiveProfile(profile)}
              activeOpacity={0.88}
            >
              <TouchableOpacity style={styles.avatarPlaceholder} onPress={() => openEdit(profile.name)} activeOpacity={0.7}>
                <Text style={styles.avatarEmoji}>{emoji}</Text>
                <Text style={styles.editHint}>✏️</Text>
              </TouchableOpacity>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileHint}>Tocar para entrar</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.footer}>Solo para Liz y Martín 💑</Text>

      <Modal visible={editingProfile !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.emojiModal}>
            <Text style={styles.emojiModalTitle}>Cambiar emoji de {editingProfile}</Text>
            <TextInput
              style={styles.emojiInput}
              value={draftEmoji}
              onChangeText={setDraftEmoji}
              placeholder="Pegá o escribí un emoji"
              placeholderTextColor="rgba(139,69,19,0.4)"
              autoFocus
              maxLength={8}
            />
            <View style={styles.emojiModalBtns}>
              <TouchableOpacity style={styles.emojiCancelBtn} onPress={() => setEditingProfile(null)}>
                <Text style={styles.emojiCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emojiSaveBtn} onPress={saveEmoji}>
                <Text style={styles.emojiSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  avatarEmoji: {
    fontSize: 36,
  },
  profileName: {
    ...theme.typography.h3,
    color: '#FFF',
    fontWeight: '700',
  },
  profileHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontWeight: '500',
  },
  footer: {
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  editHint: { fontSize: 12, position: 'absolute', bottom: 2, right: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emojiModal: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%' },
  emojiModalTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 16, textAlign: 'center' },
  emojiInput: {
    borderWidth: 1.5, borderColor: 'rgba(139,69,19,0.2)', borderRadius: 12,
    padding: 14, fontSize: 28, textAlign: 'center', color: theme.colors.text,
    backgroundColor: theme.colors.background, marginBottom: 20,
  },
  emojiModalBtns: { flexDirection: 'row', gap: 12 },
  emojiCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139,69,19,0.15)', alignItems: 'center' },
  emojiCancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  emojiSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center' },
  emojiSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
