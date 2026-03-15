// src/context/AuthContext.tsx
import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    loadStoredUser();
  }, []);

  // 🚀 FIX 1: Accept an optional token parameter
  const refreshUser = async (activeToken?: string) => {
    // Use the passed token, or fallback to the state token
    const currentToken = activeToken || token; 
    
    if (!currentToken) return; // Now it won't fail!

    try {
      const response = await apiClient.get('/users/me');
      setUser(response.data); 
    } catch (error: any) {
      console.error("Failed to refresh user data:", error);
      if (error.response?.status === 401) logout();
    }
  };

  const loadStoredUser = async () => {
    const storedToken = await SecureStore.getItemAsync('userToken');
    if (storedToken) {
        setToken(storedToken);
        // 🚀 FIX 2: Pass the token directly
        await refreshUser(storedToken); 
    } else {
        console.log("Guest session: Skipping user refresh.");
    }
    setLoading(false);
  };

  const login = async (newToken: string) => {
    await SecureStore.setItemAsync('userToken', newToken);
    setToken(newToken);
    // 🚀 FIX 3: Pass the token directly so it doesn't read stale state!
    await refreshUser(newToken);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setToken(null);
    setUser(null);
  };

  const signUp = async (name: string, email: string, password: string) => {
    try {
      const response = await apiClient.post('/users', { name, email, password });
      const { token: newToken, user: userData } = response.data;

      await SecureStore.setItemAsync('userToken', newToken);
      setToken(newToken);
      setUser(userData); 
      
      return { success: true };
    } catch (e: any) {
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