import { useState, useCallback } from 'react';
import { supabase } from './supabase';

export type PointsBalances = { [name: string]: number };

/**
 * Hook centralizado para calcular puntos (earned - spent) de todos los perfiles.
 * Evita duplicar la lógica en dashboard y points.
 */
export function usePoints() {
  const [balances, setBalances] = useState<PointsBalances>({});
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: tasks }, { data: spends }] = await Promise.all([
        supabase.from('profiles').select('name'),
        supabase
          .from('tasks')
          .select('points_awarded, profiles!tasks_completed_by_profile_id_fkey(name)')
          .eq('status', 'completed'),
        supabase
          .from('reward_redemptions')
          .select('points_cost, profiles(name)')
          .order('created_at', { ascending: false }),
      ]);

      const earned: PointsBalances = {};
      const spent: PointsBalances = {};

      // Inicializar todos los perfiles con 0
      if (profiles) {
        profiles.forEach((p: any) => {
          if (p.name) { earned[p.name] = 0; spent[p.name] = 0; }
        });
      }

      if (tasks) {
        tasks.forEach((t: any) => {
          const n = t.profiles?.name;
          if (n) earned[n] = (earned[n] || 0) + (t.points_awarded || 0);
        });
      }
      if (spends) {
        spends.forEach((s: any) => {
          const n = s.profiles?.name;
          if (n) spent[n] = (spent[n] || 0) + (s.points_cost || 0);
        });
      }

      const result: PointsBalances = {};
      [...new Set([...Object.keys(earned), ...Object.keys(spent)])].forEach(name => {
        result[name] = (earned[name] || 0) - (spent[name] || 0);
      });

      setBalances(result);
    } finally {
      setLoading(false);
    }

    return balances;
  }, []);

  return { balances, loading, fetchBalances };
}
