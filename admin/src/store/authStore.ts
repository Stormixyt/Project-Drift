import { create } from 'zustand';
import { api } from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('authToken'),
  isAuthenticated: !!localStorage.getItem('authToken'),

  login: async (username: string, password: string) => {
    const data = await api.login(username, password);
    localStorage.setItem('authToken', data.token);
    set({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('authToken');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    try {
      const data = await api.verify();
      set({ user: data.user, isAuthenticated: true });
    } catch (error) {
      localStorage.removeItem('authToken');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
