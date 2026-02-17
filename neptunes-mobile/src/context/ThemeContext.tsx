import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export const ThemeContext = createContext({
    isDark: false,
    colors: { 
      background: '#fff', 
      text: '#000', 
      card: '#f9f9f9',
      subText: '#8e8e93' // <--- Add this line!
    },
    toggleTheme: () => {},
  });

export const ThemeProvider = ({ children }: any) => {
  const systemTheme = useColorScheme(); // Detects phone's setting
  const [isDark, setIsDark] = useState(systemTheme === 'dark');

  const toggleTheme = () => setIsDark(!isDark);

  const colors = {
    background: isDark ? '#121212' : '#f2f2f7',
    text: isDark ? '#ffffff' : '#1c1c1e',
    card: isDark ? '#1e1e1e' : '#ffffff',
    subText: isDark ? '#a1a1a1' : '#8e8e93', // <--- And this one!
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};