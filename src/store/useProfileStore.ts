import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from '../types/database.types';

type ProfileState = {
  activeProfile: Profile | null;
  isLoading: boolean;
  setActiveProfile: (profile: Profile) => Promise<void>;
  loadProfile: () => Promise<void>;
  clearProfile: () => Promise<void>;
};

const PROFILE_STORAGE_KEY = '@casa_en_orden_active_profile';

export const useProfileStore = create<ProfileState>((set) => ({
  activeProfile: null,
  isLoading: true,

  setActiveProfile: async (profile: Profile) => {
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      set({ activeProfile: profile });
    } catch (error) {
      console.error('Error saving profile', error);
    }
  },

  loadProfile: async () => {
    try {
      set({ isLoading: true });
      const stored = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) {
        set({ activeProfile: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error loading profile', error);
    } finally {
      set({ isLoading: false });
    }
  },

  clearProfile: async () => {
    try {
      await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
      set({ activeProfile: null });
    } catch (error) {
      console.error('Error clearing profile', error);
    }
  }
}));
