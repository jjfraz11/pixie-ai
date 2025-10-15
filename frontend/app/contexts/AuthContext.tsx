"use client";

import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { User } from "../types/auth";
import { loginAPI, registerAPI } from "../lib/api";

// Define the shape of the context data
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  // Login form state and handlers
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  loginError: string | null;
  setLoginError: (error: string | null) => void;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  // Registration form state and handlers
  registerEmail: string;
  setRegisterEmail: (email: string) => void;
  registerPassword: string;
  setRegisterPassword: (password: string) => void;
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
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []); // Run only once on mount

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Registration form state
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  // User selection state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const login = useCallback((userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("authToken", authToken); // Store token
    localStorage.setItem("user", JSON.stringify(userData)); // Store user data
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("authToken"); // Remove token
    localStorage.removeItem("user"); // Remove user data
  }, []);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);

      try {
        const data = await loginAPI({ strategy: "local", email, password });
        login(data.user, data.accessToken);
      } catch (err) {
        setLoginError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred during login"
        );
      }
    },
    [email, password, login]
  );

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setRegisterError(null);

      try {
        await registerAPI({
          email: registerEmail,
          password: registerPassword,
          roles: ["user"],
        });

        // After successful registration, automatically log in the user
        // Use the loginAPI directly to avoid circular dependency
        const { user, accessToken } = await loginAPI({
          strategy: "local",
          email: registerEmail,
          password: registerPassword,
        });

        login(user, accessToken);
        setShowRegister(false);
      } catch (err) {
        setRegisterError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred during registration"
        );
      }
    },
    [registerEmail, registerPassword, login]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        email,
        setEmail,
        password,
        setPassword,
        loginError,
        setLoginError,
        handleLogin,
        registerEmail,
        setRegisterEmail,
        registerPassword,
        setRegisterPassword,
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
