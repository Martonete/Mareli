export const theme = {
  colors: {
    primary: '#8B4513', // Brown
    primaryLight: '#A0522D', 
    primaryDark: '#5D4037', 
    secondary: '#D2B48C', // Tan
    background: '#F5F5DC', // Beige / Light
    surface: '#FFFFFF',
    text: '#211811', // Dark Brown
    textSecondary: 'rgba(33, 24, 17, 0.6)', 
    border: 'rgba(139, 69, 19, 0.15)', // Primary with opacity
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    elizabeth: '#C2410C', // Rust
    martin: '#1D4ED8', // Deep Blue
  },
  spacing: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
  },
  borderRadius: {
    sm: 8, md: 16, lg: 24, xl: 32, full: 9999,
  },
  typography: {
    h1: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -1 },
    h2: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
    h3: { fontSize: 20, fontWeight: '600' as const },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    caption: { fontSize: 14, fontWeight: '500' as const },
    small: { fontSize: 12, fontWeight: '400' as const },
  },
  shadows: {
    floating: {
      shadowColor: '#8B4513',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 15,
      elevation: 10,
    },
    card: {
      shadowColor: '#211811',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }
  }
};
