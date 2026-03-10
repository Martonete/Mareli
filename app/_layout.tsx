import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useProfileStore } from '../src/store/useProfileStore';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '../src/constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerForPushNotificationsAsync } from '../src/lib/notifications';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const { activeProfile, isLoading, loadProfile } = useProfileStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadProfile().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!activeProfile) return;
    (async () => {
      // Sync local profile name to DB (ensures 'Liz' matches DB, not 'Elizabeth')
      const updates: Record<string, any> = { name: activeProfile.name };
      const token = await registerForPushNotificationsAsync();
      if (token) updates.push_token = token;
      await supabase.from('profiles').update(updates).eq('id', activeProfile.id);
    })();
  }, [activeProfile?.id]);

  useEffect(() => {
    if (!isReady) return;

    const inTabsGroup = segments[0] === '(tabs)';

    if (!activeProfile && inTabsGroup) {
      router.replace('/profile-select');
    } else if (activeProfile && segments[0] === 'profile-select') {
      router.replace('/(tabs)');
    } else if (activeProfile && !inTabsGroup && segments.length < 1) {
      router.replace('/(tabs)');
    }
  }, [activeProfile, segments, isReady]);

  if (!isReady || isLoading) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
          }}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}