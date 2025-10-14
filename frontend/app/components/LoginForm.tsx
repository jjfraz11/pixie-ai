"use client";

import { useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface LoginFormProps {
  className?: string;
}

export default function LoginForm({ className = "" }: LoginFormProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    loginError,
    setShowRegister,
    handleLogin,
  } = useAuth();

  const handleCreateAccount = useCallback(() => {
    setShowRegister(true);
  }, [setShowRegister]);

  return (
    <form onSubmit={handleLogin} className={`space-y-4 ${className}`}>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email
        </label>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
          Password
        </label>

        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      {loginError && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          {loginError}
        </div>
      )}

      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Login
      </button>

      <button
        type="button"
        onClick={handleCreateAccount}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
      >
        Create an account
      </button>
    </form>
  );
}
