import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const response = await apiClient.post('/auth/login', { username, password });
    return response.data;
  },
  
  register: async (username: string, email: string, password: string) => {
    const response = await apiClient.post('/auth/register', { username, email, password });
    return response.data;
  },
  
  verify: async () => {
    const response = await apiClient.get('/auth/verify');
    return response.data;
  },
};

// Server API
export const serverApi = {
  getServers: async () => {
    const response = await apiClient.get('/server/list');
    return response.data;
  },
  
  getServer: async (serverId: string) => {
    const response = await apiClient.get(`/server/${serverId}`);
    return response.data;
  },
  
  startServer: async (lobbyId: string) => {
    const response = await apiClient.post('/server/start', { lobbyId });
    return response.data;
  },
  
  stopServer: async (serverId: string) => {
    const response = await apiClient.post(`/server/${serverId}/stop`);
    return response.data;
  },
  
  kickPlayer: async (serverId: string, playerId: string) => {
    const response = await apiClient.post(`/server/${serverId}/kick/${playerId}`);
    return response.data;
  },
};

// Lobby API
export const lobbyApi = {
  createLobby: async (name: string, maxPlayers: number, isPublic: boolean) => {
    const response = await apiClient.post('/lobby/create', { name, maxPlayers, isPublic });
    return response.data;
  },
  
  getLobbies: async () => {
    const response = await apiClient.get('/lobby/list');
    return response.data;
  },
  
  joinLobby: async (lobbyId: string) => {
    const response = await apiClient.post(`/lobby/${lobbyId}/join`);
    return response.data;
  },
  
  leaveLobby: async (lobbyId: string) => {
    const response = await apiClient.post(`/lobby/${lobbyId}/leave`);
    return response.data;
  },
};

export const api = {
  ...authApi,
  ...serverApi,
  ...lobbyApi,
};
