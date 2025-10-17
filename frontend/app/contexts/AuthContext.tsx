'use client';

import { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { isEmpty } from 'lodash';

import { User } from '@/app/types/auth';
import { loginAPI, registerAPI } from '@/app/lib/api';

// Define the shape of the context data
interface AuthContextType {
  user: User | null;
  token: string | undefined;
  login: (userData: User, token: string) => void;
  logout: () => void;
  // Login form state and handlers
  loginForm: { email: string; password: string; captcha: string };
  setLoginForm: (form: { email: string; password: string; captcha: string }) => void;
  loginError: string | null;
  setLoginError: (error: string | null) => void;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  // Registration form state and handlers
  registerForm: { email: string; password: string; confirmPassword: string; captcha: string };
  setRegisterForm: (form: { email: string; password: string; confirmPassword: string; captcha: string }) => void;
  registerError: string | null;
  setRegisterError: (error: string | null) => void;
  showRegister: boolean;
  setShowRegister: (show: boolean) => void;
  handleRegister: (e: React.FormEvent) => Promise<void>;
  // User selection state
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>();

  useEffect(() => {
    if (localStorage) {
      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser !== null) {
        setToken(storedToken);
        // const userObject = JSON.parse(storedUser || '{}');
        // if (!isEmpty(userObject)) setUser(userObject);
      }
    }
  }, []);

  // Login form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '', captcha: '' });
  const [loginError, setLoginError] = useState<string | null>(null);

  // Registration form state
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', confirmPassword: '', captcha: '' });
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  // User selection state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const login = useCallback((userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('authToken', authToken); // Store token
    localStorage.setItem('user', JSON.stringify(userData)); // Store user data
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(undefined);
    localStorage.removeItem('authToken'); // Remove token
    localStorage.removeItem('user'); // Remove user data
  }, []);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);

      try {
        const data = await loginAPI({
          strategy: 'local',
          email: loginForm.email,
          password: loginForm.password,
          captcha: loginForm.captcha,
        });
        login(data.user, data.accessToken);
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'An unknown error occurred during login');
      }
    },
    [loginForm, login],
  );

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setRegisterError(null);

      // Validate password confirmation
      if (registerForm.password !== registerForm.confirmPassword) {
        setRegisterError('Passwords do not match');
        return;
      }

      try {
        const registerResponse = await registerAPI({
          email: registerForm.email,
          password: registerForm.password,
          captcha: registerForm.captcha,
          roles: ['USER'],
        });

        console.info({ registerResponse });

        // After successful registration, automatically log in the user
        // Use the loginAPI directly to avoid circular dependency
        const { user, accessToken } = await loginAPI({
          strategy: 'local',
          email: registerForm.email,
          password: registerForm.password,
          captcha: registerForm.captcha,
        });

        login(user, accessToken);
        setShowRegister(false);
      } catch (err) {
        setRegisterError(err instanceof Error ? err.message : 'An unknown error occurred during registration');
      }
    },
    [registerForm, login],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loginForm,
        setLoginForm: (form) => setLoginForm((prev) => ({ ...prev, ...form })),
        loginError,
        setLoginError,
        handleLogin,
        registerForm,
        setRegisterForm: (form) => setRegisterForm((prev) => ({ ...prev, ...form })),
        registerError,
        setRegisterError,
        showRegister,
        setShowRegister,
        selectedUser,
        setSelectedUser,
        handleRegister,
      }}
    >
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
