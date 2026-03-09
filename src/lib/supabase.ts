import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// ⚠️ IMPORTANTE: Reemplaza estos valores con los de tu proyecto Supabase
// Los encontrás en: https://supabase.com/dashboard -> tu proyecto -> Settings -> API
const SUPABASE_URL = 'https://gkhjaitakhujkfhtzwxj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdraGphaXRha2h1amtmaHR6d3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDM5MzcsImV4cCI6MjA4ODU3OTkzN30.jVzxNzrVOeaw1KLaRHPLOzgzBY-9SMGp-qAnoUt1M_E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Manejar cambios de estado de la app para refrescar tokens
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
