import { Tabs } from 'expo-router';
import { Home, ListTodo, Trophy, ShoppingCart, Calendar, Dog, Settings } from 'lucide-react-native';
import { theme } from '../../src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const tabColor = theme.colors.primary;
  const insets = useSafeAreaInsets();

  // The tab bar height includes the bottom safe area inset (handles Android gesture bar / 3-button nav)
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tabColor,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FEFCF7',
          borderTopWidth: 1,
          borderTopColor: 'rgba(139,69,19,0.1)',
          shadowColor: '#8B4513',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 8,
          height: tabBarHeight,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...theme.typography.small,
          fontSize: 10,
          marginTop: 2,
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tareas', tabBarIcon: ({ color, size }) => <ListTodo color={color} size={size} /> }} />
      <Tabs.Screen name="points" options={{ title: 'Puntos', tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }} />
      <Tabs.Screen name="shopping" options={{ title: 'Compras', tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} /> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendario', tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
      <Tabs.Screen name="tony" options={{ title: 'Tony', tabBarIcon: ({ color, size }) => <Dog color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Config', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
