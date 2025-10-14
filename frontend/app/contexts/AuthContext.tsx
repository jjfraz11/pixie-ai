'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the shape of the context data
interface AuthContextType {
  user: any; // Replace 'any' with your User type
  token: string | null;
  login: (userData: any, token: string) => void;
  logout: () => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = (userData: any, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    // In a real app, you'd also store the token in localStorage
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    // And remove the token from localStorage
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};