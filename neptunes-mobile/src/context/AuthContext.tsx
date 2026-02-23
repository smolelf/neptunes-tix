import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  // 1. Unified Refresh Function
  const refreshUser = async () => {
    try {
      const response = await apiClient.get('/users/me');
      // response.data contains the real-time Points from Go
      setUser(response.data); 
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      // If the token is invalid, log them out
      if (error.response?.status === 401) logout();
    }
  };

  const loadStoredUser = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      // Don't just rely on the decoded token, 
      // use it to bootstrap the session, then fetch fresh data
      await refreshUser(); 
    }
    setLoading(false);
  };

  const login = async (token: string) => {
    await SecureStore.setItemAsync('userToken', token);
    // 2. Instead of just decoding, fetch the fresh user immediately
    // so the points are accurate from the very first second
    await refreshUser();
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};