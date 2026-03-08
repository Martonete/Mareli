-- ==============================================================================
-- CASA EN ORDEN - ESQUEMA SQL
-- ==============================================================================

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN ('Elizabeth', 'Martin')),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Habilitar RLS (Row Level Security) (Opcional en MVP, abierto para facilitar auth local)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.profiles FOR ALL USING (true);

-- 2. Task Types (Base Configurable)
CREATE TABLE IF NOT EXISTS public.task_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  default_points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.task_types FOR ALL USING (true);


-- 3. Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type_id uuid NOT NULL REFERENCES public.task_types(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  target_date date NOT NULL,
  target_time time without time zone,
  notes text,
  
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  -- Campos cuando se completa la tarea
  completed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  points_awarded integer,
  completed_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.tasks FOR ALL USING (true);


-- 4. Weekly Points (Calculado/Vista Materializada o manejado via logs. Aquí damos una vista)
-- Fuente de verdad son las TAREAS (tasks).
CREATE OR REPLACE VIEW public.weekly_points_view AS
SELECT
  p.id as profile_id,
  p.name as profile_name,
  date_trunc('week', t.completed_at) as week_start,
  SUM(t.points_awarded) as total_points
FROM public.profiles p
LEFT JOIN public.tasks t ON t.completed_by_profile_id = p.id AND t.status = 'completed'
GROUP BY p.id, p.name, date_trunc('week', t.completed_at);


-- 5. Weekly Rewards
CREATE TABLE IF NOT EXISTS public.weekly_rewards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date date NOT NULL,
  winner_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reward_name text NOT NULL,
  is_redeemed boolean DEFAULT false NOT NULL,
  redeemed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(week_start_date) -- Solo un premio/registro por semana
);
ALTER TABLE public.weekly_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.weekly_rewards FOR ALL USING (true);


-- 6. Shopping Items
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  resolved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone
);
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.shopping_items FOR ALL USING (true);


-- 7. Notes
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.notes FOR ALL USING (true);


-- 8. Calendar Events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  event_date date NOT NULL,
  event_time time without time zone,
  description text,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.calendar_events FOR ALL USING (true);


-- 9. Tony Reminders
CREATE TABLE IF NOT EXISTS public.tony_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('comida', 'paseo', 'veterinario', 'baño', 'vacuna', 'remedio')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  reminder_date date NOT NULL,
  reminder_time time without time zone,
  
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  completed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone
);
ALTER TABLE public.tony_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.tony_reminders FOR ALL USING (true);


-- 10. Household Settings
CREATE TABLE IF NOT EXISTS public.household_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for everyone" ON public.household_settings FOR ALL USING (true);


-- ==============================================================================
-- SEEDS INICIALES
-- ==============================================================================

-- Profiles
INSERT INTO public.profiles (id, name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Elizabeth'),
  ('00000000-0000-0000-0000-000000000002', 'Martin')
ON CONFLICT (name) DO NOTHING;

-- Task Types (Lista predefinida requerida)
INSERT INTO public.task_types (name, default_points) VALUES 
  ('Compras', 5),
  ('Limpieza baño', 15),
  ('Lavar platos', 10),
  ('Cocinar', 15),
  ('Ordenar habitación', 10),
  ('Sacar basura', 5),
  ('Pasear a Tony', 10),
  ('Limpiar cocina', 15),
  ('Barrer', 10),
  ('Trapear', 15)
ON CONFLICT (name) DO NOTHING;

-- Settings (Premios Base en JSON array)
INSERT INTO public.household_settings (setting_key, setting_value) VALUES 
  ('base_rewards', '["Elegir cena", "Salida elegida por el ganador", "Masaje", "Desayuno especial", "Merienda especial"]')
ON CONFLICT (setting_key) DO NOTHING;
