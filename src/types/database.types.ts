export type Profile = {
  id: string; // uuid
  name: 'Elizabeth' | 'Martin';
  created_at: string; // ISO DB string
};

export type TaskType = {
  id: string; // uuid
  name: string;
  default_points: number;
  created_at: string;
};

export type TaskStatus = 'pending' | 'completed';

export type Task = {
  id: string;
  task_type_id: string;
  status: TaskStatus;
  target_date: string; // YYYY-MM-DD
  target_time: string | null; // HH:mm:ss
  notes: string | null;
  created_by_profile_id: string;
  completed_by_profile_id: string | null;
  points_awarded: number | null;
  completed_at: string | null;
  created_at: string;
};

export type TaskWithDetails = Task & {
  task_types: {
    name: string;
    default_points: number;
  };
  profiles: {
    name: string;
  } | null; // completed_by
};

export type WeeklyPointsView = {
  profile_id: string;
  profile_name: string;
  week_start: string;
  total_points: number;
};

export type WeeklyReward = {
  id: string;
  week_start_date: string; // Date of monday
  winner_profile_id: string | null;
  reward_name: string;
  is_redeemed: boolean;
  redeemed_at: string | null;
  created_at: string;
};

export type ShoppingItemStatus = 'pending' | 'resolved';

export type ShoppingItem = {
  id: string;
  name: string;
  status: ShoppingItemStatus;
  created_by_profile_id: string;
  resolved_by_profile_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type Note = {
  id: string;
  content: string;
  created_by_profile_id: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_time: string | null; // HH:mm:ss
  description: string | null;
  created_by_profile_id: string;
  created_at: string;
};

export type TonyReminderStatus = 'pending' | 'completed';
export type TonyReminderType = 'comida' | 'paseo' | 'veterinario' | 'baño' | 'vacuna' | 'remedio';

export type TonyReminder = {
  id: string;
  type: TonyReminderType;
  status: TonyReminderStatus;
  reminder_date: string;
  reminder_time: string | null;
  created_by_profile_id: string;
  completed_by_profile_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type HouseholdSetting = {
  id: string;
  setting_key: string;
  setting_value: string; // Can be JSON stringified
  updated_at: string;
};
