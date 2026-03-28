import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// IMPORTANT: Replace this with your computer's LOCAL IP (e.g., 192.168.1.5)
export const SERVER_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

const apiClient = axios.create({
  baseURL: SERVER_BASE_URL,
  timeout: 5000, // 5 seconds
});

apiClient.interceptors.request.use(
  async (config: any) => {
    const token = await SecureStore.getItemAsync('userToken');
    
    if (token) {
      config.headers = config.headers || {};
      // Use bracket notation if TypeScript complains about the common 'Authorization' header
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;