"use client";

import { useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface RegisterFormProps {
  className?: string;
}

export default function RegisterForm({ className = "" }: RegisterFormProps) {
  const {
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    registerError,
    setShowRegister,
    handleRegister,
  } = useAuth();

  const handleBackToLogin = useCallback(() => {
    setShowRegister(false);
  }, [setShowRegister]);

  return (
    <form onSubmit={handleRegister} className={`space-y-4 ${className}`}>
      <div>
        <label
          htmlFor="register-email"
          className="block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={registerEmail}
          onChange={(e) => setRegisterEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label
          htmlFor="register-password"
          className="block text-sm font-medium text-gray-700"
        >
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={registerPassword}
          onChange={(e) => setRegisterPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      {registerError && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          {registerError}
        </div>
      )}

      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        Register
      </button>

      <button
        type="button"
        onClick={handleBackToLogin}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
      >
        Back to Login
      </button>
    </form>
  );
}
