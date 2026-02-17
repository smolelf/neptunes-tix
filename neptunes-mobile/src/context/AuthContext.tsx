import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      const decoded: any = jwtDecode(token);
      setUser(decoded); // This will contain { user_id, role, etc. }
    }
    setLoading(false);
  };

  const login = async (token: string) => {
    await SecureStore.setItemAsync('userToken', token);
    const decoded: any = jwtDecode(token);
    setUser(decoded);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};