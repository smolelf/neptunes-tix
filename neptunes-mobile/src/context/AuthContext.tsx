import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null); // Added token state

  useEffect(() => {
    loadStoredUser();
  }, []);

  const refreshUser = async () => {
    if (!token) return;
    try {
      const response = await apiClient.get('/users/me');
      setUser(response.data); 
    } catch (error: any) {
      console.error("Failed to refresh user data:", error);
      if (error.response?.status === 401) logout();
    }
  };

  const loadStoredUser = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
        setToken(token);
        // 🚀 Only refresh if we actually have a token!
        await refreshUser(); 
    } else {
        console.log("Guest session: Skipping user refresh.");
    }
    setLoading(false);
};

  const login = async (newToken: string) => {
    await SecureStore.setItemAsync('userToken', newToken);
    setToken(newToken);
    await refreshUser();
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setToken(null);
    setUser(null);
  };

  // 🚀 Refined SignUp to match your Go Backend
  const signUp = async (name, email, password) => {
    try {
      // Use apiClient instead of axios to maintain config consistency
      const response = await apiClient.post('/users', { name, email, password });
      
      const { token: newToken, user: userData } = response.data;

      // 1. Save securely
      await SecureStore.setItemAsync('userToken', newToken);

      // 2. Update global state immediately
      setToken(newToken);
      setUser(userData); // This will now show those Welcome Points!
      
      return { success: true };
    } catch (e: any) {
      // Handle "Email already exists" or validation errors from Go
      const errorMsg = e.response?.data?.error || e.message;
      return { success: false, error: errorMsg };
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, signUp, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};